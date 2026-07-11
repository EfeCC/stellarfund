import { STROOPS_PER_XLM } from '../config'

/**
 * Amounts are `i128` stroops on-chain and arrive as `bigint`. Never convert them
 * to `number` for arithmetic — a large campaign would silently lose precision
 * past 2^53. Convert only at the edge, for display.
 */
export function stroopsToXlm(stroops: bigint): string {
  const negative = stroops < 0n
  const magnitude = negative ? -stroops : stroops

  const whole = magnitude / STROOPS_PER_XLM
  const fraction = magnitude % STROOPS_PER_XLM

  const sign = negative ? '-' : ''
  if (fraction === 0n) return `${sign}${whole}`

  // Pad to 7 digits, then drop trailing zeros: 1.5 rather than 1.5000000.
  const decimals = fraction.toString().padStart(7, '0').replace(/0+$/, '')
  return `${sign}${whole}.${decimals}`
}

/**
 * Parse user input in XLM into stroops.
 *
 * Throws on anything that is not a non-negative decimal with at most 7 places —
 * the caller is expected to have validated the field, and a silent 0 here would
 * turn a typo into a failed transaction.
 */
export function xlmToStroops(xlm: string): bigint {
  const trimmed = xlm.trim()
  if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) {
    throw new Error(`"${xlm}" is not a valid XLM amount`)
  }

  const [whole, fraction = ''] = trimmed.split('.')
  return BigInt(whole) * STROOPS_PER_XLM + BigInt(fraction.padEnd(7, '0'))
}

/** Formats an XLM amount for display, with thousands separators. */
export function formatXlm(stroops: bigint): string {
  const [whole, fraction] = stroopsToXlm(stroops).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction ? `${grouped}.${fraction}` : grouped
}

/** `GDD5YXT3…3ORY` — enough to recognise an address, short enough to fit. */
export function shortenAddress(address: string, lead = 6, tail = 4): string {
  if (address.length <= lead + tail + 1) return address
  return `${address.slice(0, lead)}…${address.slice(-tail)}`
}

/** Percentage of the goal raised, capped at 100 for progress bars. */
export function progressPercent(raised: bigint, goal: bigint): number {
  if (goal <= 0n) return 0
  const basisPoints = (raised * 10_000n) / goal
  return Math.min(100, Number(basisPoints) / 100)
}

/**
 * Human-readable time remaining. Deadlines are unix seconds (u64), so compare in
 * seconds rather than milliseconds.
 */
export function timeRemaining(deadline: bigint, now = Date.now()): string {
  const seconds = Number(deadline) - Math.floor(now / 1000)
  if (seconds <= 0) return 'Ended'

  const days = Math.floor(seconds / 86_400)
  if (days > 0) return `${days} day${days === 1 ? '' : 's'} left`

  const hours = Math.floor(seconds / 3_600)
  if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} left`

  const minutes = Math.max(1, Math.floor(seconds / 60))
  return `${minutes} minute${minutes === 1 ? '' : 's'} left`
}

export function hasEnded(deadline: bigint, now = Date.now()): boolean {
  return Number(deadline) * 1000 <= now
}

/** `11 Jul 2026, 15:32` */
export function formatDate(unixSeconds: bigint): string {
  return new Date(Number(unixSeconds) * 1000).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** `just now`, `4m ago`, `2h ago` — for the activity feed. */
export function timeAgo(unixSeconds: bigint, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor(now / 1000) - Number(unixSeconds))
  if (seconds < 45) return 'just now'
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`
  return `${Math.floor(seconds / 86_400)}d ago`
}
