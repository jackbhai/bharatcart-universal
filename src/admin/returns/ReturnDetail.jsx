import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSlice } from '../../hooks/useStore.js'
import store from '../../core/store/index.js'
import useToast from '../../hooks/useToast.js'
import { selectReturn, selectReturnPolicy } from '../../core/store/slices/returnsSlice.js'
import { selectOrder } from '../../core/store/slices/ordersSlice.js'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Textarea, Select, Radio, Switch } from '../../ui/primitives/Input.jsx'
import { Badge, Card, Divider, Modal, Empty, Tooltip, Progress } from '../../ui/primitives/Display.jsx'
import {
  RETURN_STATUS, RETURN_TRANSITIONS, RETURN_TYPE, REASON_BY_CODE,
  calculateRefund, restockDecision,
} from '../../engines/returns/returnEngine.js'
import { inr } from '../../lib/analytics.js'
import { RMA_TONE } from './ReturnsList.jsx'

const R = RETURN_STATUS

export default function ReturnDetail({ rmaId, onClose }) {
  const returnsState = useSlice('returns')
  const ordersState = useSlice('orders')
  const { success, error } = useToast()
  const [qcOpen, setQcOpen] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)

  const state = { returns: returnsState, orders: ordersState }
  const rma = useMemo(() => selectReturn(state, rmaId), [returnsState, rmaId])
  const policy = selectReturnPolicy(state)
  if (!rma) return <Empty icon="?" title="Return not found" />

  const order = selectOrder(state, rma.orderId)
  const next = RETURN_TRANSITIONS[rma.status] || []

  const refund = useMemo(
    () => order ? calculateRefund(order, rma.lines, { type: rma.type, policy, qcOutcome: rma.qcOutcome || 'pass' }) : null,
    [order, rma, policy]
  )

  const move = (to) => {
    store.dispatch('returns/transition', { rma, to })
    const res = store.get('returns').lastAction
    res?.ok ? success(`Return moved to ${to}`) : error(res?.reason || 'Could not update')
  }

  const ageDays = Math.floor((Date.now() - rma.requestedAt) / 86400000)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-[16px] font-mono" style={{ color: 'var(--c-text)' }}>{rma.id}</h3>
            <Badge tone={RMA_TONE[rma.status]} dot>{rma.status}</Badge>
            <Badge size="sm" tone={rma.type === 'exchange' ? 'info' : 'neutral'}>{rma.type.replace('_', ' ')}</Badge>
          </div>
          <p className="text-[11.5px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
            {rma.customerName} · order <span className="font-mono">{rma.orderId}</span> · raised {ageDays}d ago
          </p>
        </div>
        {refund && (
          <div className="text-right">
            <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--c-text)' }}>
              {inr(rma.refundAmount || refund.payable)}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
              {rma.refundAmount > 0 ? 'refunded' : 'estimated refund'}
            </p>
          </div>
        )}
      </div>

      {rma.sellerAtFault && (
        <div className="p-2.5 rounded-lg text-[11.5px] flex items-start gap-2"
          style={{ background: 'color-mix(in srgb, var(--c-danger) 8%, transparent)' }}>
          <span style={{ color: 'var(--c-danger)' }}>⚠</span>
          <div>
            <p className="font-semibold" style={{ color: 'var(--c-text)' }}>Our fault — pickup is free</p>
            <p style={{ color: 'var(--c-text-muted)' }}>
              Reverse shipping charged to us, not the customer. Worth checking the SKU for a pattern.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------- stage actions */}
      <div className="flex flex-wrap gap-1.5">
        {next.map(to => (
          <Button key={to} size="xs"
            variant={to === R.REJECTED || to === R.QC_FAILED ? 'danger' : to === R.REFUNDED ? 'primary' : 'soft'}
            onClick={() => {
              if (to === R.QC_PASSED || to === R.QC_FAILED) setQcOpen(true)
              else if (to === R.REFUNDED) setRefundOpen(true)
              else move(to)
            }}>
            {to === R.QC_PASSED ? 'Run QC' : `→ ${to}`}
          </Button>
        ))}
        {!next.length && (
          <span className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
            This return is closed — no further action.
          </span>
        )}
      </div>

      {/* ------------------------------------------------------- progress */}
      <StageTrack status={rma.status} />

      {/* ---------------------------------------------------------- items */}
      <Card>
        <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--c-text-muted)' }}>
          Returned items
        </p>
        <div className="space-y-2">
          {rma.lines.map((l, i) => {
            const meta = REASON_BY_CODE[l.reasonCode]
            return (
              <div key={l.sku + i} className="flex items-start gap-3 p-2.5 rounded-lg"
                style={{ background: 'var(--c-surface-alt)' }}>
                <div className="w-8 h-10 rounded shrink-0" style={{ background: 'var(--c-border)' }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--c-text)' }}>{l.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
                    {l.size} · {l.color} · qty {l.qty}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Badge size="sm" tone={meta?.fault === 'seller' ? 'danger' : meta?.fault === 'courier' ? 'warning' : 'neutral'}>
                      {meta?.label}
                    </Badge>
                    {l.photos > 0 && <Badge size="sm" tone="info">{l.photos} photo{l.photos > 1 ? 's' : ''}</Badge>}
                    {!meta?.restockable && <Badge size="sm" tone="danger">Not restockable</Badge>}
                  </div>
                  {l.comment && (
                    <p className="text-[11.5px] mt-1.5 italic" style={{ color: 'var(--c-text-muted)' }}>
                      “{l.comment}”
                    </p>
                  )}
                </div>
                <span className="tabular-nums text-[12.5px] font-semibold shrink-0" style={{ color: 'var(--c-text)' }}>
                  {inr(l.price * l.qty)}
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* --------------------------------------------------- refund maths */}
      {refund && (
        <Card>
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--c-text-muted)' }}>
            Refund calculation
          </p>
          <Row label="Goods value (net of discount)" value={inr(refund.goodsValue)} />
          {refund.shippingRefund > 0 && <Row label="Shipping refunded (full return)" value={`+ ${inr(refund.shippingRefund)}`} />}
          {refund.codFeeRefund > 0 && <Row label="COD fee refunded" value={`+ ${inr(refund.codFeeRefund)}`} />}
          {refund.pickupFee > 0 && <Row label="Reverse pickup fee" value={`− ${inr(refund.pickupFee)}`} muted />}
          {refund.qcPenalty > 0 && <Row label={`QC penalty (${refund.qcOutcome})`} value={`− ${inr(refund.qcPenalty)}`} muted />}
          <Divider />
          <Row label="Customer receives" strong value={
            <span style={{ color: 'var(--c-success)' }}>
              {inr(refund.payable)}
              {refund.type === RETURN_TYPE.STORE_CREDIT && ' in credit'}
            </span>
          } />
          <p className="text-[10.5px] mt-1.5" style={{ color: 'var(--c-text-muted)' }}>
            Via {refund.method} · approx {refund.etaDays} working days · GST reversal {inr(refund.gstReversal)}
          </p>
          {refund.type === RETURN_TYPE.STORE_CREDIT && (
            <p className="text-[10.5px] mt-1" style={{ color: 'var(--c-success)' }}>
              Store credit includes a {policy.storeCreditBonusPct}% bonus over the cash refund of {inr(refund.refund)}.
            </p>
          )}
        </Card>
      )}

      {/* ------------------------------------------------------- logistics */}
      <Card>
        <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--c-text-muted)' }}>
          Reverse logistics
        </p>
        <Row label="Courier" value={rma.courier || '—'} />
        <Row label="Return AWB" value={rma.awb ? <span className="font-mono text-[11px]">{rma.awb}</span> : 'Not scheduled'} />
        <Row label="Pickup pincode" value={rma.pincode || '—'} />
        {rma.qcOutcome && <Row label="QC outcome" value={
          <Badge size="sm" tone={rma.qcOutcome === 'pass' ? 'success' : 'danger'}>{rma.qcOutcome}</Badge>
        } />}
        {rma.restockDestination && <Row label="Restock to" value={rma.restockDestination} />}
      </Card>

      {qcOpen && <QCModal rma={rma} onClose={() => setQcOpen(false)} />}
      {refundOpen && refund && <RefundModal rma={rma} refund={refund} onClose={() => setRefundOpen(false)} />}
    </div>
  )
}

