#![no_std]
// The constructor genuinely takes seven parameters, and `contractimpl` generates
// a client method of the same arity — plus `env`, which clippy counts.
#![allow(clippy::too_many_arguments)]
//! # Campaign
//!
//! A single crowdfunding campaign. One contract instance per campaign, deployed
//! by the [factory](../../factory) — never by hand.
//!
//! It talks to two other contracts:
//!
//! * the **token** (a Stellar Asset Contract, e.g. native XLM) to escrow
//!   contributions and pay them out, and
//! * the **factory**, which it calls back on every state change so the platform
//!   has one place to stream activity from.

mod events;
mod hub;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contractimpl, panic_with_error, token::Client as TokenClient, Address, Env, String,
};

use types::DataKey;
pub use types::{CampaignConfig, CampaignState, CampaignStatus, Error};

const DAY_IN_LEDGERS: u32 = 17_280;

const INSTANCE_BUMP: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_IN_LEDGERS;

/// Contributions outlive the campaign itself: a contributor must still be able
/// to claim a refund long after a failed campaign stops being interesting.
const PERSISTENT_BUMP: u32 = 120 * DAY_IN_LEDGERS;
const PERSISTENT_THRESHOLD: u32 = PERSISTENT_BUMP - DAY_IN_LEDGERS;

const MAX_TITLE_LEN: u32 = 100;
const MAX_DESCRIPTION_LEN: u32 = 800;

#[contract]
pub struct CampaignContract;

#[contractimpl]
impl CampaignContract {
    /// Called by the factory as part of `deploy_v2`, in the same transaction as
    /// the deployment — a campaign can never be observed uninitialised.
    pub fn __constructor(
        env: Env,
        creator: Address,
        token: Address,
        factory: Address,
        title: String,
        description: String,
        goal: i128,
        deadline: u64,
    ) {
        if goal <= 0 {
            panic_with_error!(&env, Error::InvalidGoal);
        }
        if deadline <= env.ledger().timestamp() {
            panic_with_error!(&env, Error::InvalidDeadline);
        }
        if title.is_empty() || title.len() > MAX_TITLE_LEN {
            panic_with_error!(&env, Error::InvalidTitle);
        }
        if description.len() > MAX_DESCRIPTION_LEN {
            panic_with_error!(&env, Error::InvalidDescription);
        }

        let config = CampaignConfig {
            creator: creator.clone(),
            token,
            factory,
            title,
            description,
            goal,
            deadline,
        };

        let storage = env.storage().instance();
        storage.set(&DataKey::Config, &config);
        storage.set(&DataKey::Raised, &0i128);
        storage.set(&DataKey::Withdrawn, &false);
        storage.set(&DataKey::Contributors, &0u32);
        storage.extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);

