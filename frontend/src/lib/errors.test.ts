import { describe, expect, it } from 'vitest'

import { humanizeError, unwrapResult } from './errors'

describe('humanizeError', () => {
  it('maps a raw host error code to the right contract error', () => {
    // #6 is CampaignNotActive on the campaign...
    expect(humanizeError('HostError: Error(Contract, #6)', 'campaign')).toMatch(
      /no longer taking contributions/i,
    )
    // ...but UnknownCampaign is #3 on the factory. Same number, different contract,
    // different meaning — which is why the caller has to say where it came from.
    expect(humanizeError('HostError: Error(Contract, #3)', 'factory')).toMatch(
      /not a campaign deployed by this factory/i,
    )
  })

  it('maps an error by name, which is how a Result::Err arrives', () => {
    expect(humanizeError('NothingToRefund', 'campaign')).toMatch(/nothing to refund/i)
    expect(humanizeError('GoalNotReached', 'campaign')).toMatch(/not been reached/i)
    expect(humanizeError('InvalidDuration', 'factory')).toMatch(/between 1 hour and 1 year/i)
  })

  it('recognises a wallet rejection, which is not really an error', () => {
    expect(humanizeError(new Error('User declined access'))).toMatch(/dismissed the request/i)
    expect(humanizeError({ error: 'Request rejected by user' })).toMatch(/dismissed the request/i)
  })

  it('explains a missing extension instead of showing a stack trace', () => {
    expect(humanizeError('Freighter is not installed')).toMatch(/freighter is not installed/i)
  })

  it('translates an insufficient balance', () => {
    expect(humanizeError(new Error('transfer failed: insufficient balance'))).toMatch(
      /balance is not enough/i,
    )
  })

  it('translates a network failure', () => {
    expect(humanizeError(new TypeError('Failed to fetch'))).toMatch(/could not reach/i)
  })

  it('falls back to something safe rather than leaking a host error', () => {
    const message = humanizeError(new Error('XdrParseError: bad union switch 87'))
    expect(message).toBe('Something went wrong submitting that transaction. Please try again.')
    expect(message).not.toMatch(/xdr/i)
  })

  it('digs the message out of whatever shape it was thrown in', () => {
    expect(humanizeError({ error: { message: 'CampaignNotFailed' } }, 'campaign')).toMatch(
      /passes its deadline/i,
    )
  })
})

describe('unwrapResult', () => {
  it('returns the value of an Ok', () => {
    const ok = { isOk: () => true, unwrap: () => 42n, unwrapErr: () => ({ message: '' }) }
    expect(unwrapResult(ok, 'campaign')).toBe(42n)
  })

  it('throws an Err as a message the user can act on', () => {
    const err = {
      isOk: () => false,
      unwrap: () => 0n,
      unwrapErr: () => ({ message: 'AlreadyWithdrawn' }),
    }

    expect(() => unwrapResult(err, 'campaign')).toThrow(/already been withdrawn/i)
  })
})
