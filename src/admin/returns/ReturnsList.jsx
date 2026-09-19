import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useSlice } from '../../hooks/useStore.js'
import store from '../../core/store/index.js'
import useToast from '../../hooks/useToast.js'
import { selectReturns, selectReturnPolicy } from '../../core/store/slices/returnsSlice.js'
import { selectOrders } from '../../core/store/slices/ordersSlice.js'
import DataTable from '../../ui/patterns/DataTable.jsx'
import EmptyState from '../../ui/EmptyState.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select, Switch } from '../../ui/primitives/Input.jsx'
import { Badge, Card, Drawer, Pill, Tooltip, Empty, Avatar } from '../../ui/primitives/Display.jsx'
import {
  RETURN_STATUS, RETURN_TRANSITIONS, REASON_BY_CODE, returnAnalytics,
} from '../../engines/returns/returnEngine.js'
import { inr } from '../../lib/analytics.js'
import ReturnDetail from './ReturnDetail.jsx'

const R = RETURN_STATUS

export const RMA_TONE = {
  [R.REQUESTED]: 'warning', [R.APPROVED]: 'info', [R.REJECTED]: 'neutral',
  [R.PICKUP_SCHEDULED]: 'info', [R.IN_TRANSIT]: 'primary', [R.RECEIVED]: 'primary',
  [R.QC_PASSED]: 'success', [R.QC_FAILED]: 'danger', [R.REFUNDED]: 'success', [R.CLOSED]: 'neutral',
}

