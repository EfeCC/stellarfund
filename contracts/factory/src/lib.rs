#![no_std]
// `contractimport!` of the campaign wasm in the tests generates a client whose
// constructor takes seven parameters, plus `env`, which clippy counts.
#![allow(clippy::too_many_arguments)]
//! # Campaign factory
//!
//! Two jobs, and they are why this contract exists rather than letting people
//! deploy campaigns themselves:
//!
//! 1. **Deployer.** [`create_campaign`] instantiates a fresh campaign contract
//!    from an uploaded wasm hash and runs its constructor in the same host call,
//!    so a campaign is never observable in a half-built state — and every
//!    campaign on the platform is known to be running the same audited code.
//!
//! 2. **Activity hub.** Every campaign calls [`record_activity`] back on state
//!    changes, and the factory re-emits it as an [`events::Activity`] event.
//!    That gives clients a single contract id to stream the whole platform from.
//!    Watching campaigns individually does not scale: `getEvents` accepts only a
//!    handful of contract ids per filter, and campaigns are unbounded.
//!
//! [`create_campaign`]: FactoryContract::create_campaign
//! [`record_activity`]: FactoryContract::record_activity

mod events;
mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{
    contract, contractimpl, xdr::ToXdr, Address, Bytes, BytesN, Env, String, Symbol, Vec,
};

use types::DataKey;
pub use types::Error;

const DAY_IN_LEDGERS: u32 = 17_280;

const INSTANCE_BUMP: u32 = 60 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = INSTANCE_BUMP - DAY_IN_LEDGERS;

const REGISTRY_BUMP: u32 = 120 * DAY_IN_LEDGERS;
const REGISTRY_THRESHOLD: u32 = REGISTRY_BUMP - DAY_IN_LEDGERS;

/// An hour: short enough to demo a campaign that misses its deadline.
const MIN_DURATION: u64 = 3_600;
/// A year.
const MAX_DURATION: u64 = 365 * 24 * 3_600;

/// Cap on a single registry page, so a client cannot request a response large
/// enough to breach the contract's output limits.
const MAX_PAGE: u32 = 50;

#[contract]
pub struct FactoryContract;

