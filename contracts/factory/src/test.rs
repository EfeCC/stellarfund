#![cfg(test)]

use soroban_sdk::testutils::{Address as _, BytesN as _, Events as _, Ledger};
use soroban_sdk::token::StellarAssetClient;
use soroban_sdk::{symbol_short, Address, BytesN, Env, Event, String};

use crate::events;
use crate::{Error, FactoryContract, FactoryContractClient};

/// The real, compiled campaign contract — the factory deploys wasm, not a Rust
/// type, so these tests exercise the same `deploy_v2` path as testnet.
///
/// Requires `stellar contract build` to have run first; `make test` and CI both
/// do. The factory's non-test code does not reference this, so a clean build
/// never hits a chicken-and-egg problem.
mod campaign_wasm {
    soroban_sdk::contractimport!(file = "../../target/wasm32v1-none/release/campaign.wasm");
}

const GOAL: i128 = 10_000;
const DURATION: u64 = 7 * 24 * 3_600;
const START: u64 = 1_700_000_000;

struct Fixture {
    env: Env,
    factory: FactoryContractClient<'static>,
    factory_id: Address,
    token: Address,
    admin: Address,
    creator: Address,
    alice: Address,
}

impl Fixture {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|li| li.timestamp = START);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let alice = Address::generate(&env);

        let issuer = Address::generate(&env);
        let token = env.register_stellar_asset_contract_v2(issuer).address();
        StellarAssetClient::new(&env, &token).mint(&alice, &100_000);

        let wasm_hash = env.deployer().upload_contract_wasm(campaign_wasm::WASM);
        let factory_id = env.register(FactoryContract, (admin.clone(), wasm_hash));

        Self {
            factory: FactoryContractClient::new(&env, &factory_id),
            env,
            factory_id,
            token,
            admin,
            creator,
            alice,
        }
    }

    fn create(&self, title: &str) -> Address {
        self.factory.create_campaign(
            &self.creator,
            &self.token,
            &String::from_str(&self.env, title),
            &String::from_str(&self.env, "A worthy cause."),
            &GOAL,
            &DURATION,
        )
    }
}

#[test]
fn constructor_stores_the_admin_and_the_campaign_wasm_hash() {
    let f = Fixture::new();

    assert_eq!(f.factory.get_admin(), f.admin);
    assert_eq!(f.factory.get_campaign_count(), 0);
    assert_eq!(f.factory.get_wasm_hash().len(), 32);
}

/// The whole point of the factory: it deploys a *live, initialised* campaign.
#[test]
fn create_campaign_deploys_a_campaign_that_is_ready_to_use() {
    let f = Fixture::new();

    let address = f.create("Fund the Docs");
    let campaign = campaign_wasm::Client::new(&f.env, &address);
    let state = campaign.get_state();

    assert_eq!(state.creator, f.creator);
    assert_eq!(state.token, f.token);
    // The campaign knows where to report its activity.
    assert_eq!(state.factory, f.factory_id);
    assert_eq!(state.goal, GOAL);
    assert_eq!(state.deadline, START + DURATION);
    assert_eq!(state.raised, 0);
    assert_eq!(state.status, campaign_wasm::CampaignStatus::Active);
    assert_eq!(state.title, String::from_str(&f.env, "Fund the Docs"));
}

#[test]
fn create_campaign_adds_the_campaign_to_the_registry() {
    let f = Fixture::new();

    let address = f.create("Fund the Docs");

    assert_eq!(f.factory.get_campaign_count(), 1);
    assert!(f.factory.is_campaign(&address));
    assert_eq!(
        f.factory.get_campaigns(&0, &10),
        soroban_sdk::vec![&f.env, address]
    );
}

#[test]
fn create_campaign_rejects_a_non_positive_goal() {
    let f = Fixture::new();

    let result = f.factory.try_create_campaign(
        &f.creator,
        &f.token,
        &String::from_str(&f.env, "Free Money"),
        &String::from_str(&f.env, ""),
        &0,
        &DURATION,
    );

    assert_eq!(result, Err(Ok(Error::InvalidGoal)));
    assert_eq!(f.factory.get_campaign_count(), 0);
}

#[test]
fn create_campaign_rejects_a_duration_below_the_floor() {
    let f = Fixture::new();

    let result = f.factory.try_create_campaign(
        &f.creator,
        &f.token,
        &String::from_str(&f.env, "Blink"),
        &String::from_str(&f.env, ""),
        &GOAL,
        &60, // one minute
    );

    assert_eq!(result, Err(Ok(Error::InvalidDuration)));
}