export default function ReturnsList() {
  const returnsState = useSlice('returns')
  const ordersState = useSlice('orders')
  const { success, error } = useToast()
  const nav = useNavigate()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState([])
  const [reason, setReason] = useState([])
  const [selected, setSelected] = useState([])
  const [detailId, setDetailId] = useState(null)
  const [onlySeller, setOnlySeller] = useState(false)

  const state = { returns: returnsState, orders: ordersState }
  const all = useMemo(() => selectReturns(state), [returnsState])
  const orders = useMemo(() => selectOrders(state), [ordersState])

  const analytics = useMemo(() => returnAnalytics(orders, all), [orders, all])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(r => {
      if (status.length && !status.includes(r.status)) return false
      if (reason.length && !r.lines.some(l => reason.includes(l.reasonCode))) return false
      if (onlySeller && !r.sellerAtFault) return false
      if (q) {
        const hay = `${r.id} ${r.orderId} ${r.customerName} ${r.awb ?? ''} ${r.city ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [all, query, status, reason, onlySeller])

  const pending = all.filter(r => [R.REQUESTED, R.APPROVED, R.PICKUP_SCHEDULED, R.IN_TRANSIT, R.RECEIVED].includes(r.status))
  const refundLiability = pending.reduce((s, r) => s + r.lines.reduce((t, l) => t + l.price * l.qty, 0), 0)

  const bulkMove = (to) => {
    const rmas = filtered.filter(r => selected.includes(r.id))
    store.dispatch('returns/bulkTransition', { rmas, to })
    const res = store.get('returns').lastAction
    if (res?.succeeded) success(`${res.succeeded} returns → ${to}`)
    if (res?.failed?.length) error(`${res.failed.length} blocked: ${res.failed[0].reason}`)
    setSelected([])
  }

  const columns = [
    {
      key: 'id', label: 'RMA', width: '14%',
      render: (r) => (
        <div>
          <p className="font-mono font-semibold text-[12px]" style={{ color: 'var(--c-text)' }}>{r.id}</p>
          <p className="text-[10.5px] font-mono" style={{ color: 'var(--c-text-muted)' }}>{r.orderId}</p>
        </div>
      ),
    },
    {
      key: 'customerName', label: 'Customer', width: '18%', nowrap: false,
      render: (r) => (
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={r.customerName} size={24} />
          <div className="min-w-0">
            <p className="truncate" style={{ color: 'var(--c-text)' }}>{r.customerName}</p>
            <p className="text-[10.5px] truncate" style={{ color: 'var(--c-text-muted)' }}>{r.city}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'lines', label: 'Items', width: '22%', nowrap: false, sortValue: (r) => r.lines.length,
      render: (r) => (
        <div>
          <p className="truncate text-[12px]" style={{ color: 'var(--c-text)' }}>{r.lines[0]?.name}</p>
          {r.lines.length > 1 && (
            <p className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>+{r.lines.length - 1} more</p>
          )}
        </div>
      ),
    },
    {
      key: 'reason', label: 'Reason', sortValue: (r) => r.lines[0]?.reasonCode ?? '',
      render: (r) => {
        const code = r.lines[0]?.reasonCode
        const meta = REASON_BY_CODE[code]
        return (
          <Tooltip content={r.lines[0]?.comment || meta?.label}>
            <Badge size="sm" tone={meta?.fault === 'seller' ? 'danger' : meta?.fault === 'courier' ? 'warning' : 'neutral'}>
              {meta?.label ?? code}
            </Badge>
          </Tooltip>
        )
      },
    },
    { key: 'type', label: 'Type', render: (r) => <Badge size="sm" tone={r.type === 'exchange' ? 'info' : 'neutral'}>{r.type.replace('_', ' ')}</Badge> },
    {
      key: 'value', label: 'Value', align: 'right',
      sortValue: (r) => r.lines.reduce((s, l) => s + l.price * l.qty, 0),
      render: (r) => <span className="tabular-nums">{inr(r.lines.reduce((s, l) => s + l.price * l.qty, 0))}</span>,
    },
    {
      key: 'refundAmount', label: 'Refunded', align: 'right',
      render: (r) => r.refundAmount > 0
        ? <span className="tabular-nums font-medium" style={{ color: 'var(--c-success)' }}>{inr(r.refundAmount)}</span>
        : <span style={{ color: 'var(--c-text-muted)' }}>—</span>,
    },
    {
      key: 'age', label: 'Age', align: 'right', sortValue: (r) => r.requestedAt,
      render: (r) => {
        const days = Math.floor((Date.now() - r.requestedAt) / 86400000)
        const stale = days > 7 && ![R.REFUNDED, R.CLOSED, R.REJECTED].includes(r.status)
        return <span className="tabular-nums" style={{ color: stale ? 'var(--c-danger)' : 'var(--c-text-muted)' }}>{days}d</span>
      },
    },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={RMA_TONE[r.status]} size="sm" dot>{r.status}</Badge> },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        <Stat label="Total returns" value={analytics.totalReturns} />
        <Stat label="Return rate" value={`${analytics.returnRatePct}%`} raw
          tone={analytics.returnRatePct > 20 ? 'danger' : 'warning'} />
        <Stat label="Open RMAs" value={pending.length} tone="warning" />
        <Stat label="Refund liability" value={inr(refundLiability)} raw tone="danger" />
        <Stat label="Our fault" value={`${analytics.sellerFaultPct}%`} raw
          tone={analytics.sellerFaultPct > 40 ? 'danger' : 'neutral'} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[220px]">
          <Input value={query} onChange={e => setQuery(e.target.value)} size="sm" prefix="⌕"
            placeholder="RMA, order ID, customer, AWB…" />
        </div>
        <Switch label="Our fault only" checked={onlySeller} onChange={setOnlySeller} size="sm" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {Object.values(R).map(st => {
          const count = all.filter(r => r.status === st).length
          if (!count) return null
          return (
            <Pill key={st} active={status.includes(st)} count={count}
              onClick={() => setStatus(s => s.includes(st) ? s.filter(x => x !== st) : [...s, st])}>{st}</Pill>
          )
        })}
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon="↩"
          title="No returns yet"
          message="Return and refund requests will appear here once orders start flowing through your store."
          secondaryLabel="Add a product"
          onSecondary={() => nav('/admin/catalogue')}
        />
      ) : (
      <DataTable
        rows={filtered}
        columns={columns}
        selectable selected={selected} onSelect={setSelected}
        onRowClick={(r) => setDetailId(r.id)}
        initialSort={['age', 'desc']}
        bulkActions={<BulkBar rmas={filtered.filter(r => selected.includes(r.id))} onRun={bulkMove} />}
        empty={<Empty icon="↩" title="No returns match" description="Adjust the filters to see more." />}
      />
      )}

      <Drawer open={Boolean(detailId)} onClose={() => setDetailId(null)} title="Return detail" width={640}>
        {detailId && <ReturnDetail rmaId={detailId} onClose={() => setDetailId(null)} />}
      </Drawer>
    </div>
  )
}

function BulkBar({ rmas, onRun }) {
  const common = useMemo(() => {
    if (!rmas.length) return []
    const sets = rmas.map(r => new Set(RETURN_TRANSITIONS[r.status] || []))
    return [...sets[0]].filter(to => sets.every(s => s.has(to)))
  }, [rmas])

  if (!common.length) {
    return <span className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
      Selected returns are at different stages — no shared action
    </span>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {common.map(to => (
        <Button key={to} size="xs" variant={to === R.REJECTED ? 'danger' : 'outline'} onClick={() => onRun(to)}>
          → {to}
        </Button>
      ))}
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
