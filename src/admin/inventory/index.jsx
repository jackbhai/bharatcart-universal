import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import DataTable from '../../ui/patterns/DataTable.jsx'
import EmptyState from '../../ui/EmptyState.jsx'
import KpiRow from '../../ui/patterns/KpiRow.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select } from '../../ui/primitives/Input.jsx'
import { Badge, Card, CardHead, Tabs, Progress, Empty, Divider } from '../../ui/primitives/Display.jsx'
import {
  stockPositions, inventoryKpis, abcAnalysis, abcSummary,
  reorderPlan, reorderByVendor, warehouseSummary,
  transferSuggestions, deadStock, movements,
} from '../../engines/inventory/warehouseEngine.js'
import { WAREHOUSES } from '../../data/vendorSeed.js'
import { inr, inrShort } from '../../lib/analytics.js'

const TABS = [
  { id: 'positions', label: 'Stock', icon: '▤' },
  { id: 'reorder', label: 'Reorder', icon: '↻' },
  { id: 'warehouses', label: 'Warehouses', icon: '⌂' },
  { id: 'abc', label: 'ABC', icon: '◴' },
  { id: 'dead', label: 'Dead stock', icon: '⚑' },
  { id: 'movements', label: 'Movements', icon: '⇄' },
]

const STATUS_TONE = {
  'Out of stock': 'danger', Critical: 'danger', Low: 'warn', Healthy: 'success', Overstocked: 'info',
}

const day = (ts) => new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

export default function Inventory() {
  const [tab, setTab] = useState('positions')
  const positions = useMemo(() => stockPositions(), [])
  const kpis = useMemo(() => inventoryKpis(positions), [positions])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Inventory</h1>
          <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
            Stock across every warehouse, what to reorder this week, and which cash is stuck on a shelf.
          </p>
        </div>
      </div>

      <KpiRow columns={6} items={[
        { label: 'SKUs', value: kpis.skus, sub: kpis.units.toLocaleString('en-IN') + ' units', icon: '▤' },
        { label: 'Stock value', value: inrShort(kpis.stockValue), sub: 'at cost', icon: '₹' },
        { label: 'Out of stock', value: kpis.outOfStock, sub: `${kpis.critical} critical`, tone: kpis.outOfStock ? 'danger' : 'success', icon: '⚠' },
        { label: 'To reorder', value: kpis.needsReorder, sub: inrShort(kpis.reorderValue) + ' to spend', tone: kpis.needsReorder ? 'warn' : 'success', icon: '↻' },
        { label: 'Dead stock', value: kpis.deadStock, sub: inrShort(kpis.deadStockValue) + ' idle', tone: kpis.deadStock ? 'warn' : 'success', icon: '⚑' },
        { label: 'Turnover', value: kpis.turnover + '×', sub: 'sell-through per year', hint: 'Revenue over the last year divided by the value of stock held. Under 1 means you hold more than you sell.', icon: '◴' },
      ]} />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'positions' && <Positions positions={positions} />}
          {tab === 'reorder' && <Reorder />}
          {tab === 'warehouses' && <Warehouses positions={positions} />}
          {tab === 'abc' && <Abc />}
          {tab === 'dead' && <Dead />}
          {tab === 'movements' && <Movements />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------- Positions */

function Positions({ positions }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [warehouse, setWarehouse] = useState('all')
  const nav = useNavigate()

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return positions
      .filter(p => (status === 'all' || p.status === status)
        && (warehouse === 'all' || (p.byWarehouse?.[warehouse] ?? 0) > 0)
        && (!needle || p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle)))
      .sort((a, b) => a.coverDays - b.coverDays)
  }, [positions, q, status, warehouse])

  return (
    <Card padding={false}>
      <div className="p-3 flex gap-2 flex-wrap items-center">
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search product or SKU"
          className="!w-auto flex-1 min-w-[180px]" />
        <Select value={status} onChange={e => setStatus(e.target.value)} className="!w-auto"
          options={[{ value: 'all', label: 'All statuses' }, ...Object.keys(STATUS_TONE).map(s => ({ value: s, label: s }))]} />
        <Select value={warehouse} onChange={e => setWarehouse(e.target.value)} className="!w-auto"
          options={[{ value: 'all', label: 'All warehouses' }, ...WAREHOUSES.map(w => ({ value: w.id, label: w.name }))]} />
      </div>
      {positions.length === 0 ? (
        <div className="p-3">
          <EmptyState
            icon="⬓"
            title="No inventory yet"
            message="Stock positions appear here once your catalogue has products with stock."
            actionLabel="Add a product"
            onAction={() => nav('/admin/catalogue')}
          />
        </div>
      ) : (
      <DataTable
        rows={rows}
        rowKey="productId"
        pageSize={12}
        expandable={p => (
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold mb-1.5" style={{ color: 'var(--c-text-muted)' }}>
              Stock by warehouse
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {WAREHOUSES.map(w => (
                <div key={w.id} className="rounded-[var(--radius-sm)] px-2 py-1.5"
                  style={{ background: 'var(--c-surface-2, rgba(0,0,0,0.03))' }}>
                  <div className="text-[11px] truncate" style={{ color: 'var(--c-text-muted)' }}>{w.name}</div>
                  <div className="text-[14px] font-bold tabular-nums">{p.byWarehouse?.[w.id] ?? 0}</div>
                </div>
              ))}
            </div>
            <Divider />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">
              <div><span style={{ color: 'var(--c-text-muted)' }}>Sold (1y): </span><b className="tabular-nums">{p.unitsSold}</b></div>
              <div><span style={{ color: 'var(--c-text-muted)' }}>Per day: </span><b className="tabular-nums">{p.perDay}</b></div>
              <div><span style={{ color: 'var(--c-text-muted)' }}>Reorder at: </span><b className="tabular-nums">{p.reorderPoint}</b></div>
              <div><span style={{ color: 'var(--c-text-muted)' }}>Supplier: </span><b>{p.vendorName}</b></div>
            </div>
          </div>
        )}
        columns={[
          { key: 'name', label: 'Product', render: p => (
            <div>
              <div className="font-semibold text-[12.5px] truncate max-w-[220px]" title={p.name}>{p.name}</div>
              <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{p.category}</div>
            </div>
          ) },
          { key: 'stock', label: 'On hand', align: 'right', render: p => <span className="tabular-nums font-semibold text-[12.5px]">{p.stock}</span> },
          { key: 'coverDays', label: 'Cover', align: 'right', render: p => (
            <span className="tabular-nums text-[12px]">{p.coverDays >= 999 ? '∞' : p.coverDays + 'd'}</span>
          ) },
          { key: 'perDay', label: 'Per day', align: 'right', render: p => <span className="tabular-nums text-[12px]">{p.perDay}</span> },
          { key: 'status', label: 'Status', render: p => <Badge tone={STATUS_TONE[p.status] ?? 'neutral'} size="sm">{p.status}</Badge> },
          { key: 'vendorName', label: 'Supplier', render: p => <span className="text-[12px] truncate max-w-[150px] inline-block" title={p.vendorName}>{p.vendorName}</span> },
          { key: 'stockValue', label: 'Value', align: 'right', render: p => <span className="tabular-nums text-[12px]">{inrShort(p.stockValue)}</span> },
        ]}
      />
      )}
    </Card>
  )
}

