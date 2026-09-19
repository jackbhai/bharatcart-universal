import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSlice } from '../../hooks/useStore.js'
import { CUSTOMERS, TICKETS, eventsFor } from '../../data/seed.js'
import { selectOrders } from '../../core/store/slices/ordersSlice.js'
import { selectReturnsByCustomer } from '../../core/store/slices/returnsSlice.js'
import Button from '../../ui/primitives/Button.jsx'
import { Badge, Card, CardHead, Tabs, Divider, Avatar, Progress, Tooltip, Empty } from '../../ui/primitives/Display.jsx'
import {
  rfmScores, SEGMENT_META, predictCLV, nextBestAction,
} from '../../engines/orders/customerEngine.js'
import { resolveTier, tierProgress, DEFAULT_CONFIG } from '../../engines/loyalty/loyaltyEngine.js'
import { personalisedFeed } from '../../engines/analytics/recoEngine.js'
import { selectProducts } from '../../core/store/slices/catalogueSlice.js'
import { orderMargin } from '../../engines/orders/orderEngine.js'
import { inr } from '../../lib/analytics.js'
import { STATUS_TONE } from '../orders/OrdersList.jsx'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders' },
  { id: 'returns', label: 'Returns' },
  { id: 'activity', label: 'Activity' },
  { id: 'support', label: 'Support' },
]

