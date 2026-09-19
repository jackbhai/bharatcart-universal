import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useSlice } from '../../hooks/useStore.js'
import store from '../../core/store/index.js'
import useToast from '../../hooks/useToast.js'
import { selectProducts } from '../../core/store/slices/catalogueSlice.js'
import DataTable from '../../ui/patterns/DataTable.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select, Switch, Slider } from '../../ui/primitives/Input.jsx'
import { Card, CardHead, Badge, Tabs, Progress, Empty, Tooltip, Modal } from '../../ui/primitives/Display.jsx'
import {
  reorderSuggestions, valuation, ageing, deadStock, forecast,
  stockStatus, reorderPoint, eoq, STOCK_STATUS,
} from '../../engines/inventory/inventoryEngine.js'
import { inr } from '../../lib/analytics.js'
import { salesHistory } from '../../lib/salesHistory.js'

const VIEWS = [
  { id: 'reorder', label: 'Reorder' },
  { id: 'valuation', label: 'Valuation' },
  { id: 'ageing', label: 'Ageing' },
  { id: 'dead', label: 'Dead stock' },
  { id: 'warehouses', label: 'Warehouses' },
]

export default function InventoryTab() {
  const cat = useSlice('catalogue')
  const { success } = useToast()
  const [view, setView] = useState('reorder')
  const products = useMemo(() => selectProducts({ catalogue: cat }), [cat])
  const cfg = cat.inventoryConfig

  return (
    <div className="space-y-3">
      <Tabs tabs={VIEWS} value={view} onChange={setView} size="sm" />
      {view === 'reorder' && <ReorderView products={products} cfg={cfg} />}
      {view === 'valuation' && <ValuationView products={products} />}
      {view === 'ageing' && <AgeingView products={products} />}
      {view === 'dead' && <DeadStockView products={products} />}
      {view === 'warehouses' && <WarehousesView warehouses={cat.warehouses} products={products} cfg={cfg} />}
    </div>
  )
}

/* ------------------------------------------------------------ reorder */
function ReorderView({ products, cfg }) {
  const { success } = useToast()
  const [leadTime, setLeadTime] = useState(cfg.leadTimeDays ?? 7)
  const [service, setService] = useState(95)
  const [selected, setSelected] = useState([])

  const suggestions = useMemo(
    () => reorderSuggestions(products, salesHistory(), { ...cfg, leadTimeDays: leadTime, serviceLevel: service / 100 })
      .filter(r => r.suggestedQty > 0)
      .map(r => ({ ...r, id: r.product.id, name: r.product.name })),
    [products, cfg, leadTime, service]
  )
  const totalCost = suggestions.filter(s => selected.includes(s.id)).reduce((t, s) => t + s.estimatedCost, 0)

  return (
    <div className="space-y-3">
      <Card>
        <CardHead title="Replenishment planner"
          subtitle="Safety stock uses a normal-demand model: ROP = (avg daily demand × lead time) + z × σ × √L" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Slider label="Supplier lead time" value={leadTime} onChange={setLeadTime} min={1} max={45}
            format={v => `${v} days`} />
          <Slider label="Service level" value={service} onChange={setService} min={80} max={99}
            format={v => `${v}%`} />
        </div>
      </Card>

      <DataTable
        rows={suggestions}
        columns={[
          { key: 'name', label: 'Product', width: '28%', nowrap: false,
            render: r => <span className="font-medium">{r.name}</span> },
          { key: 'available', label: 'Available', align: 'right' },
          { key: 'avgDailyDemand', label: 'Demand/day', align: 'right',
            render: r => <span className="tabular-nums">{r.avgDailyDemand.toFixed(1)}</span> },
          { key: 'daysOfCover', label: 'Cover', align: 'right',
            render: r => (
              <Badge tone={r.daysOfCover < leadTime ? 'danger' : r.daysOfCover < leadTime * 2 ? 'warning' : 'success'} size="sm">
                {Math.min(r.daysOfCover, 999)}d
              </Badge>
            ) },
          { key: 'reorderPoint', label: 'ROP', align: 'right' },
          { key: 'safetyStock', label: 'Safety', align: 'right' },
          { key: 'suggestedQty', label: 'Order qty', align: 'right',
            render: r => <span className="font-bold" style={{ color: 'var(--c-primary)' }}>{r.suggestedQty}</span> },
          { key: 'estimatedCost', label: 'Est. cost', align: 'right', render: r => inr(r.estimatedCost) },
          { key: 'urgency', label: 'Urgency',
            render: r => <Badge tone={{ critical: 'danger', high: 'warning', medium: 'info', low: 'neutral' }[r.urgency]} size="sm" dot>
              {r.urgency}</Badge> },
        ]}
        selectable selected={selected} onSelect={setSelected}
        initialSort={['suggestedQty', 'desc']}
        rowKey={r => r.id}
        bulkActions={
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold" style={{ color: 'var(--c-text)' }}>PO value {inr(totalCost)}</span>
            <Button size="xs" onClick={() => { success(`Purchase order drafted for ${selected.length} SKUs`); setSelected([]) }}>
              Create PO
            </Button>
          </div>
        }
        empty={<Empty icon="✓" title="Everything well-stocked" description="No SKU is below its reorder point right now." />}
      />
    </div>
  )
}

