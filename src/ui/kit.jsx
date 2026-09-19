import React, { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { inr, inrShort, num, pct } from '../lib/analytics.js'
import { Counter, Tilt, Spotlight, Noise } from './fx.jsx'

export const cx = (...a) => a.filter(Boolean).join(' ')

/* ----------------------------------------------------------- layout */
export const Card = ({ className, children, hover = false, ...p }) => (
  <div className={cx('glass rounded-2xl elev-1',
    hover && 'glow-hover', className)} {...p}>{children}</div>
)
export const CardHead = ({ title, sub, right, icon }) => (
  <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-[var(--c-border)]">
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        {icon && <span className="text-[var(--c-text-muted)]">{icon}</span>}
        <h3 className="font-semibold text-[var(--c-text)] text-[15px] truncate">{title}</h3>
      </div>
      {sub && <p className="text-xs text-[var(--c-text-muted)] mt-0.5">{sub}</p>}
    </div>
    {right}
  </div>
)

const BADGE_TINTS = {
  gray: 'var(--c-text-muted)',
  green: 'var(--c-success)',
  red: 'var(--c-danger)',
  amber: 'var(--c-warning)',
  blue: 'var(--c-info)',
  violet: 'var(--c-secondary)',
  saffron: 'var(--c-primary)',
}
export const Badge = ({ tone = 'gray', children, className }) => {
  const t = BADGE_TINTS[tone] || BADGE_TINTS.gray
  return (
    <span
      className={cx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1', className)}
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${t} 15%, transparent), color-mix(in srgb, ${t} 6%, transparent))`,
        color: `color-mix(in srgb, ${t} 80%, var(--c-text))`,
        '--tw-ring-color': `color-mix(in srgb, ${t} 38%, transparent)`,
      }}>
      {children}
    </span>
  )
}

export const Btn = ({ variant = 'primary', size = 'md', className, children, ...p }) => {
  const v = {
    primary: 'glow-primary bg-[var(--c-primary)] text-[var(--c-primary-fg)] hover:brightness-110',
    soft: 'bg-[var(--c-primary-soft)] text-[var(--c-primary)] hover:brightness-95',
    ghost: 'text-[var(--c-text-muted)] hover:bg-[color-mix(in_srgb,var(--c-text)_8%,transparent)] hover:text-[var(--c-text)]',
    saffron: 'bg-[linear-gradient(120deg,var(--c-primary),var(--c-accent))] text-white hover:brightness-105',
    danger: 'bg-[var(--c-danger)] text-white hover:brightness-110',
    outline: 'border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[color-mix(in_srgb,var(--c-text)_5%,transparent)]',
  }[variant]
  const s = { sm: 'text-xs px-2.5 py-1.5', md: 'text-sm px-3.5 py-2', lg: 'text-sm px-5 py-2.5' }[size]
  return <button className={cx('rounded-[var(--radius-sm)] font-medium transition pressable focus-ring disabled:opacity-50 disabled:cursor-not-allowed', v, s, className)} {...p}>{children}</button>
}

export const Field = ({ label, hint, children }) => (
  <label className="block">
    {label && <span className="block text-xs font-medium text-[var(--c-text-muted)] mb-1.5">{label}</span>}
    {children}
    {hint && <span className="block text-[11px] text-[var(--c-text-muted)] opacity-70 mt-1">{hint}</span>}
  </label>
)
export const Input = (p) => <input {...p} className={cx('w-full rounded-[var(--radius-sm)] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-text)] placeholder:text-[var(--c-text-muted)] placeholder:opacity-60 outline-none transition focus:border-[var(--c-primary)] focus:shadow-[0_0_0_3px_var(--c-primary-ring)]', p.className)} />
export const Select = ({ children, ...p }) => <select {...p} className={cx('w-full rounded-[var(--radius-sm)] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-text)] outline-none transition focus:border-[var(--c-primary)] focus:shadow-[0_0_0_3px_var(--c-primary-ring)]', p.className)}>{children}</select>

export const Empty = ({ title = 'Nothing here', sub }) => (
  <div className="text-center py-12 text-[var(--c-text-muted)] anim-fade-in">
    <div className="text-3xl mb-2 opacity-60">◦</div>
    <p className="text-sm font-medium text-[var(--c-text)]">{title}</p>
    {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
  </div>
)

/* ----------------------------------------------------------- KPI */
export const Kpi = ({ label, value, delta, sub, tone = 'blue', icon, numeric, fmt }) => {
  const good = delta == null ? null : delta >= 0
  const tint = {
    blue: 'var(--c-info)',
    green: 'var(--c-success)',
    saffron: 'var(--c-primary)',
    violet: 'var(--c-secondary)',
  }[tone]
  return (
    <Tilt max={5} scale={1.015} glare={false} className="h-full">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: .45, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="glass glow-hover relative overflow-hidden rounded-2xl p-4 h-full">
        <div className="absolute inset-x-0 top-0 h-20 pointer-events-none"
          style={{ background: `linear-gradient(to bottom, color-mix(in srgb, ${tint} 13%, transparent), transparent)` }} />
        <Spotlight color={`color-mix(in srgb, ${tint} 16%, transparent)`} size={260} />
        <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full" style={{ background: tint, opacity: .85 }} />
        <div className="relative pl-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--c-text-muted)] font-semibold">{label}</p>
            {icon && <span className="text-[var(--c-text-muted)] opacity-60">{icon}</span>}
          </div>
          <p className="text-[26px] leading-tight font-bold text-[var(--c-text)] mt-1.5 tabular-nums tracking-tight">
            {numeric != null ? <Counter value={numeric} format={fmt || (v => Math.round(v).toLocaleString('en-IN'))} /> : value}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {delta != null && (
              <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .3 }}
                className={cx('text-xs font-semibold inline-flex items-center gap-0.5', good ? 'text-[var(--c-success)]' : 'text-[var(--c-danger)]')}>
                {good ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
              </motion.span>
            )}
            {sub && <span className="text-xs text-[var(--c-text-muted)]">{sub}</span>}
          </div>
        </div>
      </motion.div>
    </Tilt>
  )
}

/* ----------------------------------------------------------- charts (pure SVG) */
export function AreaChart({ data, height = 180, valueKey = 'revenue', color = '#6366F1', color2 = '#F97316', fmt = inrShort }) {
  const [hover, setHover] = useState(null)
  const W = 600, H = height, P = { t: 12, r: 8, b: 24, l: 8 }
  const vals = data.map(d => d[valueKey])
  const max = Math.max(...vals, 1), min = 0
  const iw = W - P.l - P.r, ih = H - P.t - P.b
  const x = i => P.l + (i / Math.max(data.length - 1, 1)) * iw
  const y = v => P.t + ih - ((v - min) / (max - min || 1)) * ih

  // smooth catmull-rom -> bezier
  const pts = data.map((d, i) => [x(i), y(d[valueKey])])
  let line = ''
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) { line += `M${pts[0][0]},${pts[0][1]}`; continue }
    const p0 = pts[i - 1], p1 = pts[i]
    const pm = pts[i - 2] || p0, pn = pts[i + 1] || p1
    const c1 = [p0[0] + (p1[0] - pm[0]) / 6, p0[1] + (p1[1] - pm[1]) / 6]
    const c2 = [p1[0] - (pn[0] - p0[0]) / 6, p1[1] - (pn[1] - p0[1]) / 6]
    line += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p1[0].toFixed(1)},${p1[1].toFixed(1)}`
  }
  const area = `${line} L${x(data.length - 1)},${P.t + ih} L${P.l},${P.t + ih} Z`
  const uid = useMemo(() => 'g' + Math.random().toString(36).slice(2, 8), [])

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height }} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={uid + 'f'} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".30" />
            <stop offset="55%" stopColor={color} stopOpacity=".08" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={uid + 's'} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} /><stop offset="100%" stopColor={color2} />
          </linearGradient>
          <filter id={uid + 'gl'} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {[0, .25, .5, .75, 1].map(f => (
          <line key={f} x1={P.l} x2={W - P.r} y1={P.t + ih * f} y2={P.t + ih * f}
            stroke="var(--c-border)" strokeWidth="1" strokeDasharray={f === 1 ? '0' : '4 6'} opacity=".7" />
        ))}

        <motion.path initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .8, delay: .2 }}
          d={area} fill={`url(#${uid}f)`} />
        <motion.path initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          d={line} fill="none" stroke={`url(#${uid}s)`} strokeWidth="2.6" strokeLinecap="round"
          filter={`url(#${uid}gl)`} />

        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={P.t + ih} stroke={color} strokeDasharray="3 4" strokeWidth="1" opacity=".5" />
            <motion.circle initial={{ scale: 0 }} animate={{ scale: 1 }} cx={x(hover)} cy={y(data[hover][valueKey])} r="10" fill={color} opacity=".14" />
            <circle cx={x(hover)} cy={y(data[hover][valueKey])} r="4.5" fill="var(--c-surface)" stroke={color} strokeWidth="2.5" />
          </g>
        )}

        {data.map((d, i) => (
          <rect key={i} x={x(i) - iw / data.length / 2} y={P.t} width={iw / data.length} height={ih}
            fill="transparent" onMouseEnter={() => setHover(i)} style={{ cursor: 'crosshair' }} />
        ))}

        {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0).map((d, i2) => {
          const i = i2 * Math.ceil(data.length / 6)
          return <text key={i} x={x(i)} y={H - 6} fontSize="10" fill="var(--c-text-muted)" textAnchor="middle">{d.label}</text>
        })}
      </svg>

      <AnimatePresence>
        {hover != null && (
          <motion.div initial={{ opacity: 0, y: 6, scale: .94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: .94 }}
            transition={{ duration: .16 }}
            className="glass-pop absolute top-0 pointer-events-none text-[11px] rounded-xl px-2.5 py-1.5 elev-2 whitespace-nowrap"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: 'translate(-50%,-6px)', color: 'var(--c-text)' }}>
            <div className="font-bold tabular-nums">{fmt(data[hover][valueKey])}</div>
            <div className="opacity-60">{data[hover].label}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Bars({ data, fmt = num, color = '#6366F1', max: maxProp, showVal = true }) {
  const max = maxProp ?? Math.max(...data.map(d => d.value), 1)
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={d.key} className="group">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[var(--c-text-muted)] truncate pr-2">{d.key}</span>
            {showVal && <span className="text-[var(--c-text)] font-medium tabular-nums shrink-0">{fmt(d.value)}</span>}
          </div>
          <div className="h-2 rounded-full bg-[color-mix(in_srgb,var(--c-text)_8%,transparent)] overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${(d.value / max) * 100}%` }}
              transition={{ duration: .6, delay: i * .04, ease: 'easeOut' }}
              className="h-full rounded-full" style={{ background: color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function Donut({ data, size = 150, thickness = 22, colors }) {
  const palette = colors || ['#6366F1', '#F97316', '#10B981', '#8B5CF6', '#F59E0B', '#06B6D4', '#EC4899', '#64748B']
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = (size - thickness) / 2, c = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg width={size} height={size} className="shrink-0">
        <g transform={`translate(${size / 2},${size / 2}) rotate(-90)`}>
          {data.map((d, i) => {
            const frac = d.value / total
            const el = <motion.circle key={d.key} r={r} fill="none" stroke={palette[i % palette.length]}
              strokeWidth={thickness} strokeDasharray={`${c * frac} ${c}`}
              strokeDashoffset={-c * acc}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * .06 }} />
            acc += frac
            return el
          })}
        </g>
        <text x="50%" y="48%" textAnchor="middle" fontSize="18" fontWeight="600" fill="var(--c-text)">{data.length}</text>
        <text x="50%" y="61%" textAnchor="middle" fontSize="9" fill="var(--c-text-muted)">SEGMENTS</text>
      </svg>
      <div className="space-y-1.5 min-w-0 flex-1">
        {data.map((d, i) => (
          <div key={d.key} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: palette[i % palette.length] }} />
            <span className="text-[var(--c-text-muted)] truncate flex-1">{d.key}</span>
            <span className="text-[var(--c-text)] font-medium tabular-nums">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Spark({ data, color = '#10B981', w = 90, h = 28 }) {
  const max = Math.max(...data, 1), min = Math.min(...data, 0)
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * h}`).join(' ')
  return <svg width={w} height={h}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

export function Gauge({ value, label, size = 96, color }) {
  const c = color || (value > 66 ? '#EF4444' : value > 33 ? '#F59E0B' : '#10B981')
  const r = size / 2 - 8, circ = Math.PI * r
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 12}>
        <path d={`M8,${size / 2} A${r},${r} 0 0 1 ${size - 8},${size / 2}`} fill="none" stroke="var(--c-border)" strokeWidth="9" strokeLinecap="round" />
        <motion.path d={`M8,${size / 2} A${r},${r} 0 0 1 ${size - 8},${size / 2}`} fill="none" stroke={c} strokeWidth="9" strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circ}` }} animate={{ strokeDasharray: `${(value / 100) * circ} ${circ}` }} transition={{ duration: .8 }} />
        <text x="50%" y={size / 2 - 2} textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--c-text)">{value}</text>
      </svg>
      <span className="text-[10px] uppercase tracking-wide text-[var(--c-text-muted)] -mt-1">{label}</span>
    </div>
  )
}

