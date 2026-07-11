import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { explorer } from '../config'
import { formatXlm, shortenAddress } from '../lib/format'
import { pollActivity, type ActivityEvent } from '../services/soroban'
import { useToast } from './useToast'

export type FeedStatus = 'connecting' | 'live' | 'error'

interface ActivityContextValue {
  events: ActivityEvent[]
  status: FeedStatus
  /**
   * Bumped whenever new activity lands. Views that read campaign state from the
   * contract watch this and refetch, which is how a contribution made in another
   * tab — or by anyone else on the platform — shows up here without a reload.
   */
  revision: number
}

const ActivityContext = createContext<ActivityContextValue | null>(null)

const POLL_INTERVAL_MS = 5_000
const MAX_EVENTS = 60

/**
 * Streams the platform's activity from the factory contract.
 *
 * Soroban has no event push, so this polls `getEvents` with a cursor: each pass
 * asks only for what happened since the last one. One subscription covers every
 * campaign, because campaigns report their state changes back to the factory
 * rather than emitting only to themselves.
 */
export function ActivityProvider({
  children,
  intervalMs = POLL_INTERVAL_MS,
}: {
  children: ReactNode
  intervalMs?: number
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [status, setStatus] = useState<FeedStatus>('connecting')
  const [revision, setRevision] = useState(0)

  const { push } = useToast()
  const pushRef = useRef(push)
  pushRef.current = push

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    let cursor: string | undefined
    // The first pass backfills recent history. Announcing all of it would fire a
    // dozen toasts at once for things that happened before the user arrived.
    let seeded = false

    const tick = async () => {
      try {
        const page = await pollActivity(cursor)
        if (cancelled) return

        cursor = page.cursor || cursor
        setStatus('live')

        if (page.activity.length > 0) {
          // RPC returns oldest first; the feed reads newest first.
          const incoming = [...page.activity].reverse()

          setEvents((current) => {
            const seen = new Set(current.map((event) => event.id))
            const fresh = incoming.filter((event) => !seen.has(event.id))
            if (fresh.length === 0) return current
            return [...fresh, ...current].slice(0, MAX_EVENTS)
          })

          if (seeded) incoming.forEach(announce)
          setRevision((value) => value + 1)
        }

        seeded = true
      } catch (error) {
        if (cancelled) return
        console.error('activity feed poll failed', error)
        setStatus('error')
      } finally {
        if (!cancelled) timer = setTimeout(tick, intervalMs)
      }
    }

    void tick()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [intervalMs])

  function announce(event: ActivityEvent) {
    const actor = shortenAddress(event.actor)
    const amount = `${formatXlm(event.amount)} XLM`

    const copy: Record<ActivityEvent['kind'], { title: string; message: string }> = {
      contrib: { title: 'New contribution', message: `${actor} pledged ${amount}` },
      goal_met: { title: 'Goal reached! 🎉', message: `A campaign hit its ${amount} target` },
      withdraw: { title: 'Funds withdrawn', message: `${actor} withdrew ${amount}` },
      refund: { title: 'Refund claimed', message: `${actor} reclaimed ${amount}` },
    }

    pushRef.current({
      kind: event.kind === 'goal_met' ? 'success' : 'info',
      ...copy[event.kind],
      href: explorer.tx(event.txHash),
      linkLabel: 'View transaction',
    })
  }

  const value = useMemo(() => ({ events, status, revision }), [events, status, revision])

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>
}

export function useActivity(): ActivityContextValue {
  const context = useContext(ActivityContext)
  if (!context) throw new Error('useActivity must be used inside an <ActivityProvider>')
  return context
}

/** The slice of the feed belonging to one campaign. */
export function useCampaignActivity(campaignId: string): ActivityEvent[] {
  const { events } = useActivity()
  return useMemo(
    () => events.filter((event) => event.campaign === campaignId),
    [events, campaignId],
  )
}
