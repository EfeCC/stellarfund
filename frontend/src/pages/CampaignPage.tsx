import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ActivityFeed } from '../components/ActivityFeed'
import { Button, ErrorNotice, ProgressBar, Skeleton, StatusBadge } from '../components/ui'
import { explorer } from '../config'
import { CampaignStatus } from '../contracts/campaign'
import { useCampaign } from '../hooks/useCampaigns'
import { useToast } from '../hooks/useToast'
import { useWallet } from '../hooks/useWallet'
import {
  formatDate,
  formatXlm,
  progressPercent,
  shortenAddress,
  timeRemaining,
  xlmToStroops,
} from '../lib/format'
import type { Campaign } from '../services/soroban'
import { contribute, refund, withdraw } from '../services/transactions'

function ContributeForm({ campaign, onDone }: { campaign: Campaign; onDone: () => void }) {
  const { signer, connect, connecting, installed } = useWallet()
  const { push } = useToast()

  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validate before we ever build a transaction: a bad amount should cost the
  // user a glance, not a simulation round-trip.
  const invalid = amount.trim() !== '' && !/^\d+(\.\d{1,7})?$/.test(amount.trim())
  const empty = amount.trim() === '' || Number(amount) === 0

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!signer || invalid || empty) return

    setSubmitting(true)
    setError(null)
    try {
      const { hash } = await contribute(signer, campaign.address, xlmToStroops(amount))
      push({
        kind: 'success',
        title: 'Contribution confirmed',
        message: `You pledged ${amount} XLM to "${campaign.title}".`,
        href: explorer.tx(hash),
        linkLabel: 'View transaction',
      })
      setAmount('')
      onDone()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSubmitting(false)
    }
  }

  if (!installed) {
    return (
      <p className="text-sm text-muted">
        <a
          href="https://www.freighter.app/"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-accent hover:underline"
        >
          Install Freighter
        </a>{' '}
        to back this campaign.
      </p>
    )
  }

  if (!signer) {
    return (
      <Button className="w-full" onClick={() => void connect()} loading={connecting}>
        Connect wallet to contribute
      </Button>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label htmlFor="amount" className="block text-sm font-medium text-muted">
        Amount
      </label>

      <div className="flex rounded-lg border border-edge bg-canvas focus-within:border-accent">
        <input
          id="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          aria-invalid={invalid}
          aria-describedby={invalid ? 'amount-error' : undefined}
          className="w-full bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-faint"
        />
        <span className="grid place-items-center px-3 text-sm font-semibold text-faint">XLM</span>
      </div>

      {invalid && (
        <p id="amount-error" className="text-xs text-negative">
          Enter a number with up to 7 decimal places.
        </p>
      )}

      <Button type="submit" className="w-full" loading={submitting} disabled={invalid || empty}>
        {submitting ? 'Confirming…' : 'Contribute'}
      </Button>

      {error && <ErrorNotice message={error} />}
    </form>
  )
}

function CreatorActions({ campaign, onDone }: { campaign: Campaign; onDone: () => void }) {
  const { signer } = useWallet()
  const { push } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!signer || signer.address !== campaign.creator) return null
  if (campaign.status !== CampaignStatus.Successful) return null

  async function onWithdraw() {
    if (!signer) return
    setSubmitting(true)
    setError(null)
    try {
      const { value, hash } = await withdraw(signer, campaign.address)
      push({
        kind: 'success',
        title: 'Funds withdrawn',
        message: `${formatXlm(value)} XLM is on its way to your wallet.`,
        href: explorer.tx(hash),
        linkLabel: 'View transaction',
      })
      onDone()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-positive/40 bg-positive/10 p-4">
      <p className="text-sm text-ink">
        This campaign hit its goal. As the creator, you can withdraw the{' '}
        <strong>{formatXlm(campaign.raised)} XLM</strong> raised.
      </p>
      <Button className="w-full" loading={submitting} onClick={() => void onWithdraw()}>
        Withdraw {formatXlm(campaign.raised)} XLM
      </Button>
      {error && <ErrorNotice message={error} />}
    </div>
  )
}