export function Heat({ rows, cols, grid, fmt = v => v }) {
  const vals = Object.values(grid)
  const max = Math.max(...vals, 1)
  return (
    <div className="overflow-x-auto">
      <table className="text-[11px]">
        <thead><tr><th />{cols.map(c => <th key={c} className="px-2 py-1 text-[var(--c-text-muted)] font-medium">{c}</th>)}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r}>
              <td className="pr-2 text-[var(--c-text-muted)] font-medium text-right">{r}</td>
              {cols.map(c => {
                const v = grid[`${r}-${c}`] || 0
                const a = v / max
                return <td key={c} className="p-0.5">
                  <div className="w-9 h-8 rounded flex items-center justify-center font-medium"
                    style={{
                      background: a ? `color-mix(in srgb, var(--c-primary) ${Math.round((0.08 + a * 0.85) * 100)}%, transparent)` : 'color-mix(in srgb, var(--c-text) 4%, transparent)',
                      color: a > .55 ? '#fff' : 'var(--c-text-muted)',
                    }}>
                    {v || ''}
                  </div>
                </td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ----------------------------------------------------------- misc */
export const Avatar = ({ name, size = 36, tone }) => {
  const init = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const hues = ['#6366F1', '#F97316', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4', '#F59E0B']
  const h = tone || hues[name.charCodeAt(0) % hues.length]
  return (
    <div className="rounded-full grid place-items-center font-semibold text-white shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${h}, ${h}CC)`, fontSize: size * .36 }}>
      {init}
    </div>
  )
}

export const Drawer = ({ open, onClose, children, width = 'max-w-3xl' }) => (
  <AnimatePresence>
    {open && (
      <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] z-40" />
        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className={cx('glass-pop scroll-slim fixed right-0 top-0 bottom-0 w-full z-50 shadow-2xl overflow-y-auto', width)}>
          {children}
        </motion.div>
      </>
    )}
  </AnimatePresence>
)

export const Modal = ({ open, onClose, title, children, width = 'max-w-lg' }) => (
  <AnimatePresence>
    {open && (
      <div className="fixed inset-0 z-50 grid place-items-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" />
        <motion.div initial={{ opacity: 0, scale: .95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .97 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className={cx('glass-pop relative rounded-2xl elev-3 w-full', width)}>
          {title && <div className="px-5 py-4 border-b border-[var(--c-border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--c-text)]">{title}</h3>
            <button onClick={onClose} className="pressable focus-ring text-[var(--c-text-muted)] hover:text-[var(--c-text)] text-lg leading-none w-8 h-8 grid place-items-center rounded-lg">✕</button>
          </div>}
          {children}
        </motion.div>
      </div>
    )}
  </AnimatePresence>
)

/**
 * Tab strip.
 *
 * Accepts both `['a','b']` and `[{ id, label, icon, count }]`, and both
 * `active` and `value` for the selection. Display.jsx exports a Tabs with the
 * object/`value` contract; a component that imports the wrong one used to
 * render an object as a React child and crash the entire admin shell. Being
 * permissive here turns that mistake into a working tab strip.
 */
export const Tabs = ({ tabs = [], active, value, onChange, className }) => {
  const selected = value !== undefined ? value : active
  return (
    <div className={cx('flex gap-1 overflow-x-auto no-scrollbar', className)}>
      {tabs.map(t => {
        const key = t?.id ?? t
        const label = t?.label ?? t
        const isActive = selected === key
        return (
          <button key={key} onClick={() => onChange?.(key)}
            className={cx('pressable focus-ring relative px-3.5 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition inline-flex items-center gap-1.5',
              isActive ? 'text-white' : 'text-[var(--c-text-muted)] hover:text-[var(--c-text)]')}>
            {isActive && <motion.div layoutId="tabpill" transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="absolute inset-0 rounded-xl bg-[linear-gradient(120deg,var(--c-primary),var(--c-secondary))] glow-primary" />}
            {t?.icon && <span className="relative">{t.icon}</span>}
            <span className="relative">{label}</span>
            {t?.count != null && <span className="relative tabular-nums opacity-80 text-[10px]">{t.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export const Progress = ({ value, tone = 'indigo' }) => {
  const c = {
    indigo: 'var(--c-primary)',
    green: 'var(--c-success)',
    amber: 'var(--c-warning)',
    red: 'var(--c-danger)',
  }[tone]
  return (
    <div className="h-1.5 rounded-full bg-[color-mix(in_srgb,var(--c-text)_8%,transparent)] overflow-hidden">
      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ type: 'spring', stiffness: 90, damping: 20 }}
        className="h-full rounded-full" style={{ background: c }} />
    </div>
  )
}

export const Stat = ({ label, value, tone }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wide text-[var(--c-text-muted)] font-medium">{label}</p>
    <p className={cx('text-sm font-semibold mt-0.5 tabular-nums', tone || 'text-[var(--c-text)]')}>{value}</p>
  </div>
)

export function useSort(rows, initial) {
  const [sort, setSort] = useState(initial)
  const sorted = useMemo(() => {
    if (!sort) return rows
    const [k, dir] = sort
    return [...rows].sort((a, b) => {
      const x = a[k], y = b[k]
      const r = typeof x === 'string' ? x.localeCompare(y) : (x ?? 0) - (y ?? 0)
      return dir === 'asc' ? r : -r
    })
  }, [rows, sort])
  const toggle = (k) => setSort(s => s && s[0] === k ? [k, s[1] === 'asc' ? 'desc' : 'asc'] : [k, 'desc'])
  return { sorted, sort, toggle }
}

export const Th = ({ k, sort, toggle, children, className, align = 'left' }) => (
  <th onClick={() => toggle?.(k)}
    className={cx('sticky top-0 z-[5] bg-[var(--c-surface)] px-3 py-2.5 text-[11px] uppercase tracking-wide font-semibold text-[var(--c-text-muted)] select-none',
      toggle && 'cursor-pointer hover:text-[var(--c-text)]', align === 'right' && 'text-right', align === 'center' && 'text-center', className)}>
    {children}
    {k != null && sort?.[0] === k && <span className="ml-1 text-[var(--c-primary)]">{sort[1] === 'asc' ? '↑' : '↓'}</span>}
  </th>
)
