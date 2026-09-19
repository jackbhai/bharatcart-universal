import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useSlice } from '../../hooks/useStore.js'
import store from '../../core/store/index.js'
import useToast from '../../hooks/useToast.js'
import { selectOrders } from '../../core/store/slices/ordersSlice.js'
import { CUSTOMERS } from '../../data/seed.js'
import DataTable from '../../ui/patterns/DataTable.jsx'
import EmptyState from '../../ui/EmptyState.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select, Switch } from '../../ui/primitives/Input.jsx'
import { Badge, Card, Drawer, Modal, Pill, Tooltip, Empty, Avatar } from '../../ui/primitives/Display.jsx'
import {
  ORDER_STATUS, allowedTransitions, orderMargin, slaBreaches, riskScore,
} from '../../engines/orders/orderEngine.js'
import { inr } from '../../lib/analytics.js'
import OrderDetail from './OrderDetail.jsx'

const S = ORDER_STATUS

export const STATUS_TONE = {
  [S.PENDING]: 'warning', [S.CONFIRMED]: 'info', [S.PACKED]: 'info',
  [S.SHIPPED]: 'primary', [S.OUT_FOR_DELIVERY]: 'primary', [S.DELIVERED]: 'success',
  [S.CANCELLED]: 'neutral', [S.RTO]: 'danger', [S.RETURNED]: 'danger', [S.ON_HOLD]: 'warning',
}

const CUST_BY_ID = new Map(CUSTOMERS.map(c => [c.id, c]))

