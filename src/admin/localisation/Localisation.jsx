import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Btn, Field, cx } from '../../ui/kit.jsx'
// Display.jsx is the primitives set every other admin module uses. kit.jsx
// exports same-named components with different contracts; mixing the two is
// what broke this screen.
import { Card, CardHead, Badge, Tabs, Progress } from '../../ui/primitives/Display.jsx'
import { Input, Select } from '../../ui/primitives/Input.jsx'
import { useI18n } from '../../hooks/useI18n.js'
import { useCurrency } from '../../hooks/useCurrency.js'
import { useSlice, useDispatch } from '../../hooks/useStore.js'
import { LANGUAGES, LANGUAGE_CODES, coverage } from '../../i18n/index.js'
import { CURRENCIES, CURRENCY_REGIONS, currenciesByRegion } from '../../currency/currencies.js'
import { RATES, getRate, RATES_UPDATED_AT, BASE_CURRENCY, fetchLiveRates } from '../../currency/rates.js'
import { formatMoney } from '../../currency/format.js'

/**
 * Admin control room for language and currency.
 *
 * Three jobs: choose which languages shoppers may pick, inspect and correct
 * exchange rates, and see how complete each translation actually is. The
 * coverage table matters because a language can be "enabled" while only half
 * translated — better to show the operator that number than let a customer
 * discover it.
 */
