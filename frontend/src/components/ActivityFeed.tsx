import { explorer } from '../config'
import { useActivity, type FeedStatus } from '../hooks/useActivity'
import { formatXlm, shortenAddress, timeAgo } from '../lib/format'
import type { ActivityEvent, ActivityKind } from '../services/soroban'
import { Skeleton } from './ui'

const KIND: Record<ActivityKind, { icon: string; verb: string; className: string }> = {
  contrib: { icon: '↑', verb: 'pledged', className: 'bg-accent/15 text-accent' },
  goal_met: { icon: '★', verb: 'hit the goal —', className: 'bg-positive/15 text-positive' },
  withdraw: { icon: '↓', verb: 'withdrew', className: 'bg-positive/15 text-positive' },
  refund: { icon: '↺', verb: 'reclaimed', className: 'bg-warning/15 text-warning' },
}

function LiveIndicator({ status }: { status: FeedStatus }) {
  const label: Record<FeedStatus, string> = {
    connecting: 'Connecting',
    live: 'Live',
    error: 'Reconnecting',
  }

  const dot: Record<FeedStatus, string> = {
    connecting: 'bg-faint',
    live: 'bg-positive live-dot',
    error: 'bg-warning',
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
      <span className={`size-2 rounded-full ${dot[status]}`} aria-hidden="true" />
      {label[status]}
    </span>
  )
}

function Row({ event, showCampaign }: { event: ActivityEvent; showCampaign: boolean }) {
  const { icon, verb, className } = KIND[event.kind]

  return (
    <li className="flex items-center gap-3 py-3">
      <span
        aria-hidden="true"
        className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${className}`}
      >
        {icon}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <span className="font-medium text-ink">{shortenAddress(event.actor, 4, 4)}</span>{' '}
          <span className="text-muted">{verb}</span>{' '}
          <span className="font-semibold text-ink">{formatXlm(event.amount)} XLM</span>
        </p>
        {showCampaign && (
          <p className="address truncate text-faint">to {shortenAddress(event.campaign, 6, 4)}</p>
        )}
      </div>

      <a
        href={explorer.tx(event.txHash)}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 text-xs text-faint transition-colors hover:text-accent"
        title="View transaction"
      >
        {timeAgo(event.timestamp)}
      </a>
    </li>
  )
}

/**
 * The platform's live feed, straight from the factory's `Activity` events.
 *
 * `campaignId` narrows it to one campaign; without it, this is every campaign on
 * the platform — which is only possible because campaigns report back to the
 * factory rather than emitting in isolation.
 */
export function ActivityFeed({
  campaignId,
  title = 'Live activity',
  emptyMessage = 'Nothing yet. Contributions show up here the moment they land on-chain.',
}: {
  campaignId?: string
  title?: string
  emptyMessage?: string
}) {
  const { events, status } = useActivity()
  const visible = campaignId ? events.filter((event) => event.campaign === campaignId) : events

  return (
    <section className="rounded-xl border border-edge bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <LiveIndicator status={status} />
      </div>

      {status === 'connecting' && events.length === 0 ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-4 text-sm text-faint">{emptyMessage}</p>
      ) : (
        <ul className="mt-1 divide-y divide-edge">
          {visible.map((event) => (
            <Row key={event.id} event={event} showCampaign={!campaignId} />
          ))}
        </ul>
      )}
    </section>
  )
}
