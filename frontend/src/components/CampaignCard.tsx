import { Link } from 'react-router-dom'

import { CampaignStatus } from '../contracts/campaign'
import type { Campaign } from '../services/soroban'
import { formatXlm, progressPercent, shortenAddress, timeRemaining } from '../lib/format'
import { ProgressBar, StatusBadge } from './ui'

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const percent = Math.round(progressPercent(campaign.raised, campaign.goal))
  const live = campaign.status === CampaignStatus.Active

  return (
    <Link
      to={`/campaign/${campaign.address}`}
      className="group flex flex-col rounded-xl border border-edge bg-surface p-5 transition-colors hover:border-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 font-semibold text-ink transition-colors group-hover:text-accent">
          {campaign.title}
        </h3>
        <StatusBadge status={campaign.status} />
      </div>

      <p className="mt-2 line-clamp-2 min-h-10 text-sm text-muted">{campaign.description}</p>

      <div className="mt-5">
        <ProgressBar raised={campaign.raised} goal={campaign.goal} />

        <div className="mt-3 flex items-baseline justify-between gap-2">
          <p className="text-sm">
            <span className="font-semibold text-ink">{formatXlm(campaign.raised)}</span>
            <span className="text-faint"> / {formatXlm(campaign.goal)} XLM</span>
          </p>
          <p className="text-sm font-semibold text-accent">{percent}%</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-edge pt-3 text-xs text-faint">
        <span title={campaign.creator}>by {shortenAddress(campaign.creator, 4, 4)}</span>
        <span>
          {live ? timeRemaining(campaign.deadline) : `${campaign.contributors} backers`}
        </span>
      </div>
    </Link>
  )
}