export default function Localisation() {
  const { t, lang, setLanguage, available } = useI18n()
  const cur = useCurrency()
  const locale = useSlice('locale')
  const dispatch = useDispatch()
  const [tab, setTab] = useState('languages')
  const [rateQuery, setRateQuery] = useState('')
  const [liveNote, setLiveNote] = useState(null)
  const [sample, setSample] = useState(2499)

  const cov = useMemo(() => coverage(), [])
  const allowedLangs = locale.allowedLanguages?.length ? locale.allowedLanguages : LANGUAGE_CODES

  const toggleLang = (code) => {
    // English stays available as the fallback target: every missing key resolves
    // to it, so disabling it would leave untranslated strings with nowhere to go.
    if (code === 'en') return
    const next = allowedLangs.includes(code)
      ? allowedLangs.filter(c => c !== code)
      : [...allowedLangs, code]
    dispatch('locale/setAllowedLanguages', next.length ? next : ['en'])
    if (!next.includes(lang)) setLanguage('en')
  }

  const tryLive = async () => {
    const res = await fetchLiveRates()
    setLiveNote(res.note || (res.ok ? 'Live rates loaded.' : 'Live fetch unavailable.'))
  }

  const regions = currenciesByRegion()
  const rateRows = useMemo(() => {
    const q = rateQuery.trim().toLowerCase()
    return Object.values(CURRENCIES)
      .filter(c => !q || c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
      .sort((a, b) => a.region.localeCompare(b.region) || a.code.localeCompare(b.code))
  }, [rateQuery])

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('admin.localisation')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {LANGUAGE_CODES.length} languages · {Object.keys(CURRENCIES).length} currencies · base {BASE_CURRENCY}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="green">{t('admin.live')}</Badge>
          <Badge tone="gray">{t('currency.ratesUpdated', { date: RATES_UPDATED_AT })}</Badge>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'languages', label: t('language.title') },
          { id: 'currency', label: t('currency.title') },
          { id: 'rates', label: t('currency.rate') },
          { id: 'coverage', label: t('language.coverage') },
        ]}
      />

      {/* ------------------------------------------------------- languages */}
      {tab === 'languages' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHead title={t('language.select')} sub="Tick the languages shoppers may switch to." />
            <div className="p-4 grid gap-2 sm:grid-cols-2">
              {Object.values(LANGUAGES).map(l => {
                const on = allowedLangs.includes(l.code)
                const pc = cov[l.code]?.percent ?? 0
                return (
                  <motion.button
                    key={l.code}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => toggleLang(l.code)}
                    className={cx(
                      'flex items-center gap-3 rounded-xl border p-3 text-left transition',
                      on ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 hover:border-slate-300 bg-white',
                      l.code === 'en' && 'opacity-90',
                    )}
                  >
                    <span className="text-xl leading-none">{l.flag}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-800 truncate" dir={l.dir}>{l.native}</span>
                      <span className="block text-[11px] text-slate-500">
                        {l.name} · {l.group}{l.dir === 'rtl' ? ' · RTL' : ''}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-[11px] font-semibold tabular-nums text-slate-600">{pc}%</span>
                      <span className={cx('block text-[10px]', on ? 'text-indigo-600' : 'text-slate-400')}>
                        {l.code === 'en' ? 'fallback' : on ? t('common.enabled') : t('common.disabled')}
                      </span>
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </Card>

          <Card>
            <CardHead title="Preview" sub="Strings as a shopper would read them." />
            <div className="p-4 space-y-3">
              <Field label={t('language.select')}>
                <Select value={lang} onChange={e => setLanguage(e.target.value)}>
                  {available.map(l => <option key={l.code} value={l.code}>{l.native} — {l.name}</option>)}
                </Select>
              </Field>
              <div className="rounded-xl bg-slate-50 p-3 space-y-1.5" dir={LANGUAGES[lang].dir}>
                <p className="text-sm font-semibold text-slate-800">{t('shop.pickedForYou')}</p>
                <p className="text-xs text-slate-600">{t('shop.pickedForYouSub')}</p>
                <p className="text-xs text-slate-600">{t('shop.addToCart')} · {t('cart.checkout')}</p>
                <p className="text-xs text-slate-600">{t('cart.items', { count: 1 })} / {t('cart.items', { count: 5 })}</p>
                <p className="text-xs text-slate-600">{t('shop.freeShippingAbove', { amount: cur.money(999) })}</p>
              </div>
              {LANGUAGES[lang].dir === 'rtl' && (
                <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-2">{t('language.rtlNotice')}</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* -------------------------------------------------------- currency */}
      {tab === 'currency' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHead title={t('currency.select')} sub={`${Object.keys(CURRENCIES).length} currencies across ${CURRENCY_REGIONS.length} regions.`} />
            <div className="p-4 space-y-4">
              {CURRENCY_REGIONS.map(region => (
                <div key={region}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{region}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(regions[region] || []).map(c => (
                      <button
                        key={c.code}
                        onClick={() => cur.setCurrency(c.code)}
                        className={cx(
                          'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition',
                          c.code === cur.code
                            ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-semibold'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                        )}
                      >
                        <span>{c.flag}</span>
                        <span className="tabular-nums">{c.code}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead title={t('currency.showing', { currency: cur.code })} />
            <div className="p-4 space-y-3">
              <Field label="Sample amount (INR)">
                <Input type="number" value={sample} onChange={e => setSample(Number(e.target.value) || 0)} />
              </Field>
              <div className="rounded-xl bg-slate-50 p-3 space-y-2">
                <Row k="Formatted" v={cur.money(sample)} />
                <Row k="With code" v={cur.money(sample, { showCode: true })} />
                <Row k="Compact" v={cur.money(sample * 4200, { compact: true })} />
                <Row k={t('currency.rate')} v={`1 INR = ${cur.rate < 0.01 ? cur.rate.toFixed(6) : cur.rate.toFixed(4)} ${cur.code}`} />
                <Row k="Decimals" v={String(cur.currency.decimals)} />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={locale.showCurrencyCode}
                  onChange={e => dispatch('locale/setShowCurrencyCode', e.target.checked)}
                />
                Always append the currency code
              </label>
            </div>
          </Card>
        </div>
      )}

      {/* ----------------------------------------------------------- rates */}
      {tab === 'rates' && (
        <Card>
          <CardHead
            title={t('currency.rate')}
            sub={t('currency.staticNotice')}
            right={
              <div className="flex items-center gap-2">
                <Btn size="sm" variant="soft" onClick={tryLive}>Fetch live</Btn>
                <Btn size="sm" variant="ghost" onClick={cur.clearRateOverrides}>{t('currency.reset')}</Btn>
              </div>
            }
          />
          {liveNote && <p className="px-4 pt-3 text-[11px] text-amber-700">{liveNote}</p>}
          <div className="p-4">
            <Input
              value={rateQuery}
              onChange={e => setRateQuery(e.target.value)}
              placeholder={t('common.search')}
              className="mb-3 max-w-xs"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-3">Currency</th>
                    <th className="py-2 pr-3">Region</th>
                    <th className="py-2 pr-3 text-right">Default</th>
                    <th className="py-2 pr-3 text-right">{t('currency.override')}</th>
                    <th className="py-2 pr-3 text-right">₹1,000 →</th>
                  </tr>
                </thead>
                <tbody>
                  {rateRows.map(c => {
                    const overridden = Object.prototype.hasOwnProperty.call(cur.overrides, c.code)
                    return (
                      <tr key={c.code} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <td className="py-2 pr-3">
                          <span className="inline-flex items-center gap-2">
                            <span>{c.flag}</span>
                            <span className="font-medium text-slate-700 tabular-nums">{c.code}</span>
                            <span className="text-[11px] text-slate-400 truncate max-w-[160px]">{c.name}</span>
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-[11px] text-slate-500">{c.region}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-[12px] text-slate-500">
                          {RATES[c.code] != null ? RATES[c.code] : '—'}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <input
                            type="number"
                            step="any"
                            value={overridden ? cur.overrides[c.code] : ''}
                            placeholder="—"
                            onChange={e => cur.setRateOverride(c.code, e.target.value)}
                            className={cx(
                              'w-28 rounded-lg border px-2 py-1 text-right text-[12px] tabular-nums outline-none',
                              overridden ? 'border-amber-300 bg-amber-50' : 'border-slate-200',
                            )}
                          />
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-[12px] text-slate-700">
                          {formatMoney(1000, c.code, { rates: cur.overrides })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* -------------------------------------------------------- coverage */}
      {tab === 'coverage' && (
        <Card>
          <CardHead title={t('language.coverage')} sub={`Measured against the ${cov.en.total} English keys.`} />
          <div className="p-4 space-y-2.5">
            {Object.values(cov)
              .sort((a, b) => b.percent - a.percent || a.code.localeCompare(b.code))
              .map(row => (
                <div key={row.code} className="flex items-center gap-3">
                  <span className="w-6 text-base leading-none">{LANGUAGES[row.code].flag}</span>
                  <span className="w-28 shrink-0">
                    <span className="block text-[12px] font-medium text-slate-700">{LANGUAGES[row.code].name}</span>
                    <span className="block text-[10px] text-slate-400" dir={LANGUAGES[row.code].dir}>{LANGUAGES[row.code].native}</span>
                  </span>
                  <span className="flex-1"><Progress value={row.percent} tone={row.percent === 100 ? 'emerald' : 'amber'} /></span>
                  <span className="w-24 text-right text-[11px] tabular-nums text-slate-600">
                    {row.translated}/{row.total}
                  </span>
                  <span className="w-12 text-right text-[12px] font-semibold tabular-nums text-slate-800">{row.percent}%</span>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  )
}

const Row = ({ k, v }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-[11px] text-slate-500">{k}</span>
    <span className="text-[12px] font-medium text-slate-800 tabular-nums">{v}</span>
  </div>
)
