/**
 * Smoke test against the real deployment.
 *
 * The unit tests mock the network, which proves the app handles what the RPC
 * *says* it returns. This proves the RPC actually returns it — that the contract
 * addresses in deployment.json are live, that `get_state` decodes into the shape
 * the UI renders, and that the factory's `Activity` events parse.
 *
 * Excluded from the default run because it needs the network and costs a few
 * seconds. Run it after a deploy:
 *
 *     npm run test:live
 */
import { describe, expect, it } from 'vitest'

import { config } from '../config'
import { CampaignStatus } from '../contracts/campaign'
import { listCampaigns, loadCampaign, pollActivity } from './soroban'

describe('live testnet deployment', () => {
  it('reads the campaign registry from the deployed factory', async () => {
    const campaigns = await listCampaigns()

    expect(campaigns.length).toBeGreaterThan(0)
    for (const campaign of campaigns) {
      expect(campaign.address).toMatch(/^C[A-Z2-7]{55}$/)
      expect(campaign.factory).toBe(config.factoryId)
      expect(campaign.token).toBe(config.nativeTokenId)
      expect(campaign.goal).toBeGreaterThan(0n)
      expect(CampaignStatus[campaign.status]).toBeDefined()
    }
  }, 30_000)

  it('decodes a campaign into the shape the UI renders', async () => {
    const [first] = await listCampaigns()
    const campaign = await loadCampaign(first.address)

    expect(campaign.title.length).toBeGreaterThan(0)
    expect(typeof campaign.raised).toBe('bigint')
    expect(typeof campaign.deadline).toBe('bigint')
    expect(typeof campaign.contributors).toBe('number')
  }, 30_000)

  /**
   * The one that matters: campaigns call the factory back on every state change,
   * so a contribution made to *any* campaign shows up on this single stream.
   */
  it('streams campaign activity from the factory', async () => {
    const page = await pollActivity()

    expect(page.cursor).not.toBe('')
    expect(page.latestLedger).toBeGreaterThan(0)

    const contribution = page.activity.find((event) => event.kind === 'contrib')
    expect(contribution, 'no contribution events in the retention window').toBeDefined()
    expect(contribution!.amount).toBeGreaterThan(0n)
    expect(contribution!.campaign).toMatch(/^C[A-Z2-7]{55}$/)
    expect(contribution!.txHash).toMatch(/^[0-9a-f]{64}$/)
  }, 30_000)
})