function Row({ label, value, strong, muted }) {
  return (
    <div className="flex justify-between items-baseline gap-3 text-[12px] py-0.5">
      <span style={{ color: 'var(--c-text-muted)' }}>{label}</span>
      <span className={strong ? 'font-semibold tabular-nums' : 'tabular-nums'}
        style={{ color: muted ? 'var(--c-text-muted)' : 'var(--c-text)' }}>{value}</span>
    </div>
  )
}

const STAGES = [R.REQUESTED, R.APPROVED, R.PICKUP_SCHEDULED, R.IN_TRANSIT, R.RECEIVED, R.QC_PASSED, R.REFUNDED]

function StageTrack({ status }) {
  const dead = [R.REJECTED, R.QC_FAILED, R.CLOSED].includes(status)
  const idx = STAGES.indexOf(status)
  return (
    <div className="flex items-center gap-1">
      {STAGES.map((s, i) => {
        const done = !dead && idx >= i
        return (
          <React.Fragment key={s}>
            <Tooltip content={s}>
              <motion.span initial={false} animate={{ scale: done ? 1 : 0.85 }}
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: dead ? 'var(--c-danger)' : done ? 'var(--c-primary)' : 'var(--c-border)' }} />
            </Tooltip>
            {i < STAGES.length - 1 && (
              <div className="flex-1 h-0.5 rounded-full"
                style={{ background: !dead && idx > i ? 'var(--c-primary)' : 'var(--c-border)' }} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function QCModal({ rma, onClose }) {
  const { success } = useToast()
  const [outcome, setOutcome] = useState('pass')
  const [notes, setNotes] = useState('')
  const decision = restockDecision(rma, outcome)

  return (
    <Modal open onClose={onClose} title="Quality check" size="sm"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => {
          store.dispatch('returns/recordQC', {
            id: rma.id, outcome, notes,
            restock: decision.restock, destination: decision.destination,
          })
          success(`QC ${outcome} recorded`)
          onClose()
        }}>Record QC</Button>
      </>}>
      <div className="space-y-3">
        <div className="space-y-2">
          <Radio checked={outcome === 'pass'} onChange={() => setOutcome('pass')}
            label="Pass — as-new condition" description="Full refund, item returns to sellable stock" />
          <Radio checked={outcome === 'partial'} onChange={() => setOutcome('partial')}
            label="Partial — minor issues" description="Reduced refund, item goes to the outlet channel" />
          <Radio checked={outcome === 'fail'} onChange={() => setOutcome('fail')}
            label="Fail — used or damaged" description="No refund, item written off" />
        </div>

        <div className="p-2.5 rounded-lg text-[11.5px]" style={{ background: 'var(--c-surface-alt)' }}>
          <p className="font-semibold" style={{ color: 'var(--c-text)' }}>
            {decision.restock ? `Restock to ${decision.destination}` : 'Do not restock'}
          </p>
          <p style={{ color: 'var(--c-text-muted)' }}>{decision.note}</p>
        </div>

        <Textarea label="QC notes" rows={3} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Condition observed, tags intact, any damage…" />
      </div>
    </Modal>
  )
}

function RefundModal({ rma, refund, onClose }) {
  const { success } = useToast()
  const [amount, setAmount] = useState(refund.payable)
  const [method, setMethod] = useState(refund.method)

  return (
    <Modal open onClose={onClose} title="Issue refund" size="sm"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => {
          store.dispatch('returns/recordRefund', { id: rma.id, amount: Number(amount), method })
          success(`${inr(Number(amount))} refunded`)
          onClose()
        }}>Refund {inr(Number(amount))}</Button>
      </>}>
      <div className="space-y-3">
        <Input label="Refund amount" type="number" prefix="₹" value={amount}
          onChange={e => setAmount(e.target.value)}
          hint={Number(amount) !== refund.payable ? `Engine calculated ${inr(refund.payable)}` : 'Matches the calculated amount'} />
        <Select label="Refund to" value={method} onChange={e => setMethod(e.target.value)}
          options={[refund.method, 'Store credit', 'Bank transfer (NEFT)', 'Original payment method']} />
        <div className="p-2.5 rounded-lg text-[11.5px]" style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}>
          The customer is told to expect it in about {refund.etaDays} working days.
          GST of {inr(refund.gstReversal)} will be reversed in this period's filing.
        </div>
      </div>
    </Modal>
  )
}
