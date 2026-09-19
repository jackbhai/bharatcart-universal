import React from 'react'
import { motion } from 'framer-motion'
import { cx } from '../../ui/kit.jsx'

/** Miniature live rendering of a template so the choice is visual, not a name. */
function Thumb({ tpl }) {
  const t = tpl.tokens
  const p = tpl.preview
  const radius = Math.min(t.radius ?? 12, 14)
  const isDark = p.bg && parseInt(p.bg.slice(1, 3), 16) < 90

  return (
    <div className="relative w-full aspect-[4/3] overflow-hidden"
      style={{ background: p.bg, borderRadius: radius }}>
      {/* header bar */}
      <div className="absolute inset-x-0 top-0 h-[18%] flex items-center px-2 gap-1"
        style={{ background: t.surface, borderBottom: `1px solid ${t.border}` }}>
        <div className="w-3 h-3 rounded" style={{ background: p.a }} />
        <div className="h-1 w-6 rounded-full" style={{ background: t.textMuted, opacity: .5 }} />
        <div className="ml-auto flex gap-0.5">
          {[0, 1, 2].map(i => <div key={i} className="w-1 h-1 rounded-full" style={{ background: t.textMuted, opacity: .45 }} />)}
        </div>
      </div>

      {/* hero */}
      <div className="absolute left-2 right-2 rounded overflow-hidden" style={{ top: '23%', height: '32%' }}>
        <div className="w-full h-full relative" style={{
          background: `linear-gradient(120deg, ${p.a}, ${p.b})`,
          borderRadius: Math.min(radius, 8),
        }}>
          <div className="absolute left-1.5 top-1.5 h-1 w-8 rounded-full bg-white/70" />
          <div className="absolute left-1.5 top-3.5 h-[3px] w-5 rounded-full bg-white/40" />
          <div className="absolute left-1.5 bottom-1.5 h-2 w-6 rounded"
            style={{ background: t.primaryFg || '#fff', borderRadius: t.buttonStyle === 'pill' ? 99 : 2 }} />
        </div>
      </div>

      {/* product grid */}
      <div className="absolute left-2 right-2 grid grid-cols-3" style={{ top: '60%', gap: 3 }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="overflow-hidden" style={{
            background: t.surface,
            border: t.cardStyle === 'outlined' ? `1.5px solid ${t.border}` : `1px solid ${t.border}`,
            borderRadius: Math.min(radius, 6),
            boxShadow: t.shadowIntensity === 'brutal' ? `2px 2px 0 ${t.text}` : 'none',
          }}>
            <div style={{ height: 14, background: i === 1 ? p.c : t.surfaceAlt }} />
            <div className="p-[3px] space-y-[2px]">
              <div className="h-[2px] w-full rounded-full" style={{ background: t.textMuted, opacity: .4 }} />
              <div className="h-[2px] w-1/2 rounded-full" style={{ background: p.a }} />
            </div>
          </div>
        ))}
      </div>

      {isDark && <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(60% 50% at 50% 0%, ${p.a}18, transparent)` }} />}
    </div>
  )
}

export default function TemplateGallery({ templates, activeId, onApply, customThemes = [], onApplyCustom, onDeleteCustom }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-baseline justify-between mb-2.5">
          <h3 className="text-[13px] font-semibold" style={{ color: 'var(--c-text)' }}>Templates</h3>
          <span className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{templates.length} designs</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {templates.map((tpl, i) => {
            const active = tpl.id === activeId
            return (
              <motion.button
                key={tpl.id}
                onClick={() => onApply(tpl.id)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.035, type: 'spring', stiffness: 300, damping: 26 }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.985 }}
                className="group text-left relative"
              >
                <div className={cx('relative rounded-xl overflow-hidden transition-all duration-300',
                  active ? 'ring-2 ring-offset-2' : 'ring-1 hover:ring-2')}
                  style={{
                    '--tw-ring-color': active ? 'var(--c-primary)' : 'var(--c-border)',
                    '--tw-ring-offset-color': 'var(--c-surface)',
                  }}>
                  <Thumb tpl={tpl} />

                  {active && (
                    <motion.div layoutId="tpl-active" transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold shadow-lg"
                      style={{ background: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}>
                      ✓
                    </motion.div>
                  )}
                </div>

                <div className="mt-1.5 px-0.5">
                  <p className="text-[12px] font-semibold leading-tight" style={{ color: 'var(--c-text)' }}>
                    {tpl.name}
                  </p>
                  <p className="text-[10px] mt-0.5 line-clamp-2 leading-snug" style={{ color: 'var(--c-text-muted)' }}>
                    {tpl.description}
                  </p>
                  <div className="flex gap-1 mt-1">
                    {tpl.tags?.slice(0, 2).map(tag => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      {customThemes.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold mb-2.5" style={{ color: 'var(--c-text)' }}>
            Your saved themes
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {customThemes.map(ct => (
              <div key={ct.id} className="relative group">
                <button onClick={() => onApplyCustom(ct.id)}
                  className="w-full text-left rounded-xl overflow-hidden ring-1 hover:ring-2 transition-all"
                  style={{ '--tw-ring-color': 'var(--c-border)' }}>
                  <Thumb tpl={{ tokens: ct.tokens, preview: {
                    bg: ct.tokens.bg, a: ct.tokens.primary, b: ct.tokens.secondary, c: ct.tokens.accent,
                  }}} />
                  <p className="text-[12px] font-semibold mt-1.5 px-0.5" style={{ color: 'var(--c-text)' }}>
                    {ct.name}
                  </p>
                </button>
                <button onClick={() => onDeleteCustom(ct.id)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full text-[12px] opacity-0 group-hover:opacity-100 transition-opacity shadow"
                  style={{ background: 'var(--c-danger)', color: '#fff' }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
