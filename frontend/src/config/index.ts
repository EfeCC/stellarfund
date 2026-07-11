import deployment from './deployment.json'

/**
 * Where the contracts live.
 *
 * `deployment.json` is written by `scripts/deploy.sh`, so a fresh deploy needs no
 * code change and no dashboard fiddling — the committed file is the source of
 * truth. Each field can still be overridden by a `VITE_*` environment variable,
 * which is what lets a preview build point at a different factory without a
 * separate commit.
 */
export const config = {
  network: deployment.network,
  networkPassphrase: import.meta.env.VITE_NETWORK_PASSPHRASE ?? deployment.networkPassphrase,
  rpcUrl: import.meta.env.VITE_RPC_URL ?? deployment.rpcUrl,
  explorerUrl: import.meta.env.VITE_EXPLORER_URL ?? deployment.explorerUrl,
  factoryId: import.meta.env.VITE_FACTORY_ID ?? deployment.factoryId,
  nativeTokenId: import.meta.env.VITE_NATIVE_TOKEN_ID ?? deployment.nativeTokenId,
  admin: deployment.admin,
} as const

/** XLM is denominated in stroops on-chain: 1 XLM = 10^7 stroops. */
export const STROOPS_PER_XLM = 10_000_000n

export const explorer = {
  tx: (hash: string) => `${config.explorerUrl}/tx/${hash}`,
  contract: (id: string) => `${config.explorerUrl}/contract/${id}`,
  account: (id: string) => `${config.explorerUrl}/account/${id}`,
}
