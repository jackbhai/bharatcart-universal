import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Card, CardHead, Kpi, AreaChart, Bars, Donut, Badge, Btn, Heat, Avatar, Progress, Tabs, cx,
} from '../ui/kit.jsx'
import { Reveal, Stagger, StaggerItem, Counter, Gradient, Spotlight, Tilt, GlowCard } from '../ui/fx.jsx'
import { useSlice } from '../hooks/useStore.js'
import { selectProducts } from '../core/store/slices/catalogueSlice.js'
import {
  kpis, revenueSeries, segmentBreakdown, stateBreakdown, paymentBreakdown, categoryBreakdown,
  channelBreakdown, tierBreakdown, deviceBreakdown, languageBreakdown, cohorts, rfmGrid,
  topCustomers, atRisk, lowStock, abandonedValue, openTickets, ALERTS,
  inr, inrShort, num, dt, ago, productPerf,
} from '../lib/analytics.js'
import { CUSTOMERS, ORDERS, CARTS, COUPONS } from '../data/seed.js'
import { loop } from '../ui/useDeviceProfile.js'

const RANGES = { '7D': 7, '30D': 30, '90D': 90, '1Y': 365 }

const SEV_TINT = {
  high: 'var(--c-danger)',
  warn: 'var(--c-warning)',
  info: 'var(--c-info)',
}

