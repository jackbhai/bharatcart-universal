import { useEffect, useRef } from 'react'

/**
 * Focus management for modal surfaces.
 *
 * Without this, a dialog is only a dialog visually. Tab moves focus behind the
 * overlay into the page underneath, a screen reader keeps announcing content
 * the user cannot see, and closing the dialog drops focus back to the top of
 * the document so keyboard users lose their place entirely.
 *
 * The three behaviours a modal owes its user:
 *
 *   1. Focus moves into the dialog when it opens.
 *   2. Tab and Shift+Tab cycle within it and cannot escape.
 *   3. Focus returns to whatever opened it on close.
 *
 * Used by Modal and Drawer. Any future overlay should use it too.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function getFocusable(container) {
  if (!container) return []
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter(el => {
    // Explicitly hidden, by any of the three ways markup can say so.
    if (el.hasAttribute('aria-hidden')) return false
    if (el.hidden || el.closest?.('[hidden]')) return false

    // Layout-based visibility, but only where layout actually exists.
    // offsetParent is null for display:none AND for position:fixed elements —
    // which a modal's own children often are — so it cannot be trusted alone.
    // In a non-rendering environment (jsdom, SSR) there is no layout at all,
    // and treating "no measurements" as "invisible" would wrongly report a
    // dialog as having nothing to focus.
    const hasLayout = typeof el.getClientRects === 'function'
    if (!hasLayout) return true
    const rects = el.getClientRects().length
    const measurable = rects > 0 || el.offsetParent !== null
    if (measurable) return true

    // No measurements anywhere in the document means no layout engine, not a
    // hidden element. Fall back to trusting the markup.
    const docHasLayout = typeof document !== 'undefined'
      && document.body
      && document.body.getClientRects
      && document.body.getClientRects().length > 0
    return !docHasLayout
  })
}

export default function useFocusTrap(active, { onEscape } = {}) {
  const ref = useRef(null)
  const previouslyFocused = useRef(null)

  useEffect(() => {
    if (!active) return
    const container = ref.current
    if (!container) return

    // Remember where focus came from so it can be restored precisely.
    previouslyFocused.current = document.activeElement

    // Move focus in. Prefer the first genuinely interactive element; fall back
    // to the container itself so focus is at least inside the dialog.
    const focusables = getFocusable(container)
    const first = focusables[0]
    if (first) {
      first.focus()
    } else {
      container.setAttribute('tabindex', '-1')
      container.focus()
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onEscape?.()
        return
      }
      if (e.key !== 'Tab') return

      // Recompute on every Tab: dialog contents change as the user types,
      // expands sections, or a list loads.
      const items = getFocusable(container)
      if (!items.length) {
        e.preventDefault()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]

      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault()
        lastItem.focus()
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault()
        firstItem.focus()
      } else if (!container.contains(document.activeElement)) {
        // Focus escaped some other way (a click outside, programmatic focus).
        e.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      // Restore focus, but only if the origin is still in the document —
      // returning focus to a removed node silently sends it to <body>.
      const prev = previouslyFocused.current
      if (prev && document.contains(prev) && typeof prev.focus === 'function') {
        prev.focus()
      }
    }
  }, [active, onEscape])

  return ref
}

/**
 * Hides background content from assistive technology while a modal is open.
 * Visual users get an overlay; screen reader users get nothing unless the rest
 * of the page is explicitly marked inert.
 */
export function useAriaHideBackground(active, containerRef) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return
    const root = document.getElementById('root')
    if (!root) return

    // Only hide siblings that do not contain the dialog itself.
    const hidden = []
    for (const child of Array.from(root.children)) {
      if (containerRef?.current && child.contains(containerRef.current)) continue
      if (child.getAttribute('aria-hidden') === 'true') continue
      child.setAttribute('aria-hidden', 'true')
      hidden.push(child)
    }
    return () => hidden.forEach(el => el.removeAttribute('aria-hidden'))
  }, [active, containerRef])
}

/**
 * Locks body scroll. A modal that scrolls the page behind it is disorienting
 * on desktop and effectively broken on touch.
 */
export function useScrollLock(active) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return
    const { body } = document
    const previous = body.style.overflow
    const previousPad = body.style.paddingRight

    // Compensate for the scrollbar disappearing, otherwise the whole layout
    // shifts sideways the moment a dialog opens.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`

    return () => {
      body.style.overflow = previous
      body.style.paddingRight = previousPad
    }
  }, [active])
}
