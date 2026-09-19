import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSlice } from '../../hooks/useStore.js'
import store from '../../core/store/index.js'
import useToast from '../../hooks/useToast.js'
import { selectOrder, selectNotes, selectTags } from '../../core/store/slices/ordersSlice.js'
import { selectReturnsByOrder } from '../../core/store/slices/returnsSlice.js'
import { CUSTOMERS } from '../../data/seed.js'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Textarea, Select } from '../../ui/primitives/Input.jsx'
import { Badge, Card, Tabs, Divider, Avatar, Tooltip, Modal, Empty, Progress } from '../../ui/primitives/Display.jsx'
import {
  ORDER_STATUS, allowedTransitions, canTransition, orderMargin, riskScore,
} from '../../engines/orders/orderEngine.js'
import { taxInvoice } from '../../engines/tax/gst.js'
import { checkEligibility } from '../../engines/returns/returnEngine.js'
import { DEFAULT_COURIERS } from '../../engines/shipping/shippingEngine.js'
import { inr } from '../../lib/analytics.js'
import { STATUS_TONE } from './OrdersList.jsx'

const CUST_BY_ID = new Map(CUSTOMERS.map(c => [c.id, c]))

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'items', label: 'Items' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'payment', label: 'Payment & tax' },
  { id: 'notes', label: 'Notes' },
]