export default function Customer360({ customerId, onClose }) {
  const ordersState = useSlice('orders')
  const returnsState = useSlice('returns')
  const catalogueState = useSlice('catalogue')
  const loyaltyState = useSlice('loyalty')
  const [tab, setTab] = useState('overview')

  const state = { orders: ordersState, returns: returnsState, catalogue: catalogueState }
  const customer = CUSTOMERS.find(c => c.id === customerId)
  if (!customer) return <Empty icon="?" title="Customer not found" />

  const allOrders = useMemo(() => selectOrders(state), [ordersState])
  const orders = useMemo(
    () => allOrders.filter(o => o.customerId === customerId).sort((a, b) => b.placedAt - a.placedAt),
    [allOrders, customerId]
  )
  const returns = useMemo(() => selectReturnsByCustomer(state, customerId), [returnsState, customerId])
  const tickets = useMemo(() => TICKETS.filter(t => t.customerId === customerId), [customerId])

  const row = useMemo(() => {
    const byCust = { [customerId]: orders }
    return rfmScores([customer], byCust)[0]
  }, [customer, orders, customerId])

  const clv = predictCLV(row)
  const actions = nextBestAction(row, { tickets, returns })
  const loyaltyCfg = loyaltyState.config
  const tier = resolveTier({ spend12m: row.monetary, spend: row.monetary }, loyaltyCfg)
  const progress = tierProgress({ spend12m: row.monetary, spend: row.monetary }, loyaltyCfg)

  const returnRate = orders.length ? Math.round((returns.length / orders.length) * 100) : 0

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------------- head */}
      <div className="flex items-start gap-3">
        <Avatar name={customer.name} size={52} ring />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-[16px]" style={{ color: 'var(--c-text)' }}>{customer.name}</h3>
            <Badge tone={SEGMENT_META[row.segment]?.tone} dot>{row.segment}</Badge>
            {tier && <Badge tone="primary" size="sm">{tier.name}</Badge>}
          </div>
          <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
            {customer.email} · {customer.phone}
          </p>
          <p className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
            {customer.city}, {customer.state} · Tier {customer.cityTier} city · joined{' '}
            {new Date(customer.joinedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* ------------------------------------------------- headline KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KPI label="Lifetime spend" value={inr(row.monetary)} />
        <KPI label="Orders" value={row.frequency} />
        <KPI label="AOV" value={inr(row.aov)} />
        <KPI label="Predicted CLV" value={inr(clv.totalValue)} tone="primary" />
      </div>

      {/* ------------------------------------------------- next best action */}
      <Card style={{ borderColor: 'var(--c-primary)' }}>
        <p className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'var(--c-text-muted)' }}>
          Next best action
        </p>
        <p className="text-[13.5px] font-semibold" style={{ color: 'var(--c-text)' }}>{actions[0].title}</p>
        <p className="text-[11.5px] mb-2" style={{ color: 'var(--c-text-muted)' }}>{actions[0].why}</p>
        <div className="flex gap-1.5 flex-wrap">
          <Button size="xs">{actions[0].cta}</Button>
          {actions.slice(1, 3).map((a, i) => (
            <Tooltip key={i} content={a.why}>
              <Button size="xs" variant="outline">{a.title}</Button>
            </Tooltip>
          ))}
        </div>
      </Card>

      <Tabs tabs={TABS} value={tab} onChange={setTab} size="sm" />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .15 }} className="space-y-3">

          {tab === 'overview' && (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <Card>
                  <CardHead title="RFM breakdown" subtitle="Scored against the whole customer base." />
                  {[
                    ['Recency', row.R, `${row.recencyDays} days since last order`],
                    ['Frequency', row.F, `${row.frequency} orders placed`],
                    ['Monetary', row.M, `${inr(row.monetary)} lifetime`],
                  ].map(([label, score, note]) => (
                    <div key={label} className="mb-2.5">
                      <div className="flex justify-between text-[12px] mb-1">
                        <span style={{ color: 'var(--c-text)' }}>{label}</span>
                        <span className="font-semibold tabular-nums" style={{ color: 'var(--c-primary)' }}>{score}/5</span>
                      </div>
                      <Progress value={score} max={5} height={5} />
                      <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>{note}</p>
                    </div>
                  ))}
                </Card>

                <Card>
                  <CardHead title="Churn outlook" subtitle="Based on their own ordering cadence." />
                  <div className="mb-3">
                    <div className="flex justify-between text-[12px] mb-1">
                      <span style={{ color: 'var(--c-text)' }}>Churn probability</span>
                      <span className="font-semibold tabular-nums"
                        style={{ color: clv.risk === 'high' ? 'var(--c-danger)' : clv.risk === 'medium' ? 'var(--c-warning)' : 'var(--c-success)' }}>
                        {clv.churnProbability}%
                      </span>
                    </div>
                    <Progress value={clv.churnProbability} height={6}
                      tone={clv.risk === 'high' ? 'danger' : clv.risk === 'medium' ? 'warning' : 'success'} />
                  </div>
                  <Row label="Usual gap between orders" value={`${clv.expectedGapDays} days`} />
                  <Row label="Silent for" value={`${row.recencyDays} days`} />
                  <Row label="Orders per month" value={clv.ordersPerMonth} />
                  <Row label="Margin per order" value={inr(clv.grossMarginPerOrder)} />
                  <Divider />
                  <Row label="Historic value" value={inr(clv.historicValue)} />
                  <Row label="Predicted future" value={inr(clv.predictedValue)} strong />
                </Card>
              </div>

              {progress.next && (
                <Card>
                  <CardHead title="Loyalty tier"
                    subtitle={`${tier?.name} · ${inr(progress.toNext)} more to reach ${progress.next.name}`} />
                  <Progress value={progress.percent} height={8} label={`${tier?.name} → ${progress.next.name}`} />
                  <p className="text-[11px] mt-2" style={{ color: 'var(--c-text-muted)' }}>
                    Earns {tier?.multiplier}× points on every order · based on {progress.basisLabel}
                  </p>
                </Card>
              )}

              <div className="grid grid-cols-3 gap-2">
                <KPI label="Returns" value={returns.length} tone={returnRate > 30 ? 'danger' : undefined} />
                <KPI label="Return rate" value={`${returnRate}%`} tone={returnRate > 30 ? 'danger' : undefined} />
                <KPI label="Support tickets" value={tickets.length} tone={tickets.length > 2 ? 'warning' : undefined} />
              </div>
            </>
          )}

          {tab === 'orders' && (
            <div className="space-y-2">
              {orders.map((o, i) => {
                const m = orderMargin(o)
                return (
                  <motion.div key={o.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * .03, .3) }}
                    className="p-2.5 rounded-lg border" style={{ borderColor: 'var(--c-border)' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-[12px]" style={{ color: 'var(--c-text)' }}>{o.id}</span>
                      <Badge tone={STATUS_TONE[o.status]} size="sm" dot>{o.status}</Badge>
                      <Badge size="sm">{o.paymentMethod}</Badge>
                      <span className="text-[11px] ml-auto" style={{ color: 'var(--c-text-muted)' }}>
                        {new Date(o.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11.5px] flex-1 truncate" style={{ color: 'var(--c-text-muted)' }}>
                        {o.items.map(i => i.name).join(', ')}
                      </span>
                      <span className="tabular-nums font-semibold text-[12.5px]" style={{ color: 'var(--c-text)' }}>
                        {inr(o.total)}
                      </span>
                      <Tooltip content={`${m.marginPct}% margin`}>
                        <span className="tabular-nums text-[11px]"
                          style={{ color: m.profit > 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
                          {inr(m.profit)}
                        </span>
                      </Tooltip>
                    </div>
                  </motion.div>
                )
              })}
              {!orders.length && <Empty icon="◫" title="No orders yet" />}
            </div>
          )}

          {tab === 'returns' && (
            <div className="space-y-2">
              {returns.map(r => (
                <div key={r.id} className="p-2.5 rounded-lg border" style={{ borderColor: 'var(--c-border)' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[12px] font-semibold" style={{ color: 'var(--c-text)' }}>{r.id}</span>
                    <Badge size="sm" tone="warning">{r.status}</Badge>
                    <span className="text-[11px] ml-auto" style={{ color: 'var(--c-text-muted)' }}>
                      {new Date(r.requestedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  {r.lines.map((l, i) => (
                    <p key={i} className="text-[11.5px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
                      {l.name} — {l.comment || l.reasonCode}
                    </p>
                  ))}
                </div>
              ))}
              {!returns.length && <Empty icon="✓" title="No returns" description="This customer has never returned an order." />}
            </div>
          )}

          {tab === 'activity' && <ActivityFeed customerId={customerId} />}

          {tab === 'support' && (
            <div className="space-y-2">
              {tickets.map(t => (
                <div key={t.id} className="p-2.5 rounded-lg border" style={{ borderColor: 'var(--c-border)' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12.5px] font-medium" style={{ color: 'var(--c-text)' }}>{t.subject}</span>
                    <Badge size="sm" tone={t.status === 'Resolved' ? 'success' : t.status === 'Escalated' ? 'danger' : 'warning'}>
                      {t.status}
                    </Badge>
                    <Badge size="sm">{t.priority}</Badge>
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
                    via {t.channel} · first response {t.firstResponseMins}min
                    {t.csat && ` · CSAT ${t.csat}/5`}
                  </p>
                </div>
              ))}
              {!tickets.length && <Empty icon="☺" title="No support tickets" />}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function ActivityFeed({ customerId }) {
  const events = useMemo(() => eventsFor(customerId).slice(0, 40), [customerId])
  return (
    <div className="relative pl-5">
      <div className="absolute left-[7px] top-2 bottom-2 w-px" style={{ background: 'var(--c-border)' }} />
      {events.map((e, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(i * .025, .4) }} className="relative pb-3">
          <span className="absolute -left-5 top-1 w-3 h-3 rounded-full border-2"
            style={{ background: 'var(--c-surface)', borderColor: 'var(--c-primary)' }} />
          <p className="text-[12px]" style={{ color: 'var(--c-text)' }}>{e.label ?? e.type}</p>
          <p className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>
            {new Date(e.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </motion.div>
      ))}
      {!events.length && <Empty icon="◷" title="No recorded activity" />}
    </div>
  )
}

function KPI({ label, value, tone }) {
  const colour = { primary: 'var(--c-primary)', danger: 'var(--c-danger)', warning: 'var(--c-warning)' }[tone] || 'var(--c-text)'
  return (
    <div className="t-card p-2.5" style={{ background: 'var(--c-surface-alt)' }}>
      <p className="text-[9.5px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>{label}</p>
      <p className="text-[15px] font-bold tabular-nums" style={{ color: colour }}>{value}</p>
    </div>
  )
}

function Row({ label, value, strong }) {
  return (
    <div className="flex justify-between items-baseline gap-3 text-[12px] py-0.5">
      <span style={{ color: 'var(--c-text-muted)' }}>{label}</span>
      <span className={strong ? 'font-semibold tabular-nums' : 'tabular-nums'} style={{ color: 'var(--c-text)' }}>{value}</span>
    </div>
  )
}
