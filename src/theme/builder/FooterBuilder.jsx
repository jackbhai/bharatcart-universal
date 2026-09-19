import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const Toggle = ({ value, onChange }) => (
  <button onClick={() => onChange(!value)} className="relative w-11 h-6 rounded-full transition-colors shrink-0"
    style={{ background: value ? 'var(--c-primary)' : 'var(--c-border)' }}>
    <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow" style={{ left: value ? 22 : 2 }} />
  </button>
)

export default function FooterBuilder({ theme }) {
  const f = theme.footer
  const [open, setOpen] = useState(null)

  return (
    <div>
      <h3 className="text-[13px] font-semibold mb-1" style={{ color: 'var(--c-text)' }}>Footer</h3>
      <p className="text-[11px] mb-2" style={{ color: 'var(--c-text-muted)' }}>
        Columns, links, newsletter and badges
      </p>

      {/* ---- columns */}
      <div className="py-2.5 border-b" style={{ borderColor: 'var(--c-border)' }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-medium" style={{ color: 'var(--c-text)' }}>
            Columns <span style={{ color: 'var(--c-text-muted)' }}>({f.columns.length})</span>
          </p>
          <button onClick={theme.addFooterColumn}
            className="text-[11px] px-2 py-1 rounded-lg font-semibold"
            style={{ background: 'var(--c-primary-soft)', color: 'var(--c-primary)' }}>
            + Column
          </button>
        </div>

        <div className="space-y-1.5">
          {f.columns.map(col => (
            <div key={col.id} className="rounded-lg border overflow-hidden"
              style={{ borderColor: 'var(--c-border)' }}>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <input value={col.title}
                  onChange={e => theme.updateFooterColumn(col.id, { title: e.target.value })}
                  className="flex-1 bg-transparent text-[12px] font-medium outline-none min-w-0"
                  style={{ color: 'var(--c-text)' }} />
                <span className="text-[10px] tabular-nums" style={{ color: 'var(--c-text-muted)' }}>
                  {col.links.length}
                </span>
                <button onClick={() => setOpen(open === col.id ? null : col.id)}
                  className="text-[10px] px-1" style={{ color: 'var(--c-text-muted)' }}>
                  {open === col.id ? '▴' : '▾'}
                </button>
                <button onClick={() => theme.removeFooterColumn(col.id)}
                  className="text-[13px] leading-none px-1" style={{ color: 'var(--c-danger)' }}>×</button>
              </div>

              <AnimatePresence>
                {open === col.id && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    className="overflow-hidden px-2 pb-2 space-y-1">
                    {col.links.map(l => (
                      <div key={l.id} className="flex items-center gap-1.5">
                        <input value={l.label}
                          onChange={e => theme.updateFooterColumn(col.id, {
                            links: col.links.map(x => x.id === l.id ? { ...x, label: e.target.value } : x),
                          })}
                          className="t-input flex-1 px-2 py-1 text-[11px] min-w-0" />
                        <input value={l.href}
                          onChange={e => theme.updateFooterColumn(col.id, {
                            links: col.links.map(x => x.id === l.id ? { ...x, href: e.target.value } : x),
                          })}
                          className="t-input w-20 px-2 py-1 text-[10px] font-mono" />
                        <button onClick={() => theme.removeFooterLink(col.id, l.id)}
                          className="text-[12px] px-0.5" style={{ color: 'var(--c-danger)' }}>×</button>
                      </div>
                    ))}
                    <button onClick={() => theme.addFooterLink(col.id)}
                      className="w-full text-[11px] py-1 rounded border border-dashed"
                      style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-muted)' }}>
                      + link
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* ---- blocks */}
      <div className="py-2.5 border-b space-y-2" style={{ borderColor: 'var(--c-border)' }}>
        <p className="text-[12px] font-medium mb-1" style={{ color: 'var(--c-text)' }}>Blocks</p>
        {[
          ['newsletter', 'Newsletter signup'],
          ['paymentBadges', 'Payment badges'],
          ['trustBadges', 'Trust badges'],
          ['appBadges', 'App store badges'],
          ['backToTop', 'Back to top'],
        ].map(([k, label]) => (
          <div key={k} className="flex items-center justify-between gap-2">
            <span className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>{label}</span>
            <Toggle value={f[k]} onChange={v => theme.setFooter({ [k]: v })} />
          </div>
        ))}
      </div>

      {f.newsletter && (
        <div className="py-2.5 border-b space-y-2" style={{ borderColor: 'var(--c-border)' }}>
          <input value={f.newsletterTitle} placeholder="Newsletter title"
            onChange={e => theme.setFooter({ newsletterTitle: e.target.value })}
            className="t-input w-full px-2.5 py-2 text-[12px]" />
          <textarea value={f.newsletterText} rows={2} placeholder="Newsletter subtext"
            onChange={e => theme.setFooter({ newsletterText: e.target.value })}
            className="t-input w-full px-2.5 py-2 text-[12px] resize-none" />
        </div>
      )}

      {/* ---- socials */}
      <div className="py-2.5 border-b" style={{ borderColor: 'var(--c-border)' }}>
        <p className="text-[12px] font-medium mb-2" style={{ color: 'var(--c-text)' }}>Social links</p>
        <div className="space-y-1.5">
          {f.socials.map(s => (
            <div key={s.id} className="flex items-center gap-1.5">
              <span className="text-[11px] w-16 capitalize shrink-0" style={{ color: 'var(--c-text-muted)' }}>
                {s.platform}
              </span>
              <input value={s.url}
                onChange={e => theme.setFooter({
                  socials: f.socials.map(x => x.id === s.id ? { ...x, url: e.target.value } : x),
                })}
                className="t-input flex-1 px-2 py-1 text-[11px] min-w-0" />
              <button onClick={() => theme.setFooter({ socials: f.socials.filter(x => x.id !== s.id) })}
                className="text-[12px] px-0.5" style={{ color: 'var(--c-danger)' }}>×</button>
            </div>
          ))}
          <button onClick={() => theme.setFooter({
            socials: [...f.socials, { id: 's' + Date.now(), platform: 'twitter', url: '' }],
          })}
            className="w-full text-[11px] py-1 rounded border border-dashed"
            style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-muted)' }}>
            + social
          </button>
        </div>
      </div>

      <div className="py-2.5">
        <label className="text-[12px] font-medium block mb-1.5" style={{ color: 'var(--c-text)' }}>
          Copyright
        </label>
        <input value={f.copyright} onChange={e => theme.setFooter({ copyright: e.target.value })}
          className="t-input w-full px-2.5 py-2 text-[12px]" />
      </div>
    </div>
  )
}
