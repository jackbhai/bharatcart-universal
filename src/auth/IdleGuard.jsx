import React, { useCallback } from 'react'
import useIdleTimeout, { formatRemaining } from './useIdleTimeout.js'
import useAuth from '../hooks/useAuth.js'
import useFocusTrap from '../ui/a11y/useFocusTrap.js'

/**
 * The warning dialog for an idling session.
 *
 * Signing someone out without notice loses their unsaved work and feels like
 * a bug. Warn, count down visibly, and make staying signed in a single
 * obvious click.
 */
export default function IdleGuard({ idleMs, warnMs, enabled = true }) {
  const auth = useAuth()

  const handleTimeout = useCallback(() => {
    auth.signOut?.()
    // A hash change rather than a reload, so the app keeps its state and the
    // operator lands on the staff sign-in screen with an explanation.
    window.location.hash = '#/admin/login?reason=timeout'
  }, [auth])

  const { warning, remainingMs, staySignedIn } = useIdleTimeout({
    // Only guard an actually signed-in session; a visitor browsing the shop
    // has nothing to time out of.
    enabled: enabled && !!auth.isAuthed,
    idleMs,
    warnMs,
    onTimeout: handleTimeout,
  })

  const panelRef = useFocusTrap(warning, { onEscape: staySignedIn })

  if (!warning) return null

  return (
    <div className="fixed inset-0 z-[300] grid place-items-center p-4">
      <div aria-hidden="true" className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(8,12,26,.6)' }} />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-title"
        aria-describedby="idle-desc"
        className="relative t-card p-6 max-w-sm w-full text-center"
      >
        <p className="text-3xl mb-2" aria-hidden="true">⏳</p>
        <h2 id="idle-title" className="font-bold text-lg" style={{ color: 'var(--c-text)' }}>
          Still there?
        </h2>
        <p id="idle-desc" className="text-sm mt-2" style={{ color: 'var(--c-text-muted)' }}>
          You will be signed out in{' '}
          {/* The countdown updates every second; announcing each tick would be
              unbearable with a screen reader, so the region is silent and the
              dialog description carries the meaning. */}
          <strong aria-hidden="true" className="tabular-nums">{formatRemaining(remainingMs)}</strong>
          <span className="sr-only">less than two minutes</span>
          {' '}because of inactivity.
        </p>

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={staySignedIn}
            className="t-btn t-btn-primary flex-1 py-2.5 text-sm min-h-[44px]"
          >
            Stay signed in
          </button>
          <button
            type="button"
            onClick={handleTimeout}
            className="t-btn flex-1 py-2.5 text-sm border min-h-[44px]"
            style={{ borderColor: 'var(--c-border)', color: 'var(--c-text)' }}
          >
            Sign out now
          </button>
        </div>
      </div>
    </div>
  )
}
