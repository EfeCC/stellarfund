# Demo video — storyboard

Target: **90 seconds.** Judges watch a lot of these; the goal is that by second 20 they already know
what makes this different, and the rest is proof.

Record at 1440×900 with Freighter installed and pointed at **testnet**. Have two accounts: the
creator and a backer.

Before you hit record: open the app, open [stellar.expert testnet](https://stellar.expert/explorer/testnet),
and have a second browser window ready. Contributions cost real testnet XLM — fund both accounts from
friendbot first.

---

### 0:00–0:15 — The claim

> "StellarFund is crowdfunding where the escrow *is* the contract. Every campaign you see here is its
> own Soroban contract, deployed by a factory. Pledges sit in escrow until the goal is met — and if it
> isn't, every backer takes their money back. Nobody can do anything else with it, including me."

Show the home page. Four campaigns, the stats row, the live feed ticking on the right.

### 0:15–0:35 — Deploying a campaign is a contract deployment

Click **Start a campaign**, fill it in, hit **Deploy campaign**. Sign in Freighter.

> "Creating a campaign doesn't write a row in a database. The factory deploys a new contract and runs
> its constructor in the same transaction."

When it lands, click through the toast to stellar.expert and show the **`campaign_created` event and
the new contract address**. Point at the address bar: the page URL *is* the contract address.

### 0:35–1:00 — The live feed, and why it exists

Switch to the second window, connected as the backer. Contribute to the campaign.

Cut back to the first window **without touching it** — the contribution appears in the feed and as a
toast, and the progress bar moves. No reload.

> "That's the interesting part. Every campaign is a separate contract, and Soroban RPC only lets you
> watch a handful of contracts at once — so you *can't* subscribe to 'all campaigns'. Instead every
> campaign calls the factory back on each state change, and the factory re-emits it. One contract to
> stream the whole platform from."

If you can, show the transaction on stellar.expert: **three events in one transaction** — the token's
`transfer`, the campaign's `Contributed`, and the factory's `activity`.

### 1:00–1:20 — Money comes back out

Contribute enough to cross the goal. The status flips to **Goal reached**, the bar turns green, a
"Goal reached 🎉" toast fires.

As the creator, hit **Withdraw**.

> "Goal met, so the creator can withdraw. If the deadline had passed without the goal, this button
> would be a refund button for every backer instead — and the contract wouldn't let me near the money."

*(Optional, if the Testnet Faucet Rescue campaign has expired: open it and show the refund flow. It has
a 1-hour deadline for exactly this.)*

### 1:20–1:30 — It's real

Fast cuts, no narration needed:

- `cargo test` → 35 passing
- `npm run test:run` → 49 passing
- The green CI run on GitHub
- The app on a phone-sized window

> "84 tests, CI on every push, deployed on testnet. Links in the description."

---

## Checklist before uploading

- [ ] Freighter is on **testnet** (a mainnet prompt on camera is a bad look)
- [ ] No secret keys, seed phrases, or the Freighter unlock screen on camera
- [ ] Both accounts funded, so nothing fails mid-take
- [ ] 1080p, under 2 minutes
- [ ] The description carries: repo link, live demo link, factory contract address
- [ ] Add the video link to the README's header
