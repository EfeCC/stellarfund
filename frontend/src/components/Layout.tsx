import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'

import { config, explorer } from '../config'
import { useWallet } from '../hooks/useWallet'
import { shortenAddress } from '../lib/format'
import { Button, Spinner } from './ui'

const NAV = [
  { to: '/', label: 'Explore', end: true },
  { to: '/create', label: 'Start a campaign', end: false },
]

function WalletButton() {
  const { address, installed, connecting, connect, disconnect, error } = useWallet()

  if (!installed) {
    return (
      <a
        href="https://www.freighter.app/"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-edge bg-raised px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-edge"
      >
        Install Freighter
      </a>
    )
  }

  if (!address) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button onClick={() => void connect()} loading={connecting}>
          {connecting ? 'Connecting…' : 'Connect wallet'}
        </Button>
        {error && <span className="text-xs text-negative">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-edge bg-surface py-1.5 pl-3 pr-1.5">
      <span className="size-2 rounded-full bg-positive" aria-hidden="true" />
      <a
        href={explorer.account(address)}
        target="_blank"
        rel="noreferrer"
        className="address text-muted transition-colors hover:text-ink"
        title={address}
      >
        {shortenAddress(address)}
      </a>
      <button
        onClick={disconnect}
        className="rounded px-2 py-1 text-xs font-semibold text-faint transition-colors hover:bg-raised hover:text-ink"
      >
        Disconnect
      </button>
    </div>
  )
}

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-edge bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-canvas">
              ✦
            </span>
            <span className="text-lg">StellarFund</span>
            <span className="hidden rounded-full bg-raised px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted sm:inline">
              {config.network}
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-surface text-ink' : 'text-muted hover:text-ink'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:block">
            <WalletButton />
          </div>

          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label="Toggle menu"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-ink md:hidden"
          >
            <svg className="size-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                d={menuOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'}
              />
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-edge px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive ? 'bg-surface text-ink' : 'text-muted'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-4 flex justify-start">
              <WalletButton />
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Outlet />
      </main>

      <footer className="border-t border-edge">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>StellarFund — crowdfunding on Soroban.</p>
          <a
            href={explorer.contract(config.factoryId)}
            target="_blank"
            rel="noreferrer"
            className="address transition-colors hover:text-ink"
          >
            Factory: {shortenAddress(config.factoryId, 8, 6)}
          </a>
        </div>
      </footer>
    </div>
  )
}

export function PageSpinner() {
  return (
    <div className="grid place-items-center py-24 text-muted">
      <Spinner className="size-8" />
    </div>
  )
}