/* --------------------------------------------------------------- Reorder */

function Reorder() {
  const plan = useMemo(() => reorderPlan(), [])
  const grouped = useMemo(() => reorderByVendor(plan), [plan])

  if (plan.length === 0) {
    return <Empty icon="✓" title="Nothing needs reordering" description="Every product has enough cover for its supplier's lead time." />
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHead title="Reorder plan"
          subtitle="Reorder point = lead-time demand plus a half-lead-time safety buffer. Anything at or below it is listed here." />
      </Card>

      {grouped.map(g => (
        <Card key={g.vendorId ?? 'none'} padding={false}>
          <div className="p-3 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-semibold text-[13px]">{g.vendorName}</div>
              <div className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
                {g.lines.length} lines · {g.units} units · {g.leadDays}d lead
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!g.meetsMinimum && (
                <Badge tone="warn" size="sm">Below {inr(g.minOrderValue)} minimum</Badge>
              )}
              <span className="text-[14px] font-bold tabular-nums">{inr(g.value)}</span>
              <Button size="sm" variant="primary">Raise PO</Button>
            </div>
          </div>
          <DataTable
            rows={g.lines}
            rowKey="productId"
            pageSize={6}
            columns={[
              { key: 'name', label: 'Product', render: p => <span className="text-[12.5px] truncate max-w-[220px] inline-block" title={p.name}>{p.name}</span> },
              { key: 'stock', label: 'On hand', align: 'right', render: p => <span className="tabular-nums text-[12px]">{p.stock}</span> },
              { key: 'reorderPoint', label: 'Reorder at', align: 'right', render: p => <span className="tabular-nums text-[12px]">{p.reorderPoint}</span> },
              { key: 'suggestedQty', label: 'Order', align: 'right', render: p => <span className="tabular-nums text-[12px] font-semibold">{p.suggestedQty || 10}</span> },
              { key: 'urgency', label: 'Urgency', render: p => (
                <Badge tone={p.urgency === 'Now' ? 'danger' : p.urgency === 'This week' ? 'warn' : 'neutral'} size="sm">{p.urgency}</Badge>
              ) },
              { key: 'orderValue', label: 'Cost', align: 'right', render: p => <span className="tabular-nums text-[12px]">{inr(p.orderValue)}</span> },
            ]}
          />
        </Card>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------ Warehouses */

function Warehouses({ positions }) {
  const summary = useMemo(() => warehouseSummary(positions), [positions])
  const transfers = useMemo(() => transferSuggestions(positions), [positions])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {summary.map((w, i) => (
          <motion.div key={w.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}>
            <Card>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-[13.5px]">{w.name}</div>
                  <div className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>{w.city}, {w.state} · {w.pin}</div>
                </div>
                <Badge tone={w.type === 'Primary' ? 'primary' : w.type === 'Regional' ? 'info' : 'neutral'} size="sm">{w.type}</Badge>
              </div>
              <div className="mt-2.5">
                <div className="flex justify-between text-[11.5px] mb-1">
                  <span style={{ color: 'var(--c-text-muted)' }}>Utilisation</span>
                  <span className="tabular-nums font-semibold">{w.units.toLocaleString('en-IN')} / {w.capacity.toLocaleString('en-IN')}</span>
                </div>
                <Progress value={w.utilisation} tone={w.utilisation > 90 ? 'danger' : w.utilisation > 75 ? 'warn' : 'success'} height={7} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
                {[['SKUs', w.skus], ['Value', inrShort(w.value)], ['Per staff', w.unitsPerStaff]].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{k}</div>
                    <div className="text-[13px] font-bold tabular-nums">{v}</div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card padding={false}>
        <CardHead title={`Transfer suggestions (${transfers.length})`}
          subtitle="One site is empty on a SKU while another sits on a pile. Moving stock beats buying more." />
        {transfers.length === 0
          ? <Empty icon="✓" title="Stock is well balanced" description="No warehouse is empty on a moving SKU." />
          : (
            <DataTable
              rows={transfers}
              rowKey={(t) => t.productId + t.fromId + t.toId}
              pageSize={10}
              columns={[
                { key: 'name', label: 'Product', render: t => <span className="text-[12.5px] truncate max-w-[200px] inline-block" title={t.name}>{t.name}</span> },
                { key: 'from', label: 'From', render: t => <span className="text-[12px]">{t.from}</span> },
                { key: 'to', label: 'To', render: t => <span className="text-[12px]">{t.to}</span> },
                { key: 'qty', label: 'Qty', align: 'right', render: t => <span className="tabular-nums text-[12px] font-semibold">{t.qty}</span> },
                { key: 'priority', label: 'Priority', render: t => <Badge tone={t.priority === 'High' ? 'warn' : 'neutral'} size="sm">{t.priority}</Badge> },
                { key: 'action', label: '', align: 'right', render: () => <Button size="xs" variant="ghost">Create transfer</Button> },
              ]}
            />
          )}
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ ABC */

function Abc() {
  const rows = useMemo(() => abcAnalysis(), [])
  const summary = useMemo(() => abcSummary(rows), [rows])
  const [cls, setCls] = useState('A')

  return (
    <div className="space-y-3">
      <Card>
        <CardHead title="ABC analysis"
          subtitle="A earns the top 80% of revenue, B the next 15%, C the long tail. Count A weekly, C twice a year." />
        <div className="grid grid-cols-3 gap-2.5 mt-2">
          {summary.map(s => (
            <button key={s.abc} onClick={() => setCls(s.abc)}
              className="text-left rounded-[var(--radius-md)] px-3 py-2.5 transition-transform hover:-translate-y-0.5"
              style={{ background: 'var(--c-surface)', border: '1px solid ' + (cls === s.abc ? 'var(--c-primary)' : 'var(--c-border)') }}>
              <div className="text-[13px] font-bold">Class {s.abc}</div>
              <div className="text-[19px] font-bold tabular-nums">{s.skus}</div>
              <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
                {s.skuShare}% of SKUs · {inrShort(s.revenue)} revenue
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card padding={false}>
        <DataTable
          rows={rows.filter(r => r.abc === cls)}
          rowKey="productId"
          pageSize={12}
          columns={[
            { key: 'name', label: 'Product', render: p => <span className="text-[12.5px] truncate max-w-[230px] inline-block" title={p.name}>{p.name}</span> },
            { key: 'revenue', label: 'Revenue', align: 'right', render: p => <span className="tabular-nums text-[12px] font-semibold">{inrShort(p.revenue)}</span> },
            { key: 'revenueShare', label: 'Share', align: 'right', render: p => <span className="tabular-nums text-[12px]">{p.revenueShare}%</span> },
            { key: 'cumulativeShare', label: 'Cumulative', align: 'right', render: p => (
              <div className="flex items-center gap-2 justify-end">
                <span className="tabular-nums text-[12px]">{p.cumulativeShare}%</span>
                <div className="w-14"><Progress value={p.cumulativeShare} tone="primary" height={5} /></div>
              </div>
            ) },
            { key: 'unitsSold', label: 'Units', align: 'right', render: p => <span className="tabular-nums text-[12px]">{p.unitsSold}</span> },
            { key: 'stock', label: 'On hand', align: 'right', render: p => <span className="tabular-nums text-[12px]">{p.stock}</span> },
          ]}
        />
      </Card>
    </div>
  )
}

/* ----------------------------------------------------------- Dead stock */

function Dead() {
  const rows = useMemo(() => deadStock(), [])
  const total = rows.reduce((n, r) => n + r.stockValue, 0)

  return (
    <Card padding={false}>
      <CardHead title={`Dead stock — ${inr(total)} tied up`}
        subtitle="Nothing sold in the last year. This is cash sitting on a shelf; discount it or bundle it." />
      {rows.length === 0
        ? <Empty icon="✓" title="Everything is moving" description="No product has gone a full year without a sale." />
        : (
          <DataTable
            rows={rows}
            rowKey="productId"
            pageSize={12}
            columns={[
              { key: 'name', label: 'Product', render: p => (
                <div>
                  <div className="text-[12.5px] truncate max-w-[220px]" title={p.name}>{p.name}</div>
                  <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{p.category}</div>
                </div>
              ) },
              { key: 'stock', label: 'Units', align: 'right', render: p => <span className="tabular-nums text-[12px]">{p.stock}</span> },
              { key: 'stockValue', label: 'Tied up', align: 'right', render: p => <span className="tabular-nums text-[12px] font-semibold">{inrShort(p.stockValue)}</span> },
              { key: 'suggestion', label: 'Suggestion', render: p => <span className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>{p.suggestion}</span> },
              { key: 'action', label: '', align: 'right', render: () => <Button size="xs" variant="ghost">Add to clearance</Button> },
            ]}
          />
        )}
    </Card>
  )
}

/* ------------------------------------------------------------ Movements */

function Movements() {
  const [type, setType] = useState('')
  const [warehouse, setWarehouse] = useState('')
  const rows = useMemo(
    () => movements({ type: type || undefined, warehouseId: warehouse || undefined, limit: 200 }),
    [type, warehouse]
  )

  return (
    <Card padding={false}>
      <div className="p-3 flex gap-2 flex-wrap items-center">
        <Select value={type} onChange={e => setType(e.target.value)} className="!w-auto"
          options={[{ value: '', label: 'All movement types' }, ...['Inbound', 'Outbound', 'Transfer', 'Adjustment', 'Return'].map(t => ({ value: t, label: t }))]} />
        <Select value={warehouse} onChange={e => setWarehouse(e.target.value)} className="!w-auto"
          options={[{ value: '', label: 'All warehouses' }, ...WAREHOUSES.map(w => ({ value: w.id, label: w.name }))]} />
      </div>
      {rows.length === 0
        ? <Empty icon="◌" title="No movements match" description="Clear the filters to see the full ledger." />
        : (
          <DataTable
            rows={rows}
            rowKey="id"
            pageSize={15}
            columns={[
              { key: 'at', label: 'When', render: m => <span className="text-[12px] tabular-nums">{day(m.at)}</span> },
              { key: 'name', label: 'Product', render: m => <span className="text-[12.5px] truncate max-w-[200px] inline-block" title={m.name}>{m.name}</span> },
              { key: 'type', label: 'Type', render: m => (
                <Badge size="sm" tone={m.type === 'Inbound' ? 'success' : m.type === 'Outbound' ? 'info' : m.type === 'Adjustment' ? 'warn' : 'neutral'}>{m.type}</Badge>
              ) },
              { key: 'qty', label: 'Qty', align: 'right', render: m => (
                <span className="tabular-nums text-[12px] font-semibold"
                  style={{ color: m.qty < 0 ? 'var(--c-danger, #dc2626)' : 'var(--c-success, #16a34a)' }}>
                  {m.qty > 0 ? '+' : ''}{m.qty}
                </span>
              ) },
              { key: 'warehouseId', label: 'Warehouse', render: m => <span className="text-[12px]">{WAREHOUSES.find(w => w.id === m.warehouseId)?.name ?? m.warehouseId}</span> },
              { key: 'ref', label: 'Reference', render: m => <span className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>{m.ref}</span> },
              { key: 'by', label: 'By', render: m => <span className="text-[12px]">{m.by}</span> },
            ]}
          />
        )}
    </Card>
  )
}
