#![cfg(test)]

use soroban_sdk::testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke};
use soroban_sdk::token::{Client as TokenClient, StellarAssetClient};
use soroban_sdk::{
    contract, contractimpl, symbol_short, vec, Address, Env, IntoVal, String, Symbol, Val, Vec,
};

use crate::{CampaignContract, CampaignContractClient, CampaignStatus, Error};

/// Stand-in for the factory's activity hub.
///
/// It reproduces the part of the factory that campaigns depend on — including
/// `campaign.require_auth()` — so these tests exercise the real authorisation
/// path of the callback rather than a stub that waves it through.
#[contract]
pub struct MockHub;

#[contractimpl]
impl MockHub {
    pub fn record_activity(
        env: Env,
        campaign: Address,
        kind: Symbol,
        actor: Address,
        amount: i128,
        raised: i128,
    ) {
        campaign.require_auth();

        let key = symbol_short!("log");
        let mut log: Vec<Val> = env.storage().instance().get(&key).unwrap_or(Vec::new(&env));
        log.push_back((kind, actor, amount, raised).into_val(&env));
        env.storage().instance().set(&key, &log);
    }

    pub fn log(env: Env) -> Vec<Val> {
        env.storage()
            .instance()
            .get(&symbol_short!("log"))
            .unwrap_or(Vec::new(&env))
    }
}

const GOAL: i128 = 1_000;
const DEADLINE: u64 = 10_000;
const START: u64 = 1_000;

struct Fixture {
    env: Env,
    campaign: CampaignContractClient<'static>,
    hub: MockHubClient<'static>,
    token: TokenClient<'static>,
    creator: Address,
    alice: Address,
    bob: Address,
}

impl Fixture {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|li| li.timestamp = START);

        let creator = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        let issuer = Address::generate(&env);
        let asset = env.register_stellar_asset_contract_v2(issuer);
        let token_address = asset.address();
        let minter = StellarAssetClient::new(&env, &token_address);
        minter.mint(&alice, &10_000);
        minter.mint(&bob, &10_000);

        let hub_id = env.register(MockHub, ());

        let campaign_id = env.register(
            CampaignContract,
            (
                creator.clone(),
                token_address.clone(),
                hub_id.clone(),
                String::from_str(&env, "Open Source Fund"),
                String::from_str(&env, "Keeping the lights on."),
                GOAL,
                DEADLINE,
            ),
        );

        Self {
            campaign: CampaignContractClient::new(&env, &campaign_id),
            hub: MockHubClient::new(&env, &hub_id),
            token: TokenClient::new(&env, &token_address),
            env,
            creator,
            alice,
            bob,
        }
    }

    fn pass_deadline(&self) {
        self.env.ledger().with_mut(|li| li.timestamp = DEADLINE + 1);
    }
}

