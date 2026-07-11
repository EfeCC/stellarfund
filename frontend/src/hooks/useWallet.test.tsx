import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Wallet } from '../services/wallet'
import { useWallet, WalletProvider } from './useWallet'

const ADDRESS = 'GDD5YXT3WW6GOGGTVCTP6TXGR2B7OWKK247KYCWXRUSMOZ2TOJU73ORY'

/**
 * The whole reason `WalletProvider` takes a `wallet` prop: the connection flow
 * can be driven end to end without a browser extension in the loop.
 */
function fakeWallet(overrides: Partial<Wallet> = {}): Wallet {
  return {
    id: 'fake',
    name: 'Fake',
    isAvailable: vi.fn().mockResolvedValue(true),
    connect: vi.fn().mockResolvedValue(ADDRESS),
    currentAddress: vi.fn().mockResolvedValue(null),
    network: vi.fn().mockResolvedValue('Test SDF Network ; September 2015'),
    signTransaction: vi.fn().mockResolvedValue('signed-xdr'),
    ...overrides,
  }
}

function Probe() {
  const { address, signer, installed, connect, disconnect, error } = useWallet()

  return (
    <div>
      <span data-testid="address">{address ?? 'none'}</span>
      <span data-testid="signer">{signer ? 'ready' : 'null'}</span>
      <span data-testid="installed">{String(installed)}</span>
      <span data-testid="error">{error ?? ''}</span>
      <button onClick={() => void connect()}>Connect</button>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  )
}

function renderWith(wallet: Wallet) {
  return render(
    <WalletProvider wallet={wallet}>
      <Probe />
    </WalletProvider>,
  )
}

describe('WalletProvider', () => {
  it('starts disconnected, with no signer to build a transaction with', async () => {
    renderWith(fakeWallet())

    await waitFor(() => expect(screen.getByTestId('installed')).toHaveTextContent('true'))
    expect(screen.getByTestId('address')).toHaveTextContent('none')
    expect(screen.getByTestId('signer')).toHaveTextContent('null')
  })

  it('connects and hands out a signer', async () => {
    const wallet = fakeWallet()
    renderWith(wallet)

    await userEvent.click(screen.getByText('Connect'))

    await waitFor(() => expect(screen.getByTestId('address')).toHaveTextContent(ADDRESS))
    expect(screen.getByTestId('signer')).toHaveTextContent('ready')
    expect(wallet.connect).toHaveBeenCalledOnce()
  })

  /**
   * Freighter remembers that it granted this origin access, so re-prompting on
   * every page load would be pure noise.
   */
  it('restores an existing session without prompting', async () => {
    const wallet = fakeWallet({ currentAddress: vi.fn().mockResolvedValue(ADDRESS) })
    renderWith(wallet)

    await waitFor(() => expect(screen.getByTestId('address')).toHaveTextContent(ADDRESS))
    expect(wallet.connect).not.toHaveBeenCalled()
  })

  it('surfaces a rejected connection as a sentence, not a stack trace', async () => {
    const wallet = fakeWallet({
      connect: vi.fn().mockRejectedValue(new Error('User declined access')),
    })
    renderWith(wallet)

    await userEvent.click(screen.getByText('Connect'))

    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent(/dismissed the request/i),
    )
    expect(screen.getByTestId('signer')).toHaveTextContent('null')
  })

  it('reports a missing extension so the UI can offer the install link', async () => {
    renderWith(fakeWallet({ isAvailable: vi.fn().mockResolvedValue(false) }))

    await waitFor(() => expect(screen.getByTestId('installed')).toHaveTextContent('false'))
  })

  it('drops the signer on disconnect', async () => {
    renderWith(fakeWallet())

    await userEvent.click(screen.getByText('Connect'))
    await waitFor(() => expect(screen.getByTestId('signer')).toHaveTextContent('ready'))

    await userEvent.click(screen.getByText('Disconnect'))
    expect(screen.getByTestId('signer')).toHaveTextContent('null')
  })
})
