import React, { useState } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { cx } from '../../ui/kit.jsx'

const Row = ({ label, children }) => (
  <div className="py-2.5 border-b last:border-0" style={{ borderColor: 'var(--c-border)' }}>
    <label className="text-[12px] font-medium block mb-1.5" style={{ color: 'var(--c-text)' }}>{label}</label>
    {children}
  </div>
)

const Toggle = ({ value, onChange }) => (
  <button onClick={() => onChange(!value)} className="relative w-11 h-6 rounded-full transition-colors"
    style={{ background: value ? 'var(--c-primary)' : 'var(--c-border)' }}>
    <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow" style={{ left: value ? 22 : 2 }} />
  </button>
)

const Choice = ({ value, options, onChange }) => (
  <div className="flex flex-wrap gap-1">
    {options.map(o => (
      <button key={o.value ?? o} onClick={() => onChange(o.value ?? o)}
        className="px-2.5 py-1.5 text-[11px] rounded-lg border capitalize transition-all"
        style={value === (o.value ?? o)
          ? { background: 'var(--c-primary)', color: 'var(--c-primary-fg)', borderColor: 'var(--c-primary)' }
          : { background: 'var(--c-surface)', color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}>
        {o.label ?? o}
      </button>
    ))}
  </div>
)

export default function HeaderBuilder({ theme }) {
  const h = theme.header
  const [editing, setEditing] = useState(null)
  const [navItems, setNavItems] = useState(h.nav)

  React.useEffect(() => { setNavItems(h.nav) }, [h.nav])

  const commitOrder = (next) => {
    setNavItems(next)
    // translate the reordered array back into index moves
    const oldIds = h.nav.map(n => n.id)
    const newIds = next.map(n => n.id)
    for (let i = 0; i < newIds.length; i++) {
      if (oldIds[i] !== newIds[i]) {
        const from = oldIds.indexOf(newIds[i])
        theme.reorderNav(from, i)
        return
      }
    }
  }

  return (
    <div>
      <h3 className="text-[13px] font-semibold mb-1" style={{ color: 'var(--c-text)' }}>Header</h3>
      <p className="text-[11px] mb-2" style={{ color: 'var(--c-text-muted)' }}>
        Layout, announcement bar and navigation
      </p>

      <Row label="Layout">
        <Choice value={h.layout} onChange={v => theme.setHeader({ layout: v })}
          options={[
            { value: 'logo-left', label: 'Logo left' },
            { value: 'centered', label: 'Centered' },
            { value: 'split', label: 'Split' },
          ]} />
      </Row>

      <Row label="Sticky on scroll"><Toggle value={h.sticky} onChange={v => theme.setHeader({ sticky: v })} /></Row>
      <Row label="Transparent over hero">
        <Toggle value={h.transparentOnHero} onChange={v => theme.setHeader({ transparentOnHero: v })} />
      </Row>

      <Row label="Search style">
        <Choice value={h.search} onChange={v => theme.setHeader({ search: v })}
          options={['icon', 'inline', 'full']} />
      </Row>

      <div className="py-2.5 border-b" style={{ borderColor: 'var(--c-border)' }}>
        <p className="text-[12px] font-medium mb-2" style={{ color: 'var(--c-text)' }}>Show in header</p>
        <div className="space-y-2">
          {[['showWishlist', 'Wishlist'], ['showAccount', 'Account'], ['showCart', 'Cart']].map(([k, label]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>{label}</span>
              <Toggle value={h[k]} onChange={v => theme.setHeader({ [k]: v })} />
            </div>
          ))}
        </div>
      </div>

      {/* ---- announcement bar */}
      <div className="py-2.5 border-b" style={{ borderColor: 'var(--c-border)' }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-medium" style={{ color: 'var(--c-text)' }}>Announcement bar</p>
          <Toggle value={h.announcement.enabled} onChange={v => theme.setAnnouncement({ enabled: v })} />
        </div>
        <AnimatePresence>
          {h.announcement.enabled && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden">
              <textarea value={h.announcement.text} rows={2}
                onChange={e => theme.setAnnouncement({ text: e.target.value })}
                className="t-input w-full px-2.5 py-2 text-[12px] resize-none" />
              <div className="flex items-center gap-2">
                <span className="text-[11px] shrink-0" style={{ color: 'var(--c-text-muted)' }}>Speed</span>
                <input type="range" min={8} max={60} value={h.announcement.speed}
                  onChange={e => theme.setAnnouncement({ speed: Number(e.target.value) })} className="flex-1" />
                <span className="text-[11px] tabular-nums w-6" style={{ color: 'var(--c-text-muted)' }}>
                  {h.announcement.speed}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---- nav items */}
      <div className="py-2.5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-medium" style={{ color: 'var(--c-text)' }}>
            Navigation <span style={{ color: 'var(--c-text-muted)' }}>({h.nav.length})</span>
          </p>
          <button onClick={() => theme.addNavItem({ label: 'New link', href: '/shop' })}
            className="text-[11px] px-2 py-1 rounded-lg font-semibold"
            style={{ background: 'var(--c-primary-soft)', color: 'var(--c-primary)' }}>
            + Add
          </button>
        </div>

        <Reorder.Group axis="y" values={navItems} onReorder={commitOrder} className="space-y-1.5">
          {navItems.map(item => (
            <Reorder.Item key={item.id} value={item}
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <span className="cursor-grab active:cursor-grabbing text-[11px] select-none"
                  style={{ color: 'var(--c-text-muted)' }}>⠿</span>
                <input value={item.label}
                  onChange={e => theme.updateNavItem(item.id, { label: e.target.value })}
                  className="flex-1 bg-transparent text-[12px] outline-none min-w-0"
                  style={{ color: 'var(--c-text)' }} />
                <button onClick={() => setEditing(editing === item.id ? null : item.id)}
                  className="text-[10px] px-1.5 py-1 rounded" style={{ color: 'var(--c-text-muted)' }}>
                  {editing === item.id ? '▴' : '▾'}
                </button>
                <button onClick={() => theme.removeNavItem(item.id)}
                  className="text-[13px] leading-none px-1" style={{ color: 'var(--c-danger)' }}>×</button>
              </div>
              <AnimatePresence>
                {editing === item.id && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    className="overflow-hidden px-2 pb-2">
                    <input value={item.href} placeholder="#/shop"
                      onChange={e => theme.updateNavItem(item.id, { href: e.target.value })}
                      className="t-input w-full px-2 py-1.5 text-[11px] font-mono" />
                  </motion.div>
                )}
              </AnimatePresence>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>
    </div>
  )
}
