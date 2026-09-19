import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useSlice } from '../../hooks/useStore.js'
import { selectReturns } from '../../core/store/slices/returnsSlice.js'
import { selectOrders } from '../../core/store/slices/ordersSlice.js'
import { selectProducts } from '../../core/store/slices/catalogueSlice.js'
import { Card, CardHead, Badge, Progress, Empty, Tooltip } from '../../ui/primitives/Display.jsx'
import { returnAnalytics, problemProducts } from '../../engines/returns/returnEngine.js'
import { inr } from '../../lib/analytics.js'

export default function ReturnsAnalytics() {
  const returnsState = useSlice('returns')
  const ordersState = useSlice('orders')
  const catalogueState = useSlice('catalogue')

  const state = { returns: returnsState, orders: ordersState, catalogue: catalogueState }
  const returns = useMemo(() => selectReturns(state), [returnsState])
  const orders = useMemo(() => selectOrders(state), [ordersState])
  const products = useMemo(() => selectProducts(state), [catalogueState])

  const a = useMemo(() => returnAnalytics(orders, returns), [orders, returns])
  const problems = useMemo(() => problemProducts(a, products, { minReturns: 2, threshold: 10 }), [a, products])

  const maxReason = Math.max(1, ...a.byReason.map(r => r.count))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Stat label="Return rate" value={`${a.returnRatePct}%`} tone={a.returnRatePct > 20 ? 'danger' : 'warning'} />
        <Stat label="Refunds paid" value={inr(a.refundTotal)} />
        <Stat label="Avg refund" value={inr(a.avgRefund)} />
        <Stat label="Preventable" value={`${a.sellerFaultPct}%`} tone="danger" />
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <CardHead title="Why customers return"
            subtitle="Fault attribution decides who pays reverse shipping — and what to fix." />
          <div className="space-y-2.5">
            {a.byReason.map((r, i) => (
              <motion.div key={r.code} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * .05 }}>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--c-text)' }}>
                    {r.label}
                    <Badge size="sm" tone={r.fault === 'seller' ? 'danger' : r.fault === 'courier' ? 'warning' : 'neutral'}>
                      {r.fault}
                    </Badge>
                  </span>
                  <span className="tabular-nums" style={{ color: 'var(--c-text-muted)' }}>
                    {r.count} · {inr(r.value)}
                  </span>
                </div>
                <Progress value={r.count} max={maxReason} height={5}
                  tone={r.fault === 'seller' ? 'danger' : r.fault === 'courier' ? 'warning' : 'primary'} />
              </motion.div>
            ))}
            {!a.byReason.length && <Empty icon="✓" title="No returns yet" />}
          </div>
        </Card>

        <Card>
          <CardHead title="Returns by category" subtitle="Where the leakage concentrates." />
          <div className="space-y-2.5">
            {a.byCategory.slice(0, 8).map(c => (
              <div key={c.category}>
                <div className="flex justify-between text-[12px] mb-1">
                  <span style={{ color: 'var(--c-text)' }}>{c.category}</span>
                  <span className="tabular-nums" style={{ color: 'var(--c-text-muted)' }}>
                    {c.count} units · {inr(c.value)}
                  </span>
                </div>
                <Progress value={c.value} max={a.byCategory[0].value} height={5} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Products to fix"
          subtitle="Highest return rates with a concrete suggested action for each." />
        {problems.length ? (
          <div className="space-y-2">
            {problems.slice(0, 12).map((p, i) => (
              <motion.div key={p.productId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * .04 }}
                className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: 'var(--c-surface-alt)' }}>
                <Badge tone={p.severity === 'critical' ? 'danger' : p.severity === 'high' ? 'warning' : 'neutral'}
                  size="sm">{p.returnRatePct}%</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--c-text)' }}>{p.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
                    {p.count} returned of {p.soldUnits} sold · mostly “{p.topReason}”
                  </p>
                  <p className="text-[11.5px] mt-1" style={{ color: 'var(--c-primary)' }}>→ {p.suggestion}</p>
                </div>
                <span className="tabular-nums text-[12px] shrink-0" style={{ color: 'var(--c-danger)' }}>
                  −{inr(p.value)}
                </span>
              </motion.div>
            ))}
          </div>
        ) : <Empty icon="✓" title="No problem SKUs" description="No product is returning above the threshold." />}
      </Card>

      {a.preventable.length > 0 && (
        <Card>
          <CardHead title="Preventable losses"
            subtitle="These are our mistakes — every one is avoidable margin." />
          <div className="flex flex-wrap gap-2">
            {a.preventable.map(r => (
              <div key={r.code} className="px-3 py-2 rounded-lg border" style={{ borderColor: 'var(--c-border)' }}>
                <p className="text-[12px] font-medium" style={{ color: 'var(--c-text)' }}>{r.label}</p>
                <p className="text-[15px] font-bold tabular-nums" style={{ color: 'var(--c-danger)' }}>{inr(r.value)}</p>
                <p className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>{r.count} units</p>
              </div>
            ))}
          </div>
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