#[test]
fn constructor_seeds_an_active_campaign() {
    let f = Fixture::new();
    let state = f.campaign.get_state();

    assert_eq!(state.creator, f.creator);
    assert_eq!(state.goal, GOAL);
    assert_eq!(state.deadline, DEADLINE);
    assert_eq!(state.raised, 0);
    assert_eq!(state.contributors, 0);
    assert_eq!(state.status, CampaignStatus::Active);
    assert_eq!(state.title, String::from_str(&f.env, "Open Source Fund"));
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // Error::InvalidGoal
fn constructor_rejects_a_non_positive_goal() {
    let env = Env::default();
    env.ledger().with_mut(|li| li.timestamp = START);
    let who = Address::generate(&env);

    env.register(
        CampaignContract,
        (
            who.clone(),
            who.clone(),
            who.clone(),
            String::from_str(&env, "Bad"),
            String::from_str(&env, ""),
            0i128,
            DEADLINE,
        ),
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")] // Error::InvalidDeadline
fn constructor_rejects_a_deadline_in_the_past() {
    let env = Env::default();
    env.ledger().with_mut(|li| li.timestamp = START);
    let who = Address::generate(&env);

    env.register(
        CampaignContract,
        (
            who.clone(),
            who.clone(),
            who.clone(),
            String::from_str(&env, "Bad"),
            String::from_str(&env, ""),
            GOAL,
            START - 1,
        ),
    );
}

#[test]
fn contribute_escrows_the_tokens_in_the_campaign() {
    let f = Fixture::new();

    let raised = f.campaign.contribute(&f.alice, &400);

    assert_eq!(raised, 400);
    assert_eq!(f.token.balance(&f.alice), 9_600);
    assert_eq!(f.token.balance(&f.campaign.address), 400);
    assert_eq!(f.campaign.get_contribution(&f.alice), 400);

    let state = f.campaign.get_state();
    assert_eq!(state.raised, 400);
    assert_eq!(state.contributors, 1);
    assert_eq!(state.status, CampaignStatus::Active);
}

#[test]
fn repeat_contributions_accumulate_without_double_counting_the_contributor() {
    let f = Fixture::new();

    f.campaign.contribute(&f.alice, &100);
    f.campaign.contribute(&f.alice, &150);
    f.campaign.contribute(&f.bob, &50);

    assert_eq!(f.campaign.get_contribution(&f.alice), 250);
    assert_eq!(f.campaign.get_contribution(&f.bob), 50);

    let state = f.campaign.get_state();
    assert_eq!(state.raised, 300);
    assert_eq!(state.contributors, 2);
}

#[test]
fn contribute_rejects_a_non_positive_amount() {
    let f = Fixture::new();

    assert_eq!(
        f.campaign.try_contribute(&f.alice, &0),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        f.campaign.try_contribute(&f.alice, &-1),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn contribute_is_rejected_once_the_deadline_has_passed() {
    let f = Fixture::new();
    f.pass_deadline();

    assert_eq!(
        f.campaign.try_contribute(&f.alice, &100),
        Err(Ok(Error::CampaignNotActive))
    );
    assert_eq!(f.token.balance(&f.alice), 10_000);
}

#[test]
fn contribute_requires_the_contributors_authorisation() {
    let f = Fixture::new();
    f.env.set_auths(&[]); // withdraw the blanket mock

    assert!(f.campaign.try_contribute(&f.alice, &100).is_err());
    assert_eq!(f.token.balance(&f.campaign.address), 0);
}

#[test]
fn reaching_the_goal_flips_the_status_to_successful() {
    let f = Fixture::new();

    f.campaign.contribute(&f.alice, &600);
    assert_eq!(f.campaign.get_status(), CampaignStatus::Active);

    f.campaign.contribute(&f.bob, &400);
    assert_eq!(f.campaign.get_status(), CampaignStatus::Successful);
}

/// The campaign reports every state change to the factory, which is what makes a
/// single platform-wide event stream possible.
#[test]
fn every_state_change_is_reported_to_the_activity_hub() {
    let f = Fixture::new();

    f.campaign.contribute(&f.alice, &1_000); // crosses the goal in one go
    f.campaign.withdraw();

    let log = f.hub.log();
    assert_eq!(log.len(), 3);

    let mut kinds: Vec<Symbol> = Vec::new(&f.env);
    for entry in log.iter() {
        let (kind, _, _, _): (Symbol, Address, i128, i128) = entry.into_val(&f.env);
        kinds.push_back(kind);
    }

    assert_eq!(
        kinds,
        vec![
            &f.env,
            symbol_short!("contrib"),
            symbol_short!("goal_met"),
            symbol_short!("withdraw"),
        ]
    );
}

/// The hub authorises the callback with `campaign.require_auth()`. Nothing in
/// this test mocks that authorisation — it succeeds only because Soroban grants
/// it implicitly to the direct caller of a contract-to-contract call.
#[test]
fn the_hub_callback_is_authorised_by_the_calling_contract_alone() {
    let f = Fixture::new();

    // Authorise exactly what Alice signs for: the `contribute` call and the
    // token transfer nested inside it — and nothing else.
    f.env.mock_auths(&[MockAuth {
        address: &f.alice,
        invoke: &MockAuthInvoke {
            contract: &f.campaign.address,
            fn_name: "contribute",
            args: (f.alice.clone(), 250i128).into_val(&f.env),
            sub_invokes: &[MockAuthInvoke {
                contract: &f.token.address,
                fn_name: "transfer",
                args: (f.alice.clone(), f.campaign.address.clone(), 250i128).into_val(&f.env),
                sub_invokes: &[],
            }],
        },
    }]);

    assert_eq!(f.campaign.contribute(&f.alice, &250), 250);
    assert_eq!(f.hub.log().len(), 1);
}

/// A third party cannot forge activity: the hub demands the campaign's own
/// authorisation, which no external account can produce.
#[test]
fn the_hub_rejects_activity_forged_by_a_third_party() {
    let f = Fixture::new();
    f.env.set_auths(&[]);

    let forged = f.hub.try_record_activity(
        &f.campaign.address,
        &symbol_short!("contrib"),
        &f.alice,
        &1_000_000,
        &1_000_000,
    );

    assert!(forged.is_err());
    assert_eq!(f.hub.log().len(), 0);
}

#[test]
fn withdraw_pays_the_creator_once_the_goal_is_met() {
    let f = Fixture::new();
    f.campaign.contribute(&f.alice, &700);
    f.campaign.contribute(&f.bob, &300);

    let withdrawn = f.campaign.withdraw();

    assert_eq!(withdrawn, 1_000);
    assert_eq!(f.token.balance(&f.creator), 1_000);
    assert_eq!(f.token.balance(&f.campaign.address), 0);
    assert_eq!(f.campaign.get_status(), CampaignStatus::Withdrawn);
}

#[test]
fn withdraw_is_rejected_while_the_goal_is_out_of_reach() {
    let f = Fixture::new();
    f.campaign.contribute(&f.alice, &999);

    assert_eq!(f.campaign.try_withdraw(), Err(Ok(Error::GoalNotReached)));
    assert_eq!(f.token.balance(&f.campaign.address), 999);
}

#[test]
fn withdraw_cannot_be_replayed() {
    let f = Fixture::new();
    f.campaign.contribute(&f.alice, &1_000);
    f.campaign.withdraw();

    assert_eq!(f.campaign.try_withdraw(), Err(Ok(Error::AlreadyWithdrawn)));
    assert_eq!(f.token.balance(&f.creator), 1_000);
}

#[test]
fn withdraw_is_rejected_for_anyone_but_the_creator() {
    let f = Fixture::new();
    f.campaign.contribute(&f.alice, &1_000);

    // Alice authorises the withdrawal, but she is not the creator.
    f.env.mock_auths(&[MockAuth {
        address: &f.alice,
        invoke: &MockAuthInvoke {
            contract: &f.campaign.address,
            fn_name: "withdraw",
            args: vec![&f.env],
            sub_invokes: &[],
        },
    }]);

    assert!(f.campaign.try_withdraw().is_err());
    assert_eq!(f.token.balance(&f.creator), 0);
}

#[test]
fn refund_returns_the_pledge_after_a_failed_campaign() {
    let f = Fixture::new();
    f.campaign.contribute(&f.alice, &300);
    f.campaign.contribute(&f.bob, &200);
    f.pass_deadline();

    assert_eq!(f.campaign.get_status(), CampaignStatus::Failed);
    assert_eq!(f.campaign.refund(&f.alice), 300);

    assert_eq!(f.token.balance(&f.alice), 10_000);
    assert_eq!(f.campaign.get_contribution(&f.alice), 0);
    // Bob has not claimed yet, so his pledge is still escrowed.
    assert_eq!(f.token.balance(&f.campaign.address), 200);
}

#[test]
fn refund_is_rejected_while_the_campaign_can_still_succeed() {
    let f = Fixture::new();
    f.campaign.contribute(&f.alice, &300);

    assert_eq!(
        f.campaign.try_refund(&f.alice),
        Err(Ok(Error::CampaignNotFailed))
    );
}

#[test]
fn refund_is_rejected_on_a_campaign_that_met_its_goal() {
    let f = Fixture::new();
    f.campaign.contribute(&f.alice, &1_000);
    f.pass_deadline();

    assert_eq!(
        f.campaign.try_refund(&f.alice),
        Err(Ok(Error::CampaignNotFailed))
    );
}

#[test]
fn refund_cannot_be_claimed_twice() {
    let f = Fixture::new();
    f.campaign.contribute(&f.alice, &300);
    f.pass_deadline();
    f.campaign.refund(&f.alice);

    assert_eq!(
        f.campaign.try_refund(&f.alice),
        Err(Ok(Error::NothingToRefund))
    );
    assert_eq!(f.token.balance(&f.alice), 10_000);
}

#[test]
fn refund_is_rejected_for_someone_who_never_contributed() {
    let f = Fixture::new();
    f.campaign.contribute(&f.alice, &300);
    f.pass_deadline();

    assert_eq!(
        f.campaign.try_refund(&f.bob),
        Err(Ok(Error::NothingToRefund))
    );
}
