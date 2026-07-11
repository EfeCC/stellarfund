use soroban_sdk::{contracterror, contracttype, Address};

/// Keys used to address the factory's on-chain storage.
///
/// The registry deliberately does *not* live in a single `Vec<Address>` instance
/// entry: that entry would grow without bound and eventually blow the instance
/// size limit, bricking the factory. Instead each campaign gets its own
/// persistent entry, and clients read the registry a page at a time.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    /// Hash of the uploaded campaign wasm that `create_campaign` instantiates.
    WasmHash,
    /// Number of campaigns deployed so far; doubles as the next index.
    Count,
    /// index → campaign address
    CampaignAt(u32),
    /// campaign address → deployed by this factory?
    IsCampaign(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidGoal = 1,
    InvalidDuration = 2,
    /// `record_activity` was called by an address this factory never deployed.
    UnknownCampaign = 3,
    /// A page of the registry was requested with a zero or oversized limit.
    InvalidPage = 4,
}
