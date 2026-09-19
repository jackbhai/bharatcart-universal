import React, { useState, useRef, useEffect, useMemo, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cx } from '../../lib/cx.js'
import useFocusTrap, { useAriaHideBackground, useScrollLock } from '../a11y/useFocusTrap.js'

/* ------------------------------------------------------------- badges */
export function Badge({ children, tone = 'neutral', size = 'md', dot, icon }) {
  const tones = {
    neutral: { bg: 'var(--c-surface-alt)', fg: 'var(--c-text-muted)' },
    primary: { bg: 'var(--c-primary-soft)', fg: 'var(--c-primary)' },
    success: { bg: 'color-mix(in srgb, var(--c-success) 14%, transparent)', fg: 'var(--c-success)' },
    warning: { bg: 'color-mix(in srgb, var(--c-warning) 16%, transparent)', fg: 'var(--c-warning)' },
    danger:  { bg: 'color-mix(in srgb, var(--c-danger) 12%, transparent)', fg: 'var(--c-danger)' },
    info:    { bg: 'color-mix(in srgb, var(--c-info) 12%, transparent)', fg: 'var(--c-info)' },
    dark:    { bg: 'var(--c-text)', fg: 'var(--c-surface)' },
  }[tone] || {}
  const s = size === 'sm' ? 'text-[9.5px] px-1.5 py-0.5' : size === 'lg' ? 'text-[12px] px-2.5 py-1' : 'text-[10.5px] px-2 py-0.5'
  return (
    <span className={cx('inline-flex items-center gap-1 font-semibold rounded-md whitespace-nowrap', s)}
      style={{ background: tones.bg, color: tones.fg }}>
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: tones.fg }} />}
      {icon}{children}
    </span>
  )
}

