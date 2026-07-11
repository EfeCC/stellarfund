import {
  getAddress,
  getNetwork,
  isAllowed,
  isConnected,
  requestAccess,
  signTransaction,
} from '@stellar/freighter-api'

import { config } from '../config'

/**
 * The app talks to wallets through this, never to Freighter directly.
 *
 * Only Freighter is wired up today, but every call site goes through the
 * interface, so adding xBull or Albedo later is a new implementation rather than
 * a rewrite of the components.
 */
export interface Wallet {
  readonly id: string
  readonly name: string
  /** Is the extension actually installed? */
  isAvailable(): Promise<boolean>
  /** Prompt for access. Returns the connected address. */
  connect(): Promise<string>
  /** The address if the user already granted access, else null. Never prompts. */
  currentAddress(): Promise<string | null>
  /** The network the *wallet* is pointed at — not necessarily ours. */
  network(): Promise<string>
  signTransaction(xdr: string, networkPassphrase: string): Promise<string>
}

/** Freighter reports failures in the return value rather than by throwing. */
function orThrow<T extends object>(result: T & { error?: unknown }): T {
  if (result.error) throw new Error(String(result.error))
  return result
}

export const freighter: Wallet = {
  id: 'freighter',
  name: 'Freighter',

  async isAvailable() {
    try {
      const result = await isConnected()
      return !result.error && result.isConnected
    } catch {
      return false
    }
  },

  async connect() {
    const { address } = orThrow(await requestAccess())
    if (!address) throw new Error('User declined access')
    return address
  },

  async currentAddress() {
    try {
      if (!(await isAllowed()).isAllowed) return null
      const { address } = orThrow(await getAddress())
      return address || null
    } catch {
      return null
    }
  },

  async network() {
    const { networkPassphrase } = orThrow(await getNetwork())
    return networkPassphrase
  },

  async signTransaction(xdr, networkPassphrase) {
    const { signedTxXdr } = orThrow(await signTransaction(xdr, { networkPassphrase }))
    return signedTxXdr
  },
}

/**
 * Freighter happily signs a testnet transaction while pointed at mainnet, and the
 * failure surfaces much later as an opaque submission error. Catch it up front.
 */
export async function assertRightNetwork(wallet: Wallet): Promise<void> {
  const walletNetwork = await wallet.network()
  if (walletNetwork !== config.networkPassphrase) {
    throw new Error(
      `Your wallet is on the wrong network. Switch it to ${config.network} and try again.`,
    )
  }
}