export default function Dashboard({ go }) {
  const [range, setRange] = useState('30D')
  const days = RANGES[range]
  const cat = useSlice('catalogue')
  const products = useMemo(() => selectProducts({ catalogue: cat }), [cat])
  const hasData = products.length > 0 || ORDERS.length > 0 || CUSTOMERS.length > 0

  const k = useMemo(() => kpis(days), [days])
  const series = useMemo(() => revenueSeries(Math.min(days, 60)), [days])
  const alerts = useMemo(() => ALERTS(), [])
  const co = useMemo(() => cohorts(), [])
  const rfm = useMemo(() => rfmGrid(), [])
  const perf = useMemo(() => productPerf(), [])
  const risk = useMemo(() => atRisk().slice(0, 5), [])
  const top = useMemo(() => topCustomers(6), [])
  const ls = useMemo(() => lowStock().slice(0, 5), [])

  // First run: no products, no orders, no customers — show the getting-started
  // dashboard instead of a wall of zeros. The full command centre renders as
  // soon as any real data exists.
  if (!hasData) return <ZeroDashboard />

  return (
    <div className="space-y-5 stagger">
      {/* header */}
      <div style={{ '--i': 0 }} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Store overview</p>
          <h1 className="text-2xl font-bold text-[var(--c-text)] tracking-tight mt-1">
            Command <Gradient from="#F97316" to="#6366F1">Centre</Gradient>
          </h1>
          <p className="text-sm text-[var(--c-text-muted)] mt-0.5 flex items-center gap-2">
            <motion.span animate={{ opacity: [1, .3, 1] }} transition={loop({ duration: 2 })}
              className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Sunday, 14 September 2026 · Festive season live
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="glass flex rounded-xl p-0.5">
            {Object.keys(RANGES).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={cx('pressable focus-ring relative px-3 py-1.5 text-xs font-medium rounded-lg transition',
                  range === r ? 'text-white' : 'text-[var(--c-text-muted)] hover:text-[var(--c-text)]')}>
                {range === r && <motion.div layoutId="rangepill" transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-lg bg-[linear-gradient(120deg,var(--c-primary),var(--c-secondary))] glow-primary" />}
                <span className="relative">{r}</span>
              </button>
            ))}
          </div>
          <Btn variant="outline" size="sm">Export</Btn>
        </div>
      </div>

      {/* alerts */}
      {alerts.length > 0 && (
        <div style={{ '--i': 1 }} className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {alerts.slice(0, 3).map((a, i) => {
            const tint = SEV_TINT[a.sev] || SEV_TINT.info
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * .08, type: 'spring', stiffness: 300, damping: 26 }}
                whileHover={{ y: -2 }}
                className="glow-hover rounded-xl p-3 border flex gap-3 relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, color-mix(in srgb, ${tint} 10%, transparent), transparent)`,
                  borderColor: `color-mix(in srgb, ${tint} 32%, transparent)`,
                }}>
                <span className="w-1.5 rounded-full shrink-0" style={{ background: tint }} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--c-text)]">{a.t}</p>
                  <p className="text-xs text-[var(--c-text-muted)] mt-0.5">{a.d}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* KPIs */}
      <div style={{ '--i': 2 }}>
        <Stagger className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3" gap={0.055}>
          <StaggerItem><Kpi label="Revenue" numeric={k.revenue} fmt={inrShort} delta={k.revenueGrowth} tone="saffron" /></StaggerItem>
          <StaggerItem><Kpi label="Orders" numeric={k.orders} delta={k.ordersGrowth} tone="blue" /></StaggerItem>
          <StaggerItem><Kpi label="AOV" numeric={k.aov} fmt={inr} delta={k.aovGrowth} tone="violet" /></StaggerItem>
          <StaggerItem><Kpi label="Repeat rate" numeric={k.repeatRate} fmt={v => v.toFixed(1) + '%'} sub="of orders" tone="green" /></StaggerItem>
          <StaggerItem><Kpi label="RTO rate" numeric={k.rtoRate} fmt={v => v.toFixed(1) + '%'} sub="COD risk" tone="saffron" /></StaggerItem>
          <StaggerItem><Kpi label="Gross margin" numeric={k.grossMargin} fmt={inrShort} sub="42% blended" tone="green" /></StaggerItem>
        </Stagger>
      </div>

      {/* revenue + side */}
      <div style={{ '--i': 3 }}>
        <p className="eyebrow mb-2">Revenue</p>
        <div className="grid xl:grid-cols-3 gap-4">
          <div className="relative xl:col-span-2">
            <div className="absolute -inset-5 pointer-events-none" aria-hidden="true">
              <div className="orb orb-a w-64 h-64 -top-12 -left-12 opacity-50" />
              <div className="orb orb-c w-72 h-72 -bottom-20 right-0 opacity-40" />
            </div>
            <Card className="relative glow-primary h-full">
              <CardHead title="Revenue trend" sub={`Last ${Math.min(days, 60)} days · net of returns & RTO`}
                right={<div className="flex gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-[var(--c-text-muted)]"><i className="w-2 h-2 rounded-full bg-indigo-500" />Revenue</span>
                </div>} />
              <div className="p-2 sm:p-4"><AreaChart data={series} height={210} /></div>
              <div className="grid grid-cols-3 divide-x divide-[var(--c-border)] border-t border-[var(--c-border)]">
                {[['Units sold', num(k.units)], ['Unique buyers', num(k.customers)], ['GST collected', inrShort(k.gstCollected)]].map(([l, v]) => (
                  <div key={l} className="p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--c-text-muted)]">{l}</p>
                    <p className="text-sm font-semibold text-[var(--c-text)] mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="glow-hover">
            <CardHead title="Customer segments" sub="RFM-derived · live" />
            <div className="p-4"><Donut data={segmentBreakdown().slice(0, 7)} /></div>
          </Card>
        </div>
      </div>

      {/* geo + payments + category */}
      <div style={{ '--i': 4 }}>
        <p className="eyebrow mb-2">Where the money comes from</p>
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="glow-hover">
            <CardHead title="Revenue by state" sub="Top 8 · GST-wise split available" />
            <div className="p-4"><Bars data={stateBreakdown().slice(0, 8)} fmt={inrShort} color="#F97316" /></div>
          </Card>
          <Card className="glow-hover">
            <CardHead title="Payment mix" sub="UPI-first market" />
            <div className="p-4"><Bars data={paymentBreakdown()} fmt={inrShort} color="#10B981" /></div>
          </Card>
          <Card className="glow-hover">
            <CardHead title="Category revenue" />
            <div className="p-4"><Bars data={categoryBreakdown()} fmt={inrShort} color="#8B5CF6" /></div>
          </Card>
        </div>
      </div>

      {/* cohort + RFM */}
      <div style={{ '--i': 5 }}>
        <p className="eyebrow mb-2">Retention</p>
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHead title="Retention cohorts" sub="% of cohort ordering again, by month" />
            <div className="p-4 overflow-x-auto">
              <table className="text-[11px] w-full">
                <thead>
                  <tr className="text-[var(--c-text-muted)]">
                    <th className="text-left font-medium pb-2">Cohort</th>
                    <th className="text-right font-medium pb-2 pr-3">Size</th>
                    {['M0', 'M1', 'M2', 'M3', 'M4', 'M5'].map(m => <th key={m} className="font-medium pb-2 px-1">{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {co.map(c => (
                    <tr key={c.cohort}>
                      <td className="text-[var(--c-text-muted)] py-0.5">{c.cohort}</td>
                      <td className="text-right text-[var(--c-text-muted)] pr-3">{c.size}</td>
                      {c.cells.map((v, i) => (
                        <td key={i} className="p-0.5">
                          <div className="h-7 rounded grid place-items-center font-medium"
                            style={{
                              background: v ? `color-mix(in srgb, var(--c-success) ${Math.round((0.08 + (v / 100) * 0.8) * 100)}%, transparent)` : 'color-mix(in srgb, var(--c-text) 4%, transparent)',
                              color: v > 55 ? '#fff' : 'var(--c-text-muted)',
                            }}>
                            {v ? v + '%' : '·'}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHead title="RFM matrix" sub="Recency (rows) × Frequency (cols) · customer counts" />
            <div className="p-4 flex justify-center">
              <Heat rows={[5, 4, 3, 2, 1]} cols={[1, 2, 3, 4, 5]} grid={rfm} />
            </div>
            <div className="px-4 pb-4 flex flex-wrap gap-1.5">
              {segmentBreakdown().slice(0, 5).map(s => <Badge key={s.key} tone="blue">{s.key} · {s.value}</Badge>)}
            </div>
          </Card>
        </div>
      </div>

      {/* ops row */}
      <div style={{ '--i': 6 }}>
        <p className="eyebrow mb-2">Needs your attention</p>
        <div className="grid lg:grid-cols-3 gap-4">
          <Card>
            <CardHead title="Churn risk — act now" sub={`${atRisk().length} customers · ${inrShort(atRisk().reduce((s, c) => s + c.clv, 0))} CLV at stake`}
              right={<Btn size="sm" variant="soft" onClick={() => go('customers')}>View all</Btn>} />
            <div className="divide-y divide-[var(--c-border)]">
              {risk.map(c => (
                <button key={c.id} onClick={() => go('customers', c.id)}
                  className="pressable w-full flex items-center gap-3 p-3 hover:bg-[color-mix(in_srgb,var(--c-text)_4%,transparent)] text-left transition rounded-lg">
                  <Avatar name={c.name} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[var(--c-text)] truncate">{c.name}</p>
                    <p className="text-[11px] text-[var(--c-text-muted)]">{c.city} · last order {ago(c.lastOrderAt)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-semibold text-[var(--c-danger)]">{c.churnRisk}%</p>
                    <p className="text-[10px] text-[var(--c-text-muted)]">{inrShort(c.clv)} CLV</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead title="Top customers" sub="By lifetime spend"
              right={<Btn size="sm" variant="soft" onClick={() => go('customers')}>All</Btn>} />
            <div className="divide-y divide-[var(--c-border)]">
              {top.map((c, i) => (
                <button key={c.id} onClick={() => go('customers', c.id)}
                  className="pressable w-full flex items-center gap-3 p-3 hover:bg-[color-mix(in_srgb,var(--c-text)_4%,transparent)] text-left transition rounded-lg">
                  <span className="text-[11px] font-semibold text-[var(--c-text-muted)] w-4">{i + 1}</span>
                  <Avatar name={c.name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[var(--c-text)] truncate">{c.name}</p>
                    <div className="flex gap-1 mt-0.5">
                      <Badge tone={c.loyaltyTier === 'Platinum' ? 'violet' : c.loyaltyTier === 'Gold' ? 'amber' : 'gray'}>{c.loyaltyTier}</Badge>
                    </div>
                  </div>
                  <p className="text-[13px] font-semibold text-[var(--c-text)] shrink-0">{inrShort(c.spend)}</p>
                </button>
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHead title="Abandoned carts" sub={`${CARTS.filter(c => !c.recovered).length} open`} />
              <div className="p-4">
                <p className="text-2xl font-semibold text-[var(--c-text)]">{inrShort(abandonedValue())}</p>
                <p className="text-xs text-[var(--c-text-muted)] mb-3">recoverable value</p>
                {['cart', 'address', 'payment'].map(st => {
                  const n = CARTS.filter(c => !c.recovered && c.stage === st).length
                  return <div key={st} className="mb-2">
                    <div className="flex justify-between text-[11px] mb-1"><span className="capitalize text-[var(--c-text-muted)]">{st} stage</span><span className="text-[var(--c-text-muted)]">{n}</span></div>
                    <Progress value={(n / CARTS.length) * 100} tone="amber" />
                  </div>
                })}
              </div>
            </Card>
            <Card>
              <CardHead title="Low stock" sub={`${lowStock().length} SKUs need reorder`} />
              <div className="divide-y divide-[var(--c-border)]">
                {ls.map(p => (
                  <div key={p.id} className="flex items-center gap-2 p-2.5">
                    <div className="w-1.5 h-8 rounded-full shrink-0" style={{ background: p.stock < 5 ? 'var(--c-danger)' : 'var(--c-warning)' }} />
                    <p className="text-[12px] text-[var(--c-text)] truncate flex-1">{p.name}</p>
                    <span className={cx('text-[12px] font-semibold tabular-nums shrink-0', p.stock < 12 ? 'text-[var(--c-warning)]' : 'text-[var(--c-text)]')}>{p.stock}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* acquisition */}
      <div style={{ '--i': 7 }}>
        <p className="eyebrow mb-2">Acquisition</p>
        <div className="grid lg:grid-cols-4 gap-4">
          <Card className="glow-hover"><CardHead title="Acquisition channel" /><div className="p-4"><Bars data={channelBreakdown().slice(0, 6)} color="#6366F1" /></div></Card>
          <Card className="glow-hover"><CardHead title="City tier" sub="Bharat vs metro" /><div className="p-4"><Bars data={tierBreakdown()} color="#F59E0B" /></div></Card>
          <Card className="glow-hover"><CardHead title="Device" /><div className="p-4"><Bars data={deviceBreakdown()} color="#06B6D4" /></div></Card>
          <Card className="glow-hover"><CardHead title="Language" sub="For vernacular campaigns" /><div className="p-4"><Bars data={languageBreakdown().slice(0, 6)} color="#EC4899" /></div></Card>
        </div>
      </div>

      {/* best sellers */}
      <div style={{ '--i': 8 }}>
        <p className="eyebrow mb-2">Catalogue</p>
        <Card>
          <CardHead title="Best performing products" sub="By revenue · last 12 months"
            right={<Btn size="sm" variant="soft" onClick={() => go('catalogue')}>Catalogue</Btn>} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--c-border)]">
                <tr className="[&_th]:sticky [&_th]:top-0 [&_th]:z-[5] [&_th]:bg-[var(--c-surface)]">
                  <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-wide font-semibold text-[var(--c-text-muted)]">Product</th>
                  <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-wide font-semibold text-[var(--c-text-muted)] hidden sm:table-cell">Category</th>
                  <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wide font-semibold text-[var(--c-text-muted)]">Units</th>
                  <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wide font-semibold text-[var(--c-text-muted)]">Revenue</th>
                  <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wide font-semibold text-[var(--c-text-muted)] hidden md:table-cell">Rating</th>
                  <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wide font-semibold text-[var(--c-text-muted)] hidden md:table-cell">Return %</th>
                  <th className="px-3 py-2.5 text-right text-[11px] uppercase tracking-wide font-semibold text-[var(--c-text-muted)]">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-border)]">
                {perf.slice(0, 8).map(p => (
                  <tr key={p.id} className="transition-all duration-200 hover:bg-[color-mix(in_srgb,var(--c-primary)_5%,transparent)] hover:-translate-y-px">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-[var(--c-text)] text-[13px] truncate max-w-[220px]">{p.name}</p>
                      <p className="text-[11px] text-[var(--c-text-muted)]">{p.brand} · {p.origin}</p>
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell"><Badge>{p.category}</Badge></td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[var(--c-text-muted)]">{num(p.units)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[var(--c-text)]">{inrShort(p.revenue)}</td>
                    <td className="px-3 py-2.5 text-right hidden md:table-cell text-[var(--c-text-muted)]">★ {p.rating}</td>
                    <td className="px-3 py-2.5 text-right hidden md:table-cell">
                      <span className={p.returnRate > 15 ? 'text-[var(--c-danger)] font-medium' : 'text-[var(--c-text-muted)]'}>{p.returnRate}%</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={cx('tabular-nums font-medium', p.stock < 12 ? 'text-[var(--c-warning)]' : 'text-[var(--c-text)]')}>{p.stock}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ------------------------------------------------- zero-data dashboard */

/**
 * First-run dashboard: the store has no products, orders or customers yet, so
 * instead of a wall of zeros we show a greeting and the three things that get
 * a store trading. Renders only when hasData is false; the full command
 * centre above takes over the moment any real data exists.
 */
function ZeroDashboard() {
  const nav = useNavigate()
  const cards = [
    {
      icon: '▦',
      tint: '#F97316',
      title: 'Add your first product',
      body: 'Create a listing with photos, variants and pricing. It goes live on the storefront the moment you publish it.',
      cta: 'Open the product editor',
      run: () => nav('/admin/catalogue', { state: { newProduct: true } }),
    },
    {
      icon: '⊞',
      tint: '#6366F1',
      title: 'Connect your backend',
      body: 'Point BharatCart at your own database or APIs whenever you are ready — the local store works until then.',
      cta: 'Open integrations',
      run: () => nav('/admin/integrations'),
    },
    {
      icon: '✦',
      tint: '#8B5CF6',
      title: 'Choose a theme',
      body: 'Pick colours, fonts and a storefront style so the shop looks like yours from day one.',
      cta: 'Open theme studio',
      run: () => nav('/admin/theme'),
    },
  ]

  return (
    <div className="relative space-y-6 py-6 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="orb orb-a w-80 h-80 top-0 -left-20 opacity-50" />
        <div className="orb orb-b w-72 h-72 top-1/3 -right-16 opacity-40" />
        <div className="orb orb-c w-64 h-64 bottom-0 left-1/3 opacity-40" />
      </div>

      <div className="relative text-center max-w-xl mx-auto anim-fade-up">
        <motion.div
          initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="float-slow w-16 h-16 mx-auto rounded-2xl grid place-items-center text-3xl text-white shadow-xl mb-4 glow-primary"
          style={{ background: 'linear-gradient(135deg, var(--c-primary), var(--c-secondary))' }}>
          ◈
        </motion.div>
        <p className="eyebrow">Getting started</p>
        <h1 className="text-2xl font-bold tracking-tight mt-1" style={{ color: 'var(--c-text)' }}>
          Welcome to your <Gradient from="#F97316" to="#6366F1">command centre</Gradient>
        </h1>
        <p className="text-sm mt-2" style={{ color: 'var(--c-text-muted)' }}>
          Your store is a blank canvas. Three steps and you are trading — your numbers will live here once they exist.
        </p>
      </div>

      <Stagger className="relative grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto" gap={0.09}>
        {cards.map((c, i) => (
          <StaggerItem key={c.title}>
            <motion.button
              type="button"
              onClick={c.run}
              whileHover={{ y: -4 }} whileTap={{ scale: .98 }}
              className="glow-hover w-full text-left glass rounded-2xl p-5 h-full flex flex-col">
              <span
                className="w-11 h-11 rounded-xl grid place-items-center text-xl text-white mb-4"
                style={{ background: `linear-gradient(135deg, ${c.tint}, ${c.tint}88)` }}>
                {c.icon}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: c.tint }}>
                Step {i + 1}
              </span>
              <span className="text-[15px] font-bold" style={{ color: 'var(--c-text)' }}>{c.title}</span>
              <span className="text-[13px] mt-1.5 leading-relaxed flex-1" style={{ color: 'var(--c-text-muted)' }}>
                {c.body}
              </span>
              <span className="mt-4 text-[13px] font-semibold inline-flex items-center gap-1.5" style={{ color: c.tint }}>
                {c.cta} <span aria-hidden="true">→</span>
              </span>
            </motion.button>
          </StaggerItem>
        ))}
      </Stagger>

      <p className="relative text-center text-[12px]" style={{ color: 'var(--c-text-muted)' }}>
        You can replay the full setup walkthrough any time from Settings.
      </p>
    </div>
  )
}
