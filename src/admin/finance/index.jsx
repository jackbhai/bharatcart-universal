import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSlice } from '../../hooks/useStore.js'
import { selectOrders } from '../../core/store/slices/ordersSlice.js'
import { selectReturns } from '../../core/store/slices/returnsSlice.js'
import { selectProducts } from '../../core/store/slices/catalogueSlice.js'
import DataTable from '../../ui/patterns/DataTable.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select, Switch, Slider } from '../../ui/primitives/Input.jsx'
import { Badge, Card, CardHead, Tabs, Divider, Progress, Empty, Tooltip } from '../../ui/primitives/Display.jsx'
import {
  profitAndLoss, monthlyPnL, gstSummary, filingCalendar,
  settlements, payoutSchedule, unitEconomics,
} from '../../engines/finance/financeEngine.js'
import { inr } from '../../lib/analytics.js'

const TABS = [
  { id: 'pnl', label: 'P&L', icon: '₹' },
  { id: 'gst', label: 'GST', icon: '▤' },
  { id: 'settlements', label: 'Settlements', icon: '⇄' },
  { id: 'unit', label: 'Unit economics', icon: '◲' },
]

const RANGES = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
  { value: '365', label: 'Last year' },
  { value: 'all', label: 'All time' },
]

export default function Finance() {
  const [tab, setTab] = useState('pnl')
  const [range, setRange] = useState('90')

  const ordersState = useSlice('orders')
  const returnsState = useSlice('returns')
  const orders = useMemo(() => selectOrders({ orders: ordersState }), [ordersState])
  const returns = useMemo(() => selectReturns({ returns: returnsState }), [returnsState])

  const from = range === 'all' ? 0 : Date.now() - Number(range) * 86400000

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Finance</h1>
          <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
            Profit after every real cost, GST ready for filing, and when money actually reaches the bank.
          </p>
        </div>
        <Select value={range} onChange={e => setRange(e.target.value)} className="!w-auto" options={RANGES} />
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'pnl' && <PnL orders={orders} returns={returns} from={from} />}
          {tab === 'gst' && <GST orders={orders} from={from} />}
          {tab === 'settlements' && <Settlements orders={orders} />}
          {tab === 'unit' && <UnitEconomics orders={orders} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ---------------------------------------------------------------- P&L */

function PnL({ orders, returns, from }) {
  const [marketingPct, setMarketingPct] = useState(11)
  const [fixedCosts, setFixedCosts] = useState(0)
  const [cogsRate, setCogsRate] = useState(58)

  const windowOrders = orders.filter(o => o.placedAt >= from)
  const marketingSpend = Math.round(windowOrders.reduce((s, o) => s + o.total, 0) * (marketingPct / 100))

  const pnl = useMemo(
    () => profitAndLoss(orders, returns, { from, marketingSpend, fixedCosts, cogsRate: cogsRate / 100 }),
    [orders, returns, from, marketingSpend, fixedCosts, cogsRate]
  )
  const monthly = useMemo(
    () => monthlyPnL(orders, returns, 12, { cogsRate: cogsRate / 100 }),
    [orders, returns, cogsRate]
  )

  const maxRev = Math.max(1, ...monthly.map(m => m.netRevenue))
  const maxAbs = Math.max(1, ...monthly.map(m => Math.abs(m.netProfit)))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        <Stat label="Net revenue" value={inr(pnl.netRevenue)} />
        <Stat label="Gross profit" value={inr(pnl.grossProfit)} tone="success" />
        <Stat label="Gross margin" value={`${pnl.grossMarginPct}%`} />
        <Stat label="Net profit" value={inr(pnl.netProfit)} tone={pnl.profitable ? 'success' : 'danger'} />
        <Stat label="Per order" value={inr(pnl.contributionPerOrder)} tone={pnl.contributionPerOrder > 0 ? 'success' : 'danger'} />
      </div>

      <Card>
        <CardHead title="Assumptions" subtitle="These are estimates — tune them to your real numbers." />
        <div className="grid sm:grid-cols-3 gap-4">
          <Slider label="COGS as % of price" value={cogsRate} onChange={setCogsRate} min={20} max={85}
            format={v => `${v}%`} />
          <Slider label="Marketing spend" value={marketingPct} onChange={setMarketingPct} min={0} max={40}
            format={v => `${v}% of revenue`} />
          <Input label="Fixed costs for period" type="number" prefix="₹" value={fixedCosts}
            onChange={e => setFixedCosts(Number(e.target.value))} hint="Rent, salaries, software" />
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <CardHead title="Profit & loss"
            subtitle={`${pnl.orderCount} orders · ${pnl.units} units · AOV ${inr(pnl.aov)}`} />
          <div className="space-y-0.5">
            {pnl.lines.map((l, i) => {
              const isTotal = l.type === 'total'
              const isSub = l.type === 'subtotal'
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * .03 }}
                  className={`flex justify-between items-baseline gap-3 py-1 ${(isTotal || isSub) ? 'border-t mt-1 pt-1.5' : ''}`}
                  style={{ borderColor: 'var(--c-border)' }}>
                  <span className={isTotal || isSub ? 'text-[12.5px] font-semibold' : 'text-[12px]'}
                    style={{ color: isTotal || isSub ? 'var(--c-text)' : 'var(--c-text-muted)' }}>
                    {l.label}
                  </span>
                  <span className={isTotal ? 'text-[15px] font-bold tabular-nums' : 'text-[12.5px] tabular-nums'}
                    style={{
                      color: isTotal
                        ? (l.value > 0 ? 'var(--c-success)' : 'var(--c-danger)')
                        : l.value < 0 ? 'var(--c-text-muted)' : 'var(--c-text)',
                    }}>
                    {l.value < 0 ? `− ${inr(Math.abs(l.value))}` : inr(l.value)}
                  </span>
                </motion.div>
              )
            })}
          </div>
          <p className="text-[11px] mt-3" style={{ color: 'var(--c-text-muted)' }}>
            Net margin {pnl.netMarginPct}%. GST is shown as a deduction because it is collected on behalf of
            the government, not revenue.
          </p>
        </Card>

        <Card>
          <CardHead title="12-month trend" subtitle="Revenue bars with the profit line overlaid." />
          <div className="flex items-end gap-1 h-44 mb-2">
            {monthly.map((m, i) => (
              <Tooltip key={m.month} content={`${m.label}: ${inr(m.netRevenue)} revenue · ${inr(m.netProfit)} profit`}>
                <div className="flex-1 flex flex-col justify-end items-center gap-0.5 h-full cursor-default">
                  <motion.div initial={{ height: 0 }} animate={{ height: `${(m.netRevenue / maxRev) * 76}%` }}
                    transition={{ delay: i * .04, duration: .5 }}
                    className="w-full rounded-t" style={{ background: 'var(--c-primary)', opacity: 0.85 }} />
                  <motion.div initial={{ height: 0 }} animate={{ height: `${(Math.abs(m.netProfit) / maxAbs) * 20}%` }}
                    transition={{ delay: i * .04 + .15, duration: .4 }}
                    className="w-full rounded-b"
                    style={{ background: m.netProfit >= 0 ? 'var(--c-success)' : 'var(--c-danger)' }} />
                </div>
              </Tooltip>
            ))}
          </div>
          <div className="flex gap-1">
            {monthly.map(m => (
              <span key={m.month} className="flex-1 text-center text-[8.5px]" style={{ color: 'var(--c-text-muted)' }}>
                {m.label.split(' ')[0]}
              </span>
            ))}
          </div>
          <div className="flex gap-3 mt-3 text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded" style={{ background: 'var(--c-primary)' }} /> Net revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded" style={{ background: 'var(--c-success)' }} /> Net profit
            </span>
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Where the money goes" subtitle="Cost structure as a share of net revenue." />
        <div className="space-y-2">
          {[
            ['Cost of goods', pnl.cogs, 'var(--c-primary)'],
            ['Marketing', pnl.marketing, 'var(--c-warning)'],
            ['Shipping', pnl.shippingCost, 'var(--c-info)'],
            ['Payment fees', pnl.paymentFees, 'var(--c-secondary)'],
            ['Reverse logistics', pnl.reverseLogistics, 'var(--c-danger)'],
            ['Packaging', pnl.packaging, 'var(--c-text-muted)'],
          ].filter(([, v]) => v > 0).map(([label, value, colour]) => (
            <div key={label}>
              <div className="flex justify-between text-[12px] mb-1">
                <span style={{ color: 'var(--c-text)' }}>{label}</span>
                <span className="tabular-nums" style={{ color: 'var(--c-text-muted)' }}>
                  {inr(value)} · {pnl.netRevenue > 0 ? Math.round((value / pnl.netRevenue) * 100) : 0}%
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--c-border)' }}>
                <motion.div initial={{ width: 0 }}
                  animate={{ width: `${pnl.netRevenue > 0 ? Math.min(100, (value / pnl.netRevenue) * 100) : 0}%` }}
                  transition={{ duration: .6 }} className="h-full rounded-full" style={{ background: colour }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

/* ---------------------------------------------------------------- GST */

function GST({ orders, from }) {
  const settings = useSlice('settings')
  const catalogueState = useSlice('catalogue')
  const products = useMemo(() => selectProducts({ catalogue: catalogueState }), [catalogueState])
  const sellerState = settings.store?.address?.state ?? 'Haryana'
  const gst = useMemo(
    () => gstSummary(orders, { from, sellerState, products }),
    [orders, from, sellerState, products]
  )
  const calendar = useMemo(() => filingCalendar(), [])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        <Stat label="Taxable value" value={inr(gst.taxableValue)} />
        <Stat label="CGST" value={inr(gst.cgst)} />
        <Stat label="SGST" value={inr(gst.sgst)} />
        <Stat label="IGST" value={inr(gst.igst)} />
        <Stat label="Total tax" value={inr(gst.totalTax)} tone="warning" />
      </div>

      <Card>
        <CardHead title="Filing calendar" subtitle={`Registered in ${sellerState} · GSTIN ${settings.store?.gstin}`} />
        <div className="grid sm:grid-cols-3 gap-2.5">
          {calendar.map(f => (
            <div key={f.form} className="p-3 rounded-lg border"
              style={{
                borderColor: f.status === 'overdue' ? 'var(--c-danger)'
                  : f.status === 'due-soon' ? 'var(--c-warning)' : 'var(--c-border)',
              }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-[13px]" style={{ color: 'var(--c-text)' }}>{f.form}</span>
                <Badge size="sm" tone={f.status === 'overdue' ? 'danger' : f.status === 'due-soon' ? 'warning' : 'neutral'}>
                  {f.daysLeft < 0 ? `${Math.abs(f.daysLeft)}d overdue` : `${f.daysLeft}d left`}
                </Badge>
              </div>
              <p className="text-[11.5px]" style={{ color: 'var(--c-text)' }}>{f.label}</p>
              <p className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>{f.note}</p>
              <p className="text-[10.5px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
                Period: {f.period} · due {new Date(f.dueAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <CardHead title="Rate-wise summary" subtitle="HSN-backed breakdown, as GSTR-1 expects it." />
          <DataTable
            rows={gst.byRate}
            rowKey={(r) => r.rate}
            showColumnChooser={false}
            columns={[
              { key: 'rate', label: 'Rate', render: r => <Badge size="sm">{r.rate}%</Badge> },
              { key: 'taxableValue', label: 'Taxable', align: 'right', render: r => inr(r.taxableValue) },
              { key: 'cgst', label: 'CGST', align: 'right', render: r => inr(r.cgst) },
              { key: 'sgst', label: 'SGST', align: 'right', render: r => inr(r.sgst) },
              { key: 'igst', label: 'IGST', align: 'right', render: r => inr(r.igst) },
              { key: 'hsn', label: 'HSN codes', sortable: false, nowrap: false,
                render: r => <span className="text-[10.5px] font-mono" style={{ color: 'var(--c-text-muted)' }}>
                  {r.hsn.slice(0, 3).join(', ')}{r.hsn.length > 3 && ` +${r.hsn.length - 3}`}
                </span> },
            ]}
            empty={<Empty icon="▤" title="No taxable sales in this period" />}
          />
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="p-2.5 rounded-lg" style={{ background: 'var(--c-surface-alt)' }}>
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>B2C</p>
              <p className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--c-text)' }}>{inr(gst.b2c.value)}</p>
              <p className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>{gst.b2c.count} invoices</p>
            </div>
            <div className="p-2.5 rounded-lg" style={{ background: 'var(--c-surface-alt)' }}>
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>B2B</p>
              <p className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--c-text)' }}>{inr(gst.b2b.value)}</p>
              <p className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>{gst.b2b.count} invoices</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="Place of supply"
            subtitle="Intra-state attracts CGST+SGST; inter-state attracts IGST." />
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {gst.byState.slice(0, 16).map(s => (
              <div key={s.state}>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--c-text)' }}>
                    {s.state}
                    <Badge size="sm" tone={s.interState ? 'info' : 'neutral'}>
                      {s.interState ? 'IGST' : 'CGST+SGST'}
                    </Badge>
                  </span>
                  <span className="tabular-nums" style={{ color: 'var(--c-text-muted)' }}>
                    {inr(s.taxableValue)} · tax {inr(s.tax)}
                  </span>
                </div>
                <Progress value={s.taxableValue} max={gst.byState[0].taxableValue} height={4} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline">Export GSTR-1 (JSON)</Button>
        <Button size="sm" variant="outline">Export invoice register (CSV)</Button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------- settlements */

function Settlements({ orders }) {
  const [prepaidDays, setPrepaidDays] = useState(2)
  const [codDays, setCodDays] = useState(7)

  const s = useMemo(() => settlements(orders, { prepaidDays, codDays }), [orders, prepaidDays, codDays])
  const schedule = useMemo(() => payoutSchedule(orders, { prepaidDays, codDays, days: 14 }), [orders, prepaidDays, codDays])
  const maxPayout = Math.max(1, ...schedule.map(d => d.amount))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Stat label="Gross collected" value={inr(s.totalGross)} />
        <Stat label="Gateway fees" value={inr(s.totalFee)} tone="warning" />
        <Stat label="Settled to date" value={inr(s.settledToDate)} tone="success" />
        <Stat label="Pending payout" value={inr(s.pendingPayout)} tone="warning" />
      </div>

      <Card>
        <CardHead title="Settlement cycle"
          subtitle="The gap between collecting money and receiving it is the single biggest cash-flow constraint in D2C." />
        <div className="grid sm:grid-cols-2 gap-4">
          <Slider label="Prepaid settlement" value={prepaidDays} onChange={setPrepaidDays} min={0} max={10}
            format={v => v === 0 ? 'Instant' : `T+${v} days`} />
          <Slider label="COD remittance" value={codDays} onChange={setCodDays} min={1} max={21}
            format={v => `T+${v} days after delivery`} />
        </div>
      </Card>

      <Card>
        <CardHead title="By payment method" subtitle="COD looks cheap until you count the remittance delay." />
        <DataTable
          rows={s.rows}
          rowKey={(r) => r.method}
          showColumnChooser={false}
          columns={[
            { key: 'method', label: 'Method', render: r => <span className="font-medium">{r.method}</span> },
            { key: 'count', label: 'Orders', align: 'right' },
            { key: 'gross', label: 'Gross', align: 'right', render: r => inr(r.gross) },
            { key: 'fee', label: 'Fees', align: 'right',
              render: r => <span style={{ color: 'var(--c-warning)' }}>{inr(r.fee)}</span> },
            { key: 'feePct', label: 'Fee %', align: 'right', render: r => `${r.feePct}%` },
            { key: 'net', label: 'Net', align: 'right', render: r => <span className="font-semibold">{inr(r.net)}</span> },
            { key: 'pending', label: 'Awaiting payout', align: 'right',
              render: r => r.pending > 0
                ? <Tooltip content={`${r.pendingCount} orders`}>
                    <span style={{ color: 'var(--c-warning)' }}>{inr(r.pending)}</span>
                  </Tooltip>
                : <span style={{ color: 'var(--c-text-muted)' }}>—</span> },
          ]}
          initialSort={['gross', 'desc']}
        />
      </Card>

      <Card>
        <CardHead title="Upcoming payouts" subtitle="What will land in the bank over the next two weeks." />
        {schedule.length ? (
          <>
            <div className="flex items-end gap-1 h-32 mb-2">
              {schedule.map((d, i) => (
                <Tooltip key={d.date} content={`${d.date}: ${inr(d.amount)} from ${d.orders} orders`}>
                  <div className="flex-1 flex flex-col justify-end h-full">
                    <motion.div initial={{ height: 0 }} animate={{ height: `${(d.amount / maxPayout) * 100}%` }}
                      transition={{ delay: i * .04, duration: .5 }}
                      className="w-full rounded-t" style={{ background: 'var(--c-success)' }} />
                  </div>
                </Tooltip>
              ))}
            </div>
            <div className="flex gap-1">
              {schedule.map(d => (
                <span key={d.date} className="flex-1 text-center text-[8.5px]" style={{ color: 'var(--c-text-muted)' }}>
                  {new Date(d.date).getDate()}
                </span>
              ))}
            </div>
            <p className="text-[11.5px] mt-3" style={{ color: 'var(--c-text-muted)' }}>
              Total expected: <strong style={{ color: 'var(--c-text)' }}>
                {inr(schedule.reduce((t, d) => t + d.amount, 0))}
              </strong> across {schedule.reduce((t, d) => t + d.orders, 0)} orders
            </p>
          </>
        ) : <Empty icon="⇄" title="No payouts scheduled" description="Nothing is pending settlement in this window." />}
      </Card>
    </div>
  )
}

/* ------------------------------------------------------ unit economics */

function UnitEconomics({ orders }) {
  const [dimension, setDimension] = useState('channel')
  const data = useMemo(() => unitEconomics(orders, dimension), [orders, dimension])

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          Contribution margin after COGS, fees and shipping — before marketing and fixed costs.
        </p>
        <Select value={dimension} onChange={e => setDimension(e.target.value)} className="!w-auto"
          options={[
            { value: 'channel', label: 'By channel' },
            { value: 'paymentMethod', label: 'By payment method' },
            { value: 'category', label: 'By category' },
          ]} />
      </div>

      <DataTable
        rows={data}
        rowKey={(d) => d.key}
        showColumnChooser={false}
        columns={[
          { key: 'key', label: 'Segment', render: d => <span className="font-medium">{d.key}</span> },
          { key: 'orders', label: 'Orders', align: 'right' },
          { key: 'revenue', label: 'Revenue', align: 'right', render: d => inr(d.revenue) },
          { key: 'aov', label: 'AOV', align: 'right', render: d => inr(d.aov) },
          { key: 'cogs', label: 'COGS', align: 'right', render: d => <span style={{ color: 'var(--c-text-muted)' }}>{inr(d.cogs)}</span> },
          { key: 'fees', label: 'Fees', align: 'right', render: d => <span style={{ color: 'var(--c-text-muted)' }}>{inr(d.fees)}</span> },
          { key: 'shipping', label: 'Shipping', align: 'right', render: d => <span style={{ color: 'var(--c-text-muted)' }}>{inr(d.shipping)}</span> },
          { key: 'profit', label: 'Contribution', align: 'right',
            render: d => <span className="font-semibold tabular-nums"
              style={{ color: d.profit > 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>{inr(d.profit)}</span> },
          { key: 'marginPct', label: 'Margin', align: 'right',
            render: d => <Badge size="sm" tone={d.marginPct >= 25 ? 'success' : d.marginPct >= 10 ? 'warning' : 'danger'}>
              {d.marginPct}%
            </Badge> },
          { key: 'rtoRate', label: 'RTO', align: 'right',
            render: d => <span style={{ color: d.rtoRate > 10 ? 'var(--c-danger)' : 'var(--c-text-muted)' }}>{d.rtoRate}%</span> },
          { key: 'contributionPerOrder', label: 'Per order', align: 'right',
            render: d => <span style={{ color: d.contributionPerOrder > 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
              {inr(d.contributionPerOrder)}
            </span> },
        ]}
        initialSort={['profit', 'desc']}
      />

      {data.some(d => d.profit < 0) && (
        <Card style={{ borderColor: 'var(--c-danger)' }}>
          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--c-danger)' }}>
            Loss-making segments
          </p>
          <p className="text-[11.5px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
            {data.filter(d => d.profit < 0).map(d => d.key).join(', ')} lose money on a contribution basis.
            Before cutting them, check whether the RTO rate is the cause — fixing delivery is usually cheaper
            than losing the channel.
          </p>
        </Card>
      )}
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
