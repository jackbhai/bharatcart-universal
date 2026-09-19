import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSlice } from '../../hooks/useStore.js'
import { CUSTOMERS } from '../../data/seed.js'
import { selectOrders } from '../../core/store/slices/ordersSlice.js'
import { selectReturns } from '../../core/store/slices/returnsSlice.js'
import { selectProducts } from '../../core/store/slices/catalogueSlice.js'
import DataTable from '../../ui/patterns/DataTable.jsx'
import { Select } from '../../ui/primitives/Input.jsx'
import { Badge, Card, CardHead, Tabs, Progress, Empty, Tooltip, Divider } from '../../ui/primitives/Display.jsx'
import { profitAndLoss, monthlyPnL, unitEconomics } from '../../engines/finance/financeEngine.js'
import { rfmScores, cohortRetention, predictCLV } from '../../engines/orders/customerEngine.js'
import { returnAnalytics } from '../../engines/returns/returnEngine.js'
import { inr } from '../../lib/analytics.js'

const TABS = [
  { id: 'overview', label: 'Overview', icon: '◈' },
  { id: 'products', label: 'Products', icon: '▦' },
  { id: 'geography', label: 'Geography', icon: '◍' },
  { id: 'cohorts', label: 'Retention', icon: '▤' },
]

export default function Analytics() {
  const [tab, setTab] = useState('overview')
  const [range, setRange] = useState('90')

  const ordersState = useSlice('orders')
  const returnsState = useSlice('returns')
  const catalogueState = useSlice('catalogue')

  const orders = useMemo(() => selectOrders({ orders: ordersState }), [ordersState])
  const returns = useMemo(() => selectReturns({ returns: returnsState }), [returnsState])
  const products = useMemo(() => selectProducts({ catalogue: catalogueState }), [catalogueState])

  const from = range === 'all' ? 0 : Date.now() - Number(range) * 86400000
  const windowed = useMemo(() => orders.filter(o => o.placedAt >= from), [orders, from])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Analytics</h1>
          <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
            The numbers that decide what to stock, where to ship and who to keep.
          </p>
        </div>
        <Select value={range} onChange={e => setRange(e.target.value)} className="!w-auto"
          options={[
            { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' },
            { value: '365', label: 'Last year' }, { value: 'all', label: 'All time' },
          ]} />
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'overview' && <Overview orders={orders} windowed={windowed} returns={returns} from={from} />}
          {tab === 'products' && <ProductPerf orders={windowed} products={products} returns={returns} />}
          {tab === 'geography' && <Geography orders={windowed} />}
          {tab === 'cohorts' && <Retention orders={orders} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ----------------------------------------------------------- overview */

function Overview({ orders, windowed, returns, from }) {
  const pnl = useMemo(() => profitAndLoss(orders, returns, { from }), [orders, returns, from])
  const monthly = useMemo(() => monthlyPnL(orders, returns, 12), [orders, returns])

  const daily = useMemo(() => {
    const m = {}
    for (const o of windowed) {
      if (o.status === 'Cancelled') continue
      const k = new Date(o.placedAt).toISOString().slice(0, 10)
      m[k] = m[k] || { date: k, revenue: 0, orders: 0 }
      m[k].revenue += o.total
      m[k].orders++
    }
    return Object.values(m).sort((a, b) => a.date.localeCompare(b.date)).slice(-60)
  }, [windowed])

  const maxDaily = Math.max(1, ...daily.map(d => d.revenue))

  const repeatRate = useMemo(() => {
    const byCust = {}
    for (const o of orders) byCust[o.customerId] = (byCust[o.customerId] || 0) + 1
    const buyers = Object.values(byCust)
    return buyers.length ? Math.round((buyers.filter(n => n > 1).length / buyers.length) * 100) : 0
  }, [orders])

  const ra = useMemo(() => returnAnalytics(orders, returns), [orders, returns])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
        <Stat label="Net revenue" value={inr(pnl.netRevenue)} />
        <Stat label="Orders" value={pnl.orderCount} />
        <Stat label="AOV" value={inr(pnl.aov)} />
        <Stat label="Net margin" value={`${pnl.netMarginPct}%`} tone={pnl.netMarginPct > 0 ? 'success' : 'danger'} />
        <Stat label="Repeat rate" value={`${repeatRate}%`} tone={repeatRate > 30 ? 'success' : 'warning'} />
        <Stat label="Return rate" value={`${ra.returnRatePct}%`} tone={ra.returnRatePct > 20 ? 'danger' : 'warning'} />
      </div>

      <Card>
        <CardHead title="Daily revenue" subtitle={`${daily.length} days of trading`} />
        <div className="flex items-end gap-0.5 h-40">
          {daily.map((d, i) => (
            <Tooltip key={d.date} content={`${d.date}: ${inr(d.revenue)} · ${d.orders} orders`}>
              <motion.div initial={{ height: 0 }} animate={{ height: `${(d.revenue / maxDaily) * 100}%` }}
                transition={{ delay: Math.min(i * .008, .5), duration: .4 }}
                className="flex-1 rounded-t min-w-[2px] cursor-default"
                style={{ background: 'var(--c-primary)', opacity: 0.4 + (d.revenue / maxDaily) * 0.6 }} />
            </Tooltip>
          ))}
        </div>
        {daily.length > 0 && (
          <div className="flex justify-between text-[10px] mt-1.5" style={{ color: 'var(--c-text-muted)' }}>
            <span>{daily[0].date}</span>
            <span>{daily.at(-1).date}</span>
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <CardHead title="Revenue vs profit by month" />
          <div className="space-y-2">
            {monthly.slice(-8).map(m => (
              <div key={m.month}>
                <div className="flex justify-between text-[11.5px] mb-1">
                  <span style={{ color: 'var(--c-text)' }}>{m.label}</span>
                  <span className="tabular-nums" style={{ color: 'var(--c-text-muted)' }}>
                    {inr(m.netRevenue)} ·{' '}
                    <span style={{ color: m.netProfit > 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
                      {inr(m.netProfit)}
                    </span>
                  </span>
                </div>
                <div className="flex gap-0.5 h-1.5">
                  <div className="rounded-l-full" style={{
                    background: 'var(--c-primary)',
                    width: `${(m.netRevenue / Math.max(...monthly.map(x => x.netRevenue), 1)) * 100}%`,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="Order status mix" subtitle="Where orders end up — RTO and returns are pure loss." />
          <div className="space-y-2">
            {useMemo(() => {
              const m = {}
              for (const o of windowed) m[o.status] = (m[o.status] || 0) + 1
              return Object.entries(m).sort((a, b) => b[1] - a[1])
            }, [windowed]).map(([status, count]) => {
              const bad = ['RTO', 'Returned', 'Cancelled'].includes(status)
              return (
                <div key={status}>
                  <div className="flex justify-between text-[11.5px] mb-1">
                    <span style={{ color: 'var(--c-text)' }}>{status}</span>
                    <span className="tabular-nums" style={{ color: 'var(--c-text-muted)' }}>
                      {count} · {Math.round((count / Math.max(windowed.length, 1)) * 100)}%
                    </span>
                  </div>
                  <Progress value={count} max={windowed.length} height={4}
                    tone={bad ? 'danger' : status === 'Delivered' ? 'success' : 'primary'} />
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ products */

function ProductPerf({ orders, products, returns }) {
  const perf = useMemo(() => {
    const byId = {}
    for (const o of orders) {
      if (o.status === 'Cancelled') continue
      for (const it of o.items || []) {
        byId[it.productId] = byId[it.productId] || {
          productId: it.productId, name: it.name, category: it.category,
          units: 0, revenue: 0, orders: 0, returned: 0,
        }
        byId[it.productId].units += it.qty
        byId[it.productId].revenue += it.price * it.qty
        byId[it.productId].orders++
      }
    }
    for (const r of returns) {
      for (const l of r.lines || []) {
        if (byId[l.productId]) byId[l.productId].returned += l.qty ?? 1
      }
    }
    const pById = new Map(products.map(p => [p.id, p]))
    return Object.values(byId).map(p => {
      const prod = pById.get(p.productId)
      const cost = (prod?.cost ?? (prod?.price ?? 0) * 0.58) * p.units
      const profit = p.revenue - cost
      return {
        ...p,
        product: prod,
        stock: prod?.stock ?? 0,
        profit: Math.round(profit),
        marginPct: p.revenue > 0 ? Math.round((profit / p.revenue) * 100) : 0,
        returnRate: p.units > 0 ? Math.round((p.returned / p.units) * 100) : 0,
        revenue: Math.round(p.revenue),
      }
    }).sort((a, b) => b.revenue - a.revenue)
  }, [orders, products, returns])

  const top = perf.slice(0, 10)
  const totalRev = perf.reduce((s, p) => s + p.revenue, 0) || 1
  const top10Share = Math.round((top.reduce((s, p) => s + p.revenue, 0) / totalRev) * 100)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Stat label="Products sold" value={perf.length} />
        <Stat label="Top 10 share" value={`${top10Share}%`} tone={top10Share > 60 ? 'warning' : undefined} />
        <Stat label="Units moved" value={perf.reduce((s, p) => s + p.units, 0)} />
        <Stat label="Never sold" value={products.length - perf.length} tone="warning" />
      </div>

      {top10Share > 60 && (
        <Card style={{ borderColor: 'var(--c-warning)' }}>
          <p className="text-[12.5px]" style={{ color: 'var(--c-text)' }}>
            ⚠ {top10Share}% of revenue comes from just 10 products.
          </p>
          <p className="text-[11.5px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
            That concentration is fragile — a stockout or a supplier problem on any one of them dents the
            month. Worth deliberately promoting the long tail.
          </p>
        </Card>
      )}

      <DataTable
        rows={perf}
        rowKey={(p) => p.productId}
        columns={[
          { key: 'name', label: 'Product', width: '28%', nowrap: false },
          { key: 'category', label: 'Category', render: p => <Badge size="sm">{p.category}</Badge> },
          { key: 'units', label: 'Units', align: 'right' },
          { key: 'revenue', label: 'Revenue', align: 'right', render: p => inr(p.revenue) },
          { key: 'profit', label: 'Profit', align: 'right',
            render: p => <span style={{ color: p.profit > 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>{inr(p.profit)}</span> },
          { key: 'marginPct', label: 'Margin', align: 'right',
            render: p => <Badge size="sm" tone={p.marginPct >= 35 ? 'success' : p.marginPct >= 20 ? 'warning' : 'danger'}>
              {p.marginPct}%
            </Badge> },
          { key: 'returnRate', label: 'Returns', align: 'right',
            render: p => p.returnRate > 0
              ? <span style={{ color: p.returnRate > 25 ? 'var(--c-danger)' : 'var(--c-text-muted)' }}>{p.returnRate}%</span>
              : <span style={{ color: 'var(--c-text-muted)' }}>—</span> },
          { key: 'stock', label: 'In stock', align: 'right',
            render: p => <span style={{ color: p.stock === 0 ? 'var(--c-danger)' : 'var(--c-text)' }}>{p.stock}</span> },
        ]}
        initialSort={['revenue', 'desc']}
        empty={<Empty icon="▦" title="No sales in this period" />}
      />
    </div>
  )
}

/* ----------------------------------------------------------- geography */

function Geography({ orders }) {
  const byState = useMemo(() => {
    const m = {}
    for (const o of orders) {
      if (o.status === 'Cancelled') continue
      const st = o.address?.state || 'Unknown'
      m[st] = m[st] || { state: st, orders: 0, revenue: 0, rto: 0, cod: 0 }
      m[st].orders++
      m[st].revenue += o.total
      if (o.status === 'RTO') m[st].rto++
      if (o.paymentMethod === 'COD') m[st].cod++
    }
    return Object.values(m).map(s => ({
      ...s,
      revenue: Math.round(s.revenue),
      aov: Math.round(s.revenue / s.orders),
      rtoRate: Math.round((s.rto / s.orders) * 1000) / 10,
      codShare: Math.round((s.cod / s.orders) * 100),
    })).sort((a, b) => b.revenue - a.revenue)
  }, [orders])

  const byCity = useMemo(() => {
    const m = {}
    for (const o of orders) {
      if (o.status === 'Cancelled') continue
      const c = o.address?.city || 'Unknown'
      m[c] = m[c] || { city: c, state: o.address?.state, orders: 0, revenue: 0 }
      m[c].orders++
      m[c].revenue += o.total
    }
    return Object.values(m).map(c => ({ ...c, revenue: Math.round(c.revenue) }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 15)
  }, [orders])

  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Card>
        <CardHead title="Revenue by state"
          subtitle="High RTO states may need COD restrictions rather than more marketing." />
        <div className="space-y-2 max-h-[30rem] overflow-y-auto">
          {byState.map((s, i) => (
            <motion.div key={s.state} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * .03, .4) }}>
              <div className="flex justify-between text-[12px] mb-1">
                <span className="flex items-center gap-1.5" style={{ color: 'var(--c-text)' }}>
                  {s.state}
                  {s.rtoRate > 12 && <Badge size="sm" tone="danger">{s.rtoRate}% RTO</Badge>}
                </span>
                <span className="tabular-nums" style={{ color: 'var(--c-text-muted)' }}>
                  {inr(s.revenue)} · {s.orders} orders · {s.codShare}% COD
                </span>
              </div>
              <Progress value={s.revenue} max={byState[0].revenue} height={5}
                tone={s.rtoRate > 12 ? 'danger' : 'primary'} />
            </motion.div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title="Top cities" subtitle="Where to prioritise express delivery and dark stores." />
        <DataTable
          rows={byCity}
          rowKey={(c) => c.city}
          showColumnChooser={false}
          pageSize={15}
          columns={[
            { key: 'city', label: 'City', render: c => <span className="font-medium">{c.city}</span> },
            { key: 'state', label: 'State', render: c => <span style={{ color: 'var(--c-text-muted)' }}>{c.state}</span> },
            { key: 'orders', label: 'Orders', align: 'right' },
            { key: 'revenue', label: 'Revenue', align: 'right', render: c => inr(c.revenue) },
          ]}
          initialSort={['revenue', 'desc']}
        />
      </Card>
    </div>
  )
}

/* ---------------------------------------------------------- retention */

function Retention({ orders }) {
  const byCustomer = useMemo(() => {
    const m = {}
    for (const o of orders) (m[o.customerId] = m[o.customerId] || []).push(o)
    return m
  }, [orders])

  const cohorts = useMemo(() => cohortRetention(CUSTOMERS, byCustomer, 12), [byCustomer])
  const rows = useMemo(() => rfmScores(CUSTOMERS, byCustomer), [byCustomer])

  const m1 = cohorts.filter(c => c.cells.length > 1)
  const avgM1 = m1.length ? Math.round(m1.reduce((s, c) => s + c.cells[1].pct, 0) / m1.length) : 0

  const totalCLV = rows.reduce((s, r) => s + predictCLV(r).totalValue, 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Stat label="Customers" value={rows.length} />
        <Stat label="Avg M1 retention" value={`${avgM1}%`} tone={avgM1 > 20 ? 'success' : 'warning'} />
        <Stat label="Total predicted CLV" value={inr(totalCLV)} tone="success" />
        <Stat label="Avg CLV" value={inr(Math.round(totalCLV / Math.max(rows.length, 1)))} />
      </div>

      <Card>
        <CardHead title="Cohort retention"
          subtitle="M1 is the number that matters — it is the second-order rate, and it compounds." />
        <div className="overflow-x-auto">
          <table className="text-[11px] border-collapse">
            <thead>
              <tr>
                <th className="px-2 py-1.5 text-left sticky left-0" style={{ color: 'var(--c-text-muted)', background: 'var(--c-surface)' }}>Cohort</th>
                <th className="px-2 py-1.5 text-right" style={{ color: 'var(--c-text-muted)' }}>Size</th>
                {Array.from({ length: Math.max(0, ...cohorts.map(c => c.cells.length)) }, (_, i) => (
                  <th key={i} className="px-2 py-1.5 text-center min-w-[42px]" style={{ color: 'var(--c-text-muted)' }}>M{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map(c => (
                <tr key={c.cohort}>
                  <td className="px-2 py-1 font-medium sticky left-0" style={{ color: 'var(--c-text)', background: 'var(--c-surface)' }}>{c.cohort}</td>
                  <td className="px-2 py-1 text-right tabular-nums" style={{ color: 'var(--c-text-muted)' }}>{c.size}</td>
                  {c.cells.map(cell => (
                    <td key={cell.month} className="px-1 py-1">
                      <Tooltip content={`${cell.active} active · ${inr(cell.revenue)}`}>
                        <div className="rounded text-center py-1 tabular-nums text-[10.5px] font-medium"
                          style={{
                            background: cell.pct === 0 ? 'var(--c-surface-alt)'
                              : `color-mix(in srgb, var(--c-primary) ${Math.min(90, 12 + cell.pct * 1.6)}%, transparent)`,
                            color: cell.pct > 42 ? 'var(--c-primary-fg)' : 'var(--c-text)',
                          }}>
                          {cell.pct}%
                        </div>
                      </Tooltip>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function Stat({ label, value, tone }) {
  const colour = { success: 'var(--c-success)', warning: 'var(--c-warning)', danger: 'var(--c-danger)' }[tone] || 'var(--c-text)'
  return (
    <div className="t-card p-3">
      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>{label}</p>
      <p className="text-base font-bold tabular-nums mt-0.5" style={{ color: colour }}>{value}</p>
    </div>
  )
}
