import { Errors as CampaignErrors } from '../contracts/campaign'
import { Errors as FactoryErrors } from '../contracts/factory'

export type ContractKind = 'campaign' | 'factory'

/**
 * Which contract a call went to. A raw `Error(Contract, #6)` is ambiguous on its
 * own — code 6 means something different in each contract — so the caller says
 * where it came from.
 */
const ERROR_NAMES: Record<ContractKind, Record<number, { message: string }>> = {
  campaign: CampaignErrors,
  factory: FactoryErrors,
}

/**
 * Contract errors, restated for the person who hit them.
 *
 * Keyed by the error's *name* rather than its number: the numbers are only
 * meaningful next to a specific contract, but the names are unique across both
 * and survive a renumbering of the enum.
 */
const FRIENDLY: Record<string, string> = {
  // campaign
  InvalidGoal: 'The funding goal has to be greater than zero.',
  InvalidDeadline: 'The deadline has to be in the future.',
  InvalidTitle: 'Give the campaign a title of 100 characters or fewer.',
  InvalidDescription: 'The description is too long — 800 characters maximum.',
  InvalidAmount: 'Enter an amount greater than zero.',
  CampaignNotActive:
    'This campaign is no longer taking contributions — it has either hit its goal or passed its deadline.',
  GoalNotReached: 'The goal has not been reached yet, so the funds cannot be withdrawn.',
  AlreadyWithdrawn: 'These funds have already been withdrawn.',
  CampaignNotFailed: 'Refunds open only once a campaign passes its deadline without reaching its goal.',
  NothingToRefund: 'There is nothing to refund — you either never contributed here, or you already claimed it.',

  // factory
  InvalidDuration: 'Choose a duration between 1 hour and 1 year.',
  UnknownCampaign: 'That address is not a campaign deployed by this factory.',
  InvalidPage: 'Asked for too many campaigns at once.',
}

const CONTRACT_ERROR_CODE = /Error\(Contract,\s*#(\d+)\)/

/** Digs a string out of whatever the SDK, the wallet, or the network threw. */
function messageOf(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message

  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; error?: unknown }
    if (typeof candidate.message === 'string') return candidate.message
    // Freighter reports failures as `{ error: ... }` rather than throwing.
    if (candidate.error !== undefined) return messageOf(candidate.error)
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }

  return String(error)
}

/**
 * Turn anything thrown during a contract call into a sentence worth showing.
 *
 * Falls back to a generic message rather than leaking a host error at the user —
 * but the original is always still available on the console via the caller.
 */
export function humanizeError(error: unknown, kind?: ContractKind): string {
  const raw = messageOf(error)

  if (/user (declined|rejected)|declined access|rejected by user|user closed/i.test(raw)) {
    return 'You dismissed the request in your wallet.'
  }
  if (/freighter is not|not installed|no wallet found/i.test(raw)) {
    return 'Freighter is not installed. Add the extension and reload the page.'
  }

  // The contract said no, and told us exactly why.
  const byName = FRIENDLY[raw.trim()]
  if (byName) return byName

  const code = CONTRACT_ERROR_CODE.exec(raw)?.[1]
  if (code !== undefined && kind !== undefined) {
    const name = ERROR_NAMES[kind][Number(code)]?.message
    if (name && FRIENDLY[name]) return FRIENDLY[name]
  }

  if (/insufficient balance|balance is not sufficient|underflow/i.test(raw)) {
    return 'Your XLM balance is not enough to cover this contribution and the network fee.'
  }
  if (/trustline|not authorized/i.test(raw)) {
    return 'Your account cannot hold this asset yet.'
  }
  if (/failed to fetch|networkerror|timeout|econnrefused|503|502/i.test(raw)) {
    return 'Could not reach the Stellar network. Check your connection and try again.'
  }
  if (/account not found|was not found/i.test(raw)) {
    return 'This account does not exist on the network yet. Fund it with the testnet friendbot first.'
  }

  return 'Something went wrong submitting that transaction. Please try again.'
}

/**
 * Contract methods that return `Result` give back an `Ok`/`Err` rather than
 * throwing. Unwrapping through here means a contract-level rejection and a
 * thrown host error both surface the same way to the UI.
 */
export function unwrapResult<T>(
  result: { isOk: () => boolean; unwrap: () => T; unwrapErr: () => { message: string } },
  kind: ContractKind,
): T {
  if (result.isOk()) return result.unwrap()
  throw new Error(humanizeError(result.unwrapErr().message, kind))
}
