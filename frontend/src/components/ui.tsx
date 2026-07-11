import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { CampaignStatus } from '../contracts/campaign'
import { progressPercent } from '../lib/format'

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  /** Swaps the label for a spinner and disables the button, so a double-tap cannot double-submit. */
  loading?: boolean
  children: ReactNode
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-accent text-canvas hover:bg-accent-strong hover:text-ink',
  secondary: 'bg-raised text-ink hover:bg-edge border border-edge',
  ghost: 'text-muted hover:text-ink hover:bg-surface',
  danger: 'bg-negative/15 text-negative border border-negative/40 hover:bg-negative/25',
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold
        transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
        disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export function ProgressBar({ raised, goal }: { raised: bigint; goal: bigint }) {
  const percent = progressPercent(raised, goal)
  const complete = percent >= 100

  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-raised"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Funding progress"
    >
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out ${
          complete ? 'bg-positive' : 'bg-accent'
        }`}
        style={{ width: `${Math.max(percent, percent > 0 ? 2 : 0)}%` }}
      />
    </div>
  )
}

const STATUS_STYLES: Record<CampaignStatus, { label: string; className: string }> = {
  [CampaignStatus.Active]: { label: 'Active', className: 'bg-accent/15 text-accent' },
  [CampaignStatus.Successful]: {
    label: 'Goal reached',
    className: 'bg-positive/15 text-positive',
  },
  [CampaignStatus.Failed]: { label: 'Refundable', className: 'bg-warning/15 text-warning' },
  [CampaignStatus.Withdrawn]: { label: 'Funded', className: 'bg-positive/15 text-positive' },
}

export function StatusBadge({ status }: { status: CampaignStatus }) {
  const { label, className } = STATUS_STYLES[status]
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />
}

export function CampaignCardSkeleton() {
  return (
    <div className="rounded-xl border border-edge bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-4/5" />
      <Skeleton className="mt-6 h-2 w-full rounded-full" />
      <div className="mt-4 flex justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  )
}

/** Shown when a list is empty, or a fetch failed and there is nothing cached. */
export function EmptyState({
  title,
  message,
  action,
}: {
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-edge bg-surface/50 px-6 py-14 text-center">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{message}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  )
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-negative/40 bg-negative/10 p-4 text-sm text-ink sm:flex-row sm:items-center sm:justify-between"
    >
      <span>{message}</span>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="shrink-0">
          Try again
        </Button>
      )}
    </div>
  )
}
