import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSlice } from '../../hooks/useStore.js'
import store from '../../core/store/index.js'
import useToast from '../../hooks/useToast.js'
import { selectOrders } from '../../core/store/slices/ordersSlice.js'
import { selectProducts, selectWarehouses } from '../../core/store/slices/catalogueSlice.js'
import { CUSTOMERS } from '../../data/seed.js'
import DataTable from '../../ui/patterns/DataTable.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select, Switch, Slider } from '../../ui/primitives/Input.jsx'
import { Badge, Card, CardHead, Tabs, Progress, Empty, Tooltip, Modal, Divider } from '../../ui/primitives/Display.jsx'
import {
  ORDER_STATUS, slaBreaches, riskScore, orderMargin,
} from '../../engines/orders/orderEngine.js'
import {
  DEFAULT_COURIERS, DEFAULT_ZONES, resolveZone, checkServiceability, rateShop,
} from '../../engines/shipping/shippingEngine.js'
import { inr } from '../../lib/analytics.js'

const S = ORDER_STATUS

const TABS = [
  { id: 'today', label: 'Today', icon: '◉' },
  { id: 'picking', label: 'Pick & pack', icon: '▤' },
  { id: 'sla', label: 'SLA breaches', icon: '⚠' },
  { id: 'couriers', label: 'Couriers', icon: '⇢' },
  { id: 'zones', label: 'Serviceability', icon: '◍' },
]

