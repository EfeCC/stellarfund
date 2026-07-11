import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from './ui'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Last line of defence. A render that throws would otherwise unmount the whole
 * tree and leave a blank page — which, on a page showing someone's money, is the
 * worst possible failure mode. Anything the hooks and services did not catch
 * lands here with a way out.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('unhandled render error', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-edge bg-surface p-8 text-center">
          <h1 className="text-lg font-semibold">Something broke</h1>
          <p className="mt-2 text-sm text-muted">
            The page hit an unexpected error. Your funds are on-chain and untouched by this.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-canvas p-3 text-left text-xs text-faint">
            {error.message}
          </pre>
          <Button className="mt-6 w-full" onClick={() => window.location.reload()}>
            Reload the page
          </Button>
        </div>
      </div>
    )
  }
}
