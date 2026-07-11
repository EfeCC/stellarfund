import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ActivityProvider } from '../hooks/useActivity'
import { ToastProvider } from '../hooks/useToast'
import type { ActivityEvent, EventPage } from '../services/soroban'
import { ActivityFeed } from './ActivityFeed'
import { ToastViewport } from './ToastViewport'

const { pollActivity } = vi.hoisted(() => ({ pollActivity: vi.fn() }))
vi.mock('../services/soroban', () => ({ pollActivity }))

const ALICE = 'GDD5YXT3WW6GOGGTVCTP6TXGR2B7OWKK247KYCWXRUSMOZ2TOJU73ORY'
const CAMPAIGN_A = 'CC3O752IQUHES6SSNARFCTRQSOJJWNUI7FCTGNI2STVNPTGB7OI7I2QL'
const CAMPAIGN_B = 'CDHZUBWTRT53NQKJKJCOXWKM5BITXPYYHWKLQYWQNKJMVNNXDPJT3Z57'

function event(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: '0001',
    kind: 'contrib',
    campaign: CAMPAIGN_A,
    actor: ALICE,
    amount: 250_000_000n, // 25 XLM
    raised: 250_000_000n,
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
    txHash: 'abc123',
    ledger: 100,
    ...overrides,
  }
}

function page(activity: ActivityEvent[], cursor = 'cursor-1'): EventPage {
  return { activity, cursor, latestLedger: 100 }
}

function renderFeed(campaignId?: string) {
  return render(
    <ToastProvider>
      <ActivityProvider intervalMs={10}>
        <ActivityFeed campaignId={campaignId} />
        <ToastViewport />
      </ActivityProvider>
    </ToastProvider>,
  )
}

beforeEach(() => {
  pollActivity.mockReset()
})

describe('ActivityFeed', () => {
  it('renders the activity the factory reported', async () => {
    pollActivity.mockResolvedValue(page([event()]))
    renderFeed()

    expect(await screen.findByText('25 XLM')).toBeInTheDocument()
    expect(screen.getByText('pledged')).toBeInTheDocument()
    expect(screen.getByText('GDD5…3ORY')).toBeInTheDocument()
    expect(await screen.findByText('Live')).toBeInTheDocument()
  })

  /**
   * Every campaign reports back to the factory, so one subscription covers the
   * whole platform — and a view of one campaign is a filter over that feed.
   */
  it('narrows to a single campaign when asked', async () => {
    pollActivity.mockResolvedValue(
      page([
        event({ id: '1', campaign: CAMPAIGN_A, amount: 250_000_000n }),
        event({ id: '2', campaign: CAMPAIGN_B, amount: 990_000_000n }),
      ]),
    )

    renderFeed(CAMPAIGN_A)

    expect(await screen.findByText('25 XLM')).toBeInTheDocument()
    expect(screen.queryByText('99 XLM')).not.toBeInTheDocument()
  })

  /**
   * The first poll backfills recent history. Announcing all of it would fire a
   * pile of toasts for things that happened before the user arrived.
   */
  it('does not toast the events it backfills on the first poll', async () => {
    pollActivity.mockResolvedValue(page([event()]))
    renderFeed()

    await screen.findByText('25 XLM')
    expect(screen.queryByText('New contribution')).not.toBeInTheDocument()
  })

  it('toasts activity that arrives after the feed is live', async () => {
    pollActivity
      .mockResolvedValueOnce(page([event({ id: 'seed' })]))
      .mockResolvedValue(page([event({ id: 'fresh', amount: 1_000_000_000n })], 'cursor-2'))

    renderFeed()
    await screen.findByText('25 XLM')

    expect(await screen.findByText('New contribution')).toBeInTheDocument()
    expect(await screen.findByText(/pledged 100 XLM/)).toBeInTheDocument()
  })

  it('shows each event once, however often the poll returns it', async () => {
    pollActivity.mockResolvedValue(page([event({ id: 'same' })]))
    renderFeed()

    await screen.findByText('25 XLM')
    // Let several polls go by; the cursor is mocked, so they all return the same event.
    await new Promise((resolve) => setTimeout(resolve, 60))

    expect(screen.getAllByText('25 XLM')).toHaveLength(1)
  })

  it('celebrates a goal being reached', async () => {
    pollActivity
      .mockResolvedValueOnce(page([]))
      .mockResolvedValue(page([event({ id: 'goal', kind: 'goal_met' })]))

    renderFeed()

    expect(await screen.findByText('Goal reached! 🎉')).toBeInTheDocument()
  })

  it('keeps showing what it has when the network drops, and says it is reconnecting', async () => {
    pollActivity
      .mockResolvedValueOnce(page([event()]))
      .mockRejectedValue(new Error('Failed to fetch'))

    renderFeed()
    await screen.findByText('25 XLM')

    expect(await screen.findByText('Reconnecting')).toBeInTheDocument()
    // The feed does not blank out just because a refresh failed.
    expect(screen.getByText('25 XLM')).toBeInTheDocument()
  })

  it('says so when a campaign has no activity yet', async () => {
    pollActivity.mockResolvedValue(page([]))
    renderFeed()

    expect(await screen.findByText(/nothing yet/i)).toBeInTheDocument()
  })
})
