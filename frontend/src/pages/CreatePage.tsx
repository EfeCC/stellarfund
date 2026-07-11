import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button, ErrorNotice } from '../components/ui'
import { explorer } from '../config'
import { useToast } from '../hooks/useToast'
import { useWallet } from '../hooks/useWallet'
import { xlmToStroops } from '../lib/format'
import { createCampaign } from '../services/transactions'

/** Mirrors the factory's MIN_DURATION / MAX_DURATION, in seconds. */
const DURATIONS = [
  { label: '1 hour', seconds: 3_600n },
  { label: '7 days', seconds: 604_800n },
  { label: '30 days', seconds: 2_592_000n },
  { label: '90 days', seconds: 7_776_000n },
] as const

const MAX_TITLE = 100
const MAX_DESCRIPTION = 800

export function CreatePage() {
  const navigate = useNavigate()
  const { signer, connect, connecting, installed } = useWallet()
  const { push } = useToast()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [goal, setGoal] = useState('')
  const [duration, setDuration] = useState<bigint>(DURATIONS[1].seconds)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The contract enforces all of this too — these are the same rules, restated so
  // the user finds out now rather than after a signature and a failed simulation.
  const errors = {
    title:
      title.trim() === ''
        ? 'A title is required.'
        : title.length > MAX_TITLE
          ? `${title.length}/${MAX_TITLE} characters.`
          : null,
    description:
      description.length > MAX_DESCRIPTION ? `${description.length}/${MAX_DESCRIPTION} characters.` : null,
    goal:
      goal.trim() === ''
        ? 'A goal is required.'
        : !/^\d+(\.\d{1,7})?$/.test(goal.trim())
          ? 'Enter a number with up to 7 decimal places.'
          : Number(goal) <= 0
            ? 'The goal has to be greater than zero.'
            : null,
  }

  const valid = !errors.title && !errors.description && !errors.goal

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!signer || !valid) return

    setSubmitting(true)
    setError(null)
    try {
      const { value: address, hash } = await createCampaign(signer, {
        title: title.trim(),
        description: description.trim(),
        goal: xlmToStroops(goal),
        duration,
      })

      push({
        kind: 'success',
        title: 'Campaign deployed 🚀',
        message: `"${title.trim()}" now lives at its own contract address.`,
        href: explorer.tx(hash),
        linkLabel: 'View transaction',
      })

      void navigate(`/campaign/${address}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSubmitting(false)
    }
  }

  const field = 'w-full rounded-lg border border-edge bg-canvas px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-faint focus:border-accent'

  return (
    <div className="mx-auto max-w-2xl">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Start a campaign</h1>
        <p className="mt-2 text-sm text-muted">
          This deploys a contract of your own. Contributions are escrowed there — you can only
          withdraw them once the goal is met, and if it isn&apos;t, your backers take theirs back.
        </p>
      </header>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <div className="space-y-2">
          <label htmlFor="title" className="block text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            value={title}
            maxLength={MAX_TITLE + 20}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Fund the docs rewrite"
            className={field}
          />
          <p className="text-xs text-faint">
            {title.length}/{MAX_TITLE}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="description" className="block text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What are you raising for, and what happens if you hit the goal?"
            className={`${field} resize-y`}
          />
          {errors.description && <p className="text-xs text-negative">{errors.description}</p>}
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="goal" className="block text-sm font-medium">
              Funding goal
            </label>
            <div className="flex rounded-lg border border-edge bg-canvas focus-within:border-accent">
              <input
                id="goal"
                inputMode="decimal"
                autoComplete="off"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder="1000"
                className="w-full bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-faint"
              />
              <span className="grid place-items-center px-3 text-sm font-semibold text-faint">
                XLM
              </span>
            </div>
            {goal !== '' && errors.goal && <p className="text-xs text-negative">{errors.goal}</p>}
          </div>

          <div className="space-y-2">
            <label htmlFor="duration" className="block text-sm font-medium">
              Runs for
            </label>
            <select
              id="duration"
              value={String(duration)}
              onChange={(event) => setDuration(BigInt(event.target.value))}
              className={field}
            >
              {DURATIONS.map((option) => (
                <option key={option.label} value={String(option.seconds)}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <ErrorNotice message={error} />}

        {!installed ? (
          <a
            href="https://www.freighter.app/"
            target="_blank"
            rel="noreferrer"
            className="block w-full rounded-lg border border-edge bg-raised px-4 py-2.5 text-center text-sm font-semibold transition-colors hover:bg-edge"
          >
            Install Freighter to continue
          </a>
        ) : !signer ? (
          <Button type="button" className="w-full" loading={connecting} onClick={() => void connect()}>
            Connect wallet to continue
          </Button>
        ) : (
          <Button type="submit" className="w-full" loading={submitting} disabled={!valid}>
            {submitting ? 'Deploying your contract…' : 'Deploy campaign'}
          </Button>
        )}
      </form>
    </div>
  )
}
