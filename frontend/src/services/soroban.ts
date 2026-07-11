import { scValToNative } from '@stellar/stellar-sdk'
import { Server } from '@stellar/stellar-sdk/rpc'

import { Client as CampaignClient, type CampaignState } from '../contracts/campaign'
import { Client as FactoryClient } from '../contracts/factory'
import { config } from '../config'
import { unwrapResult } from '../lib/errors'
import type { Wallet } from './wallet'

/**
 * Simulating a read does not move any funds, but the RPC still wants a source
 * account to simulate *against*. This is the canonical all-zero account: it never
 * needs to exist, and using it means reads work before a wallet is connected.
 */
const NULL_ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'

/** The contract caps a page at 50; ask for the whole page each time. */
const PAGE_SIZE = 50

export const server = new Server(config.rpcUrl)

/**
 * A wallet-backed client can sign; a read-only one cannot. Passing the wallet is
 * what separates "show me this campaign" from "pledge 10 XLM to it", and it means
 * the app cannot accidentally build a signable transaction while logged out.
 */
function clientOptions(contractId: string, wallet?: { address: string; wallet: Wallet }) {
  return {
    contractId,
    networkPassphrase: config.networkPassphrase,
    rpcUrl: config.rpcUrl,
    allowHttp: config.rpcUrl.startsWith('http://'),
    publicKey: wallet?.address ?? NULL_ACCOUNT,
    ...(wallet && {
      signTransaction: async (xdr: string) => ({
        signedTxXdr: await wallet.wallet.signTransaction(xdr, config.networkPassphrase),
        signerAddress: wallet.address,
      }),
    }),
  }
}

export type Signer = { address: string; wallet: Wallet }

export function factory(signer?: Signer): FactoryClient {
  return new FactoryClient(clientOptions(config.factoryId, signer))
}

export function campaign(contractId: string, signer?: Signer): CampaignClient {
  return new CampaignClient(clientOptions(contractId, signer))
}

/** A campaign's on-chain state, plus the address it lives at. */
export type Campaign = CampaignState & { address: string }

/** Every campaign address in the registry, oldest first. */
export async function listCampaignAddresses(): Promise<string[]> {
  const client = factory()
  const count = (await client.get_campaign_count()).result

  const addresses: string[] = []
  for (let start = 0; start < count; start += PAGE_SIZE) {
    const page = await client.get_campaigns({ start, limit: PAGE_SIZE })
    addresses.push(...unwrapResult(page.result, 'factory'))
  }

  return addresses
}

export async function loadCampaign(address: string): Promise<Campaign> {
  const { result } = await campaign(address).get_state()
  return { ...result, address }
}

/**
 * Load every campaign, newest first — which is the order the UI wants.
 *
 * One `get_state` simulation per campaign, run concurrently. That is fine at
 * demo scale and it keeps the contract honest as the single source of truth; a
 * platform with thousands of campaigns would put an indexer in front of this.
 */
export async function listCampaigns(): Promise<Campaign[]> {
  const addresses = await listCampaignAddresses()
  const campaigns = await Promise.all(addresses.map(loadCampaign))
  return campaigns.reverse()
}

export async function contributionOf(campaignId: string, address: string): Promise<bigint> {
  const { result } = await campaign(campaignId).get_contribution({ contributor: address })
  return result
}

// --- Events ------------------------------------------------------------------

export type ActivityKind = 'contrib' | 'goal_met' | 'withdraw' | 'refund'

export interface ActivityEvent {
  /** RPC event id — stable, and unique across the whole ledger history. */
  id: string
  kind: ActivityKind
  campaign: string
  actor: string
  amount: bigint
  raised: bigint
  timestamp: bigint
  txHash: string
  ledger: number
}

export interface EventPage {
  activity: ActivityEvent[]
  /** Feed this back into the next poll to pick up exactly where we stopped. */
  cursor: string
  latestLedger: number
}

/**
 * How far back to look when seeding the feed. Soroban RPC only retains recent
 * events (about a day on testnet), so this is a "recent activity" window, not
 * history — the contract state, not the event log, is the source of truth.
 */
const SEED_LOOKBACK_LEDGERS = 8_000

/**
 * Poll the factory for activity.
 *
 * Only the *factory* is watched, never the campaigns. RPC accepts a handful of
 * contract ids per filter and campaigns are unbounded, so a per-campaign
 * subscription would fall apart as soon as the platform grew. Every campaign
 * reports its state changes back to the factory precisely so that one
 * subscription can cover all of them.
 *
 * Pass the `cursor` from the previous page to get only what is new.
 */
export async function pollActivity(cursor?: string): Promise<EventPage> {
  const filters = [{ type: 'contract' as const, contractIds: [config.factoryId] }]

  const request = cursor
    ? { filters, cursor, limit: 100 }
    : {
        filters,
        startLedger: Math.max(1, (await server.getLatestLedger()).sequence - SEED_LOOKBACK_LEDGERS),
        limit: 100,
      }

  const response = await server.getEvents(request)

  const activity = response.events
    .map(parseActivity)
    .filter((event): event is ActivityEvent => event !== null)

  return {
    activity,
    // RPC advances the cursor even on an empty page, so a quiet stretch does not
    // leave us re-scanning the same ledgers forever.
    cursor: response.cursor,
    latestLedger: response.latestLedger,
  }
}

const ACTIVITY_KINDS: ReadonlySet<string> = new Set([
  'contrib',
  'goal_met',
  'withdraw',
  'refund',
] satisfies ActivityKind[])

/**
 * The factory emits `Activity`, `CampaignCreated` and `WasmUpdated`; the feed only
 * shows the first. Returns null for the rest rather than throwing, so one
 * unexpected event never takes the whole feed down.
 */
function parseActivity(event: {
  id: string
  topic: unknown[]
  value: unknown
  txHash: string
  ledger: number
}): ActivityEvent | null {
  try {
    const topics = event.topic.map((topic) => scValToNative(topic as never))
    if (topics[0] !== 'activity') return null

    const kind = topics[1]
    if (!ACTIVITY_KINDS.has(kind)) return null

    const data = scValToNative(event.value as never) as {
      actor: string
      amount: bigint
      raised: bigint
      timestamp: bigint
    }

    return {
      id: event.id,
      kind: kind as ActivityKind,
      campaign: topics[2],
      actor: data.actor,
      amount: data.amount,
      raised: data.raised,
      timestamp: data.timestamp,
      txHash: event.txHash,
      ledger: event.ledger,
    }
  } catch {
    return null
  }
}
