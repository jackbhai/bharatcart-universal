import React from 'react'
import { motion } from 'framer-motion'
import { Card, Tooltip } from '../primitives/Display.jsx'
import { Counter } from '../fx.jsx'
import { useDeviceProfile } from '../useDeviceProfile.js'

/**
 * A KPI value is usually a pre-formatted string — "₹7.34 Cr", "71%", "1,018".
 * Counting up only makes sense for a plain number, and forcing a string
 * through a numeric animation would print NaN or strip the units.
 *
 * So: parse conservatively. If the value is a bare number, or a number with a
 * simple prefix/suffix we can reassemble exactly, animate it. Anything more
 * elaborate renders as-is. Getting this wrong is worse than not animating.
 */
export function parseCountable(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { n: value, prefix: '', suffix: '' }
  }
  if (typeof value !== 'string') return null

  // e.g. "₹1,23,456" / "1,018" / "71%" / "4.2x" — but NOT "₹7.34 Cr", where
  // the unit carries meaning that a raw count-up would mangle.
  const m = value.match(/^([^\d-]*)([\d,]+(?:\.\d+)?)([%x]?)$/)
  if (!m) return null
  const n = Number(m[2].replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  // Very small numbers finish counting before the eye registers it started.
  if (Math.abs(n) < 10) return null
  return { n, prefix: m[1], suffix: m[3], decimals: (m[2].split('.')[1] || '').length }
}

/**
 * The KPI strip that heads every admin module.
 *
 * Each module had grown its own private `Stat` component with slightly
 * different padding and tone names. One shared implementation keeps the whole
 * panel visually consistent and means a change to the hover animation lands
 * everywhere at once.
 */

const TONES = {
  neutral: 'var(--c-text)',
  primary: 'var(--c-primary)',
  success: 'var(--c-success, #16a34a)',
  warn: 'var(--c-warn, #d97706)',
  danger: 'var(--c-danger, #dc2626)',
  info: 'var(--c-info, #0284c7)',
}

export function Kpi({ label, value, sub, tone = 'neutral', icon, hint, delta, onClick, index = 0, countUp = true }) {
  const colour = TONES[tone] ?? TONES.neutral
  const clickable = typeof onClick === 'function'
  const device = useDeviceProfile()

  // Count-up is the single most effective "this dashboard is alive" cue, but
  // it is also the one most likely to misrender a formatted value, so it is
  // gated on a conservative parse and on the device profile.
  const countable = countUp && device.motion ? parseCountable(value) : null

  const body = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      // Stagger is capped so a row of twelve KPIs does not take a second to
      // appear; after the eighth they all arrive together.
      transition={{ duration: 0.28, delay: Math.min(index, 8) * 0.035, ease: [0.22, 1, 0.36, 1] }}
      whileHover={clickable ? { y: -3, boxShadow: '0 12px 28px -14px rgba(8,12,26,.3)' } : undefined}
      whileTap={clickable ? { y: -1, scale: .995 } : undefined}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      className={'rounded-[var(--radius-md)] px-3.5 py-3 h-full transition-shadow ' + (clickable ? 'cursor-pointer' : '')}
      style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-[13px] opacity-70" aria-hidden="true">{icon}</span>}
        <span className="text-[11px] uppercase tracking-wide font-semibold truncate"
          style={{ color: 'var(--c-text-muted)' }}>{label}</span>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[19px] font-bold leading-tight tabular-nums" style={{ color: colour }}>
          {countable
            ? <Counter
                value={countable.n}
                duration={0.9}
                format={v => countable.prefix
                  + v.toLocaleString('en-IN', {
                      minimumFractionDigits: countable.decimals || 0,
                      maximumFractionDigits: countable.decimals || 0,
                    })
                  + countable.suffix}
              />
            : value}
        </span>
        {delta != null && (
          <span className="text-[11.5px] font-semibold tabular-nums"
            style={{ color: delta >= 0 ? TONES.success : TONES.danger }}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </span>
        )}
      </div>
      {sub && <div className="text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--c-text-muted)' }}>{sub}</div>}
    </motion.div>
  )

  return hint ? <Tooltip content={hint}>{body}</Tooltip> : body
}

/**
 * Responsive KPI grid. Two columns on a phone so numbers stay readable rather
 * than being squeezed into a horizontal scroll.
 */
export default function KpiRow({ items = [], columns = 4, className = '' }) {
  const cols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6',
  }[columns] ?? 'grid-cols-2 md:grid-cols-4'

  return (
    <div className={`grid ${cols} gap-2.5 ${className}`}>
      {items.filter(Boolean).map((item, i) => (
        <Kpi key={item.label ?? i} index={i} {...item} />
      ))}
    </div>
  )
}

export { KpiRow }
