//! Campaign → factory activity reporting (inter-contract call).
//!
//! The campaign cannot link against the factory crate: the factory embeds the
//! *compiled campaign wasm* in order to deploy it, so a compile-time dependency
//! the other way round would be circular. We therefore issue the call through
//! [`Env::invoke_contract`] with a hand-built argument vector.
//!
//! The factory authorises this call by requiring auth from the campaign's own
//! address, which Soroban grants automatically to the direct caller of a
//! contract-to-contract invocation. A third party cannot forge it.

use soroban_sdk::{symbol_short, vec, Address, Env, IntoVal, Symbol, Val, Vec};

/// Kinds of activity a campaign reports to the hub. Kept `symbol_short`
/// (≤ 9 chars) so they can be used as event topics without allocation.
pub const KIND_CONTRIBUTE: Symbol = symbol_short!("contrib");
pub const KIND_GOAL_MET: Symbol = symbol_short!("goal_met");
pub const KIND_WITHDRAW: Symbol = symbol_short!("withdraw");
pub const KIND_REFUND: Symbol = symbol_short!("refund");

/// Name of the factory entrypoint. Too long for `symbol_short!`.
fn record_activity_fn(env: &Env) -> Symbol {
    Symbol::new(env, "record_activity")
}

/// Report an event to the factory so it lands in the platform-wide feed.
pub fn report(
    env: &Env,
    factory: &Address,
    kind: Symbol,
    actor: &Address,
    amount: i128,
    raised: i128,
) {
    let args: Vec<Val> = vec![
        env,
        env.current_contract_address().into_val(env),
        kind.into_val(env),
        actor.into_val(env),
        amount.into_val(env),
        raised.into_val(env),
    ];

    env.invoke_contract::<()>(factory, &record_activity_fn(env), args);
}
