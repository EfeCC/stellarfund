import { useCallback, useEffect, useState } from 'react'

import { humanizeError } from '../lib/errors'
import { contributionOf, listCampaigns, loadCampaign, type Campaign } from '../services/soroban'
import { useActivity } from './useActivity'
import { useWallet } from './useWallet'

interface Async<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Every campaign on the platform.
 *
 * Refetches whenever the activity feed sees something new, so a contribution by
 * anyone — in this tab or not — moves the progress bars without a reload. The
 * feed tells us *that* something changed; the contract tells us what it changed to.
 */
export function useCampaigns(): Async<Campaign[]> {
  const { revision } = useActivity()
  const [reloads, setReloads] = useState(0)
  const [state, setState] = useState<Omit<Async<Campaign[]>, 'reload'>>({
    data: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const campaigns = await listCampaigns()
        if (!cancelled) setState({ data: campaigns, loading: false, error: null })
      } catch (error) {
        if (cancelled) return
        console.error('failed to load campaigns', error)
        // Keep whatever is on screen: a failed background refresh should not
        // blank out a list the user is reading.
        setState((current) => ({
          data: current.data,
          loading: false,
          error: humanizeError(error),
        }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [revision, reloads])

  const reload = useCallback(() => setReloads((value) => value + 1), [])
  return { ...state, reload }
}

/** One campaign, plus what the connected wallet has pledged to it. */
export function useCampaign(address: string): Async<Campaign> & { myContribution: bigint } {
  const { revision } = useActivity()
  const { address: me } = useWallet()

  const [reloads, setReloads] = useState(0)
  const [myContribution, setMyContribution] = useState(0n)
  const [state, setState] = useState<Omit<Async<Campaign>, 'reload'>>({
    data: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const campaign = await loadCampaign(address)
        if (!cancelled) setState({ data: campaign, loading: false, error: null })
      } catch (error) {
        if (cancelled) return
        console.error('failed to load campaign', address, error)
        setState((current) => ({
          data: current.data,
          loading: false,
          error: humanizeError(error),
        }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [address, revision, reloads])

  useEffect(() => {
    let cancelled = false

    if (!me) {
      setMyContribution(0n)
      return
    }

    void (async () => {
      try {
        const amount = await contributionOf(address, me)
        if (!cancelled) setMyContribution(amount)
      } catch (error) {
        // Not fatal: it only hides the refund button, and the next poll retries.
        console.error('failed to read contribution', error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [address, me, revision, reloads])

  const reload = useCallback(() => setReloads((value) => value + 1), [])
  return { ...state, reload, myContribution }
}