export function Pill({ children, active, onClick, count }) {
  return (
    <button onClick={onClick}
      className="px-2.5 py-1.5 text-[11.5px] font-medium rounded-lg border transition-all whitespace-nowrap inline-flex items-center gap-1.5"
      style={active
        ? { background: 'var(--c-primary)', color: 'var(--c-primary-fg)', borderColor: 'var(--c-primary)' }
        : { background: 'var(--c-surface)', color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}>
      {children}
      {count != null && <span className="tabular-nums opacity-60">{count}</span>}
    </button>
  )
}

/* -------------------------------------------------------------- cards */
export function Card({ children, className, hover, padding = true, ...p }) {
  return (
    <div className={cx('t-card', hover && 't-card-hover', padding && 'p-4', className)} {...p}>
      {children}
    </div>
  )
}

export function CardHead({ title, subtitle, action, icon }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="flex items-start gap-2.5 min-w-0">
        {icon && <span className="text-[16px] mt-0.5 shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h3 className="font-semibold text-[14px] leading-tight" style={{ color: 'var(--c-text)' }}>{title}</h3>
          {subtitle && <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

/* ------------------------------------------------------------ avatars */
const AV_COLOURS = ['#6366F1','#F97316','#10B981','#EC4899','#8B5CF6','#0EA5E9','#F59E0B','#EF4444']

export function Avatar({ name = '', src, size = 34, ring }) {
  const initials = String(name).split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  const bg = AV_COLOURS[Math.abs(h) % AV_COLOURS.length]
  return (
    <span className="relative inline-grid place-items-center rounded-full font-semibold shrink-0 overflow-hidden"
      style={{
        width: size, height: size, background: src ? undefined : bg, color: '#fff',
        fontSize: size * 0.38,
        boxShadow: ring ? `0 0 0 2px var(--c-surface), 0 0 0 4px ${bg}` : undefined,
      }}>
      {src ? <img src={src} alt={name} loading="lazy" className="w-full h-full object-cover" /> : initials}
    </span>
  )
}

export function AvatarGroup({ people = [], max = 4, size = 28 }) {
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={i} style={{ marginLeft: i ? -size * 0.3 : 0, zIndex: shown.length - i }}
          className="rounded-full" >
          <Avatar name={p.name ?? p} src={p.avatar} size={size} ring />
        </span>
      ))}
      {rest > 0 && (
        <span className="grid place-items-center rounded-full font-semibold"
          style={{ width: size, height: size, marginLeft: -size * 0.3, fontSize: size * 0.34,
            background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)',
            boxShadow: '0 0 0 2px var(--c-surface)' }}>
          +{rest}
        </span>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ feedback */
export function Progress({ value = 0, max = 100, tone = 'primary', height = 6, label, animated = true }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const colour = { primary: 'var(--c-primary)', success: 'var(--c-success)', warning: 'var(--c-warning)', danger: 'var(--c-danger)' }[tone]
  return (
    <div>
      {label && (
        <div className="flex justify-between text-[11px] mb-1" style={{ color: 'var(--c-text-muted)' }}>
          <span>{label}</span><span className="tabular-nums">{Math.round(pct)}%</span>
        </div>
      )}
      <div className="rounded-full overflow-hidden" style={{ height, background: 'var(--c-border)' }}>
        <motion.div initial={animated ? { width: 0 } : false} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full" style={{ background: colour }} />
      </div>
    </div>
  )
}

export function Empty({ icon = '◌', title, description, action }) {
  return (
    <div className="py-12 text-center">
      <div className="text-3xl mb-2 opacity-30">{icon}</div>
      <p className="font-semibold text-[13.5px]" style={{ color: 'var(--c-text)' }}>{title}</p>
      {description && <p className="text-[12px] mt-1 max-w-xs mx-auto" style={{ color: 'var(--c-text-muted)' }}>{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ width, height = 14, rounded = 'var(--radius-sm)', className }) {
  return (
    <span className={cx('block relative overflow-hidden', className)}
      style={{ width, height, borderRadius: rounded, background: 'var(--c-surface-alt)' }}>
      <motion.span
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-y-0 w-1/3"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)' }} />
    </span>
  )
}

export function Divider({ label, className }) {
  if (!label) return <div className={cx('h-px w-full', className)} style={{ background: 'var(--c-border)' }} />
  return (
    <div className={cx('flex items-center gap-3', className)}>
      <div className="flex-1 h-px" style={{ background: 'var(--c-border)' }} />
      <span className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: 'var(--c-border)' }} />
    </div>
  )
}

/* ------------------------------------------------------------ tooltip */
export function Tooltip({ children, content, side = 'top' }) {
  const [show, setShow] = useState(false)
  const pos = {
    top: { bottom: '100%', left: '50%', x: '-50%', mb: 6 },
    bottom: { top: '100%', left: '50%', x: '-50%', mt: 6 },
    left: { right: '100%', top: '50%', y: '-50%', mr: 6 },
    right: { left: '100%', top: '50%', y: '-50%', ml: 6 },
  }[side]
  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && content && (
          <motion.span initial={{ opacity: 0, scale: .92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .92 }}
            transition={{ duration: .13 }}
            className="absolute z-50 px-2 py-1 rounded-md text-[11px] whitespace-nowrap pointer-events-none shadow-lg"
            style={{
              background: 'var(--c-text)', color: 'var(--c-surface)',
              bottom: pos.bottom, top: pos.top, left: pos.left, right: pos.right,
              transform: `translate(${pos.x || 0}, ${pos.y || 0})`,
              marginBottom: pos.mb, marginTop: pos.mt, marginRight: pos.mr, marginLeft: pos.ml,
            }}>
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

/* --------------------------------------------------------------- tabs */
export function Tabs({ tabs = [], value, onChange, size = 'md', full, label }) {
  const pad = size === 'sm' ? 'px-2.5 py-1.5 text-[11.5px]' : 'px-3 py-2 text-[12.5px]'
  const id = useRef('tabs' + Math.random().toString(36).slice(2, 7)).current

  /**
   * Arrow-key navigation, per the WAI-ARIA tabs pattern. A tablist is a single
   * tab stop: Tab enters it, arrows move between tabs, Home/End jump to the
   * ends. Without this a keyboard user has to Tab through every tab to reach
   * the content, and on a 10-tab screen that is genuinely painful.
   */
  const onKeyDown = (e) => {
    const keys = tabs.map(t => t.id ?? t)
    const i = keys.indexOf(value)
    if (i < 0) return
    let next = null
    if (e.key === 'ArrowRight') next = keys[(i + 1) % keys.length]
    else if (e.key === 'ArrowLeft') next = keys[(i - 1 + keys.length) % keys.length]
    else if (e.key === 'Home') next = keys[0]
    else if (e.key === 'End') next = keys[keys.length - 1]
    if (next != null) {
      e.preventDefault()
      onChange?.(next)
    }
  }

  return (
    <div
      role="tablist"
      aria-label={label || 'Sections'}
      onKeyDown={onKeyDown}
      className={cx('flex gap-1 overflow-x-auto no-scrollbar', full && 'w-full')}>
      {tabs.map(t => {
        const key = t.id ?? t
        const label = t.label ?? t
        const active = value === key
        return (
          <button key={key} onClick={() => onChange?.(key)}
            type="button"
            role="tab"
            id={`${id}-tab-${key}`}
            aria-selected={active}
            aria-controls={`${id}-panel-${key}`}
            // Roving tabindex: only the active tab is reachable by Tab.
            tabIndex={active ? 0 : -1}
            className={cx('relative font-semibold rounded-lg whitespace-nowrap transition-colors inline-flex items-center gap-1.5 min-h-[40px]', pad, full && 'flex-1 justify-center')}
            style={{ color: active ? 'var(--c-primary-fg)' : 'var(--c-text-muted)' }}>
            {active && <motion.span layoutId={id} transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="absolute inset-0 rounded-lg" style={{ background: 'var(--c-primary)' }} />}
            {t.icon && <span className="relative">{t.icon}</span>}
            <span className="relative">{label}</span>
            {t.count != null && <span className="relative tabular-nums opacity-70 text-[10px]">{t.count}</span>}
            {/* The count is meaningful; make sure it is announced as such. */}
            {t.count != null && <span className="sr-only">{`, ${t.count} items`}</span>}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------- overlays */
export function Modal({ open, onClose, title, children, footer, size = 'md', label }) {
  const width = { sm: 380, md: 520, lg: 720, xl: 960 }[size]
  // Escape, focus trapping and focus restoration all live in the hook so every
  // overlay in the app behaves identically.
  const panelRef = useFocusTrap(open, { onEscape: onClose })
  useAriaHideBackground(open, panelRef)
  useScrollLock(open)
  const titleId = useId()

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} aria-hidden="true" className="absolute inset-0 backdrop-blur-sm"
            style={{ background: 'rgba(8,12,26,.55)' }} />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={!title ? (label || 'Dialog') : undefined}
            initial={{ opacity: 0, scale: .95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: .96, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative t-card w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
            style={{ maxWidth: width, padding: 0 }}>
            {title && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b shrink-0"
                style={{ borderColor: 'var(--c-border)' }}>
                <h3 id={titleId} className="font-semibold text-[14px]" style={{ color: 'var(--c-text)' }}>{title}</h3>
                <button type="button" onClick={onClose} aria-label="Close dialog"
                  className="text-[18px] leading-none opacity-40 hover:opacity-100 transition-opacity min-w-[44px] min-h-[44px] grid place-items-center -mr-2"
                  style={{ color: 'var(--c-text)' }}><span aria-hidden="true">×</span></button>
              </div>
            )}
            <div className="p-4 overflow-y-auto flex-1">{children}</div>
            {footer && <div className="px-4 py-3 border-t shrink-0 flex justify-end gap-2"
              style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface-alt)' }}>{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function Drawer({ open, onClose, title, children, footer, side = 'right', width = 440, label }) {
  const isRight = side === 'right'
  // A drawer is a dialog too - same focus contract as Modal.
  const panelRef = useFocusTrap(open, { onEscape: onClose })
  useAriaHideBackground(open, panelRef)
  useScrollLock(open)
  const titleId = useId()
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[150]">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} aria-hidden="true" className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(8,12,26,.5)' }} />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={!title ? (label || 'Panel') : undefined}
            initial={{ x: isRight ? '100%' : '-100%' }} animate={{ x: 0 }} exit={{ x: isRight ? '100%' : '-100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 36 }}
            className="absolute top-0 bottom-0 flex flex-col shadow-2xl"
            style={{ [side]: 0, width: '100%', maxWidth: width, background: 'var(--c-surface)' }}>
            {title && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b shrink-0"
                style={{ borderColor: 'var(--c-border)' }}>
                <h3 id={titleId} className="font-semibold text-[14px]" style={{ color: 'var(--c-text)' }}>{title}</h3>
                <button type="button" onClick={onClose} aria-label="Close panel"
                  className="text-[18px] leading-none opacity-40 hover:opacity-100 min-w-[44px] min-h-[44px] grid place-items-center -mr-2"
                  style={{ color: 'var(--c-text)' }}><span aria-hidden="true">×</span></button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4">{children}</div>
            {footer && <div className="px-4 py-3 border-t shrink-0" style={{ borderColor: 'var(--c-border)' }}>{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function Popover({ trigger, children, align = 'right', width = 240 }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div className="relative inline-block" ref={ref}>
      <span onClick={() => setOpen(o => !o)}>{trigger}</span>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: .98 }} transition={{ duration: .15 }}
            className="absolute z-50 mt-1.5 t-card shadow-xl p-2"
            style={{ [align]: 0, width, padding: 8 }}>
            {typeof children === 'function' ? children(() => setOpen(false)) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default { Badge, Card, CardHead, Avatar, Progress, Empty, Skeleton, Tooltip, Tabs, Modal, Drawer, Popover }
