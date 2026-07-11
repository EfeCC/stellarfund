import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { humanizeError } from '../lib/errors'
import type { Signer } from '../services/soroban'
import { freighter, type Wallet } from '../services/wallet'

interface WalletContextValue {
  address: string | null
  /** Null until a wallet is connected — the type is what stops us building a signable tx while logged out. */
  signer: Signer | null
  installed: boolean
  connecting: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({
  children,
  wallet = freighter,
}: {
  children: ReactNode
  /** Injectable so tests can drive the UI without a browser extension. */
  wallet?: Wallet
}) {
  const [address, setAddress] = useState<string | null>(null)
  const [installed, setInstalled] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Restore an existing session without prompting. Freighter remembers that it
  // granted this origin access, so re-asking on every reload would be noise.
  useEffect(() => {
    let cancelled = false

    void (async () => {
      const available = await wallet.isAvailable()
      if (cancelled) return
      setInstalled(available)
      if (!available) return

      const existing = await wallet.currentAddress()
      if (!cancelled && existing) setAddress(existing)
    })()

    return () => {
      cancelled = true
    }
  }, [wallet])

  const connect = useCallback(async () => {
    setConnecting(true)
    setError(null)
    try {
      setAddress(await wallet.connect())
      setInstalled(true)
    } catch (cause) {
      setError(humanizeError(cause))
    } finally {
      setConnecting(false)
    }
  }, [wallet])

  const disconnect = useCallback(() => {
    // Freighter has no revoke API — the app forgets the session, and the next
    // connect is a one-click re-approval rather than a fresh grant.
    setAddress(null)
    setError(null)
  }, [])

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      signer: address ? { address, wallet } : null,
      installed,
      connecting,
      error,
      connect,
      disconnect,
    }),
    [address, wallet, installed, connecting, error, connect, disconnect],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext)
  if (!context) throw new Error('useWallet must be used inside a <WalletProvider>')
  return context
}