export default function Operations() {
  const [tab, setTab] = useState('today')
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Operations</h1>
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          The daily fulfilment cockpit — what to pack, what is late, and which courier to use.
        </p>
      </div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'today' && <TodayBoard />}
          {tab === 'picking' && <PickPack />}
          {tab === 'sla' && <SLABoard />}
          {tab === 'couriers' && <Couriers />}
          {tab === 'zones' && <Serviceability />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* -------------------------------------------------------------- today */

function TodayBoard() {
  const ordersState = useSlice('orders')
  const orders = useMemo(() => selectOrders({ orders: ordersState }), [ordersState])

  const lanes = [
    { status: S.PENDING, label: 'Awaiting payment', tone: 'warning' },
    { status: S.CONFIRMED, label: 'To pack', tone: 'info' },
    { status: S.PACKED, label: 'To hand over', tone: 'primary' },
    { status: S.SHIPPED, label: 'In transit', tone: 'primary' },
    { status: S.OUT_FOR_DELIVERY, label: 'Out for delivery', tone: 'success' },
    { status: S.ON_HOLD, label: 'On hold', tone: 'danger' },
  ]

  const breaches = useMemo(() => slaBreaches(orders, ordersState.slaConfig), [orders, ordersState.slaConfig])
  const breachByOrder = new Map(breaches.map(b => [b.order.id, b]))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
        {lanes.map(l => {
          const list = orders.filter(o => o.status === l.status)
          const late = list.filter(o => breachByOrder.has(o.id)).length
          return (
            <motion.div key={l.status} whileHover={{ y: -2 }} className="t-card p-3">
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>
                {l.label}
              </p>
              <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--c-text)' }}>{list.length}</p>
              {late > 0 && (
                <p className="text-[10.5px]" style={{ color: 'var(--c-danger)' }}>{late} breaching SLA</p>
              )}
              <p className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>
                {inr(list.reduce((s, o) => s + o.total, 0))}
              </p>
            </motion.div>
          )
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <CardHead title="Work queue" subtitle="Oldest first — clear these before anything else." />
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {orders
              .filter(o => [S.CONFIRMED, S.PACKED].includes(o.status))
              .sort((a, b) => a.placedAt - b.placedAt)
              .slice(0, 18)
              .map((o, i) => {
                const breach = breachByOrder.get(o.id)
                const hours = Math.round((Date.now() - o.placedAt) / 3600000)
                return (
                  <motion.div key={o.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * .03 }}
                    className="flex items-center gap-2 p-2 rounded-lg text-[12px]"
                    style={{ background: breach ? 'color-mix(in srgb, var(--c-danger) 7%, transparent)' : 'var(--c-surface-alt)' }}>
                    <span className="font-mono font-semibold" style={{ color: 'var(--c-text)' }}>{o.id}</span>
                    <Badge size="sm" tone={o.status === S.CONFIRMED ? 'info' : 'primary'}>{o.status}</Badge>
                    <span className="flex-1 truncate" style={{ color: 'var(--c-text-muted)' }}>
                      {o.items.reduce((s, i) => s + i.qty, 0)} units · {o.address?.city}
                    </span>
                    <span className="tabular-nums" style={{ color: breach ? 'var(--c-danger)' : 'var(--c-text-muted)' }}>
                      {hours}h
                    </span>
                  </motion.div>
                )
              })}
          </div>
        </Card>

        <Card>
          <CardHead title="Risky dispatches" subtitle="Confirm these before they leave the warehouse." />
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {orders
              .filter(o => [S.CONFIRMED, S.PACKED].includes(o.status))
              .map(o => ({ o, r: riskScore(o, CUSTOMERS.find(c => c.id === o.customerId) || {}) }))
              .filter(x => x.r.band !== 'low')
              .sort((a, b) => b.r.score - a.r.score)
              .slice(0, 15)
              .map(({ o, r }, i) => (
                <motion.div key={o.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * .03 }}
                  className="p-2 rounded-lg" style={{ background: 'var(--c-surface-alt)' }}>
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="font-mono font-semibold" style={{ color: 'var(--c-text)' }}>{o.id}</span>
                    <Badge size="sm" tone={r.band === 'high' ? 'danger' : 'warning'}>{r.score}</Badge>
                    <span className="tabular-nums ml-auto" style={{ color: 'var(--c-text)' }}>{inr(o.total)}</span>
                  </div>
                  <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>{r.flags.join(' · ')}</p>
                  <p className="text-[10.5px]" style={{ color: 'var(--c-primary)' }}>→ {r.action}</p>
                </motion.div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- pick & pack */

function PickPack() {
  const ordersState = useSlice('orders')
  const catalogueState = useSlice('catalogue')
  const { success } = useToast()
  const [selected, setSelected] = useState([])

  const orders = useMemo(
    () => selectOrders({ orders: ordersState }).filter(o => o.status === S.CONFIRMED),
    [ordersState]
  )

  /**
   * Consolidated pick list — the single most useful artefact in a warehouse.
   * Aggregating by SKU across orders means one walk through the racks, not one per order.
   */
  const pickList = useMemo(() => {
    const bySku = {}
    for (const o of orders) {
      for (const it of o.items) {
        bySku[it.sku] = bySku[it.sku] || {
          sku: it.sku, name: it.name, size: it.size, color: it.color,
          category: it.category, qty: 0, orders: [],
        }
        bySku[it.sku].qty += it.qty
        bySku[it.sku].orders.push(o.id)
      }
    }
    return Object.values(bySku).sort((a, b) => a.category.localeCompare(b.category) || b.qty - a.qty)
  }, [orders])

  const totalUnits = pickList.reduce((s, p) => s + p.qty, 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Stat label="Orders to pack" value={orders.length} />
        <Stat label="Unique SKUs" value={pickList.length} />
        <Stat label="Units to pick" value={totalUnits} />
        <Stat label="Order value" value={inr(orders.reduce((s, o) => s + o.total, 0))} raw />
      </div>

      <Card>
        <CardHead title="Consolidated pick list"
          subtitle="Grouped by category so the picker walks the racks once."
          action={
            <Button size="xs" variant="outline" onClick={() => success('Pick list sent to printer')}>
              Print pick list
            </Button>
          } />
        <DataTable
          rows={pickList}
          rowKey={(r) => r.sku}
          selectable selected={selected} onSelect={setSelected}
          showColumnChooser={false}
          pageSize={50}
          columns={[
            { key: 'category', label: 'Zone', render: r => <Badge size="sm">{r.category}</Badge> },
            { key: 'name', label: 'Product', width: '32%', nowrap: false },
            { key: 'variant', label: 'Variant', sortValue: r => r.size,
              render: r => <span style={{ color: 'var(--c-text-muted)' }}>{r.size} · {r.color}</span> },
            { key: 'sku', label: 'SKU', render: r => <span className="font-mono text-[10.5px]">{r.sku}</span> },
            { key: 'qty', label: 'Pick', align: 'right',
              render: r => <span className="font-bold tabular-nums text-[13px]" style={{ color: 'var(--c-primary)' }}>{r.qty}</span> },
            { key: 'orders', label: 'For orders', width: '20%', nowrap: false, sortable: false,
              render: r => (
                <span className="text-[10.5px] font-mono" style={{ color: 'var(--c-text-muted)' }}>
                  {r.orders.slice(0, 3).join(', ')}{r.orders.length > 3 && ` +${r.orders.length - 3}`}
                </span>
              ) },
          ]}
          bulkActions={
            <Button size="xs" onClick={() => { success(`${selected.length} SKUs marked picked`); setSelected([]) }}>
              Mark picked
            </Button>
          }
          empty={<Empty icon="✓" title="Nothing to pack" description="Every confirmed order is already packed." />}
        />
      </Card>
    </div>
  )
}

/* ----------------------------------------------------------------- SLA */

function SLABoard() {
  const ordersState = useSlice('orders')
  const { success } = useToast()
  const cfg = ordersState.slaConfig
  const orders = useMemo(() => selectOrders({ orders: ordersState }), [ordersState])
  const breaches = useMemo(() => slaBreaches(orders, cfg), [orders, cfg])

  const byType = useMemo(() => {
    const m = {}
    for (const b of breaches) (m[b.type] = m[b.type] || []).push(b)
    return m
  }, [breaches])

  const TYPE_LABEL = { payment: 'Payment pending', pack: 'Not packed in time', ship: 'Not handed to courier', deliver: 'Late in transit' }

  return (
    <div className="space-y-3">
      <Card>
        <CardHead title="SLA thresholds" subtitle="Tune these to match what you actually promise customers." />
        <div className="grid sm:grid-cols-3 gap-4">
          <Slider label="Pack within" value={cfg.packHours} min={4} max={72} format={v => `${v} hours`}
            onChange={v => store.dispatch('orders/setSlaConfig', { packHours: v })} />
          <Slider label="Hand to courier within" value={cfg.shipDays} min={1} max={7} format={v => `${v} days`}
            onChange={v => store.dispatch('orders/setSlaConfig', { shipDays: v })} />
          <Slider label="Deliver within" value={cfg.deliverDays} min={2} max={21} format={v => `${v} days`}
            onChange={v => store.dispatch('orders/setSlaConfig', { deliverDays: v })} />
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {['payment', 'pack', 'ship', 'deliver'].map(t => (
          <Stat key={t} label={TYPE_LABEL[t]} value={byType[t]?.length ?? 0}
            tone={(byType[t]?.length ?? 0) > 0 ? 'danger' : undefined} />
        ))}
      </div>

      <DataTable
        rows={breaches}
        rowKey={(b) => b.order.id + b.type}
        columns={[
          { key: 'id', label: 'Order', sortValue: b => b.order.id,
            render: b => <span className="font-mono font-semibold text-[12px]">{b.order.id}</span> },
          { key: 'type', label: 'Breach', render: b => <Badge size="sm" tone="danger">{TYPE_LABEL[b.type]}</Badge> },
          { key: 'message', label: 'Detail', width: '32%', nowrap: false,
            render: b => <span style={{ color: 'var(--c-text-muted)' }}>{b.message}</span> },
          { key: 'breachedBy', label: 'Over by', align: 'right',
            render: b => <span className="tabular-nums font-medium" style={{ color: 'var(--c-danger)' }}>
              {b.breachedBy} {b.unit}
            </span> },
          { key: 'total', label: 'Value', align: 'right', sortValue: b => b.order.total,
            render: b => inr(b.order.total) },
          { key: 'city', label: 'Destination', sortValue: b => b.order.address?.city ?? '',
            render: b => <span style={{ color: 'var(--c-text-muted)' }}>{b.order.address?.city}</span> },
        ]}
        initialSort={['breachedBy', 'desc']}
        empty={<Empty icon="✓" title="No SLA breaches" description="Everything is inside the promised windows." />}
      />
    </div>
  )
}

/* ------------------------------------------------------------ couriers */

function Couriers() {
  const ordersState = useSlice('orders')
  const orders = useMemo(() => selectOrders({ orders: ordersState }), [ordersState])

  /** Real performance per courier, derived from the order book rather than a static table. */
  const performance = useMemo(() => {
    const m = {}
    for (const o of orders) {
      const name = o.courier
      if (!name) continue
      m[name] = m[name] || { courier: name, shipped: 0, delivered: 0, rto: 0, returned: 0, totalDays: 0, value: 0 }
      m[name].shipped++
      m[name].value += o.total
      if (o.status === 'Delivered') { m[name].delivered++; m[name].totalDays += o.deliveryDays ?? 0 }
      if (o.status === 'RTO') m[name].rto++
      if (o.status === 'Returned') m[name].returned++
    }
    return Object.values(m).map(c => ({
      ...c,
      deliveryRate: c.shipped ? Math.round((c.delivered / c.shipped) * 100) : 0,
      rtoRate: c.shipped ? Math.round((c.rto / c.shipped) * 1000) / 10 : 0,
      avgDays: c.delivered ? Math.round((c.totalDays / c.delivered) * 10) / 10 : 0,
    })).sort((a, b) => b.shipped - a.shipped)
  }, [orders])

  return (
    <div className="space-y-3">
      <Card>
        <CardHead title="Courier scorecard"
          subtitle="RTO rate matters more than speed — every RTO costs you both legs of shipping plus the lost sale." />
        <DataTable
          rows={performance}
          rowKey={(c) => c.courier}
          showColumnChooser={false}
          columns={[
            { key: 'courier', label: 'Courier', render: c => <span className="font-semibold">{c.courier}</span> },
            { key: 'shipped', label: 'Shipments', align: 'right' },
            { key: 'value', label: 'Value moved', align: 'right', render: c => inr(c.value) },
            { key: 'deliveryRate', label: 'Delivered', align: 'right',
              render: c => (
                <div className="flex items-center justify-end gap-2">
                  <div className="w-12"><Progress value={c.deliveryRate} height={4} animated={false}
                    tone={c.deliveryRate > 85 ? 'success' : c.deliveryRate > 70 ? 'warning' : 'danger'} /></div>
                  <span className="tabular-nums text-[11px]">{c.deliveryRate}%</span>
                </div>
              ) },
            { key: 'rtoRate', label: 'RTO rate', align: 'right',
              render: c => <Badge size="sm" tone={c.rtoRate > 12 ? 'danger' : c.rtoRate > 7 ? 'warning' : 'success'}>
                {c.rtoRate}%
              </Badge> },
            { key: 'avgDays', label: 'Avg days', align: 'right',
              render: c => <span className="tabular-nums">{c.avgDays}</span> },
          ]}
          initialSort={['shipped', 'desc']}
        />
      </Card>

      <Card>
        <CardHead title="Configured rate cards" subtitle="What the rate-shop engine quotes from." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {DEFAULT_COURIERS.map(c => (
            <div key={c.id} className="p-2.5 rounded-lg border" style={{ borderColor: 'var(--c-border)' }}>
              <p className="text-[12.5px] font-semibold" style={{ color: 'var(--c-text)' }}>{c.name}</p>
              <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
                Base {inr(c.baseRate ?? 0)} · {c.perKgRate ? `${inr(c.perKgRate)}/kg` : 'flat'}
              </p>
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {c.cod && <Badge size="sm">COD</Badge>}
                {c.express && <Badge size="sm" tone="info">Express</Badge>}
                {c.rating && <Badge size="sm" tone="success">★ {c.rating}</Badge>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------ serviceability */

function Serviceability() {
  const catalogueState = useSlice('catalogue')
  const [pincode, setPincode] = useState('110001')
  const result = useMemo(() => checkServiceability(pincode), [pincode])

  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Card>
        <CardHead title="Pincode checker" subtitle="Exactly what the storefront tells a shopper at checkout." />
        <Input label="Pincode" value={pincode} maxLength={6}
          onChange={e => setPincode(e.target.value.replace(/\D/g, ''))}
          placeholder="6-digit pincode" />

        <AnimatePresence mode="wait">
          <motion.div key={pincode} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-3">
            {pincode.length === 6 ? (
              <div className="p-3 rounded-lg" style={{ background: 'var(--c-surface-alt)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge tone={result.ok ? 'success' : 'danger'} dot>
                    {result.ok ? 'Serviceable' : 'Not serviceable'}
                  </Badge>
                  {result.zone && <Badge size="sm">{result.zone}</Badge>}
                </div>
                {result.ok && (
                  <>
                    <Row label="Estimated delivery" value={`${result.days} days`} />
                    {result.eta && <Row label="Arrives by" value={new Date(result.eta).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} />}
                    <Row label="COD available" value={result.cod ? 'Yes' : 'No'} />
                    <Row label="Express" value={result.express ? 'Available' : 'Not available'} />
                    <Row label="Same day" value={result.sameDay ? 'Available' : 'Not available'} />
                  </>
                )}
              </div>
            ) : (
              <p className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>Enter a 6-digit pincode.</p>
            )}
          </motion.div>
        </AnimatePresence>
      </Card>

      <Card>
        <CardHead title="Delivery zones" subtitle="Rate bands and promised transit times." />
        <div className="space-y-2">
          {DEFAULT_ZONES.map(z => (
            <div key={z.id ?? z.name} className="p-2.5 rounded-lg border" style={{ borderColor: 'var(--c-border)' }}>
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-semibold" style={{ color: 'var(--c-text)' }}>{z.name}</p>
                <Badge size="sm">{z.days ?? `${z.minDays}–${z.maxDays}`} days</Badge>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                {z.states ? z.states.slice(0, 5).join(', ') : z.description}
                {z.states?.length > 5 && ` +${z.states.length - 5} more`}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-[12px] py-0.5">
      <span style={{ color: 'var(--c-text-muted)' }}>{label}</span>
      <span className="tabular-nums" style={{ color: 'var(--c-text)' }}>{value}</span>
    </div>
  )
}

function Stat({ label, value, tone, raw }) {
  const colour = { success: 'var(--c-success)', warning: 'var(--c-warning)', danger: 'var(--c-danger)' }[tone] || 'var(--c-text)'
  return (
    <div className="t-card p-3">
      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>{label}</p>
      <p className="text-base font-bold tabular-nums mt-0.5" style={{ color: colour }}>
        {raw ? value : Number(value).toLocaleString('en-IN')}
      </p>
    </div>
  )
}