function RefundAction({
  campaign,
  myContribution,
  onDone,
}: {
  campaign: Campaign
  myContribution: bigint
  onDone: () => void
}) {
  const { signer } = useWallet()
  const { push } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!signer || campaign.status !== CampaignStatus.Failed || myContribution <= 0n) return null

  async function onRefund() {
    if (!signer) return
    setSubmitting(true)
    setError(null)
    try {
      const { value, hash } = await refund(signer, campaign.address)
      push({
        kind: 'success',
        title: 'Refund claimed',
        message: `${formatXlm(value)} XLM is back in your wallet.`,
        href: explorer.tx(hash),
        linkLabel: 'View transaction',
      })
      onDone()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
      <p className="text-sm text-ink">
        This campaign closed without reaching its goal. Your{' '}
        <strong>{formatXlm(myContribution)} XLM</strong> is waiting to be claimed.
      </p>
      <Button variant="secondary" className="w-full" loading={submitting} onClick={() => void onRefund()}>
        Claim {formatXlm(myContribution)} XLM refund
      </Button>
      {error && <ErrorNotice message={error} />}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

export function CampaignPage() {
  const { id = '' } = useParams()
  const { data: campaign, loading, error, reload, myContribution } = useCampaign(id)

  if (loading && !campaign) return <DetailSkeleton />

  if (!campaign) {
    return (
      <div className="space-y-6">
        <ErrorNotice message={error ?? 'That campaign could not be loaded.'} onRetry={reload} />
        <Link to="/" className="text-sm font-semibold text-accent hover:underline">
          ← Back to all campaigns
        </Link>
      </div>
    )
  }

  const percent = Math.round(progressPercent(campaign.raised, campaign.goal))
  const active = campaign.status === CampaignStatus.Active

  return (
    <div className="space-y-8">
      <Link to="/" className="inline-block text-sm font-semibold text-muted hover:text-ink">
        ← All campaigns
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <header className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{campaign.title}</h1>
              <StatusBadge status={campaign.status} />
            </div>

            <p className="whitespace-pre-line text-muted">{campaign.description}</p>

            <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-faint">
              <div className="flex gap-1.5">
                <dt>Creator</dt>
                <dd>
                  <a
                    href={explorer.account(campaign.creator)}
                    target="_blank"
                    rel="noreferrer"
                    className="address text-muted hover:text-accent"
                  >
                    {shortenAddress(campaign.creator)}
                  </a>
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Contract</dt>
                <dd>
                  <a
                    href={explorer.contract(campaign.address)}
                    target="_blank"
                    rel="noreferrer"
                    className="address text-muted hover:text-accent"
                  >
                    {shortenAddress(campaign.address)}
                  </a>
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Deadline</dt>
                <dd className="text-muted">{formatDate(campaign.deadline)}</dd>
              </div>
            </dl>
          </header>

          <section className="rounded-xl border border-edge bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-2xl font-bold tabular-nums">
                {formatXlm(campaign.raised)}{' '}
                <span className="text-base font-medium text-faint">
                  / {formatXlm(campaign.goal)} XLM
                </span>
              </p>
              <p className="text-sm font-semibold text-accent">{percent}% funded</p>
            </div>

            <div className="mt-4">
              <ProgressBar raised={campaign.raised} goal={campaign.goal} />
            </div>

            <div className="mt-4 flex justify-between text-sm text-muted">
              <span>
                {campaign.contributors} {campaign.contributors === 1 ? 'backer' : 'backers'}
              </span>
              <span>{active ? timeRemaining(campaign.deadline) : 'Ended'}</span>
            </div>
          </section>

          <ActivityFeed
            campaignId={campaign.address}
            title="Campaign activity"
            emptyMessage="No contributions to this campaign yet."
          />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-edge bg-surface p-5">
            {active ? (
              <ContributeForm campaign={campaign} onDone={reload} />
            ) : (
              <p className="text-sm text-muted">
                This campaign is closed to new contributions.
              </p>
            )}
          </div>

          <CreatorActions campaign={campaign} onDone={reload} />
          <RefundAction campaign={campaign} myContribution={myContribution} onDone={reload} />

          {myContribution > 0n && campaign.status !== CampaignStatus.Failed && (
            <p className="rounded-lg border border-edge bg-surface px-4 py-3 text-sm text-muted">
              You have pledged{' '}
              <strong className="text-ink">{formatXlm(myContribution)} XLM</strong> to this campaign.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