#[contractimpl]
impl FactoryContract {
    pub fn __constructor(env: Env, admin: Address, campaign_wasm_hash: BytesN<32>) {
        let storage = env.storage().instance();
        storage.set(&DataKey::Admin, &admin);
        storage.set(&DataKey::WasmHash, &campaign_wasm_hash);
        storage.set(&DataKey::Count, &0u32);
        storage.extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);
    }

    /// Deploy a campaign contract and add it to the registry.
    ///
    /// `duration` is relative — seconds from now — rather than an absolute
    /// deadline, so a client cannot submit a deadline that has already expired by
    /// the time the transaction lands.
    ///
    /// Returns the address of the new campaign.
    pub fn create_campaign(
        env: Env,
        creator: Address,
        token: Address,
        title: String,
        description: String,
        goal: i128,
        duration: u64,
    ) -> Result<Address, Error> {
        creator.require_auth();

        if goal <= 0 {
            return Err(Error::InvalidGoal);
        }
        if !(MIN_DURATION..=MAX_DURATION).contains(&duration) {
            return Err(Error::InvalidDuration);
        }

        let deadline = env.ledger().timestamp() + duration;
        let index: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let wasm_hash: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::WasmHash)
            .expect("factory is always initialised by its constructor");

        // Deploy and construct in one host call.
        let campaign = env
            .deployer()
            .with_current_contract(Self::salt(&env, &creator, index))
            .deploy_v2(
                wasm_hash,
                (
                    creator.clone(),
                    token,
                    env.current_contract_address(),
                    title.clone(),
                    description,
                    goal,
                    deadline,
                ),
            );

        let registry = env.storage().persistent();
        registry.set(&DataKey::CampaignAt(index), &campaign);
        registry.extend_ttl(
            &DataKey::CampaignAt(index),
            REGISTRY_THRESHOLD,
            REGISTRY_BUMP,
        );
        registry.set(&DataKey::IsCampaign(campaign.clone()), &true);
        registry.extend_ttl(
            &DataKey::IsCampaign(campaign.clone()),
            REGISTRY_THRESHOLD,
            REGISTRY_BUMP,
        );

        let instance = env.storage().instance();
        instance.set(&DataKey::Count, &(index + 1));
        instance.extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);

        events::CampaignCreated {
            campaign: campaign.clone(),
            creator,
            title,
            goal,
            deadline,
            index,
        }
        .publish(&env);

        Ok(campaign)
    }

    /// Called *by a campaign* whenever its state changes; re-emitted here as an
    /// [`events::Activity`] event so the whole platform has one feed.
    ///
    /// The `require_auth` below is what makes that feed trustworthy. Soroban
    /// grants a contract authorisation over its own address for the calls it
    /// makes, so a genuine campaign passes. An external account trying to inject
    /// a fake contribution cannot produce that authorisation, and the registry
    /// check rejects any contract this factory did not deploy.
    pub fn record_activity(
        env: Env,
        campaign: Address,
        kind: Symbol,
        actor: Address,
        amount: i128,
        raised: i128,
    ) -> Result<(), Error> {
        campaign.require_auth();

        if !Self::is_campaign(env.clone(), campaign.clone()) {
            return Err(Error::UnknownCampaign);
        }

        events::Activity {
            kind,
            campaign,
            actor,
            amount,
            raised,
            timestamp: env.ledger().timestamp(),
        }
        .publish(&env);

        Ok(())
    }

    /// A page of the campaign registry, oldest first.
    pub fn get_campaigns(env: Env, start: u32, limit: u32) -> Result<Vec<Address>, Error> {
        if limit == 0 || limit > MAX_PAGE {
            return Err(Error::InvalidPage);
        }

        let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let end = start.saturating_add(limit).min(count);

        let mut page = Vec::new(&env);
        for index in start..end {
            if let Some(campaign) = env
                .storage()
                .persistent()
                .get::<_, Address>(&DataKey::CampaignAt(index))
            {
                page.push_back(campaign);
            }
        }

        Ok(page)
    }

    pub fn get_campaign_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }

    pub fn is_campaign(env: Env, campaign: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::IsCampaign(campaign))
            .unwrap_or(false)
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("factory is always initialised by its constructor")
    }

    pub fn get_wasm_hash(env: Env) -> BytesN<32> {
        env.storage()
            .instance()
            .get(&DataKey::WasmHash)
            .expect("factory is always initialised by its constructor")
    }

    /// Point the factory at a new campaign implementation. Campaigns already
    /// deployed keep running the code they were deployed with; this only affects
    /// campaigns created from here on.
    pub fn set_campaign_wasm(env: Env, wasm_hash: BytesN<32>) {
        let admin = Self::get_admin(env.clone());
        admin.require_auth();

        let instance = env.storage().instance();
        instance.set(&DataKey::WasmHash, &wasm_hash);
        instance.extend_ttl(INSTANCE_THRESHOLD, INSTANCE_BUMP);

        events::WasmUpdated { admin, wasm_hash }.publish(&env);
    }

    /// Upgrade the factory itself.
    pub fn upgrade(env: Env, wasm_hash: BytesN<32>) {
        Self::get_admin(env.clone()).require_auth();
        env.deployer().update_current_contract_wasm(wasm_hash);
    }
}

impl FactoryContract {
    /// Deterministic in (creator, index): two campaigns can never collide on a
    /// salt, and a creator can precompute the address of their next campaign.
    fn salt(env: &Env, creator: &Address, index: u32) -> BytesN<32> {
        let mut seed = Bytes::new(env);
        seed.append(&creator.to_xdr(env));
        seed.extend_from_array(&index.to_be_bytes());

        env.crypto().sha256(&seed).to_bytes()
    }
}
