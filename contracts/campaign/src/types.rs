use soroban_sdk::{contracterror, contracttype, Address, String};

/// Keys used to address the campaign's on-chain storage.
///
/// `Config`, `Raised`, `Withdrawn` and `Contributors` live in instance storage so
/// that they share the contract's TTL. Individual contributions live in
/// persistent storage: they are unbounded in number and must survive
/// independently of the instance entry.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Config,
    Raised,
    Withdrawn,
    Contributors,
    Contribution(Address),
}

/// Immutable campaign parameters, written once by the constructor.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignConfig {
    pub creator: Address,
    /// Address of the token (SAC) this campaign raises funds in.
    pub token: Address,
    /// The factory that deployed this campaign; it doubles as the activity hub.
    pub factory: Address,
    pub title: String,
    pub description: String,
    pub goal: i128,
    pub deadline: u64,
}

/// Lifecycle of a campaign. Derived from storage rather than stored, so it can
/// never drift out of sync with the ledger clock.
///
/// ```text
///                     raised >= goal
///        ┌──────────────────────────────────▶ Successful ──withdraw()──▶ Withdrawn
///        │
///     Active
///        │
///        └──────────────────────────────────▶ Failed ──refund()──▶ Failed
///          now >= deadline && raised < goal
/// ```
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CampaignStatus {
    Active = 0,
    Successful = 1,
    Failed = 2,
    Withdrawn = 3,
}

/// Full campaign snapshot returned to clients in a single call, so the frontend
/// does not have to fan out into several RPC round-trips per campaign card.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignState {
    pub creator: Address,
    pub token: Address,
    pub factory: Address,
    pub title: String,
    pub description: String,
    pub goal: i128,
    pub deadline: u64,
    pub raised: i128,
    pub contributors: u32,
    pub status: CampaignStatus,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidGoal = 1,
    InvalidDeadline = 2,
    InvalidTitle = 3,
    InvalidDescription = 4,
    InvalidAmount = 5,
    /// Contributions are only accepted while the campaign is `Active`.
    CampaignNotActive = 6,
    /// `withdraw` was called before the goal was reached.
    GoalNotReached = 7,
    AlreadyWithdrawn = 8,
    /// `refund` was called on a campaign that is not `Failed`.
    CampaignNotFailed = 9,
    /// The caller has no refundable balance (never contributed, or already refunded).
    NothingToRefund = 10,
}
