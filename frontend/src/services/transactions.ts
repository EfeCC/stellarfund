import { config } from '../config'
import { humanizeError, unwrapResult, type ContractKind } from '../lib/errors'
import { campaign, factory, type Signer } from './soroban'
import { assertRightNetwork } from './wallet'

export interface TxResult<T> {
  value: T
  /** Hash of the submitted transaction, for the explorer link. */
  hash: string
}

/**
 * Everything a write goes through.
 *
 * The wallet's network is checked first: Freighter will happily sign a testnet
 * transaction while pointed at mainnet, and that failure otherwise surfaces much
 * later as an opaque submission error. Whatever goes wrong after that — a
 * simulation failure, a rejected signature, a contract error — comes back out as
 * one `Error` carrying a sentence fit to show the user, with the original logged.
 */
async function submit<T>(
  signer: Signer,
  kind: ContractKind,
  send: () => Promise<{ result: unknown; hash: string }>,
): Promise<TxResult<T>> {
  await assertRightNetwork(signer.wallet)

  try {
    const { result, hash } = await send()
    return { value: unwrapResult(result as never, kind) as T, hash }
  } catch (error) {
    console.error(`${kind} transaction failed`, error)
    throw new Error(humanizeError(error, kind))
  }
}

export async function createCampaign(
  signer: Signer,
  input: { title: string; description: string; goal: bigint; duration: bigint },
): Promise<TxResult<string>> {
  return submit(signer, 'factory', async () => {
    const tx = await factory(signer).create_campaign({
      creator: signer.address,
      token: config.nativeTokenId,
      title: input.title,
      description: input.description,
      goal: input.goal,
      duration: input.duration,
    })

    const sent = await tx.signAndSend()
    return { result: sent.result, hash: hashOf(sent) }
  })
}

export async function contribute(
  signer: Signer,
  campaignId: string,
  amount: bigint,
): Promise<TxResult<bigint>> {
  return submit(signer, 'campaign', async () => {
    const tx = await campaign(campaignId, signer).contribute({
      from: signer.address,
      amount,
    })

    const sent = await tx.signAndSend()
    return { result: sent.result, hash: hashOf(sent) }
  })
}

export async function withdraw(signer: Signer, campaignId: string): Promise<TxResult<bigint>> {
  return submit(signer, 'campaign', async () => {
    const tx = await campaign(campaignId, signer).withdraw()
    const sent = await tx.signAndSend()
    return { result: sent.result, hash: hashOf(sent) }
  })
}

export async function refund(signer: Signer, campaignId: string): Promise<TxResult<bigint>> {
  return submit(signer, 'campaign', async () => {
    const tx = await campaign(campaignId, signer).refund({ contributor: signer.address })
    const sent = await tx.signAndSend()
    return { result: sent.result, hash: hashOf(sent) }
  })
}

function hashOf(sent: {
  sendTransactionResponse?: { hash?: string } | null
  getTransactionResponse?: { txHash?: string } | null
}): string {
  return sent.sendTransactionResponse?.hash ?? sent.getTransactionResponse?.txHash ?? ''
}