/* ---------------------------------------------------------- valuation */
function ValuationView({ products }) {
  const [method, setMethod] = useState('cost')
  const v = useMemo(() => valuation(products, method), [products, method])

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Select value={method} onChange={e => setMethod(e.target.value)} className="!w-auto"
          options={[
            { value: 'cost', label: 'At cost' },
            { value: 'retail', label: 'At retail' },
            { value: 'lower', label: 'Lower of cost/market' },
          ]} />
        <p className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>
          {v.byCategory.reduce((t, c) => t + c.skus, 0)} SKUs · {v.totalUnits.toLocaleString('en-IN')} units
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <BigStat label="Value at cost" value={inr(v.totalCost)} tone="primary" />
        <BigStat label="Value at retail" value={inr(v.totalRetail)} />
        <BigStat label="Unrealised margin" value={inr(v.potentialMargin)} tone="success" />
        <BigStat label="Margin %" value={`${v.marginPct}%`} />
      </div>

      <Card>
        <CardHead title="Value by category" />
        <div className="space-y-2.5">
          {v.byCategory.map(c => (
            <div key={c.category}>
              <div className="flex justify-between text-[12px] mb-1">
                <span style={{ color: 'var(--c-text)' }}>{c.category}</span>
                <span className="tabular-nums font-medium" style={{ color: 'var(--c-text)' }}>
                  {inr(method === 'retail' ? c.retail : c.cost)}
                  <span style={{ color: 'var(--c-text-muted)' }}> · {c.skus} SKUs</span>
                </span>
              </div>
              <Progress value={method === 'retail' ? c.retail : c.cost}
                max={method === 'retail' ? v.byCategory[0].retail : v.byCategory[0].cost} height={5} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------ ageing */
function AgeingView({ products }) {
  const buckets = useMemo(() => ageing(products), [products])
  const total = buckets.reduce((s, b) => s + b.value, 0) || 1
  const tones = ['success', 'success', 'warning', 'danger', 'danger']

  return (
    <div className="space-y-3">
      <Card>
        <CardHead title="Stock ageing" subtitle="Older inventory ties up cash and risks markdown — act before 180 days." />
        <div className="flex h-8 rounded-lg overflow-hidden mb-4">
          {buckets.map((b, i) => (
            <Tooltip key={b.label} content={`${b.label}: ${inr(b.value)}`}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${(b.value / total) * 100}%` }}
                transition={{ duration: .6, delay: i * .08 }}
                style={{ background: `var(--c-${tones[i] === 'success' ? 'success' : tones[i] === 'warning' ? 'warning' : 'danger'})`,
                  opacity: 0.45 + i * 0.14, height: '100%' }} />
            </Tooltip>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {buckets.map((b, i) => (
            <div key={b.label} className="t-card p-2.5" style={{ background: 'var(--c-surface-alt)' }}>
              <p className="text-[10px] font-semibold" style={{ color: 'var(--c-text-muted)' }}>{b.label}</p>
              <p className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--c-text)' }}>{inr(b.value)}</p>
              <p className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>{b.skus} SKUs · {b.units} units</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

/* -------------------------------------------------------- dead stock */
function DeadStockView({ products }) {
  const { success } = useToast()
  const [days, setDays] = useState(90)
  const [selected, setSelected] = useState([])
  const dead = useMemo(
    () => deadStock(products, salesHistory(), { days }).map(d => ({
      ...d,
      id: d.product.id,
      name: d.product.name,
      category: d.product.category,
      price: d.product.price,
      suggestedDiscount: d.units > 20 ? 40 : 25,
      clearPrice: Math.round(d.product.price * (d.units > 20 ? 0.6 : 0.75)),
    })),
    [products, days]
  )
  const lockedValue = dead.reduce((s, d) => s + d.lockedCapital, 0)

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold text-[13.5px]" style={{ color: 'var(--c-text)' }}>
              {dead.length} slow movers · {inr(lockedValue)} locked
            </p>
            <p className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
              No meaningful sales velocity in the last {days} days.
            </p>
          </div>
          <div className="w-48"><Slider value={days} onChange={setDays} min={30} max={365} step={15}
            format={v => `${v} days`} /></div>
        </div>
      </Card>

      <DataTable
        rows={dead}
        columns={[
          { key: 'name', label: 'Product', width: '30%', nowrap: false },
          { key: 'category', label: 'Category' },
          { key: 'units', label: 'Units', align: 'right' },
          { key: 'lockedCapital', label: 'Locked ₹', align: 'right', render: r => inr(r.lockedCapital) },
          { key: 'ageDays', label: 'Age', align: 'right', render: r => `${r.ageDays}d` },
          { key: 'suggestion', label: 'Action', nowrap: false,
            render: r => <span style={{ color: 'var(--c-text-muted)' }}>{r.suggestion}</span> },
          { key: 'suggestedDiscount', label: 'Suggested markdown', align: 'right',
            render: r => <Badge tone="warning" size="sm">−{r.suggestedDiscount}%</Badge> },
          { key: 'clearPrice', label: 'Clear at', align: 'right', render: r => inr(r.clearPrice) },
        ]}
        selectable selected={selected} onSelect={setSelected}
        bulkActions={
          <Button size="xs" onClick={() => {
            const changes = dead.filter(d => selected.includes(d.id)).map(d => ({ id: d.id, to: d.clearPrice }))
            store.dispatch('catalogue/applyBulkPrice', changes)
            success(`Markdown applied to ${changes.length} products`)
            setSelected([])
          }}>Apply markdown</Button>
        }
        empty={<Empty icon="⚡" title="No dead stock" description="Every SKU is moving. Nice." />}
      />
    </div>
  )
}

/* -------------------------------------------------------- warehouses */
function WarehousesView({ warehouses, products, cfg }) {
  const { success } = useToast()
  const totalUnits = products.reduce((s, p) => s + (p.stock || 0), 0)

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        {warehouses.map((w, i) => {
          const units = Math.round(totalUnits * (w.share ?? 1 / warehouses.length))
          return (
            <motion.div key={w.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .06 }}>
              <Card hover>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-[13.5px]" style={{ color: 'var(--c-text)' }}>{w.name}</p>
                    <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{w.city}, {w.state} · {w.pincode}</p>
                  </div>
                  <Badge tone={w.active !== false ? 'success' : 'neutral'} size="sm" dot>
                    {w.active !== false ? 'Active' : 'Paused'}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Stat label="Units" value={units.toLocaleString('en-IN')} />
                  <Stat label="Capacity" value={`${Math.round((units / (w.capacity || 50000)) * 100)}%`} />
                </div>
                <Progress value={units} max={w.capacity || 50000} height={5}
                  tone={units / (w.capacity || 50000) > 0.85 ? 'danger' : 'primary'} />
                <p className="text-[10.5px] mt-2" style={{ color: 'var(--c-text-muted)' }}>
                  Serves {(w.zones || []).join(', ') || 'all zones'}
                </p>
                <div className="flex gap-1.5 mt-3">
                  <Button size="xs" variant="outline"
                    onClick={() => { store.dispatch('catalogue/updateWarehouse', { id: w.id, patch: { active: w.active === false } }); success('Warehouse updated') }}>
                    {w.active !== false ? 'Pause' : 'Activate'}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>

      <Card>
        <CardHead title="Fulfilment policy" subtitle="How orders are split and allocated across locations." />
        <div className="space-y-2.5">
          <Switch label="Allow backorders when out of stock" checked={Boolean(cfg.allowBackorder)}
            onChange={v => store.dispatch('catalogue/setInventoryConfig', { allowBackorder: v })} />
          <Switch label="Split shipments across warehouses" checked={cfg.allowSplit !== false}
            onChange={v => store.dispatch('catalogue/setInventoryConfig', { allowSplit: v })} />
          <Switch label="Reserve stock at checkout (not payment)" checked={Boolean(cfg.reserveAtCheckout)}
            onChange={v => store.dispatch('catalogue/setInventoryConfig', { reserveAtCheckout: v })} />
        </div>
      </Card>
    </div>
  )
}

function BigStat({ label, value, tone }) {
  const colour = { primary: 'var(--c-primary)', success: 'var(--c-success)' }[tone] || 'var(--c-text)'
  return (
    <div className="t-card p-3">
      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>{label}</p>
      <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: colour }}>{value}</p>
    </div>
  )
}
function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[9.5px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>{label}</p>
      <p className="text-[14px] font-bold tabular-nums" style={{ color: 'var(--c-text)' }}>{value}</p>
    </div>
  )
}
