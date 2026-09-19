import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useSlice } from '../../hooks/useStore.js'
import { CUSTOMERS, ORDERS_BY_CUSTOMER, TICKETS } from '../../data/seed.js'
import { selectReturns } from '../../core/store/slices/returnsSlice.js'
import { selectOrders } from '../../core/store/slices/ordersSlice.js'
import DataTable from '../../ui/patterns/DataTable.jsx'
import EmptyState from '../../ui/EmptyState.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select, Switch } from '../../ui/primitives/Input.jsx'
import { Badge, Card, CardHead, Drawer, Tabs, Pill, Avatar, Progress, Tooltip, Empty } from '../../ui/primitives/Display.jsx'
import {
  rfmScores, SEGMENT_META, predictCLV, churnRisk, cohortRetention, priorityCustomers,
} from '../../engines/orders/customerEngine.js'
import { inr } from '../../lib/analytics.js'
import Customer360 from './Customer360.jsx'

const TABS = [
  { id: 'list', label: 'All customers', icon: '◯' },
  { id: 'segments', label: 'Segments', icon: '◫' },
  { id: 'churn', label: 'Churn risk', icon: '⚠' },
  { id: 'cohorts', label: 'Cohorts', icon: '▦' },
  { id: 'actions', label: 'Action list', icon: '★' },
]

export default function Customers() {
  const ordersState = useSlice('orders')
  const returnsState = useSlice('returns')
  const [tab, setTab] = useState('list')
  const [focusId, setFocusId] = useState(null)

  const state = { orders: ordersState, returns: returnsState }
  const orders = useMemo(() => selectOrders(state), [ordersState])
  const returns = useMemo(() => selectReturns(state), [returnsState])

  // Rebuild the per-customer order index from live (override-aware) orders.
  const byCustomer = useMemo(() => {
    const m = {}
    for (const o of orders) (m[o.customerId] = m[o.customerId] || []).push(o)
    return m
  }, [orders])

  const rows = useMemo(() => rfmScores(CUSTOMERS, byCustomer), [byCustomer])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Customers</h1>
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          RFM segmentation, predicted lifetime value and the next best action for every buyer.
        </p>
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'list' && <CustomerList rows={rows} onOpen={setFocusId} />}
          {tab === 'segments' && <Segments rows={rows} onOpen={setFocusId} />}
          {tab === 'churn' && <ChurnView rows={rows} onOpen={setFocusId} />}
          {tab === 'cohorts' && <Cohorts byCustomer={byCustomer} />}
          {tab === 'actions' && <ActionList rows={rows} returns={returns} onOpen={setFocusId} />}
        </motion.div>
      </AnimatePresence>

      <Drawer open={Boolean(focusId)} onClose={() => setFocusId(null)} title="Customer 360" width={700}>
        {focusId && <Customer360 customerId={focusId} onClose={() => setFocusId(null)} />}
      </Drawer>
    </div>
  )
}

/* ------------------------------------------------------------- list */

