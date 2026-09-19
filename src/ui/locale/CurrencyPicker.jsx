import React, { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCurrency } from '../../hooks/useCurrency.js'
import { searchCurrencies } from '../../currency/currencies.js'
import { useI18n } from '../../hooks/useI18n.js'
import { cx } from '../kit.jsx'

/**
 * Currency switcher.
 *
 * Currencies are grouped by region and searchable. With 56 of them a flat
 * <select> is unusable on a phone, and a shopper who wants CAD should not have
 * to scroll past thirty entries to find it — typing "can" or "cad" gets there.
 */
export function CurrencyPicker({ compact = false, align = 'right', tone = 'dark', className }) {
  const { code, currency, available, setCurrency, rate, ratesUpdatedAt, isBase } = useCurrency()
  const { t, rtl } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    // Focusing the search box means the picker is usable from the keyboard
    // straight away instead of requiring a second click.
    const id = setTimeout(() => inputRef.current?.focus(), 40)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      clearTimeout(id)
    }
  }, [open])

  const groups = useMemo(() => {
    const q = query.trim()
    // Delegate to the ranked search so typing a country works: "myanmar" finds
    // MMK, "nepal" finds NPR. With 157 currencies a plain substring filter puts
    // the obvious answer halfway down the list.
    const allowed = new Set(available.map(c => c.code))
    const matches = (q ? searchCurrencies(q, 200) : available).filter(c => allowed.has(c.code))
    const out = new Map()
    for (const c of matches) {
      if (!out.has(c.region)) out.set(c.region, [])
      out.get(c.region).push(c)
    }
    return [...out.entries()]
  }, [available, query])

  const choose = (next) => { setCurrency(next); setOpen(false); setQuery('') }

  return (
    <div className={cx('relative', className)} ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('currency.select')}
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
        <span className="text-[13px] leading-none">{currency.flag}</span>
        <span className="tabular-nums tracking-wide">{code}</span>
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
              'absolute z-50 mt-2 w-[340px] max-w-[90vw] rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden',
              align === 'right' && !rtl ? 'right-0' : 'left-0',
            )}
            role="listbox"
          >
            <div className="p-2.5 border-b border-slate-100">
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search 157 currencies or a country…"
                className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto overscroll-contain">
              {groups.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-slate-400">{t('common.noResults')}</p>
              )}
              {groups.map(([region, list]) => (
                <div key={region}>
                  <div className="sticky top-0 bg-slate-50/95 backdrop-blur px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {region}
                  </div>
                  {list.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      role="option"
                      aria-selected={c.code === code}
                      onClick={() => choose(c.code)}
                      className={cx(
                        'w-full flex items-center gap-2.5 px-3 py-2 text-left transition hover:bg-indigo-50/70',
                        c.code === code && 'bg-indigo-50',
                      )}
                    >
                      <span className="text-base leading-none w-5 text-center">{c.flag}</span>
                      <span className="w-10 shrink-0 text-[11px] font-semibold tabular-nums text-slate-700">{c.code}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs text-slate-700 truncate">{c.name}</span>
                        <span className="block text-[10px] text-slate-400 truncate">
                          {c.countries.slice(0, 3).join(', ')}{c.countries.length > 3 ? ` +${c.countries.length - 3}` : ''}
                        </span>
                      </span>
                      <span className="text-xs text-slate-400 shrink-0">{c.symbol}</span>
                      {c.code === code && (
                        <svg width="14" height="14" viewBox="0 0 16 16" className="text-indigo-600">
                          <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-2">
              <p className="text-[10px] leading-relaxed text-slate-500">
                {isBase
                  ? t('currency.ratesUpdated', { date: ratesUpdatedAt })
                  : `${t('currency.perBase', { rate: rate < 0.01 ? rate.toFixed(5) : rate.toFixed(4), code })} · ${t('currency.ratesUpdated', { date: ratesUpdatedAt })}`}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default CurrencyPicker