export default function OrderDetail({ orderId, onClose }) {
  const ordersState = useSlice('orders')
  const returnsState = useSlice('returns')
  const { success, error } = useToast()
  const [tab, setTab] = useState('summary')
  const [confirm, setConfirm] = useState(null)

  const state = { orders: ordersState, returns: returnsState }
  const order = useMemo(() => selectOrder(state, orderId), [ordersState, orderId])
  if (!order) return <Empty icon="?" title="Order not found" />

  const customer = CUST_BY_ID.get(order.customerId)
  const margin = orderMargin(order)
  const risk = riskScore(order, customer || {})
  const notes = selectNotes(state, orderId)
  const tags = selectTags(state, orderId)
  const returns = selectReturnsByOrder(state, orderId)
  const moves = allowedTransitions(order, 'admin')

  const run = (to, patch = {}) => {
    store.dispatch('orders/transition', { order, to, role: 'admin', patch, by: 'admin' })
    const res = store.get('orders').lastAction
    res?.ok ? success(`Order moved to ${to}`) : error(res?.reason || 'Could not update order')
    setConfirm(null)
  }

  return (
    <div className="space-y-4">
      {/* -------------------------------------------------------- header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-[16px] font-mono" style={{ color: 'var(--c-text)' }}>{order.id}</h3>
            <Badge tone={STATUS_TONE[order.status]} dot>{order.status}</Badge>
            {risk.band !== 'low' && (
              <Tooltip content={risk.flags.join(' · ')}>
                <Badge tone={risk.band === 'high' ? 'danger' : 'warning'} size="sm">Risk {risk.score}</Badge>
              </Tooltip>
            )}
          </div>
          <p className="text-[11.5px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
            Placed {new Date(order.placedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            {' · '}{order.channel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--c-text)' }}>{inr(order.total)}</p>
          <p className="text-[11px] tabular-nums"
            style={{ color: margin.profit > 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
            {inr(margin.profit)} profit · {margin.marginPct}%
          </p>
        </div>
      </div>

      {/* risk banner — the thing ops needs to see before shipping */}
      {risk.band !== 'low' && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="p-2.5 rounded-lg text-[11.5px] flex items-start gap-2"
          style={{ background: 'color-mix(in srgb, var(--c-danger) 8%, transparent)' }}>
          <span style={{ color: 'var(--c-danger)' }}>⚠</span>
          <div>
            <p className="font-semibold" style={{ color: 'var(--c-text)' }}>{risk.action}</p>
            <p style={{ color: 'var(--c-text-muted)' }}>{risk.flags.join(' · ')}</p>
          </div>
        </motion.div>
      )}

      {/* ------------------------------------------------------- actions */}
      {moves.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {moves.map(m => {
            const verdict = canTransition(order, m.to, { role: 'admin' })
            return (
              <Tooltip key={m.to} content={verdict.ok ? m.label : verdict.reason}>
                <Button size="xs" disabled={!verdict.ok && !verdict.missing}
                  variant={m.to === 'Cancelled' ? 'danger' : m.money === 'refund' ? 'outline' : 'soft'}
                  onClick={() => (m.requires?.length || m.money === 'refund')
                    ? setConfirm(m)
                    : run(m.to)}>
                  {m.label}
                </Button>
              </Tooltip>
            )
          })}
        </div>
      )}

      <Tabs tabs={TABS} value={tab} onChange={setTab} size="sm" />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .15 }} className="space-y-3">

          {tab === 'summary' && (
            <>
              <Card padding>
                <div className="flex items-center gap-3">
                  <Avatar name={customer?.name ?? '?'} size={40} ring />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[13.5px]" style={{ color: 'var(--c-text)' }}>{customer?.name}</p>
                    <p className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
                      {customer?.phone} · {customer?.email}
                    </p>
                    <div className="flex gap-1.5 mt-1">
                      <Badge size="sm">{customer?.orders ?? 0} orders</Badge>
                      <Badge size="sm" tone="primary">{inr(customer?.spend ?? 0)} lifetime</Badge>
                      {customer?.cityTier && <Badge size="sm">Tier {customer.cityTier}</Badge>}
                    </div>
                  </div>
                </div>
              </Card>

              <div className="grid sm:grid-cols-2 gap-3">
                <Card>
                  <p className="text-[10px] uppercase tracking-wider font-semibold mb-1.5"
                    style={{ color: 'var(--c-text-muted)' }}>Shipping address</p>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--c-text)' }}>
                    {order.address?.line1}<br />
                    {order.address?.city}, {order.address?.state}<br />
                    <span className="font-mono">{order.address?.pincode}</span>
                  </p>
                </Card>
                <Card>
                  <p className="text-[10px] uppercase tracking-wider font-semibold mb-1.5"
                    style={{ color: 'var(--c-text-muted)' }}>Fulfilment</p>
                  <Row label="Courier" value={order.courier} />
                  <Row label="AWB" value={order.awb ? <span className="font-mono text-[11px]">{order.awb}</span> : '—'} />
                  <Row label="Promised" value={`${order.deliveryDays} days`} />
                  {order.giftWrap && <Row label="Gift wrap" value="Yes" />}
                  {order.occasion && <Row label="Occasion" value={order.occasion} />}
                </Card>
              </div>

              {/* margin waterfall */}
              <Card>
                <p className="text-[10px] uppercase tracking-wider font-semibold mb-2"
                  style={{ color: 'var(--c-text-muted)' }}>Unit economics</p>
                <div className="space-y-1.5">
                  <Row label="Revenue (ex-GST)" value={inr(margin.netRevenue)} strong />
                  <Row label="COGS" value={`− ${inr(margin.cogs)}`} muted />
                  <Row label="Payment fee" value={`− ${inr(margin.paymentFee)}`} muted />
                  <Row label="Shipping" value={`− ${inr(margin.shippingCost)}`} muted />
                  <Row label="Packaging" value={`− ${inr(margin.packaging)}`} muted />
                  {margin.reverseLogistics > 0 &&
                    <Row label="Reverse logistics" value={`− ${inr(margin.reverseLogistics)}`} muted />}
                  <Divider />
                  <Row label="Net profit" strong
                    value={<span style={{ color: margin.profit > 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
                      {inr(margin.profit)} ({margin.marginPct}%)
                    </span>} />
                </div>
              </Card>

              {returns.length > 0 && (
                <Card>
                  <p className="text-[10px] uppercase tracking-wider font-semibold mb-2"
                    style={{ color: 'var(--c-text-muted)' }}>Returns against this order</p>
                  {returns.map(r => (
                    <div key={r.id} className="flex items-center gap-2 text-[12px] py-1">
                      <span className="font-mono" style={{ color: 'var(--c-text)' }}>{r.id}</span>
                      <Badge size="sm" tone="warning">{r.status}</Badge>
                      <span className="flex-1" style={{ color: 'var(--c-text-muted)' }}>
                        {r.lines.length} item{r.lines.length > 1 ? 's' : ''}
                      </span>
                      <span className="tabular-nums" style={{ color: 'var(--c-text)' }}>{inr(r.refundAmount)}</span>
                    </div>
                  ))}
                </Card>
              )}
            </>
          )}

          {tab === 'items' && (
            <div className="space-y-2">
              {order.items.map((it, i) => {
                const elig = checkEligibility(order, it, { now: Date.now() })
                return (
                  <motion.div key={it.sku + i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * .04 }}
                    className="flex items-center gap-3 p-2.5 rounded-lg border" style={{ borderColor: 'var(--c-border)' }}>
                    <div className="w-9 h-11 rounded shrink-0"
                      style={{ background: `linear-gradient(135deg, var(--c-surface-alt), ${it.hex || '#ccc'}55)` }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--c-text)' }}>{it.name}</p>
                      <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
                        {it.size} · {it.color} · {it.category}
                      </p>
                      <p className="text-[10px] font-mono opacity-50" style={{ color: 'var(--c-text)' }}>{it.sku}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[12.5px] tabular-nums font-semibold" style={{ color: 'var(--c-text)' }}>
                        {inr(it.price * it.qty)}
                      </p>
                      <p className="text-[10.5px] tabular-nums" style={{ color: 'var(--c-text-muted)' }}>
                        {it.qty} × {inr(it.price)}
                      </p>
                      <Badge size="sm" tone={elig.eligible ? 'success' : 'neutral'}>
                        {elig.eligible ? `${elig.daysLeft}d to return` : 'Not returnable'}
                      </Badge>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}

          {tab === 'timeline' && (
            <div className="relative pl-5">
              <div className="absolute left-[7px] top-2 bottom-2 w-px" style={{ background: 'var(--c-border)' }} />
              {order.timeline.map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * .05 }} className="relative pb-4">
                  <span className="absolute -left-5 top-1 w-3.5 h-3.5 rounded-full border-2"
                    style={{
                      background: i === order.timeline.length - 1 ? 'var(--c-primary)' : 'var(--c-surface)',
                      borderColor: 'var(--c-primary)',
                    }} />
                  <p className="text-[12.5px] font-semibold" style={{ color: 'var(--c-text)' }}>{t.to}</p>
                  <p className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>{t.note}</p>
                  <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                    {new Date(t.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    {t.by && ` · ${t.by}`}
                  </p>
                </motion.div>
              ))}
            </div>
          )}

          {tab === 'payment' && <PaymentTab order={order} />}

          {tab === 'notes' && <NotesTab orderId={orderId} notes={notes} tags={tags} />}
        </motion.div>
      </AnimatePresence>

      {confirm && (
        <TransitionModal order={order} move={confirm} onClose={() => setConfirm(null)} onRun={run} />
      )}
    </div>
  )
}

/* -------------------------------------------------------------- pieces */

function Row({ label, value, strong, muted }) {
  return (
    <div className="flex justify-between items-baseline gap-3 text-[12px] py-0.5">
      <span style={{ color: 'var(--c-text-muted)' }}>{label}</span>
      <span className={strong ? 'font-semibold tabular-nums' : 'tabular-nums'}
        style={{ color: muted ? 'var(--c-text-muted)' : 'var(--c-text)' }}>{value}</span>
    </div>
  )
}

function PaymentTab({ order }) {
  const invoice = useMemo(() => {
    const lines = order.items.map(it => ({
      amount: it.price * it.qty, rate: it.gst, qty: it.qty, hsn: it.hsn, name: it.name,
    }))
    return taxInvoice(lines, {
      sellerState: 'Haryana',
      buyerState: order.address?.state || 'Delhi',
      inclusive: true,
      shipping: order.shipping,
    })
  }, [order])

  return (
    <div className="space-y-3">
      <Card>
        <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--c-text-muted)' }}>
          Payment
        </p>
        <Row label="Method" value={order.paymentMethod} />
        {order.upiApp && <Row label="UPI app" value={order.upiApp} />}
        {order.paymentGateway && order.paymentGateway !== 'cod' && (
          <Row label="Gateway" value={order.paymentGateway === 'razorpay' ? 'Razorpay' : order.paymentGateway === 'stripe' ? 'Stripe' : order.paymentGateway} />
        )}
        <Row label="Status" value={
          <Badge size="sm" tone={order.paid ? 'success' : 'warning'}>{order.paid ? 'Paid' : 'Pending'}</Badge>
        } />
        {/* Real gateway payment id — only ever rendered when the backend
            verified the payment. COD has no transaction id by design. */}
        {order.paymentRef && (
          <Row label="Payment ID" value={<span className="font-mono text-[11.5px]">{order.paymentRef}</span>} />
        )}
        {order.paymentMode && order.paymentMode !== 'cod' && (
          <Row label="Mode" value={
            <Badge size="sm" tone={order.paymentMode === 'live' ? 'success' : 'warning'}>
              {order.paymentMode === 'live' ? 'Live' : 'Test'}
            </Badge>
          } />
        )}
        {!order.paid && order.paymentGateway === 'cod' && (
          <Row label="Collection" value="Collect on delivery" />
        )}
        {order.couponCode && <Row label="Coupon" value={<span className="font-mono">{order.couponCode}</span>} />}
      </Card>

      <Card>
        <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--c-text-muted)' }}>
          Tax invoice
        </p>
        <Row label="Subtotal" value={inr(order.subtotal)} />
        {order.discount > 0 && <Row label="Discount" value={`− ${inr(order.discount)}`} />}
        <Divider />
        {order.igst > 0
          ? <Row label={`IGST`} value={inr(order.igst)} />
          : <>
              <Row label="CGST" value={inr(order.cgst)} />
              <Row label="SGST" value={inr(order.sgst)} />
            </>}
        <Row label="Shipping" value={order.shipping ? inr(order.shipping) : 'Free'} />
        {order.codFee > 0 && <Row label="COD fee" value={inr(order.codFee)} />}
        <Divider />
        <Row label="Total" value={inr(order.total)} strong />
        <p className="text-[10.5px] mt-2" style={{ color: 'var(--c-text-muted)' }}>
          {order.igst > 0 ? 'Inter-state supply — IGST applies' : 'Intra-state supply — CGST + SGST apply'}
        </p>
      </Card>

      <Button size="sm" variant="outline" full>Download GST invoice (PDF)</Button>
    </div>
  )
}

