# StellarFund

Crowdfunding on Stellar. A factory contract deploys one campaign contract per
campaign; campaigns escrow pledges in a Stellar Asset Contract and report every
state change back to the factory, which doubles as the platform's activity feed.

Full documentation lands with the frontend. For now:

```sh
make test    # build the wasm, then run the contract test suite
make lint    # rustfmt + clippy
```