export default function OrdersList() {
  const ordersState = useSlice('orders')
  const { success, error, info } = useToast()
  const nav = useNavigate()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState([])
  const [payment, setPayment] = useState([])
  const [range, setRange] = useState('90')
  const [selected, setSelected] = useState([])
  const [detailId, setDetailId] = useState(null)
  const [onlyBreaches, setOnlyBreaches] = useState(false)
  const [onlyRisk, setOnlyRisk] = useState(false)

  const all = useMemo(() => selectOrders({ orders: ordersState }), [ordersState])

  const breachIds = useMemo(() => {
    const b = slaBreaches(all, ordersState.slaConfig)
    return new Map(b.map(x => [x.order.id, x]))
  }, [all, ordersState.slaConfig])

  const filtered = useMemo(() => {
    const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 86400000
    const q = query.trim().toLowerCase()
    return all.filter(o => {
      if (o.placedAt < cutoff) return false
      if (status.length && !status.includes(o.status)) return false
      if (payment.length && !payment.includes(o.paymentMethod)) return false
      if (onlyBreaches && !breachIds.has(o.id)) return false
      if (onlyRisk) {
        const r = riskScore(o, CUST_BY_ID.get(o.customerId) || {})
        if (r.band === 'low') return false
      }
      if (q) {
        const cust = CUST_BY_ID.get(o.customerId)
        const hay = `${o.id} ${cust?.name ?? ''} ${cust?.phone ?? ''} ${o.awb ?? ''} ${o.address?.city ?? ''} ${o.address?.pincode ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    }).sort((a, b) => b.placedAt - a.placedAt)
  }, [all, query, status, payment, range, onlyBreaches, onlyRisk, breachIds])

  const stats = useMemo(() => {
    const revenue = filtered.filter(o => !['Cancelled'].includes(o.status)).reduce((s, o) => s + o.total, 0)
    const margins = filtered.map(o => orderMargin(o))
    const profit = margins.reduce((s, m) => s + m.profit, 0)
    const toPack = filtered.filter(o => o.status === S.CONFIRMED).length
    const inTransit = filtered.filter(o => [S.SHIPPED, S.OUT_FOR_DELIVERY].includes(o.status)).length
    const problems = filtered.filter(o => [S.RTO, S.ON_HOLD].includes(o.status)).length
    return {
      count: filtered.length, revenue, profit, toPack, inTransit, problems,
      aov: filtered.length ? Math.round(revenue / filtered.length) : 0,
      breaches: filtered.filter(o => breachIds.has(o.id)).length,
    }
  }, [filtered, breachIds])

  const doBulk = (to) => {
    const orders = filtered.filter(o => selected.includes(o.id))
    store.dispatch('orders/bulkTransition', { orders, to, role: 'admin' })
    const result = store.get('orders').lastAction
    if (result?.succeeded) success(`${result.succeeded} orders → ${to}`)
    if (result?.failed?.length) {
      error(`${result.failed.length} could not move: ${result.failed[0].reason}`)
    }
    setSelected([])
  }

  const columns = [
    {
      key: 'id', label: 'Order', width: '16%',
      render: (o) => {
        const breach = breachIds.get(o.id)
        return (
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold font-mono text-[12px]" style={{ color: 'var(--c-text)' }}>{o.id}</span>
              {breach && <Tooltip content={breach.message}><span style={{ color: 'var(--c-danger)' }}>⚠</span></Tooltip>}
            </div>
            <p className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>
              {new Date(o.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        )
      },
    },
    {
      key: 'customer', label: 'Customer', width: '20%', nowrap: false,
      sortValue: (o) => CUST_BY_ID.get(o.customerId)?.name ?? '',
      render: (o) => {
        const c = CUST_BY_ID.get(o.customerId)
        return (
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={c?.name ?? '?'} size={26} />
            <div className="min-w-0">
              <p className="truncate font-medium" style={{ color: 'var(--c-text)' }}>{c?.name ?? o.customerId}</p>
              <p className="text-[10.5px] truncate" style={{ color: 'var(--c-text-muted)' }}>
                {o.address?.city}, {o.address?.state}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'items', label: 'Items', align: 'center',
      sortValue: (o) => o.items.reduce((s, i) => s + i.qty, 0),
      render: (o) => <span className="tabular-nums">{o.items.reduce((s, i) => s + i.qty, 0)}</span>,
    },
    { key: 'total', label: 'Total', align: 'right', render: (o) => <span className="font-semibold tabular-nums">{inr(o.total)}</span> },
    {
      key: 'margin', label: 'Profit', align: 'right',
      sortValue: (o) => orderMargin(o).profit,
      render: (o) => {
        const m = orderMargin(o)
        return (
          <Tooltip content={`${m.marginPct}% margin · COGS ${inr(m.cogs)}`}>
            <span className="tabular-nums font-medium"
              style={{ color: m.profit > 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
              {inr(m.profit)}
            </span>
          </Tooltip>
        )
      },
    },
    {
      key: 'paymentMethod', label: 'Payment',
      render: (o) => (
        <div className="flex items-center gap-1.5">
          <Badge tone={o.paymentMethod === 'COD' ? 'warning' : 'neutral'} size="sm">{o.paymentMethod}</Badge>
          {!o.paid && <Tooltip content="Not yet collected"><span style={{ color: 'var(--c-warning)' }}>●</span></Tooltip>}
        </div>
      ),
    },
    {
      key: 'risk', label: 'Risk', align: 'center',
      sortValue: (o) => riskScore(o, CUST_BY_ID.get(o.customerId) || {}).score,
      render: (o) => {
        const r = riskScore(o, CUST_BY_ID.get(o.customerId) || {})
        if (r.band === 'low') return <span style={{ color: 'var(--c-text-muted)' }}>—</span>
        return (
          <Tooltip content={`${r.flags.join(' · ')} → ${r.action}`}>
            <Badge tone={r.band === 'high' ? 'danger' : 'warning'} size="sm">{r.score}</Badge>
          </Tooltip>
        )
      },
    },
    { key: 'status', label: 'Status', render: (o) => <Badge tone={STATUS_TONE[o.status]} size="sm" dot>{o.status}</Badge> },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
        <Stat label="Orders" value={stats.count} />
        <Stat label="Revenue" value={inr(stats.revenue)} raw />
        <Stat label="Profit" value={inr(stats.profit)} raw tone={stats.profit > 0 ? 'success' : 'danger'} />
        <Stat label="To pack" value={stats.toPack} tone="warning" onClick={() => setStatus([S.CONFIRMED])} />
        <Stat label="In transit" value={stats.inTransit} tone="info" />
        <Stat label="SLA breaches" value={stats.breaches} tone="danger" onClick={() => setOnlyBreaches(true)} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[220px]">
          <Input value={query} onChange={e => setQuery(e.target.value)} size="sm" prefix="⌕"
            placeholder="Order ID, customer, phone, AWB, pincode…" />
        </div>
        <Select value={range} onChange={e => setRange(e.target.value)} className="!w-auto"
          options={[
            { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' },
            { value: '90', label: 'Last 90 days' }, { value: '365', label: 'Last year' },
            { value: 'all', label: 'All time' },
          ]} />
        <Switch label="SLA breaches" checked={onlyBreaches} onChange={setOnlyBreaches} size="sm" />
        <Switch label="Risky only" checked={onlyRisk} onChange={setOnlyRisk} size="sm" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {Object.values(S).map(st => {
          const count = all.filter(o => o.status === st).length
          if (!count) return null
          return (
            <Pill key={st} active={status.includes(st)} count={count}
              onClick={() => setStatus(s => s.includes(st) ? s.filter(x => x !== st) : [...s, st])}>
              {st}
            </Pill>
          )
        })}
        {(status.length > 0 || onlyBreaches || onlyRisk) && (
          <button onClick={() => { setStatus([]); setOnlyBreaches(false); setOnlyRisk(false) }}
            className="text-[11px] px-2 hover:underline" style={{ color: 'var(--c-text-muted)' }}>Clear</button>
        )}
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon="▤"
          title="No orders yet"
          message="Orders will appear here as soon as customers start checking out on your storefront."
          secondaryLabel="Add a product"
          onSecondary={() => nav('/admin/catalogue')}
        />
      ) : (
      <DataTable
        rows={filtered}
        columns={columns}
        selectable
        selected={selected}
        onSelect={setSelected}
        onRowClick={(o) => setDetailId(o.id)}
        pageSize={25}
        bulkActions={<BulkBar selected={selected} orders={filtered} onRun={doBulk} />}
        empty={<Empty icon="◫" title="No orders match" description="Try widening the date range or clearing filters." />}
      />
      )}

      <Drawer open={Boolean(detailId)} onClose={() => setDetailId(null)} title="Order detail" width={680}>
        {detailId && <OrderDetail orderId={detailId} onClose={() => setDetailId(null)} />}
      </Drawer>
    </div>
  )
}

function BulkBar({ selected, orders, onRun }) {
  const chosen = orders.filter(o => selected.includes(o.id))
  // Only offer transitions that are legal for every selected order.
  const common = useMemo(() => {
    if (!chosen.length) return []
    const sets = chosen.map(o => new Set(allowedTransitions(o, 'admin').map(t => t.to)))
    return [...sets[0]].filter(to => sets.every(s => s.has(to)))
  }, [chosen])

  if (!common.length) {
    return <span className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
      No action applies to all {chosen.length} selected orders
    </span>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {common.map(to => (
        <Button key={to} size="xs" variant={to === 'Cancelled' ? 'danger' : 'outline'} onClick={() => onRun(to)}>
          → {to}
        </Button>
      ))}
    </div>
  )
}

function Stat({ label, value, tone, raw, onClick }) {
  const colour = { success: 'var(--c-success)', warning: 'var(--c-warning)', danger: 'var(--c-danger)', info: 'var(--c-info)' }[tone] || 'var(--c-text)'
  return (
    <motion.div whileHover={onClick ? { y: -2 } : undefined} onClick={onClick}
      className={`t-card p-3 ${onClick ? 'cursor-pointer' : ''}`}>
      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>{label}</p>
      <p className="text-base font-bold tabular-nums mt-0.5" style={{ color: colour }}>
        {raw ? value : Number(value).toLocaleString('en-IN')}
      </p>
    </motion.div>
  )
}
