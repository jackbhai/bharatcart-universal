import React from 'react'

/**
 * Crash isolation.
 *
 * React's default behaviour when a render throws is to unmount the entire
 * tree. In an admin panel that means one bad number in one widget takes down
 * the whole application and leaves a white page — the operator loses whatever
 * they were in the middle of, with no message explaining why.
 *
 * Boundaries are placed at three levels, and the level matters:
 *
 *   app    — last resort. Something outside any route broke.
 *   route  — one admin screen failed; the sidebar and every other screen keep
 *            working, so the operator can navigate away instead of reloading.
 *   widget — one card or chart failed; the rest of the screen is unaffected.
 *
 * The widget level is the one that earns its keep day to day. A single
 * malformed record in a seed or an API response should degrade one card, not
 * an entire page of otherwise correct information.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null, count: 0 }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState(s => ({ info, count: s.count + 1 }))

    // Report through whatever the host app provides. Deliberately not wired
    // to a third-party service: that would be a paid dependency and would ship
    // customer data off-site without the operator asking for it.
    try {
      this.props.onError?.(error, info, this.props.label)
    } catch { /* a failing reporter must never mask the original error */ }

    console.error(`[error:${this.props.level || 'widget'}] ${this.props.label || 'unlabelled'}`, error, info?.componentStack)
  }

  componentDidUpdate(prev) {
    // Recover automatically when the route changes. Without this, navigating
    // away from a broken screen and back again would still show the error,
    // because the boundary keeps its state until something resets it.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null, info: null })
    }
  }

  retry = () => this.setState({ error: null, info: null })

  render() {
    const { error, count } = this.state
    const { children, level = 'widget', label, fallback } = this.props
    if (!error) return children

    if (fallback) return typeof fallback === 'function' ? fallback({ error, retry: this.retry }) : fallback

    // A boundary that keeps throwing would loop forever re-rendering. After a
    // few attempts, stop offering the retry and say so plainly.
    const looping = count > 3

    return (
      <div
        role="alert"
        className={level === 'widget' ? 'rounded-xl border p-4' : 'rounded-2xl border p-6 m-4'}
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}
      >
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="text-lg">⚠</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>
              {level === 'route'
                ? 'This screen could not be displayed'
                : level === 'app'
                  ? 'Something went wrong'
                  : `${label || 'This section'} could not be displayed`}
            </p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
              {level === 'route'
                ? 'The rest of the panel is still working — you can switch to another screen.'
                : 'The rest of this page is unaffected.'}
            </p>

            {/* The message itself is useful to an operator reporting a bug,
                but a raw stack trace is noise. Show one, offer the other. */}
            <p className="text-[11px] mt-2 font-mono break-words" style={{ color: 'var(--c-text-muted)' }}>
              {String(error?.message || error).slice(0, 220)}
            </p>

            <div className="flex flex-wrap gap-2 mt-3">
              {!looping && (
                <button
                  type="button"
                  onClick={this.retry}
                  className="px-3 py-2 rounded-lg text-[12px] font-semibold border min-h-[40px]"
                  style={{ borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
                >
                  Try again
                </button>
              )}
              {level !== 'widget' && level !== 'app' && (
                <button
                  type="button"
                  onClick={() => { window.location.hash = '#/admin/dashboard'; this.retry() }}
                  className="px-3 py-2 rounded-lg text-[12px] font-semibold border min-h-[40px]"
                  style={{ borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
                >
                  Back to dashboard
                </button>
              )}
              {level === 'app' && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-3 py-2 rounded-lg text-[12px] font-semibold border min-h-[40px]"
                  style={{ borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
                >
                  Reload app
                </button>
              )}
              {looping && (
                <span className="text-[11px] self-center" style={{ color: 'var(--c-text-muted)' }}>
                  This keeps failing — reload the page to reset.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }
}

/** Convenience wrapper for the common widget case. */
export function Guard({ label, children, fallback }) {
  return <ErrorBoundary level="widget" label={label} fallback={fallback}>{children}</ErrorBoundary>
}

/**
 * Wrap a component in a boundary once, at definition time, rather than at
 * every call site.
 */
export function withBoundary(Component, { level = 'widget', label } = {}) {
  const Wrapped = props => (
    <ErrorBoundary level={level} label={label || Component.displayName || Component.name}>
      <Component {...props} />
    </ErrorBoundary>
  )
  Wrapped.displayName = `withBoundary(${Component.displayName || Component.name || 'Component'})`
  return Wrapped
}