function NotesTab({ orderId, notes, tags }) {
  const [text, setText] = useState('')
  const { success } = useToast()
  const TAG_OPTIONS = ['Fragile', 'Priority', 'Gift', 'Call before dispatch', 'Fraud check', 'VIP', 'Reship']

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'var(--c-text-muted)' }}>
          Tags
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TAG_OPTIONS.map(t => (
            <button key={t} onClick={() => store.dispatch('orders/toggleTag', { orderId, tag: t })}
              className="px-2 py-1 text-[11px] rounded-lg border transition-all"
              style={tags.includes(t)
                ? { background: 'var(--c-primary)', color: 'var(--c-primary-fg)', borderColor: 'var(--c-primary)' }
                : { color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <Divider />

      <div className="space-y-2">
        <Textarea rows={2} value={text} onChange={e => setText(e.target.value)}
          placeholder="Add an internal note — visible to staff only" />
        <Button size="sm" disabled={!text.trim()}
          onClick={() => { store.dispatch('orders/addNote', { orderId, text }); setText(''); success('Note added') }}>
          Add note
        </Button>
      </div>

      <div className="space-y-2">
        {notes.map(n => (
          <motion.div key={n.id} layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="p-2.5 rounded-lg" style={{ background: 'var(--c-surface-alt)' }}>
            <p className="text-[12px]" style={{ color: 'var(--c-text)' }}>{n.text}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>
                {n.by} · {new Date(n.at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
              <button onClick={() => store.dispatch('orders/removeNote', { orderId, noteId: n.id })}
                className="text-[10.5px] ml-auto hover:underline" style={{ color: 'var(--c-danger)' }}>Delete</button>
            </div>
          </motion.div>
        ))}
        {!notes.length && <p className="text-[12px] text-center py-3" style={{ color: 'var(--c-text-muted)' }}>
          No internal notes yet.
        </p>}
      </div>
    </div>
  )
}

/** Confirmation dialog that also collects whatever the transition requires. */
function TransitionModal({ order, move, onClose, onRun }) {
  const [patch, setPatch] = useState({
    courier: order.courier || DEFAULT_COURIERS[0]?.name,
    awb: order.awb || '',
  })
  const needsAwb = (move.requires || []).includes('awb')
  const verdict = canTransition(order, move.to, { role: 'admin', patch })

  return (
    <Modal open onClose={onClose} title={move.label} size="sm"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant={move.money === 'refund' ? 'danger' : 'primary'}
          disabled={!verdict.ok}
          onClick={() => onRun(move.to, needsAwb ? patch : {})}>
          {verdict.ok ? 'Confirm' : verdict.reason}
        </Button>
      </>}>
      <div className="space-y-3">
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          Move <span className="font-mono" style={{ color: 'var(--c-text)' }}>{order.id}</span> from{' '}
          <strong style={{ color: 'var(--c-text)' }}>{order.status}</strong> to{' '}
          <strong style={{ color: 'var(--c-text)' }}>{move.to}</strong>.
        </p>

        {move.money && (
          <div className="p-2.5 rounded-lg text-[11.5px]"
            style={{ background: 'color-mix(in srgb, var(--c-warning) 12%, transparent)', color: 'var(--c-text)' }}>
            This will <strong>{move.money}</strong> {inr(order.total)}
            {move.money === 'refund' && ` back via ${order.paymentMethod}`}.
          </div>
        )}
        {move.stock && (
          <div className="p-2.5 rounded-lg text-[11.5px]"
            style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}>
            Stock effect: <strong style={{ color: 'var(--c-text)' }}>{move.stock}</strong>
          </div>
        )}

        {needsAwb && (
          <>
            <Select label="Courier" value={patch.courier}
              onChange={e => setPatch(p => ({ ...p, courier: e.target.value }))}
              options={DEFAULT_COURIERS.map(c => c.name)} />
            <Input label="AWB / tracking number" value={patch.awb} required
              onChange={e => setPatch(p => ({ ...p, awb: e.target.value }))}
              placeholder="e.g. AWB123456789"
              error={!patch.awb ? 'Required to hand over to the courier' : undefined} />
          </>
        )}
      </div>
    </Modal>
  )
}
