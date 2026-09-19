import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useShop } from './shopState.jsx'
import { buildSchedule, frequencyLabel } from './verticalEngines.js'
import { useSlice } from '../hooks/useStore.js'
import store from '../core/store/index.js'
import useToast from '../hooks/useToast.js'
import EmptyState from '../ui/EmptyState.jsx'
import Button from '../ui/primitives/Button.jsx'
import { Input, Select, Textarea } from '../ui/primitives/Input.jsx'
import { Badge, Card, CardHead, Tabs, Divider, Progress, Avatar, Modal } from '../ui/primitives/Display.jsx'
import { selectReturns } from '../core/store/slices/returnsSlice.js'
import { checkEligibility, REASON_BY_CODE, calculateRefund } from '../engines/returns/returnEngine.js'
import { buildTimeline, ORDER_STATUS } from '../engines/orders/orderEngine.js'
import { inr } from '../lib/analytics.js'

const TABS = [
  { id: 'orders', label: 'My orders', icon: '▤' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '🔁' },
  { id: 'rewards', label: 'Rewards', icon: '★' },
  { id: 'wishlist', label: 'Wishlist', icon: '♡' },
  { id: 'returns', label: 'Returns', icon: '↩' },
]

export default function Account({ onOpenProduct, onBrowse, onLogin, tab: tabProp, onTab }) {
  const [tabState, setTabState] = useState('orders')
  // URL-driven tabs when the router supplies them (/account/orders, …);
  // otherwise the component owns its tab state exactly as before.
  const tab = tabProp ?? tabState
  const setTab = onTab ?? setTabState
  const shop = useShop()
  const guest = shop.me?.id === 'guest'

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl glass p-4 anim-fade-up">
        <span aria-hidden="true" className="orb orb-a" style={{ width: 170, height: 170, right: '-50px', top: '-70px', opacity: .5 }} />
        <span aria-hidden="true" className="orb orb-b" style={{ width: 130, height: 130, left: '-40px', bottom: '-60px', opacity: .4 }} />
        <div className="relative flex items-center gap-3">
          <Avatar name={shop.me.name} size={52} ring />
          <div className="min-w-0">
            <p className="eyebrow mb-0.5">My account</p>
            <h2 className="text-lg font-bold leading-tight truncate" style={{ color: 'var(--c-text)' }}>{shop.me.name}</h2>
            <p className="text-[12px] truncate" style={{ color: 'var(--c-text-muted)' }}>
              {shop.me.email} · {shop.myOrders.length} orders
              {shop.flags.loyalty && shop.tier && <> · <span style={{ color: shop.tier.colour }}>{shop.tier.name}</span></>}
            </p>
          </div>
          {guest && onLogin && (
            <button onClick={onLogin}
              className="relative shrink-0 px-4 py-2 rounded-xl text-[12.5px] font-bold pressable sheen"
              style={{ background: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}>
              Sign in
            </button>
          )}
        </div>
      </div>

      <Tabs tabs={TABS.filter(t => t.id !== 'rewards' || shop.flags.loyalty)} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'orders' && <MyOrders onBrowse={onBrowse} />}
          {tab === 'subscriptions' && <Subscriptions />}
          {tab === 'rewards' && <Rewards />}
          {tab === 'wishlist' && <Wishlist onOpenProduct={onOpenProduct} />}
          {tab === 'returns' && <MyReturns />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------ orders */

const STATUS_TONE = {
  'Delivered': 'success', 'In Transit': 'info', 'Out for Delivery': 'info',
  'Confirmed': 'primary', 'Packed': 'primary', 'Pending Payment': 'warning',
  'Cancelled': 'danger', 'RTO': 'danger', 'Returned': 'warning', 'On Hold': 'warning',
}

function MyOrders({ onBrowse }) {
  const shop = useShop()
  const [open, setOpen] = useState(null)
  const [returning, setReturning] = useState(null)

  if (!shop.myOrders.length) {
    return (
      <EmptyState icon="▤" title="No orders yet"
        message="Your orders will appear here."
        actionLabel="Start shopping" onAction={onBrowse} />
    )
  }

  return (
    <div className="space-y-2">
      {shop.myOrders.map((o, i) => (
        <motion.div key={o.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * .04, .3) }}>
          <Card hover className="cursor-pointer glow-hover" onClick={() => setOpen(open === o.id ? null : o.id)}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[13px]" style={{ color: 'var(--c-text)' }}>{o.id}</span>
                  <Badge size="sm" tone={STATUS_TONE[o.status] ?? 'neutral'} dot>{o.status}</Badge>
                </div>
                <p className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
                  {new Date(o.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' · '}{o.items.length} item{o.items.length > 1 ? 's' : ''}
                  {' · '}{o.paymentMethod}
                </p>
              </div>
              <span className="font-semibold tabular-nums text-[14px]" style={{ color: 'var(--c-text)' }}>
                {inr(o.total)}
              </span>
            </div>

            <AnimatePresence>
              {open === o.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <Divider />
                  <OrderDetail order={o} onReturn={(item) => setReturning({ order: o, item })} />
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      ))}

      {returning && <ReturnModal {...returning} onClose={() => setReturning(null)} />}
    </div>
  )
}

function OrderDetail({ order, onReturn }) {
  const shop = useShop()
  const returnsState = useSlice('returns')
  const policy = returnsState.policy
  const timeline = useMemo(() => buildTimeline(order), [order])
  const existing = useMemo(
    () => selectReturns({ returns: returnsState }).filter(r => r.orderId === order.id),
    [returnsState, order.id]
  )

  return (
    <div className="space-y-3 pt-1">
      {/* tracking */}
      <div className="flex items-center gap-1">
        {['Confirmed', 'Packed', 'In Transit', 'Delivered'].map((s, i, arr) => {
          const reached = timeline.some(t => t.to === s) || order.status === s
          const isCurrent = order.status === s
          return (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center gap-1">
                <span className="w-5 h-5 rounded-full grid place-items-center text-[9px] font-bold"
                  style={reached
                    ? { background: isCurrent ? 'var(--c-primary)' : 'var(--c-success)', color: '#fff' }
                    : { background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}>
                  {reached ? '✓' : i + 1}
                </span>
                <span className="text-[9px] whitespace-nowrap"
                  style={{ color: reached ? 'var(--c-text)' : 'var(--c-text-muted)' }}>{s}</span>
              </div>
              {i < arr.length - 1 && (
                <div className="flex-1 h-px mb-4" style={{ background: reached ? 'var(--c-success)' : 'var(--c-border)' }} />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {order.awb && (
        <p className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
          {order.courier} · AWB <span className="font-mono">{order.awb}</span>
        </p>
      )}

      {/* items with live return eligibility */}
      <div className="space-y-1.5">
        {order.items.map((it, i) => {
          const already = existing.some(r => r.lines?.some(l => l.sku === it.sku))
          const elig = checkEligibility(order, it, { policy })
          return (
            <div key={i} className="flex items-center gap-2 text-[12px] p-2 rounded-lg"
              style={{ background: 'var(--c-surface-alt)' }}>
              <div className="min-w-0 flex-1">
                <p className="truncate" style={{ color: 'var(--c-text)' }}>{it.name}</p>
                <p className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>
                  {[it.size, it.color].filter(Boolean).join(' · ')} · Qty {it.qty}
                </p>
              </div>
              <span className="tabular-nums" style={{ color: 'var(--c-text)' }}>{inr(it.price * it.qty)}</span>
              {already ? (
                <Badge size="sm" tone="warning">Return raised</Badge>
              ) : elig.eligible ? (
                <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); onReturn(it) }}>
                  Return
                </Button>
              ) : (
                <span className="text-[10px] text-right max-w-[110px]" style={{ color: 'var(--c-text-muted)' }}>
                  {elig.reason}
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-x-4 text-[11.5px]">
        <Row label="Subtotal" value={inr(order.subtotal)} />
        {order.discount > 0 && <Row label="Discount" value={`− ${inr(order.discount)}`} />}
        <Row label="GST" value={inr(order.gst)} />
        <Row label="Shipping" value={order.shipping ? inr(order.shipping) : 'Free'} />
        <Row label="Total" value={inr(order.total)} strong />
        <Row label="Ships to" value={`${order.address.city} ${order.address.pincode}`} />
      </div>
    </div>
  )
}

function ReturnModal({ order, item, onClose }) {
  const shop = useShop()
  const { success } = useToast()
  const returnsState = useSlice('returns')
  const policy = returnsState.policy
  const [reasonCode, setReasonCode] = useState('size_issue')
  const [comment, setComment] = useState('')
  const [type, setType] = useState('refund')

  const reason = REASON_BY_CODE[reasonCode]
  const refund = useMemo(
    () => calculateRefund(order, [{ sku: item.sku, qty: item.qty, reasonCode }], { type, policy }),
    [order, item, reasonCode, type, policy]
  )

  return (
    <Modal open onClose={onClose} title="Request a return" size="md"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => {
          store.dispatch('returns/create', {
            orderId: order.id,
            customerId: order.customerId,
            customerName: order.customerName ?? shop.me.name,
            lines: [{ sku: item.sku, productId: item.productId, name: item.name, qty: item.qty,
                      price: item.price, reasonCode, comment }],
            type,
            expectedRefund: refund.payable,
          })
          success('Return requested — we will arrange a pickup')
          onClose()
        }}>Request return</Button>
      </>}>
      <div className="space-y-3">
        <div className="flex gap-2 p-2 rounded-lg" style={{ background: 'var(--c-surface-alt)' }}>
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium" style={{ color: 'var(--c-text)' }}>{item.name}</p>
            <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
              {order.id} · {inr(item.price * item.qty)}
            </p>
          </div>
        </div>

        <Select label="Reason" value={reasonCode} onChange={e => setReasonCode(e.target.value)}
          options={Object.values(REASON_BY_CODE).map(r => ({ value: r.code, label: r.label }))}
          hint={reason?.fault === 'seller' ? 'Our fault — pickup is free' : `Return window: ${reason?.windowDays} days`} />

        <Textarea label="Tell us more" rows={2} value={comment} onChange={e => setComment(e.target.value)}
          placeholder="Optional — helps us fix the problem" />

        {reason?.requiresPhoto && (
          <div className="p-2.5 rounded-lg text-[11.5px]"
            style={{ background: 'color-mix(in srgb, var(--c-warning) 10%, transparent)', color: 'var(--c-warning)' }}>
            A photo is required for this reason. Our team will request it on WhatsApp.
          </div>
        )}

        <Select label="I would like" value={type} onChange={e => setType(e.target.value)}
          options={[
            { value: 'refund', label: 'A refund' },
            { value: 'store_credit', label: `Store credit (+${policy.storeCreditBonusPct}% bonus)` },
            ...(policy.exchangeAllowed ? [{ value: 'exchange', label: 'An exchange' }] : []),
          ]} />

        <Divider label="What you get back" />
        <Row label="Item value" value={inr(refund.goodsValue)} />
        {refund.shippingRefund > 0 && <Row label="Shipping refund" value={inr(refund.shippingRefund)} />}
        {refund.pickupFee > 0 && <Row label="Pickup fee" value={`− ${inr(refund.pickupFee)}`} />}
        <Row label={type === 'store_credit' ? 'Store credit' : 'Refund'} value={inr(refund.payable)} strong />
        <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
          {refund.method} · usually within {refund.etaDays} days of pickup
        </p>
      </div>
    </Modal>
  )
}

/* ----------------------------------------------------------- rewards */

function Rewards() {
  const shop = useShop()
  const cfg = shop.loyaltyConfig
  const tiers = [...cfg.tiers].sort((a, b) => a.threshold - b.threshold)

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl glass-tint p-4">
        <span aria-hidden="true" className="orb orb-b" style={{ width: 150, height: 150, right: '-40px', top: '-60px', opacity: .55 }} />
        <div className="relative flex items-baseline gap-2">
          <span className="text-3xl font-bold" style={{ color: 'var(--c-primary)' }}>
            {shop.myPoints.toLocaleString('en-IN')}
          </span>
          <span className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
            points · worth {inr(Math.round(shop.myPoints * cfg.pointValue))}
          </span>
        </div>

        {shop.tierProg?.next && (
          <div className="mt-3">
            <div className="flex justify-between text-[11.5px] mb-1">
              <span style={{ color: shop.tier?.colour }}>{shop.tier?.name}</span>
              <span style={{ color: 'var(--c-text-muted)' }}>
                {inr(shop.tierProg.toNext)} to {shop.tierProg.next.name}
              </span>
            </div>
            <Progress value={shop.tierProg.percent} height={7} />
          </div>
        )}
      </div>

      <Card>
        <CardHead title="Your tier benefits" />
        <div className="space-y-2">
          {tiers.map(t => {
            const isMine = t.id === shop.tier?.id
            const unlocked = (shop.me.spend ?? 0) >= t.threshold
            return (
              <div key={t.id} className="p-2.5 rounded-lg border"
                style={{
                  borderColor: isMine ? t.colour : 'var(--c-border)',
                  background: isMine ? `color-mix(in srgb, ${t.colour} 8%, transparent)` : 'transparent',
                  opacity: unlocked ? 1 : 0.6,
                }}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[12.5px] font-medium" style={{ color: 'var(--c-text)' }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.colour }} />
                    {t.name}
                    {isMine && <Badge size="sm">You</Badge>}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
                    {t.multiplier}× points · {inr(t.threshold)}+
                  </span>
                </div>
                {(t.perks || []).length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {t.perks.map((p, i) => (
                      <li key={i} className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>· {p}</li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <CardHead title="How to earn" />
        <div className="space-y-1.5">
          {[
            [`${Math.round(cfg.earnPerRupee * 100)} points per ₹100 spent`, 'Every order'],
            ...(cfg.signupBonus ? [[`${cfg.signupBonus} points`, 'Sign up']] : []),
            ...(cfg.firstOrderBonus ? [[`${cfg.firstOrderBonus} points`, 'Your first order']] : []),
            ...(cfg.reviewBonus ? [[`${cfg.reviewBonus} points`, 'Write a review']] : []),
            ...(cfg.referralBonus ? [[`${cfg.referralBonus} points`, 'Refer a friend']] : []),
            ...(cfg.birthdayBonus ? [[`${cfg.birthdayBonus} points`, 'On your birthday']] : []),
          ].map(([pts, how], i) => (
            <div key={i} className="flex justify-between text-[12px] p-2 rounded-lg"
              style={{ background: 'var(--c-surface-alt)' }}>
              <span style={{ color: 'var(--c-text-muted)' }}>{how}</span>
              <span style={{ color: 'var(--c-primary)' }}>{pts}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] mt-2" style={{ color: 'var(--c-text-muted)' }}>
          Redeem from {cfg.minRedeem} points, up to {cfg.maxRedeemPercent}% of any order.
          {cfg.expiryMonths > 0 && ` Points expire after ${cfg.expiryMonths} months.`}
        </p>
      </Card>
    </div>
  )
}

/* ---------------------------------------------------------- wishlist */

function Wishlist({ onOpenProduct }) {
  const shop = useShop()
  const items = shop.wish.map(id => shop.productById.get(id)).filter(Boolean)

  if (!items.length) {
    return (
      <EmptyState icon="♡" title="Nothing saved yet"
        message="Tap the heart on any product to save it here." />
    )
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((p, i) => (
        <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * .04 }}>
          <Card hover className="cursor-pointer glow-hover" onClick={() => onOpenProduct?.(p)}>
            <div className="flex gap-3">
              <div className="w-14 h-16 rounded-lg grid place-items-center text-xl shrink-0"
                style={{ background: 'var(--c-surface-alt)' }}>{p.emoji ?? '▦'}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--c-text)' }}>{p.name}</p>
                <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{p.category}</p>
                <p className="text-[13px] font-semibold mt-1" style={{ color: 'var(--c-text)' }}>{inr(p.price)}</p>
                {p.stock === 0 && <Badge size="sm" tone="danger">Out of stock</Badge>}
              </div>
            </div>
            <div className="flex gap-1.5 mt-2">
              <Button size="xs" full disabled={p.stock === 0}
                onClick={(e) => { e.stopPropagation(); shop.add(p, (p.variants || [])[0]) }}>
                Add to cart
              </Button>
              <Button size="xs" variant="ghost"
                onClick={(e) => { e.stopPropagation(); shop.toggleWish(p.id) }}>Remove</Button>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

/* ----------------------------------------------------------- returns */

function MyReturns() {
  const shop = useShop()
  const returnsState = useSlice('returns')
  const mine = useMemo(
    () => selectReturns({ returns: returnsState }).filter(r => r.customerId === shop.me.id),
    [returnsState, shop.me.id]
  )

  if (!mine.length) {
    return (
      <EmptyState icon="↩" title="No returns"
        message="Returns you raise will be tracked here." />
    )
  }

  return (
    <div className="space-y-2">
      {mine.map((r, i) => (
        <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * .04 }}>
          <Card className="glow-hover">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[13px]" style={{ color: 'var(--c-text)' }}>{r.id}</span>
                  <Badge size="sm" tone={
                    r.status === 'Refunded' ? 'success'
                    : r.status === 'Rejected' ? 'danger'
                    : 'info'}>{r.status}</Badge>
                </div>
                <p className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
                  Order {r.orderId} · {r.lines?.length ?? 0} item{(r.lines?.length ?? 0) > 1 ? 's' : ''}
                </p>
              </div>
              {r.refundAmount > 0 && (
                <span className="tabular-nums text-[13px] font-semibold" style={{ color: 'var(--c-success)' }}>
                  {inr(r.refundAmount)}
                </span>
              )}
            </div>
            <div className="mt-2 space-y-1">
              {(r.lines || []).map((l, j) => (
                <p key={j} className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
                  {l.name} — {REASON_BY_CODE[l.reasonCode]?.label ?? l.reasonCode}
                </p>
              ))}
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

/* ----------------------------------------------------- subscriptions */

const SUB_STORAGE_KEY = 'bharatcart:subscriptions:v1'

function loadSubOverrides() {
  try { return JSON.parse(localStorage.getItem(SUB_STORAGE_KEY) ?? '{}') } catch { return {} }
}

function fmtSubDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  } catch { return '' }
}

/** Upcoming delivery dates for a subscription, earliest first. */
function upcomingDeliveries(sub, count = 5) {
  try {
    const sched = buildSchedule({ frequency: sub.frequency, startDateISO: sub.startDateISO, occurrences: count + 3 })
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return ((sched ?? []).map(d => d.dateISO)).filter(d => {
      try { return new Date(d) >= today } catch { return false }
    }).slice(0, count)
  } catch { return [] }
}

/**
 * Subscriptions are derived from placed order lines carrying
 * extras.subscription — the order book stays the source of truth, while
 * pause/skip are local shopper preferences persisted separately.
 */
function Subscriptions() {
  const shop = useShop()
  const [overrides, setOverrides] = useState(loadSubOverrides)

  useEffect(() => {
    try { localStorage.setItem(SUB_STORAGE_KEY, JSON.stringify(overrides)) } catch { /* not worth crashing over */ }
  }, [overrides])

  const subs = useMemo(() => {
    const out = []
    for (const o of shop.myOrders) {
      for (const it of o.items ?? []) {
        if (it.extras?.subscription) {
          out.push({
            key: `${o.id}:${it.sku}`,
            orderId: o.id,
            item: it,
            product: shop.productById.get(it.productId),
          })
        }
      }
    }
    return out
  }, [shop.myOrders, shop.productById])

  if (!subs.length) {
    return (
      <EmptyState icon="🔁" title="No subscriptions"
        message="Subscribe to a dairy product at checkout and manage it here." />
    )
  }

  const setOverride = (key, patch) =>
    setOverrides(s => ({ ...s, [key]: { ...(s[key] ?? {}), ...patch } }))

  return (
    <div className="space-y-2">
      {subs.map((s, i) => {
        const ov = overrides[s.key] ?? {}
        const sub = s.item.extras.subscription
        const upcoming = upcomingDeliveries(sub).filter(d => !(ov.skipped ?? []).includes(d))
        const next = ov.paused ? null : upcoming[0]
        return (
          <motion.div key={s.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * .04, .3) }}>
            <Card className="glow-hover">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[13px]" style={{ color: 'var(--c-text)' }}>
                      {s.product?.name ?? s.item.name}
                    </span>
                    {ov.paused && <Badge size="sm" tone="warning">Paused</Badge>}
                  </div>
                  <p className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
                    {frequencyLabel(sub.frequency)} · {inr(s.item.price)} × {s.item.qty}
                    {' · '}from order {s.orderId}
                  </p>
                  {next && (
                    <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--c-text)' }}>
                      Next delivery: {fmtSubDate(next)}
                    </p>
                  )}
                  {!next && !ov.paused && (
                    <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                      No upcoming deliveries scheduled
                    </p>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="xs" variant="outline"
                    onClick={() => setOverride(s.key, { paused: !ov.paused })}>
                    {ov.paused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button size="xs" variant="ghost" disabled={!next}
                    onClick={() => setOverride(s.key, { skipped: [...(ov.skipped ?? []), next] })}>
                    Skip next
                  </Button>
                </div>
              </div>
              {upcoming.length > 1 && !ov.paused && (
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--c-text-muted)' }}>
                  Then: {upcoming.slice(1, 4).map(fmtSubDate).join(', ')}
                </p>
              )}
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

function Row({ label, value, strong }) {
  return (
    <div className="flex justify-between text-[11.5px] py-0.5">
      <span style={{ color: 'var(--c-text-muted)' }}>{label}</span>
      <span className={strong ? 'font-semibold tabular-nums' : 'tabular-nums'} style={{ color: 'var(--c-text)' }}>{value}</span>
    </div>
  )
}