#[test]
fn create_campaign_rejects_a_duration_beyond_the_ceiling() {
    let f = Fixture::new();

    let result = f.factory.try_create_campaign(
        &f.creator,
        &f.token,
        &String::from_str(&f.env, "Forever"),
        &String::from_str(&f.env, ""),
        &GOAL,
        &(400 * 24 * 3_600), // over a year
    );

    assert_eq!(result, Err(Ok(Error::InvalidDuration)));
}

#[test]
fn create_campaign_requires_the_creators_authorisation() {
    let f = Fixture::new();
    f.env.set_auths(&[]); // withdraw the blanket mock

    let result = f.factory.try_create_campaign(
        &f.creator,
        &f.token,
        &String::from_str(&f.env, "Uninvited"),
        &String::from_str(&f.env, ""),
        &GOAL,
        &DURATION,
    );

    assert!(result.is_err());
    assert_eq!(f.factory.get_campaign_count(), 0);
}

/// The deployment salt is derived from (creator, index), so a creator running a
/// second campaign does not collide with their first.
#[test]
fn one_creator_can_run_several_campaigns_at_distinct_addresses() {
    let f = Fixture::new();

    let first = f.create("Campaign One");
    let second = f.create("Campaign Two");

    assert_ne!(first, second);
    assert_eq!(f.factory.get_campaign_count(), 2);
    assert!(f.factory.is_campaign(&first));
    assert!(f.factory.is_campaign(&second));
}

#[test]
fn get_campaigns_returns_one_page_of_the_registry() {
    let f = Fixture::new();

    let first = f.create("One");
    let second = f.create("Two");
    let third = f.create("Three");

    assert_eq!(
        f.factory.get_campaigns(&0, &2),
        soroban_sdk::vec![&f.env, first, second.clone()]
    );
    assert_eq!(
        f.factory.get_campaigns(&1, &50),
        soroban_sdk::vec![&f.env, second, third]
    );
    // Reading past the end is empty, not an error.
    assert_eq!(f.factory.get_campaigns(&99, &10), soroban_sdk::vec![&f.env]);
}

#[test]
fn get_campaigns_rejects_a_page_size_it_cannot_serve() {
    let f = Fixture::new();

    assert_eq!(
        f.factory.try_get_campaigns(&0, &0),
        Err(Ok(Error::InvalidPage))
    );
    assert_eq!(
        f.factory.try_get_campaigns(&0, &51),
        Err(Ok(Error::InvalidPage))
    );
}

/// End to end across all three contracts: the factory deploys the campaign, the
/// campaign pulls tokens from the SAC, and the campaign reports back to the
/// factory — where the platform-wide feed picks it up.
#[test]
fn a_contribution_travels_all_the_way_into_the_factory_feed() {
    let f = Fixture::new();
    let address = f.create("Fund the Docs");
    let campaign = campaign_wasm::Client::new(&f.env, &address);

    campaign.contribute(&f.alice, &2_500);

    let expected = events::Activity {
        kind: symbol_short!("contrib"),
        campaign: address.clone(),
        actor: f.alice.clone(),
        amount: 2_500,
        raised: 2_500,
        timestamp: START,
    };

    assert_eq!(
        f.env.events().all().filter_by_contract(&f.factory_id),
        [expected.to_xdr(&f.env, &f.factory_id)],
    );
    assert_eq!(campaign.get_state().raised, 2_500);
}

#[test]
fn the_feed_rejects_activity_from_a_contract_the_factory_never_deployed() {
    let f = Fixture::new();
    let impostor = Address::generate(&f.env);

    let result = f.factory.try_record_activity(
        &impostor,
        &symbol_short!("contrib"),
        &f.alice,
        &1_000_000,
        &1_000_000,
    );

    assert_eq!(result, Err(Ok(Error::UnknownCampaign)));
}

#[test]
fn set_campaign_wasm_requires_the_admin() {
    let f = Fixture::new();
    let original = f.factory.get_wasm_hash();
    f.env.set_auths(&[]);

    let replacement = BytesN::random(&f.env);
    assert!(f.factory.try_set_campaign_wasm(&replacement).is_err());
    assert_eq!(f.factory.get_wasm_hash(), original);
}

#[test]
fn set_campaign_wasm_points_future_campaigns_at_the_new_code() {
    let f = Fixture::new();
    let deployed_with_old_code = f.create("Before");

    let replacement: BytesN<32> = BytesN::random(&f.env);
    f.factory.set_campaign_wasm(&replacement);

    assert_eq!(f.factory.get_wasm_hash(), replacement);
    // The campaign deployed earlier is untouched and still runs.
    let campaign = campaign_wasm::Client::new(&f.env, &deployed_with_old_code);
    assert_eq!(campaign.get_state().goal, GOAL);
}
