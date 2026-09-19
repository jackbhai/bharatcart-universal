import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useShop } from './shopState.jsx'
import { frequencyLabel } from './verticalEngines.js'
import useToast from '../hooks/useToast.js'
import EmptyState from '../ui/EmptyState.jsx'
import Button from '../ui/primitives/Button.jsx'
import { Input, Slider } from '../ui/primitives/Input.jsx'
import { Badge, Divider, Progress } from '../ui/primitives/Display.jsx'
import { inr } from '../lib/analytics.js'

export default function Cart({ onCheckout, onStartShopping }) {
  const shop = useShop()
  const { success, error } = useToast()
  const [code, setCode] = useState(shop.couponCode)

  if (!shop.cart.length) {
    return (
      <EmptyState icon="▤" title="Your cart is empty"
        message="Add something you like and it will show up here."
        actionLabel="Start shopping"
        onAction={() => onStartShopping?.()} />
    )
  }

  const applyCode = () => {
    shop.setCouponCode(code.toUpperCase())
    // The engine decides — check the result rather than assuming it worked.
    setTimeout(() => {
      const applied = shop.promoResult.applied.some(a => a.promo?.code === code.toUpperCase())
      if (applied) success('Offer applied')
      else if (code) error('That code does not apply to this cart')
    }, 40)
  }

  const freeShipAt = shop.checkout.freeShippingAbove ?? 999
  const toFreeShip = freeShipAt - shop.afterDiscount

  return (
    <div className="space-y-3">
      {/* free shipping nudge — driven by the admin's threshold */}
      {toFreeShip > 0 && shop.shipping > 0 && (
        <div className="p-2.5 rounded-xl glass-tint anim-fade-up">
          <p className="text-[11.5px] mb-1.5" style={{ color: 'var(--c-text)' }}>
            Add <strong>{inr(toFreeShip)}</strong> more for free shipping
          </p>
          <Progress value={shop.afterDiscount} max={freeShipAt} height={4} />
        </div>
      )}

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {shop.cart.map((x, i) => (
            <motion.div key={x.key} layout
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="flex gap-3 p-2.5 rounded-xl overflow-hidden glass glow-hover" >
              <div className="w-14 h-16 rounded-lg shrink-0 grid place-items-center text-lg"
                style={{ background: 'color-mix(in srgb, var(--c-primary) 8%, var(--c-surface-alt))' }}>
                {x.product.emoji ?? '▦'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--c-text)' }}>{x.product.name}</p>
                <p className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>
                  {[x.variant.size, x.variant.color].filter(Boolean).join(' · ') || x.product.category}
                </p>
                <LineExtras line={x} />
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex items-center rounded-full border pressable" style={{ borderColor: 'var(--c-border)' }}>
                    <button onClick={() => shop.setQty(x.key, x.qty - 1)}
                      className="px-2.5 py-1 text-[14px] focus-ring" style={{ color: 'var(--c-text)' }}
                      aria-label="Decrease quantity">−</button>
                    <span className="px-1.5 text-[12px] font-semibold tabular-nums min-w-[2ch] text-center" style={{ color: 'var(--c-text)' }}>{x.qty}</span>
                    <button onClick={() => shop.setQty(x.key, x.qty + 1)}
                      className="px-2.5 py-1 text-[14px] focus-ring" style={{ color: 'var(--c-text)' }}
                      aria-label="Increase quantity">+</button>
                  </div>
                  <button onClick={() => shop.remove(x.key)}
                    className="text-[11px] pressable" style={{ color: 'var(--c-danger)' }}>Remove</button>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-semibold tabular-nums" style={{ color: 'var(--c-text)' }}>
                  {inr(x.lineTotal)}
                </p>
                {x.wasPrice && (
                  <p className="text-[10.5px] line-through" style={{ color: 'var(--c-text-muted)' }}>
                    {inr(x.wasPrice * x.qty)}
                  </p>
                )}
                {x.priceSource && x.priceSource !== 'list' && (
                  <Badge size="sm" tone="success">{x.priceSource}</Badge>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* coupon */}
      <div className="flex gap-2">
        <Input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="Coupon code" size="sm" className="flex-1 focus-ring" />
        <Button size="sm" variant="outline" onClick={applyCode}>Apply</Button>
      </div>

      {shop.promoResult.applied.length > 0 && (
        <div className="space-y-1">
          {shop.promoResult.applied.map((a, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              className="flex justify-between text-[11.5px]">
              <span style={{ color: 'var(--c-success)' }}>✓ {a.promo?.name ?? 'Offer'}</span>
              <span style={{ color: 'var(--c-success)' }}>− {inr(a.amount ?? 0)}</span>
            </motion.div>
          ))}
        </div>
      )}

      {/* loyalty redemption — only if admin has the programme on */}
      {shop.flags.loyalty && shop.myPoints > 0 && shop.redeemable.maxPoints > 0 && (
        <div className="p-2.5 rounded-xl glass anim-fade-up">
          <div className="flex justify-between text-[11.5px] mb-1">
            <span style={{ color: 'var(--c-text)' }}>★ Use points</span>
            <span style={{ color: 'var(--c-text-muted)' }}>
              {shop.myPoints.toLocaleString('en-IN')} available
            </span>
          </div>
          <Slider value={shop.redeemPoints} onChange={shop.setRedeemPoints}
            min={0} max={shop.redeemable.maxPoints} step={shop.loyaltyConfig.redeemStep || 50}
            format={v => v === 0 ? 'Not using points' : `${v} pts = ${inr(Math.round(v * shop.loyaltyConfig.pointValue))} off`} />
          {shop.redeemable.limiter && shop.redeemPoints >= shop.redeemable.maxPoints && (
            <p className="text-[10.5px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
              Capped by {shop.redeemable.limiter}
            </p>
          )}
        </div>
      )}

      <Divider />

      <div className="space-y-0.5">
        <Row label="Subtotal" value={inr(shop.subtotal)} />
        {shop.promoDiscount > 0 && <Row label="Offers" value={`− ${inr(shop.promoDiscount)}`} tone="success" />}
        {shop.pointsDiscount > 0 && <Row label="Points" value={`− ${inr(shop.pointsDiscount)}`} tone="success" />}
        <Row label={`GST${shop.tax.interState ? ' (IGST)' : ''}`} value={inr(shop.tax.total)} />
        <Row label="Shipping" value={shop.shipping === 0 ? 'Free' : inr(shop.shipping)}
          tone={shop.shipping === 0 ? 'success' : undefined} />
        <Divider />
        <div className="flex justify-between items-baseline">
          <span className="text-[13.5px] font-semibold" style={{ color: 'var(--c-text)' }}>Total</span>
          <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--c-text)' }}>{inr(shop.total)}</span>
        </div>
      </div>

      {shop.afterDiscount < (shop.checkout.minOrderValue ?? 0) && (
        <p className="text-[11.5px]" style={{ color: 'var(--c-danger)' }}>
          Minimum order value is {inr(shop.checkout.minOrderValue)}
        </p>
      )}

      <button onClick={onCheckout}
        disabled={shop.afterDiscount < (shop.checkout.minOrderValue ?? 0)}
        className="pressable sheen glow-primary w-full rounded-xl py-3 text-[14px] font-bold disabled:opacity-50 disabled:saturate-50"
        style={{ background: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}>
        Checkout · {inr(shop.total)}
      </button>

      {shop.flags.loyalty && shop.willEarn.points > 0 && (
        <p className="text-[11px] text-center" style={{ color: 'var(--c-primary)' }}>
          You will earn {shop.willEarn.points} points
        </p>
      )}
    </div>
  )
}

/** Vertical context carried on the line's extras: packs, gold, subscriptions… */
function LineExtras({ line }) {
  const ex = line.extras ?? {}
  const v = line.variant ?? {}
  if (!Object.keys(ex).length && !line.unitLabel) return null

  const bits = []
  // pack size + unit price (grocery / dairy / confectionery)
  const pack = v.pack ?? v.packWeight
  if (pack && line.unitLabel) bits.push(`${pack} · ${line.unitLabel}`)
  // fine jewellery: purity · weight + locked rate
  if (ex.purity || ex.weightG) {
    const snap = ex.rateSnapshot
    const rate = typeof snap === 'number' ? snap : snap?.rate ?? snap?.pricePerGram ?? null
    bits.push(
      [ex.purity, ex.weightG ? `${ex.weightG} g` : null].filter(Boolean).join(' · ')
      + (rate ? ` @ ${inr(rate)}/g` : '')
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
      {ex.subscription && (
        <Badge size="sm" tone="info">🔁 Subscription · {frequencyLabel(ex.subscription.frequency)}</Badge>
      )}
      {ex.slot?.label && (
        <span className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>🚚 {ex.slot.label}</span>
      )}
      {bits.map((t, i) => (
        <span key={i} className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>{t}</span>
      ))}
      {ex.message ? <span className="text-[11px]" title={ex.message}>🎁</span> : null}
    </div>
  )
}

function Row({ label, value, tone }) {  return (
    <div className="flex justify-between text-[12px] py-0.5">
      <span style={{ color: 'var(--c-text-muted)' }}>{label}</span>
      <span className="tabular-nums" style={{ color: tone === 'success' ? 'var(--c-success)' : 'var(--c-text)' }}>{value}</span>
    </div>
  )
}