        events::Created {
            creator,
            goal,
            deadline,
        }
        .publish(&env);
    }

    /// Pledge `amount` of the campaign's token. Funds are escrowed in this
    /// contract until the campaign resolves.
    ///
    /// Returns the campaign's new total raised.
    pub fn contribute(env: Env, from: Address, amount: i128) -> Result<i128, Error> {
        from.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let config = Self::config(&env);
        if Self::status_of(&env, &config) != CampaignStatus::Active {
            return Err(Error::CampaignNotActive);
        }

        // Inter-contract call #1: escrow the pledge in this contract.
        TokenClient::new(&env, &config.token).transfer(
            &from,
            env.current_contract_address(),
            &amount,
        );

        let previously_raised = Self::raised(&env);
        let raised = previously_raised + amount;
        env.storage().instance().set(&DataKey::Raised, &raised);

        let key = DataKey::Contribution(from.clone());
        let existing: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if existing == 0 {
            let contributors: u32 = env
                .storage()
                .instance()
                .get(&DataKey::Contributors)
                .unwrap_or(0);
            env.storage()
                .instance()
                .set(&DataKey::Contributors, &(contributors + 1));
        }
        env.storage().persistent().set(&key, &(existing + amount));
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_THRESHOLD, PERSISTENT_BUMP);

        events::Contributed {
            from: from.clone(),
            amount,
            raised,
        }
        .publish(&env);
        // Inter-contract call #2: push the pledge into the platform-wide feed.
        hub::report(
            &env,
            &config.factory,
            hub::KIND_CONTRIBUTE,
            &from,
            amount,
            raised,
        );

        // Fire only on the transition, not on every contribution past the line.
        if previously_raised < config.goal && raised >= config.goal {
            events::GoalReached {
                goal: config.goal,
                raised,
            }
            .publish(&env);
            hub::report(
                &env,
                &config.factory,
                hub::KIND_GOAL_MET,
                &config.creator,
                config.goal,
                raised,
            );
        }

        Self::bump(&env);
        Ok(raised)
    }

    /// Pay the escrowed funds out to the creator. Only once the goal is met —
    /// the deadline does not have to have passed.
    ///
    /// Returns the amount withdrawn.
    pub fn withdraw(env: Env) -> Result<i128, Error> {
        let config = Self::config(&env);
        config.creator.require_auth();

        match Self::status_of(&env, &config) {
            CampaignStatus::Withdrawn => return Err(Error::AlreadyWithdrawn),
            CampaignStatus::Successful => {}
            _ => return Err(Error::GoalNotReached),
        }

        let raised = Self::raised(&env);
        env.storage().instance().set(&DataKey::Withdrawn, &true);

        TokenClient::new(&env, &config.token).transfer(
            &env.current_contract_address(),
            &config.creator,
            &raised,
        );

        events::Withdrawn {
            creator: config.creator.clone(),
            amount: raised,
        }
        .publish(&env);
        hub::report(
            &env,
            &config.factory,
            hub::KIND_WITHDRAW,
            &config.creator,
            raised,
            raised,
        );

        Self::bump(&env);
        Ok(raised)
    }

    /// Claim back a pledge from a campaign that missed its goal.
    ///
    /// Returns the amount refunded.
    pub fn refund(env: Env, contributor: Address) -> Result<i128, Error> {
        contributor.require_auth();

        let config = Self::config(&env);
        if Self::status_of(&env, &config) != CampaignStatus::Failed {
            return Err(Error::CampaignNotFailed);
        }

        let key = DataKey::Contribution(contributor.clone());
        let amount: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if amount <= 0 {
            return Err(Error::NothingToRefund);
        }

        // Zero the balance *before* transferring; a second `refund` in the same
        // call stack would then find nothing to claim.
        env.storage().persistent().set(&key, &0i128);
        env.storage()
            .persistent()
            .extend_ttl(&key, PERSISTENT_THRESHOLD, PERSISTENT_BUMP);

        TokenClient::new(&env, &config.token).transfer(
            &env.current_contract_address(),
            &contributor,
            &amount,
        );

        events::Refunded {
            to: contributor.clone(),
            amount,
        }
        .publish(&env);
        hub::report(
            &env,
            &config.factory,
            hub::KIND_REFUND,
            &contributor,
            amount,
            Self::raised(&env),
        );

        Self::bump(&env);
        Ok(amount)
    }

    /// Everything the UI needs to render a campaign card, in one call.
    pub fn get_state(env: Env) -> CampaignState {
        let config = Self::config(&env);
        let status = Self::status_of(&env, &config);

        CampaignState {
            creator: config.creator,
            token: config.token,
            factory: config.factory,
            title: config.title,
            description: config.description,
            goal: config.goal,
            deadline: config.deadline,
            raised: Self::raised(&env),
            contributors: env
                .storage()
                .instance()
                .get(&DataKey::Contributors)
                .unwrap_or(0),
            status,
        }
    }

    /// The refundable balance of `contributor` — zero once refunded.
    pub fn get_contribution(env: Env, contributor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Contribution(contributor))
            .unwrap_or(0)
    }

    pub fn get_status(env: Env) -> CampaignStatus {
        let config = Self::config(&env);
        Self::status_of(&env, &config)
    }
}

impl CampaignContract {
    /// The status is *derived*, never stored: a stored status would go stale the
    /// moment the ledger clock crossed the deadline with nobody there to update it.
    fn status_of(env: &Env, config: &CampaignConfig) -> CampaignStatus {
        let withdrawn: bool = env
            .storage()
            .instance()
            .get(&DataKey::Withdrawn)
            .unwrap_or(false);
        if withdrawn {
            return CampaignStatus::Withdrawn;
        }

        if Self::raised(env) >= config.goal {
            return CampaignStatus::Successful;
        }

        if env.ledger().timestamp() >= config.deadline {
            return CampaignStatus::Failed;
        }

        CampaignStatus::Active
    }

    fn config(env: &Env) -> CampaignConfig {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .expect("campaign is always initialised by its constructor")
    }

    fn raised(env: &Env) -> i128 {
        env.storage().instance().get(&DataKey::Raised).unwrap_or(0)
    }

    fn bump(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
    }
}
