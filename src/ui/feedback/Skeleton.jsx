import React from 'react'
import { cx } from '../../lib/cx.js'

/**
 * Skeleton placeholders.
 *
 * The app used spinners. A spinner says "something is happening"; a skeleton
 * says "this is what is arriving, and here is where it will be". The second
 * measurably feels faster for the same wait, because the layout does not jump
 * when content lands and the eye already knows where to look.
 *
 * Deliberately CSS-only. These render while the app is busy — mounting a
 * chunk, parsing a dataset — which is the worst possible moment to hand
 * framer-motion a few dozen elements to animate on the main thread. The
 * shimmer is a single compositor-friendly background-position animation, and
 * it stops entirely under prefers-reduced-motion.
 */

export function Skeleton({ className, w, h = 12, rounded = 'md', style }) {
  const radius = { sm: '4px', md: '8px', lg: '12px', full: '9999px' }[rounded] || rounded
  return (
    <span
      aria-hidden="true"
      className={cx('skeleton block', className)}
      style={{ width: w, height: h, borderRadius: radius, ...style }}
    />
  )
}

/** A block of text lines, last one short so it reads as a paragraph. */
export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cx('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} h={10} w={i === lines - 1 ? '62%' : '100%'} />
      ))}
    </div>
  )
}

/** Mirrors the real KpiRow so the swap is invisible. */
export function SkeletonKpis({ columns = 4 }) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      aria-hidden="true"
    >
      {Array.from({ length: columns }, (_, i) => (
        <div key={i} className="t-card p-4 space-y-3">
          <Skeleton h={10} w="52%" />
          <Skeleton h={22} w="72%" />
          <Skeleton h={8} w="38%" />
        </div>
      ))}
    </div>
  )
}

/** Mirrors DataTable: header row, then body rows. */
export function SkeletonTable({ rows = 8, columns = 5 }) {
  return (
    <div className="t-card overflow-hidden" aria-hidden="true">
      <div
        className="grid gap-3 px-4 py-3 border-b"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, borderColor: 'var(--c-border)' }}
      >
        {Array.from({ length: columns }, (_, i) => <Skeleton key={i} h={9} w="60%" />)}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          className="grid gap-3 px-4 py-3.5 border-b last:border-0"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, borderColor: 'var(--c-border)' }}
        >
          {Array.from({ length: columns }, (_, c) => (
            // Varying widths stop the placeholder looking like a barcode.
            <Skeleton key={c} h={11} w={c === 0 ? '85%' : `${50 + ((r + c) % 4) * 12}%`} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonCard({ lines = 3, className }) {
  return (
    <div className={cx('t-card p-4 space-y-3', className)} aria-hidden="true">
      <Skeleton h={13} w="45%" />
      <SkeletonText lines={lines} />
    </div>
  )
}

/** Storefront product grid. */
export function SkeletonProducts({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="t-card overflow-hidden">
          <Skeleton h={180} rounded="0" />
          <div className="p-3 space-y-2">
            <Skeleton h={11} w="88%" />
            <Skeleton h={11} w="55%" />
            <Skeleton h={15} w="42%" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonChart({ height = 220 }) {
  return (
    <div className="t-card p-4" aria-hidden="true">
      <Skeleton h={12} w="34%" className="mb-4" />
      <div className="flex items-end gap-2" style={{ height }}>
        {Array.from({ length: 14 }, (_, i) => (
          // A deterministic pseudo-random height: varied, but identical on
          // every render, so the placeholder does not twitch.
          <Skeleton key={i} h={`${28 + ((i * 37) % 62)}%`} w="100%" rounded="sm" />
        ))}
      </div>
    </div>
  )
}

/**
 * Full-screen route placeholder. Replaces the bare spinner that every lazy
 * admin route fell back to — the operator now sees the shape of the screen
 * arriving rather than a rotating circle on an empty page.
 */
export function SkeletonScreen() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading screen">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton h={18} w={220} />
          <Skeleton h={10} w={300} />
        </div>
        <Skeleton h={38} w={120} rounded="lg" />
      </div>
      <SkeletonKpis columns={4} />
      <SkeletonTable rows={6} columns={5} />
      <span className="sr-only">Loading…</span>
    </div>
  )
}

export default Skeleton
