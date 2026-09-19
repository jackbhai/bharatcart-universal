import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '../../hooks/useI18n.js'
import { cx } from '../kit.jsx'

/**
 * Language switcher.
 *
 * Each option is labelled in its own script (हिन्दी, not "Hindi") because a
 * user who cannot read the current interface language needs to recognise their
 * own by shape, not by its English name.
 */
export function LanguagePicker({ compact = false, align = 'right', tone = 'dark', className }) {
  const { t, lang, language, available, setLanguage, rtl } = useI18n()
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const indian = available.filter(l => l.group === 'Indian')
  const global = available.filter(l => l.group === 'Global')

  const Group = ({ title, list }) => list.length === 0 ? null : (
    <div>
      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/95">
        {title}
      </div>
      {list.map(l => (
        <button
          key={l.code}
          type="button"
          role="option"
          aria-selected={l.code === lang}
          onClick={() => { setLanguage(l.code); setOpen(false) }}
          className={cx(
            'w-full flex items-center gap-2.5 px-3 py-2 text-left transition hover:bg-indigo-50/70',
            l.code === lang && 'bg-indigo-50',
          )}
        >
          <span className="text-base leading-none w-5 text-center">{l.flag}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm text-slate-800 truncate" dir={l.dir}>{l.native}</span>
            <span className="block text-[10px] text-slate-400 truncate">{l.name}</span>
          </span>
          {l.dir === 'rtl' && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">RTL</span>
          )}
          {l.code === lang && (
            <svg width="14" height="14" viewBox="0 0 16 16" className="text-indigo-600 shrink-0">
              <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      ))}
    </div>
  )

  return (
    <div className={cx('relative', className)} ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('language.select')}
        className={cx(
          'inline-flex items-center gap-1.5 rounded-xl border transition active:scale-[.97] backdrop-blur',
          // Two tones because this control sits on a dark admin topbar and on a
          // light themed storefront header; one hard-coded palette would be
          // invisible on one of them.
          tone === 'dark'
            ? 'border-white/15 bg-white/10 text-white/90 hover:bg-white/20'
            : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white shadow-sm',
          compact ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-xs font-medium',
        )}
      >
        <span className="text-[13px] leading-none">{language.flag}</span>
        <span className="uppercase tracking-wide">{lang}</span>
        <svg width="10" height="10" viewBox="0 0 12 12" className={cx('opacity-60 transition-transform', open && 'rotate-180')}>
          <path d="M2 4.5L6 8.5L10 4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className={cx(
              'absolute z-50 mt-2 w-[250px] max-w-[85vw] rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden',
              align === 'right' && !rtl ? 'right-0' : 'left-0',
            )}
            role="listbox"
          >
            <div className="max-h-[360px] overflow-y-auto overscroll-contain">
              <Group title={t('language.indian')} list={indian} />
              <Group title={t('language.global')} list={global} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default LanguagePicker