function CustomerList({ rows, onOpen }) {
  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState([])
  const nav = useNavigate()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => {
      if (segment.length && !segment.includes(r.segment)) return false
      if (q) {
        const c = r.customer
        const hay = `${c.name} ${c.email} ${c.phone} ${c.city} ${c.state}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, query, segment])

  const segments = useMemo(() => {
    const m = {}
    for (const r of rows) m[r.segment] = (m[r.segment] || 0) + 1
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [rows])

  return (
    <div className="space-y-3">
      <Input value={query} onChange={e => setQuery(e.target.value)} size="sm" prefix="⌕"
        placeholder="Name, email, phone, city…" />

      <div className="flex flex-wrap gap-1.5">
        {segments.map(([seg, n]) => (
          <Pill key={seg} active={segment.includes(seg)} count={n}
            onClick={() => setSegment(s => s.includes(seg) ? s.filter(x => x !== seg) : [...s, seg])}>{seg}</Pill>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="◉"
          title="No customers yet"
          message="Shoppers who place orders on your storefront will show up here with RFM segments and lifetime value."
          secondaryLabel="Add a product"
          onSecondary={() => nav('/admin/catalogue')}
        />
      ) : (
      <DataTable
        rows={filtered}
        rowKey={(r) => r.customer.id}
        onRowClick={(r) => onOpen(r.customer.id)}
        initialSort={['monetary', 'desc']}
        columns={[
          {
            key: 'name', label: 'Customer', width: '24%', nowrap: false,
            sortValue: (r) => r.customer.name,
            render: (r) => (
              <div className="flex items-center gap-2 min-w-0">
                <Avatar name={r.customer.name} size={28} />
                <div className="min-w-0">
                  <p className="truncate font-medium" style={{ color: 'var(--c-text)' }}>{r.customer.name}</p>
                  <p className="text-[10.5px] truncate" style={{ color: 'var(--c-text-muted)' }}>
                    {r.customer.city} · joined {new Date(r.customer.joinedAt).getFullYear()}
                  </p>
                </div>
              </div>
            ),
          },
          {
            key: 'segment', label: 'Segment',
            render: (r) => <Badge size="sm" tone={SEGMENT_META[r.segment]?.tone}>{r.segment}</Badge>,
          },
          { key: 'rfm', label: 'RFM', align: 'center', sortValue: (r) => r.rfmTotal,
            render: (r) => <span className="font-mono tabular-nums text-[11px]">{r.rfm}</span> },
          { key: 'frequency', label: 'Orders', align: 'right' },
          { key: 'monetary', label: 'Lifetime', align: 'right',
            render: (r) => <span className="font-semibold tabular-nums">{inr(r.monetary)}</span> },
          { key: 'aov', label: 'AOV', align: 'right', render: (r) => inr(r.aov) },
          { key: 'recencyDays', label: 'Last seen', align: 'right',
            render: (r) => (
              <span className="tabular-nums"
                style={{ color: r.recencyDays > 120 ? 'var(--c-danger)' : r.recencyDays > 60 ? 'var(--c-warning)' : 'var(--c-text-muted)' }}>
                {r.recencyDays}d
              </span>
            ) },
          {
            key: 'clv', label: 'Predicted CLV', align: 'right',
            sortValue: (r) => predictCLV(r).totalValue,
            render: (r) => {
              const c = predictCLV(r)
              return (
                <Tooltip content={`${c.churnProbability}% churn risk · ${c.ordersPerMonth}/mo`}>
                  <span className="tabular-nums font-medium" style={{ color: 'var(--c-primary)' }}>{inr(c.totalValue)}</span>
                </Tooltip>
              )
            },
          },
        ]}
      />
      )}
    </div>
  )
}

/* --------------------------------------------------------- segments */

function Segments({ rows, onOpen }) {
  const grouped = useMemo(() => {
    const m = {}
    for (const r of rows) {
      m[r.segment] = m[r.segment] || { segment: r.segment, members: [], value: 0 }
      m[r.segment].members.push(r)
      m[r.segment].value += r.monetary
    }
    return Object.values(m).sort((a, b) => b.value - a.value)
  }, [rows])

  const totalValue = grouped.reduce((s, g) => s + g.value, 0) || 1

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {grouped.map((g, i) => {
        const meta = SEGMENT_META[g.segment] || {}
        return (
          <motion.div key={g.segment} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * .04 }}>
            <Card hover className="h-full">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-[13.5px]" style={{ color: 'var(--c-text)' }}>{g.segment}</p>
                  <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
                    {g.members.length} customers · {Math.round((g.value / totalValue) * 100)}% of value
                  </p>
                </div>
                <Badge tone={meta.tone} size="sm" dot>{g.members.length}</Badge>
              </div>

              <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--c-text)' }}>{inr(g.value)}</p>
              <Progress value={g.value} max={grouped[0].value} height={4} tone={meta.tone === 'danger' ? 'danger' : 'primary'} />

              <p className="text-[11.5px] mt-2.5 mb-2" style={{ color: 'var(--c-primary)' }}>→ {meta.action}</p>

              <div className="flex -space-x-1.5">
                {g.members.slice(0, 6).map(m => (
                  <button key={m.customer.id} onClick={() => onOpen(m.customer.id)}>
                    <Avatar name={m.customer.name} size={24} ring />
                  </button>
                ))}
                {g.members.length > 6 && (
                  <span className="w-6 h-6 rounded-full grid place-items-center text-[9px] font-semibold"
                    style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}>
                    +{g.members.length - 6}
                  </span>
                )}
              </div>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------ churn */

function ChurnView({ rows, onOpen }) {
  const risky = useMemo(() => churnRisk(rows).slice(0, 60), [rows])
  const valueAtRisk = risky.reduce((s, r) => s + r.clv.totalValue, 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Stat label="At risk" value={risky.length} tone="danger" />
        <Stat label="Value at risk" value={inr(valueAtRisk)} raw tone="danger" />
        <Stat label="High risk" value={risky.filter(r => r.clv.risk === 'high').length} tone="danger" />
        <Stat label="Avg churn prob" value={`${Math.round(risky.reduce((s, r) => s + r.clv.churnProbability, 0) / (risky.length || 1))}%`} raw />
      </div>

      <DataTable
        rows={risky}
        rowKey={(r) => r.customer.id}
        onRowClick={(r) => onOpen(r.customer.id)}
        columns={[
          {
            key: 'name', label: 'Customer', width: '24%', nowrap: false,
            sortValue: (r) => r.customer.name,
            render: (r) => (
              <div className="flex items-center gap-2 min-w-0">
                <Avatar name={r.customer.name} size={26} />
                <div className="min-w-0">
                  <p className="truncate font-medium" style={{ color: 'var(--c-text)' }}>{r.customer.name}</p>
                  <p className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>{r.segment}</p>
                </div>
              </div>
            ),
          },
          { key: 'churn', label: 'Churn risk', align: 'right', sortValue: (r) => r.clv.churnProbability,
            render: (r) => (
              <div className="flex items-center justify-end gap-2">
                <div className="w-14"><Progress value={r.clv.churnProbability} height={4}
                  tone={r.clv.churnProbability > 70 ? 'danger' : 'warning'} animated={false} /></div>
                <span className="tabular-nums text-[11px]" style={{ color: 'var(--c-danger)' }}>{r.clv.churnProbability}%</span>
              </div>
            ) },
          { key: 'recencyDays', label: 'Silent for', align: 'right', render: (r) => `${r.recencyDays}d` },
          { key: 'gap', label: 'Usual gap', align: 'right', sortValue: (r) => r.clv.expectedGapDays,
            render: (r) => <span style={{ color: 'var(--c-text-muted)' }}>{r.clv.expectedGapDays}d</span> },
          { key: 'frequency', label: 'Orders', align: 'right' },
          { key: 'monetary', label: 'Spent', align: 'right', render: (r) => inr(r.monetary) },
          { key: 'value', label: 'Value at risk', align: 'right', sortValue: (r) => r.clv.totalValue,
            render: (r) => <span className="font-semibold tabular-nums" style={{ color: 'var(--c-primary)' }}>{inr(r.clv.totalValue)}</span> },
        ]}
        empty={<Empty icon="✓" title="Nobody at risk" />}
      />
    </div>
  )
}

/* ---------------------------------------------------------- cohorts */

function Cohorts({ byCustomer }) {
  const cohorts = useMemo(() => cohortRetention(CUSTOMERS, byCustomer, 12), [byCustomer])
  const maxMonth = Math.max(0, ...cohorts.map(c => c.cells.length))

  return (
    <Card>
      <CardHead title="Monthly acquisition cohorts"
        subtitle="What share of each intake month is still buying N months later. Darker = better retention." />
      <div className="overflow-x-auto">
        <table className="text-[11px] border-collapse">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left sticky left-0" style={{ color: 'var(--c-text-muted)', background: 'var(--c-surface)' }}>
                Cohort
              </th>
              <th className="px-2 py-1.5 text-right" style={{ color: 'var(--c-text-muted)' }}>Size</th>
              {Array.from({ length: maxMonth }, (_, i) => (
                <th key={i} className="px-2 py-1.5 text-center min-w-[42px]" style={{ color: 'var(--c-text-muted)' }}>M{i}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map(c => (
              <tr key={c.cohort}>
                <td className="px-2 py-1 font-medium sticky left-0"
                  style={{ color: 'var(--c-text)', background: 'var(--c-surface)' }}>{c.cohort}</td>
                <td className="px-2 py-1 text-right tabular-nums" style={{ color: 'var(--c-text-muted)' }}>{c.size}</td>
                {c.cells.map(cell => (
                  <td key={cell.month} className="px-1 py-1">
                    <Tooltip content={`${cell.active} active · ${inr(cell.revenue)} · ₹${cell.revenuePerUser}/user`}>
                      <motion.div initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: cell.month * .02 }}
                        className="rounded text-center py-1 tabular-nums text-[10.5px] font-medium cursor-default"
                        style={{
                          background: cell.pct === 0 ? 'var(--c-surface-alt)'
                            : `color-mix(in srgb, var(--c-primary) ${Math.min(90, 12 + cell.pct * 1.6)}%, transparent)`,
                          color: cell.pct > 42 ? 'var(--c-primary-fg)' : 'var(--c-text)',
                        }}>
                        {cell.pct}%
                      </motion.div>
                    </Tooltip>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] mt-3" style={{ color: 'var(--c-text-muted)' }}>
        M0 is the acquisition month itself, so it is always 100%. The number that matters is M1 — the second-order rate.
      </p>
    </Card>
  )
}

/* ------------------------------------------------------- action list */

function ActionList({ rows, returns, onOpen }) {
  const priority = useMemo(
    () => priorityCustomers(rows, { tickets: TICKETS, returns }, 40),
    [rows, returns]
  )

  const TYPE_TONE = { support: 'danger', winback: 'warning', repeat: 'info', advocacy: 'success', risk: 'danger', aov: 'neutral', nurture: 'neutral' }

  return (
    <div className="space-y-2">
      {priority.map((p, i) => (
        <motion.div key={p.customer.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * .03, .4) }}>
          <Card hover className="cursor-pointer" onClick={() => onOpen(p.customer.id)}>
            <div className="flex items-start gap-3">
              <Avatar name={p.customer.name} size={36} ring />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-[13px]" style={{ color: 'var(--c-text)' }}>{p.customer.name}</p>
                  <Badge size="sm" tone={SEGMENT_META[p.segment]?.tone}>{p.segment}</Badge>
                  <Badge size="sm" tone={TYPE_TONE[p.topAction.type]}>{p.topAction.type}</Badge>
                </div>
                <p className="text-[12.5px] font-medium mt-1" style={{ color: 'var(--c-primary)' }}>
                  {p.topAction.title}
                </p>
                <p className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>{p.topAction.why}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-bold tabular-nums" style={{ color: 'var(--c-text)' }}>
                  {inr(p.clv.totalValue)}
                </p>
                <p className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>lifetime value</p>
                <Button size="xs" variant="soft" className="mt-1.5">{p.topAction.cta}</Button>
              </div>
            </div>
          </Card>
        </motion.div>
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
