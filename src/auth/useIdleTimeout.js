import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Idle session timeout.
 *
 * An admin panel left open on an unattended machine is one of the more
 * mundane ways a business loses control of its data — a shared back-office
 * terminal, a laptop in a café, a browser on a shop floor. Every serious
 * admin product signs the operator out after a period of inactivity, warns
 * them first, and lets them stay signed in with one click.
 *
 * Defaults: 30 minutes idle, 2 minutes of warning. Both configurable, because
 * a warehouse terminal and a finance workstation want different numbers.
 *
 * Two details worth knowing:
 *
 *   - Activity is tracked across tabs through localStorage. Working in one tab
 *     must not sign you out of another, which is exactly what happens if each
 *     tab keeps its own timer.
 *
 *   - The countdown is checked against a wall-clock timestamp rather than
 *     counted down with setInterval. Background tabs get throttled and laptops
 *     sleep; a decrementing counter would simply be wrong on wake, leaving a
 *     session alive for hours after it should have ended.
 */

const ACTIVITY_KEY = 'bharatcart:auth:lastActivity'
const DEFAULT_IDLE_MS = 30 * 60 * 1000
const DEFAULT_WARN_MS = 2 * 60 * 1000

// Passive so scroll performance is untouched.
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'focus']

function now() { return Date.now() }

function readLastActivity() {
  try {
    const v = Number(localStorage.getItem(ACTIVITY_KEY))
    return Number.isFinite(v) && v > 0 ? v : now()
  } catch {
    return now()
  }
}

function writeLastActivity(t) {
  try { localStorage.setItem(ACTIVITY_KEY, String(t)) } catch { /* private mode */ }
}

export default function useIdleTimeout({
  enabled = true,
  idleMs = DEFAULT_IDLE_MS,
  warnMs = DEFAULT_WARN_MS,
  onTimeout,
  onWarn,
} = {}) {
  const [warning, setWarning] = useState(false)
  const [remainingMs, setRemainingMs] = useState(warnMs)
  const firedRef = useRef(false)
  const warnedRef = useRef(false)

  /** Called on any activity, and by the "stay signed in" button. */
  const reset = useCallback(() => {
    writeLastActivity(now())
    firedRef.current = false
    warnedRef.current = false
    setWarning(false)
    setRemainingMs(warnMs)
  }, [warnMs])

  useEffect(() => {
    if (!enabled) return

    // Starting fresh avoids signing someone out immediately because of a
    // timestamp left behind by a previous session.
    reset()

    const onActivity = () => {
      // While the warning is showing, ordinary activity should NOT silently
      // extend the session. The operator has been asked a direct question and
      // a stray scroll is not an answer — they must confirm.
      if (warnedRef.current) return
      writeLastActivity(now())
    }

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true })
    }

    const tick = setInterval(() => {
      const idleFor = now() - readLastActivity()
      const untilTimeout = idleMs - idleFor

      if (untilTimeout <= 0) {
        if (!firedRef.current) {
          firedRef.current = true
          setWarning(false)
          onTimeout?.()
        }
        return
      }

      if (untilTimeout <= warnMs) {
        setRemainingMs(untilTimeout)
        if (!warnedRef.current) {
          warnedRef.current = true
          setWarning(true)
          onWarn?.(untilTimeout)
        }
      } else if (warnedRef.current) {
        // Another tab reset the clock on our behalf.
        warnedRef.current = false
        setWarning(false)
      }
    }, 1000)

    return () => {
      clearInterval(tick)
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity)
    }
  }, [enabled, idleMs, warnMs, onTimeout, onWarn, reset])

  return {
    warning,
    remainingMs,
    remainingLabel: formatRemaining(remainingMs),
    staySignedIn: reset,
  }
}

export function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`
}

export { ACTIVITY_KEY, DEFAULT_IDLE_MS, DEFAULT_WARN_MS }
