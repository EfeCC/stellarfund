import { useToast, type ToastKind } from '../hooks/useToast'

const ACCENTS: Record<ToastKind, string> = {
  success: 'border-positive/50 bg-positive/10',
  error: 'border-negative/50 bg-negative/10',
  info: 'border-edge bg-raised',
}

const ICONS: Record<ToastKind, string> = {
  success: '✓',
  error: '!',
  info: '◆',
}

export function ToastViewport() {
  const { toasts, dismiss } = useToast()

  return (
    // `aria-live` so a contribution landing in the feed is announced rather than
    // only seen. Pointer-events off on the stack, back on for each toast, so the
    // container never swallows clicks on the page beneath it.
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:top-0 sm:items-end"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-enter pointer-events-auto w-full max-w-sm rounded-lg border p-4 shadow-lg backdrop-blur ${ACCENTS[toast.kind]}`}
        >
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-0.5 text-sm font-bold">
              {ICONS[toast.kind]}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{toast.title}</p>
              {toast.message && <p className="mt-1 text-sm text-muted">{toast.message}</p>}
              {toast.href && (
                <a
                  href={toast.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs font-semibold text-accent hover:underline"
                >
                  {toast.linkLabel ?? 'View'} →
                </a>
              )}
            </div>

            <button
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="-m-1 rounded p-1 text-faint transition-colors hover:text-ink"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
