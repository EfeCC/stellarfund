//! Events emitted by the factory.
//!
//! [`Activity`] is the important one: every campaign reports its state changes
//! here, so a client can stream the whole platform's activity by watching a
//! *single* contract id. Watching the campaigns directly does not scale — Soroban
//! RPC only accepts a handful of contract ids per `getEvents` filter, and the set
//! of campaigns grows without bound.

use soroban_sdk::{contractevent, Address, BytesN, String, Symbol};

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignCreated {
    #[topic]
    pub campaign: Address,
    #[topic]
    pub creator: Address,
    pub title: String,
    pub goal: i128,
    pub deadline: u64,
    pub index: u32,
}

/// One entry in the platform-wide live feed.
///
/// `kind` is one of the `KIND_*` symbols the campaign reports:
/// `contrib` | `goal_met` | `withdraw` | `refund`.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Activity {
    #[topic]
    pub kind: Symbol,
    #[topic]
    pub campaign: Address,
    pub actor: Address,
    pub amount: i128,
    pub raised: i128,
    pub timestamp: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WasmUpdated {
    #[topic]
    pub admin: Address,
    pub wasm_hash: BytesN<32>,
}
