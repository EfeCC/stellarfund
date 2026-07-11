import { Link } from 'react-router-dom'

import { ActivityFeed } from '../components/ActivityFeed'
import { CampaignCard } from '../components/CampaignCard'
import { Button, CampaignCardSkeleton, EmptyState, ErrorNotice } from '../components/ui'
import { useCampaigns } from '../hooks/useCampaigns'
import { formatXlm } from '../lib/format'
import type { Campaign } from '../services/soroban'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-edge bg-surface px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{value}</p>
    </div>
  )
}

function Stats({ campaigns }: { campaigns: Campaign[] }) {
  const raised = campaigns.reduce((total, campaign) => total + campaign.raised, 0n)
  const backers = campaigns.reduce((total, campaign) => total + campaign.contributors, 0)

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Stat label="Campaigns" value={String(campaigns.length)} />
      <Stat label="Raised" value={`${formatXlm(raised)} XLM`} />
      <Stat label="Backers" value={String(backers)} />
    </div>
  )
}

export function HomePage() {
  const { data: campaigns, loading, error, reload } = useCampaigns()

  return (
    <div className="space-y-10">
      <section className="text-center sm:text-left">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Fund what matters,{' '}
          <span className="bg-gradient-to-r from-accent to-positive bg-clip-text text-transparent">
            trustlessly
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted sm:mx-0">
          Every campaign is its own Soroban contract. Pledges sit in escrow until the goal is met —
          if it isn&apos;t, anyone who backed it takes their XLM straight back. No custodian, no
          middleman.
        </p>
        <div className="mt-6 flex justify-center sm:justify-start">
          <Link to="/create">
            <Button>Start a campaign</Button>
          </Link>
        </div>
      </section>

      {campaigns && campaigns.length > 0 && <Stats campaigns={campaigns} />}

      {error && !campaigns && <ErrorNotice message={error} onRetry={reload} />}

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <section>
          <h2 className="mb-4 text-sm font-semibold text-muted">All campaigns</h2>

          {loading && !campaigns ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((card) => (
                <CampaignCardSkeleton key={card} />
              ))}
            </div>
          ) : campaigns && campaigns.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {campaigns.map((campaign) => (
                <CampaignCard key={campaign.address} campaign={campaign} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No campaigns yet"
              message="Be the first. Deploying a campaign takes one transaction and about ten seconds."
              action={
                <Link to="/create">
                  <Button>Start a campaign</Button>
                </Link>
              }
            />
          )}
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ActivityFeed />
        </aside>
      </div>
    </div>
  )
}
