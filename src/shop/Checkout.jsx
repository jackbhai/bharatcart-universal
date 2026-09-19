import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Confetti } from '../ui/fx.jsx'
import { useDeviceProfile } from '../ui/useDeviceProfile.js'
import { motion, AnimatePresence } from 'framer-motion'
import { useShop } from './shopState.jsx'
import useToast from '../hooks/useToast.js'
import EmptyState from '../ui/EmptyState.jsx'
import Button from '../ui/primitives/Button.jsx'
import { Input, Select, Switch, Label } from '../ui/primitives/Input.jsx'
import { Badge, Card, Divider, Progress, Modal } from '../ui/primitives/Display.jsx'
import { availableMethods } from '../payments/index.js'
import {
  processPayment, paymentsNotice, gatewayKey, modeLabel,
  mountStripeCard,
} from '../engines/payments/paymentGateway.js'
import { inr } from '../lib/analytics.js'
import {
  verticalFor, requiresColdChain, deliverySlots, validateColdChainOrder,
  buildSchedule, frequencyLabel, useEngineVersion,
} from './verticalEngines.js'

const BASE_STEPS = ['Delivery', 'Payment', 'Confirm']

export default function Checkout({ onClose, onDone }) {
  const shop = useShop()
  const { success, error: toastError } = useToast()
  const [step, setStep] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [placed, setPlaced] = useState(null)
  const [payError, setPayError] = useState(null)

  const [addr, setAddr] = useState({
    name: shop.me.name,
    phone: shop.me.phone,
    line1: shop.me.addresses?.[0]?.line1 ?? '',
    city: shop.me.city ?? '',
    state: shop.me.state ?? '',
    pincode: shop.pincode ?? '',
  })
  const [gstin, setGstin] = useState('')
  const [slot, setSlot] = useState(null)
  const engineVersion = useEngineVersion()

  const methods = useMemo(() => availableMethods(shop.settings), [shop.settings])
  const [method, setMethod] = useState(methods[0]?.id ?? 'cod')
  // If the available methods change (gateway connected/disconnected), drop
  // a selection that no longer exists instead of showing nothing selected.
  useEffect(() => {
    if (!methods.some(m => m.id === method)) setMethod(methods[0]?.id ?? 'cod')
  }, [methods, method])
  const chosen = methods.find(m => m.id === method) ?? methods[0]

  // Honest state of online payments: when an admin-enabled gateway is not
  // genuinely configured (no key / no backend), the checkout says so and
  // offers COD instead of faking a payment.
  const notice = useMemo(() => paymentsNotice(shop.settings), [shop.settings])
  const [confirmPay, setConfirmPay] = useState(false)

  // Stripe card Element: mounted only on the payment step while a Stripe
  // card method is selected. Its handle is passed to processPayment so the
  // real confirmCardPayment runs against the shopper's card.
  const cardMountRef = useRef(null)
  const [cardHandle, setCardHandle] = useState(null)

  const codBlocked = method === 'cod' && !shop.codAvailable.ok

  // Refrigerated verticals (dairy, confectionery) need a delivery slot step
  // between address and payment. The engine's requiresColdChain covers dairy
  // and chilled goods; confectionery always schedules a slot.
  const needsSlot = useMemo(
    () => shop.cart.some(x => {
      const v = verticalFor(x.product)
      return requiresColdChain(x.product) || v === 'dairy' || v === 'confectionery'
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shop.cart, engineVersion]
  )
  const steps = needsSlot ? ['Delivery', 'Delivery slot', 'Payment', 'Confirm'] : BASE_STEPS
  const slotStepIdx = needsSlot ? 1 : -1
  const payStepIdx = needsSlot ? 2 : 1

  // Mount the Stripe card Element only while the payment step is showing
  // and a Stripe card method is chosen. Unmount on step/method change.
  useEffect(() => {
    let handle = null
    let cancelled = false
    const wantCard = chosen?.gateway === 'stripe' && chosen?.id === 'card' && step === payStepIdx
    if (wantCard && cardMountRef.current) {
      const key = gatewayKey('stripe', shop.settings)
      if (!key) return
      mountStripeCard(cardMountRef.current, key)
        .then(h => { if (!cancelled) { handle = h; setCardHandle(h) } })
        .catch(() => { /* engine surfaces a readable error at pay time */ })
    }
    return () => {
      cancelled = true
      try { handle?.unmount() } catch { /* already gone */ }
      setCardHandle(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen?.gateway, chosen?.id, step, payStepIdx])

  const coldSlots = useMemo(
    () => needsSlot
      ? deliverySlots(addr.pincode?.length === 6 ? addr.pincode : (shop.pincode || '110001'), Date.now())
      : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [needsSlot, addr.pincode, shop.pincode, engineVersion]
  )

  // The cold-chain engine has the final say: a slot that looks fine here can
  // still be invalid (unserviceable pincode, past cut-off). Block before money moves.
  // The engine reads the chosen slot off address.deliverySlot.
  const coldCheck = useMemo(() => {
    if (!needsSlot) return { ok: true, issues: [], reason: null }
    try {
      return validateColdChainOrder(
        shop.cart.map(x => ({ product: x.product, variant: x.variant, qty: x.qty, extras: x.extras, slot })),
        { ...addr, deliverySlot: slot }
      )
    } catch {
      return { ok: true, issues: [], reason: null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSlot, shop.cart, slot, addr, engineVersion])
  const coldReason = coldCheck.reason
    ?? coldCheck.issues?.[0]?.message
    ?? 'Please choose a valid delivery slot for the refrigerated items.'

  const canContinue = step === 0
    ? addr.name && addr.phone?.length >= 10 && addr.line1 && addr.city && /^[1-9][0-9]{5}$/.test(addr.pincode)
    : step === slotStepIdx ? Boolean(slot)
    : step === payStepIdx ? Boolean(chosen) && !codBlocked
    : true

  const runPayment = async (confirmed = false) => {
    if (!chosen) {
      setPayError('No payment method is available right now.')
      return
    }
    if (needsSlot && !coldCheck.ok) {
      const msg = coldReason
      setPayError(null)
      setStep(slotStepIdx)
      toastError(msg)
      return
    }

    // Real money only moves after explicit confirmation on the review step.
    // The gateway module enforces this too (it refuses without `confirmed`),
    // so a programming slip can never skip the shopper's consent.
    // COD needs no confirmation — no online charge exists.
    const isOnline = chosen?.gateway === 'razorpay' || chosen?.gateway === 'stripe'
    if (isOnline && !confirmed) {
      setConfirmPay(true)
      return
    }
    setConfirmPay(false)

    setProcessing(true)
    setPayError(null)

    // Money moves first; the order is only written if the gateway says yes
    // AND the merchant backend verified the payment server-side.
    const result = await processPayment({
      gateway: chosen.gateway,
      amount: shop.total,
      method,
      settings: shop.settings,
      customer: shop.me,
      receipt: `rcpt_${Date.now()}`,
      confirmed,
      stripeCard: cardHandle?.card ?? null,
    })

    if (!result.ok) {
      setPayError(result.error?.message ?? 'Payment failed')
      setProcessing(false)
      toastError(result.error?.message ?? 'Payment failed')
      return
    }

    const placedResult = shop.placeOrder({
      line1: addr.line1, city: addr.city, state: addr.state, pincode: addr.pincode, gstin,
      slot,
      payment: result,
      gateway: chosen.gateway,
      paymentMethod: chosen.gateway === 'cod' ? 'COD' : chosen.label,
    })

    setProcessing(false)
    if (!placedResult.ok) {
      setPayError(placedResult.error)
      toastError(placedResult.error)
      return
    }

    setPlaced({ ...placedResult.order, payment: result })
    setStep(needsSlot ? 3 : 2)
    success(`Order ${placedResult.order.id} confirmed`)
  }

  if (placed) return <Confirmation order={placed} onDone={() => { onDone?.(); onClose?.() }} />

  // Empty cart: the order summaries below would render broken totals
  // (₹0 everywhere, no line items). Never let checkout render that way.
  if (!shop.cart.length) {
    return (
      <EmptyState icon="▤" title="Your cart is empty"
        message="Add something you like before checking out."
        actionLabel="Start shopping" onAction={() => onClose?.()} />
    )
  }

  return (
    <div className="space-y-4">
      {/* progress — animated step indicator */}
      <div>
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex items-center gap-1.5">
                <motion.span
                  key={`${i}-${i === step ? 'on' : i < step ? 'done' : 'todo'}`}
                  initial={i === step ? { scale: .55 } : false}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 480, damping: 20 }}
                  style={i < step
                    ? { background: 'var(--c-success)', color: '#fff' }
                    : i === step
                    ? { background: 'var(--c-primary)', color: 'var(--c-primary-fg)' }
                    : { background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}
                  className="w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold glow-hover">
                  {i < step ? '✓' : i + 1}
                </motion.span>
                <span className="text-[11.5px] font-medium"
                  style={{ color: i <= step ? 'var(--c-text)' : 'var(--c-text-muted)' }}>{s}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 h-[3px] rounded-full relative overflow-hidden"
                  style={{ background: 'var(--c-surface-alt)' }}>
                  <motion.div className="absolute inset-y-0 left-0 rounded-full"
                    style={{ background: 'linear-gradient(90deg, var(--c-primary), var(--c-accent))' }}
                    initial={false}
                    animate={{ width: i < step ? '100%' : '0%' }}
                    transition={{ duration: .45, ease: [0.22, 1, 0.36, 1] }} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        <div>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }} transition={{ duration: .18 }}>

              {step === 0 && (
                <div className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Input label="Full name" className="focus-ring" value={addr.name} onChange={e => setAddr(a => ({ ...a, name: e.target.value }))} />
                    <Input label="Phone" className="focus-ring" value={addr.phone} maxLength={10}
                      onChange={e => setAddr(a => ({ ...a, phone: e.target.value.replace(/\D/g, '') }))}
                      error={addr.phone && addr.phone.length < 10 ? 'Needs 10 digits' : undefined} />
                  </div>
                  <Input label="Address" className="focus-ring" value={addr.line1} onChange={e => setAddr(a => ({ ...a, line1: e.target.value }))}
                    placeholder="House / flat, street, landmark" />
                  <div className="grid sm:grid-cols-3 gap-3">
                    <Input label="City" className="focus-ring" value={addr.city} onChange={e => setAddr(a => ({ ...a, city: e.target.value }))} />
                    <Input label="State" className="focus-ring" value={addr.state} onChange={e => setAddr(a => ({ ...a, state: e.target.value }))} />
                    <Input label="PIN code" className="focus-ring" value={addr.pincode} maxLength={6}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '')
                        setAddr(a => ({ ...a, pincode: v }))
                        if (v.length === 6) shop.setPincode(v)
                      }}
                      error={addr.pincode && !/^[1-9][0-9]{5}$/.test(addr.pincode) ? 'Invalid PIN' : undefined} />
                  </div>

                  {shop.serviceability && (
                    <div className="p-2.5 rounded-lg text-[12px]"
                      style={{
                        background: shop.serviceability.ok
                          ? 'color-mix(in srgb, var(--c-success) 10%, transparent)'
                          : 'color-mix(in srgb, var(--c-danger) 10%, transparent)',
                        color: shop.serviceability.ok ? 'var(--c-success)' : 'var(--c-danger)',
                      }}>
                      {shop.serviceability.ok
                        ? <>Delivers in {shop.serviceability.days} days
                            {shop.serviceability.express && ' · Express available'}
                            {!shop.serviceability.cod && ' · COD not available here'}</>
                        : (shop.serviceability.reason ?? 'We do not deliver to this pincode yet')}
                    </div>
                  )}

                  {shop.checkout.askGstin && (
                    <Input label="GSTIN (optional)" className="focus-ring" value={gstin} onChange={e => setGstin(e.target.value.toUpperCase())}
                      hint="For a business invoice with input tax credit" />
                  )}
                </div>
              )}

              {step === slotStepIdx && slotStepIdx >= 0 && (
                <div className="space-y-2">
                  <div className="p-2.5 rounded-lg text-[12px]"
                    style={{ background: 'color-mix(in srgb, var(--c-info) 10%, transparent)', color: 'var(--c-text)' }}>
                    ❄️ Your cart has refrigerated items — pick a delivery window and we will
                    keep them chilled till your door.
                  </div>
                  {coldSlots.map(s => (
                    <button key={s.id} onClick={() => setSlot(s)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all pressable glow-hover"
                      style={{
                        borderColor: slot?.id === s.id ? 'var(--c-primary)' : 'var(--c-border)',
                        background: slot?.id === s.id ? 'var(--c-primary-soft)' : 'color-mix(in srgb, var(--c-surface) 60%, transparent)',
                      }}>
                      <span className="w-4 h-4 rounded-full border-2 grid place-items-center shrink-0"
                        style={{ borderColor: slot?.id === s.id ? 'var(--c-primary)' : 'var(--c-border)' }}>
                        {slot?.id === s.id && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--c-primary)' }} />}
                      </span>
                      <span className="text-[13px] font-medium" style={{ color: 'var(--c-text)' }}>{s.label}</span>
                    </button>
                  ))}
                  {!coldSlots.length && (
                    <EmptyState compact icon="🚚" title="No slots available"
                      message="We cannot schedule a chilled delivery to this pincode right now." />
                  )}
                  {!coldCheck.ok && (
                    <p className="text-[11.5px]" style={{ color: 'var(--c-danger)' }}>
                      {coldReason}
                    </p>
                  )}
                </div>
              )}

              {step === payStepIdx && (
                <div className="space-y-2">
                  {methods.map(m => {
                    const isCod = m.id === 'cod'
                    const blocked = isCod && !shop.codAvailable.ok
                    const gatewayName = m.gateway === 'razorpay' ? 'Razorpay' : m.gateway === 'stripe' ? 'Stripe' : 'COD'
                    return (
                      <button key={`${m.gateway}-${m.id}`} disabled={blocked} onClick={() => setMethod(m.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all disabled:opacity-50 pressable glow-hover"
                        style={{
                          borderColor: method === m.id ? 'var(--c-primary)' : 'var(--c-border)',
                          background: method === m.id ? 'var(--c-primary-soft)' : 'color-mix(in srgb, var(--c-surface) 60%, transparent)',
                        }}>
                        <span className="w-4 h-4 rounded-full border-2 grid place-items-center shrink-0"
                          style={{ borderColor: method === m.id ? 'var(--c-primary)' : 'var(--c-border)' }}>
                          {method === m.id && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--c-primary)' }} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium" style={{ color: 'var(--c-text)' }}>{m.label}</p>
                          <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
                            {blocked ? shop.codAvailable.reason : m.note}
                          </p>
                        </div>
                        {isCod && shop.checkout.codFee > 0 && !blocked && (
                          <Badge size="sm" tone="warning">+{inr(shop.checkout.codFee)}</Badge>
                        )}
                        <Badge size="sm">{gatewayName}</Badge>
                        {!isCod && (
                          <Badge size="sm" tone={m.mode === 'live' ? 'success' : 'warning'}>
                            {modeLabel(m.mode)}
                          </Badge>
                        )}
                      </button>
                    )
                  })}

                  {!methods.length && (
                    <EmptyState compact icon="₹" title="No payment methods enabled"
                      message="No payment method is available right now. Please try again shortly." />
                  )}

                  {/* Honest state when an enabled online gateway is not really connected */}
                  {notice && (
                    <div className="p-3 rounded-lg text-[12px] flex gap-2"
                      style={{ background: 'color-mix(in srgb, var(--c-warning) 12%, transparent)', color: 'var(--c-text)' }}>
                      <span>⚠️</span>
                      <span>{notice.message}</span>
                    </div>
                  )}

                  {/* Stripe card Element mount point — real Stripe Elements UI */}
                  {chosen?.gateway === 'stripe' && chosen?.id === 'card' && (
                    <div className="p-3 rounded-xl border" style={{ borderColor: 'var(--c-border)' }}>
                      <p className="text-[11.5px] mb-2" style={{ color: 'var(--c-text-muted)' }}>
                        Card details are entered directly into Stripe's secure element — they never touch this store's servers.
                      </p>
                      <div ref={cardMountRef} className="p-2.5 rounded-lg border"
                        style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }} />
                    </div>
                  )}

                  <div className="p-2.5 rounded-lg text-[11.5px] mt-2"
                    style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}>
                    {chosen?.gateway === 'cod' ? (
                      <>Cash on delivery — pay in cash or UPI when your order arrives. No online charge.</>
                    ) : chosen?.mode === 'test' ? (
                      <>Test mode — the real {chosen.gateway === 'razorpay' ? 'Razorpay' : 'Stripe'} sandbox runs, but no real money moves.
                      Use the gateway's test cards / test UPI IDs.</>
                    ) : (
                      <><strong style={{ color: 'var(--c-text)' }}>Live payment.</strong> You will
                      be charged {inr(shop.total)} via {chosen?.gateway === 'razorpay' ? 'Razorpay' : 'Stripe'}.
                      You will confirm once more before anything is charged.</>
                    )}
                  </div>

                  {payError && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-lg text-[12.5px]"
                      style={{ background: 'color-mix(in srgb, var(--c-danger) 12%, transparent)', color: 'var(--c-danger)' }}>
                      {payError} — try another method.
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex gap-2 mt-4">
            {step > 0 && <Button variant="ghost" onClick={() => setStep(s => s - 1)} disabled={processing}>Back</Button>}
            {step === 0 && (
              <Button full disabled={!canContinue} onClick={() => setStep(1)}>
                {needsSlot ? 'Choose delivery slot' : 'Continue to payment'}
              </Button>
            )}
            {step === slotStepIdx && slotStepIdx > 0 && (
              <Button full disabled={!canContinue} onClick={() => setStep(2)}>Continue to payment</Button>
            )}
            {step === payStepIdx && (
              <Button full disabled={!canContinue || processing} onClick={runPayment}>
                {processing ? 'Processing…' : chosen?.gateway === 'cod'
                  ? `Place order · ${inr(shop.total)}`
                  : `Pay ${inr(shop.total)}`}
              </Button>
            )}
          </div>
        </div>

        <OrderSummary slot={needsSlot ? slot : null} />
      </div>

      {/* Explicit review step for real money: nothing is charged until the
          shopper taps "Confirm payment" here. The gateway module refuses to
          start a charge without this confirmation. COD skips this — no
          online charge exists. */}
      <Modal open={confirmPay} onClose={() => !processing && setConfirmPay(false)}
        title="Confirm payment">
        <div className="space-y-3">
          <p className="text-[13px]" style={{ color: 'var(--c-text-muted)' }}>
            You are about to pay with <strong style={{ color: 'var(--c-text)' }}>{chosen?.label}</strong>
            {' '}via {chosen?.gateway === 'razorpay' ? 'Razorpay' : 'Stripe'}.
          </p>
          <div className="flex justify-between items-baseline p-3 rounded-xl"
            style={{ background: 'var(--c-surface-alt)' }}>
            <span className="text-[13px] font-semibold" style={{ color: 'var(--c-text)' }}>
              Amount to be charged
            </span>
            <span className="text-[20px] font-bold tabular-nums" style={{ color: 'var(--c-text)' }}>
              {inr(shop.total)}
            </span>
          </div>
          <p className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
            {chosen?.mode === 'test'
              ? 'Test mode — the gateway sandbox runs, no real money moves.'
              : 'This is a live charge to your account.'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" full disabled={processing} onClick={() => setConfirmPay(false)}>
              Cancel
            </Button>
            <Button full disabled={processing} onClick={() => runPayment(true)}>
              {processing ? 'Processing…' : `Confirm payment · ${inr(shop.total)}`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function OrderSummary({ slot }) {
  const shop = useShop()
  return (
    <div className="glass-pop rounded-2xl p-4 h-fit lg:sticky lg:top-24 elev-2 anim-fade-up">
      <div className="flex items-center justify-between mb-2">
        <p className="font-semibold text-[13px]" style={{ color: 'var(--c-text)' }}>
          {shop.cartCount} item{shop.cartCount !== 1 ? 's' : ''}
        </p>
        <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>
          Summary
        </span>
      </div>

      <div className="space-y-1.5 max-h-40 overflow-y-auto mb-2 scroll-slim">
        {shop.cart.map(x => (
          <div key={x.key} className="flex gap-2 text-[11.5px]">
            <span className="flex-1 truncate" style={{ color: 'var(--c-text-muted)' }}>
              {x.product.name} × {x.qty}
            </span>
            <span className="tabular-nums" style={{ color: 'var(--c-text)' }}>{inr(x.lineTotal)}</span>
          </div>
        ))}
      </div>

      {shop.cart.some(x => x.extras?.subscription) && (
        <div className="space-y-1 mb-2">
          {shop.cart.filter(x => x.extras?.subscription).map(x => (
            <SubscriptionSummary key={x.key} line={x} />
          ))}
        </div>
      )}

      <Divider />

      <Line label="Subtotal" value={inr(shop.subtotal)} />
      {shop.promoDiscount > 0 && (
        <Line label={`Offer${shop.couponCode ? ` (${shop.couponCode})` : ''}`}
          value={`− ${inr(shop.promoDiscount)}`} tone="success" />
      )}
      {shop.pointsDiscount > 0 && (
        <Line label={`Points (${shop.redeemPoints})`} value={`− ${inr(shop.pointsDiscount)}`} tone="success" />
      )}
      <Line label="GST" value={inr(shop.tax.total)} />
      <Line label="Shipping" value={shop.shipping === 0 ? 'Free' : inr(shop.shipping)}
        tone={shop.shipping === 0 ? 'success' : undefined} />
      {shop.codFee > 0 && <Line label="COD fee" value={inr(shop.codFee)} />}
      {slot && <Line label="Delivery slot" value={slot.label} />}

      <Divider />
      <div className="flex justify-between items-baseline">
        <span className="text-[13px] font-semibold" style={{ color: 'var(--c-text)' }}>Total</span>
        <span className="text-[17px] font-bold tabular-nums" style={{ color: 'var(--c-text)' }}>{inr(shop.total)}</span>
      </div>

      {shop.flags.loyalty && shop.willEarn.points > 0 && (
        <p className="text-[11px] mt-2" style={{ color: 'var(--c-primary)' }}>
          ★ Earn {shop.willEarn.points} points on this order
        </p>
      )}
    </div>
  )
}

function shortDates(dates, n = 3) {
  return (dates ?? []).slice(0, n).map(d => {
    try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }
    catch { return null }
  }).filter(Boolean)
}

/** "🔁 Daily · next: 20 Sep, 21 Sep, 22 Sep" under a subscription line. */
function SubscriptionSummary({ line }) {
  const sub = line.extras.subscription
  const engineVersion = useEngineVersion()
  const dates = useMemo(() => {
    try {
      const sched = buildSchedule({ frequency: sub.frequency, startDateISO: sub.startDateISO, occurrences: 3 })
      return shortDates((sched ?? []).map(d => d.dateISO))
    } catch { return [] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub.frequency, sub.startDateISO, engineVersion])
  return (
    <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
      🔁 {frequencyLabel(sub.frequency)} subscription
      {dates.length ? ` · next: ${dates.join(', ')}` : ''}
    </div>
  )
}

/** Extras carried on an order line, for the confirmation screen. */
function ItemExtras({ item }) {
  const ex = item.extras ?? {}
  if (!Object.keys(ex).length) return null
  const bits = []
  if (ex.subscription) {
    let dates = []
    try {
      const sched = buildSchedule({
        frequency: ex.subscription.frequency,
        startDateISO: ex.subscription.startDateISO,
        occurrences: 3,
      })
      dates = shortDates((sched ?? []).map(d => d.dateISO))
    } catch { /* schedule stays empty */ }
    bits.push(`🔁 ${frequencyLabel(ex.subscription.frequency)} subscription${dates.length ? ` · ${dates.join(', ')}` : ''}`)
  }
  if (ex.slot?.label) bits.push(`🚚 ${ex.slot.label}`)
  if (ex.purity || ex.weightG) {
    bits.push(`✦ ${[ex.purity, ex.weightG ? `${ex.weightG} g` : null].filter(Boolean).join(' · ')}`)
  }
  if (ex.message) bits.push('🎁 Gift message added')
  if (!bits.length) return null
  return (
    <div className="text-[11.5px]">
      <span style={{ color: 'var(--c-text)' }}>{item.name}</span>
      {bits.map((b, j) => (
        <div key={j} style={{ color: 'var(--c-text-muted)' }}>{b}</div>
      ))}
    </div>
  )
}

function Line({ label, value, tone }) {
  return (
    <div className="flex justify-between text-[12px] py-0.5">
      <span style={{ color: 'var(--c-text-muted)' }}>{label}</span>
      <span className="tabular-nums" style={{ color: tone === 'success' ? 'var(--c-success)' : 'var(--c-text)' }}>{value}</span>
    </div>
  )
}

/** Honest payment line: real gateway + method, or COD. Never a fake id. */
function paymentLine(order) {
  const p = order.payment
  if (!p || p.gateway === 'cod') return 'Cash on delivery'
  const gw = p.gateway === 'razorpay' ? 'Razorpay' : p.gateway === 'stripe' ? 'Stripe' : p.gateway
  const methodLabels = { upi: 'UPI', card: 'Card', netbanking: 'Net banking', wallet: 'Wallet', emi: 'EMI', paylater: 'Pay later' }
  const m = methodLabels[p.method] ?? p.method
  return `${gw} · ${m}`
}

function Confirmation({ order, onDone }) {
  const device = useDeviceProfile()
  /*
   * Completing a purchase is the single highest-emotion moment in the whole
   * storefront, and it was the plainest screen in it. The Confetti component
   * already existed in fx.jsx and had never been used anywhere.
   *
   * Fired once on mount rather than continuously: a celebration that loops
   * stops being a celebration. Suppressed entirely when the device profile
   * asks for reduced motion, where a burst of 34 animated elements is both
   * unpleasant and expensive.
   */
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    if (!device.effects) return
    const start = setTimeout(() => setCelebrate(true), 220)
    const stop = setTimeout(() => setCelebrate(false), 2600)
    return () => { clearTimeout(start); clearTimeout(stop) }
  }, [device.effects])

  return (
    <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }}
      className="relative text-center py-6 max-w-md mx-auto">
      <Confetti fire={celebrate} />

      {/* The tick lands with a spring, then a ring pulses outward from it. */}
      <div className="relative w-16 h-16 mx-auto mb-4">
        {device.effects && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ border: '2px solid var(--c-success)' }}
            initial={{ scale: 1, opacity: .7 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 1.1, delay: .35, ease: 'easeOut' }}
          />
        )}
        <motion.div
          initial={{ scale: 0, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 18, delay: .1 }}
          className="relative w-16 h-16 rounded-full grid place-items-center text-2xl"
          style={{ background: 'var(--c-success)', color: '#fff' }}>✓</motion.div>
      </div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: .28, duration: .3 }}
        className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>Order confirmed</motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: .36, duration: .3 }}
        className="text-[12.5px] mb-4" style={{ color: 'var(--c-text-muted)' }}>
        {order.id} · {inr(order.total)}
      </motion.p>

      <div className="t-card p-3 text-left space-y-1 mb-4 glow-ok anim-fade-up">
        <Line label="Payment" value={paymentLine(order)} />
        <Line label="Reference" value={order.payment?.reference ?? order.id} />
        <Line label="Status" value={order.paid
          ? `Paid${order.payment?.mode ? ` · ${modeLabel(order.payment.mode)} mode` : ''}`
          : 'Pay on delivery'} tone={order.paid ? 'success' : undefined} />
        <Line label="Delivery" value={`${order.deliveryDays} days · ${order.address.city}`} />
        {order.deliverySlot?.label && <Line label="Delivery slot" value={order.deliverySlot.label} />}
        {order.pointsRedeemed > 0 && <Line label="Points used" value={order.pointsRedeemed} />}
      </div>

      {order.items?.some(it => it.extras && Object.keys(it.extras).length > 0) && (
        <div className="t-card p-3 text-left space-y-1.5 mb-4">
          {order.items.map((it, i) => <ItemExtras key={i} item={it} />)}
        </div>
      )}

      <p className="text-[11.5px] mb-4" style={{ color: 'var(--c-text-muted)' }}>
        We've received your order and started processing it. You'll get an update as soon as it ships.
      </p>

      <Button full onClick={onDone}>Continue shopping</Button>
    </motion.div>
  )
}
