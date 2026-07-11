//! Events emitted by a campaign.
//!
//! Every campaign is its own contract, and Soroban RPC caps a `getEvents` filter
//! at a handful of contract ids — so a client cannot subscribe to "all
//! campaigns" by listening to the campaign contracts directly. These events are
//! the *local* record, useful when inspecting one campaign. The platform-wide
//! live feed is served by the factory's activity hub (see [`crate::hub`]), which
//! every campaign calls into.
//!
//! Declared with `#[contractevent]` so they land in the contract spec and show
//! up as typed events in the generated TypeScript bindings.

use soroban_sdk::{contractevent, Address};

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Created {
    #[topic]
    pub creator: Address,
    pub goal: i128,
    pub deadline: u64,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Contributed {
    #[topic]
    pub from: Address,
    pub amount: i128,
    pub raised: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GoalReached {
    pub goal: i128,
    pub raised: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Withdrawn {
    #[topic]
    pub creator: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Refunded {
    #[topic]
    pub to: Address,
    pub amount: i128,
}
