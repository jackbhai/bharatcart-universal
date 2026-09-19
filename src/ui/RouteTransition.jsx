import React, { Suspense, useEffect, useRef, useState } from 'react'
import ErrorBoundary from '../core/errors/ErrorBoundary.jsx'

/**
 * Page transition that cannot leave the screen blank.
 *
 * History, because it matters for anyone tempted to "improve" this:
 *
 * The original code was `<PageFade><Suspense>…</Suspense></PageFade>`, where
 * PageFade is an AnimatePresence with mode="wait". Opening any admin screen
 * left it permanently blank until a manual page reload. AnimatePresence holds
 * an incoming child at its `initial` state until the outgoing child finishes
 * exiting; when the lazy route suspended, React swapped in the fallback, the
 * exit handshake never completed, and the page stayed pinned at opacity 0
 * behind a blur filter. The content was in the DOM the entire time, fully
 * rendered and completely invisible.
 *
 * That is also why every route test passed: they asserted on textContent,
 * which was present throughout. Tests now assert on *visible* text.
 *
 * The rebuild kept hitting the same class of problem as long as opacity was
 * owned by a JS animation library: any render that gets discarded (which is
 * exactly what Suspense does) can strand the element at its starting style.
 *
 * So this version does not animate from JavaScript at all. The entrance is a
 * plain CSS keyframe. CSS animations cannot get stuck mid-flight because of a
 * React render being thrown away, and an element with no animation applied is
 * simply visible. The failure mode is "the page appears without a transition",
 * never "the page never appears".
 */

export default function RouteTransition({ children, routeKey, fallback, animate = true }) {
  // The boundary sits inside Suspense but outside the animation, and is keyed
  // on the route so navigating away from a crashed screen clears the error.
  // A crash in one admin screen must not take the sidebar down with it.
  return (
    <Suspense fallback={fallback}>
      <ErrorBoundary level="route" label={routeKey} resetKey={routeKey}>
        <PageEnter routeKey={routeKey} animate={animate}>{children}</PageEnter>
      </ErrorBoundary>
    </Suspense>
  )
}

function PageEnter({ children, routeKey, animate }) {
  // Re-animating a route the operator has already opened makes the panel feel
  // slower than it is, so the entrance only plays the first time.
  const seen = useRef(new Set())
  const [, force] = useState(0)
  const first = !seen.current.has(routeKey)

  useEffect(() => {
    if (!seen.current.has(routeKey)) {
      seen.current.add(routeKey)
      // Re-render once so the animation class is dropped after it has played;
      // leaving it on would replay it on every unrelated state change.
      const id = setTimeout(() => force(n => n + 1), 260)
      return () => clearTimeout(id)
    }
  }, [routeKey])

  return (
    <div key={routeKey} className={animate && first ? 'route-enter' : undefined}>
      {children}
    </div>
  )
}

export { RouteTransition }
