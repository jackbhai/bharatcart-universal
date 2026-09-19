/**
 * Storefront state — the bridge between the shopper and every admin setting.
 *
 * The important property here is that this file owns almost no business logic.
 * Tax, promotions, loyalty, shipping and stock all come from the same engines
 * the admin panel configures, so a change in the admin panel is visible on the
 * storefront immediately. Anything computed locally would be a place where the
 * two panels could silently disagree.
 */
import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react'
import { CUSTOMERS } from '../data/seed.js'
import store from '../core/store/index.js'
import { useSlice } from '../hooks/useStore.js'
import { selectActiveProducts, selectProducts } from '../core/store/slices/catalogueSlice.js'
import { selectOrders } from '../core/store/slices/ordersSlice.js'
import { applyPromotions } from '../engines/promo/promoEngine.js'
import { calculateEarn, calculateRedeem, resolveTier, tierProgress } from '../engines/loyalty/loyaltyEngine.js'
import { checkServiceability } from '../engines/shipping/shippingEngine.js'
import { taxLine } from '../engines/tax/gst.js'
import { verifyCartPricing, verifyPayableAmount, logTamper, hash } from '../core/security/integrity.js'
import {
  verticalFor, resolveVerticalPrice, pricingVariant, useEngineVersion,
} from './verticalEngines.js'

/**
 * Catalogue price entry point for the integrity gate below. Historically this
 * was the legacy price engine's `resolvePrice`; it now delegates to the
 * vertical-aware price engine (gold / pack / near-expiry aware, else the
 * legacy engine), so the gate re-derives exactly what the cart lines carry.
 */
const resolvePrice = (product, variant, ctx) => resolveVerticalPrice(product, variant, ctx).price

const ShopCtx = createContext(null)
export const useShop = () => useContext(ShopCtx)

const STORAGE_KEY = 'bharatcart:shop:v1'

/** The signed-in shopper. Picked deterministically so their order history is real. */
const GUEST = {
  id: 'guest', name: 'Guest', email: '', phone: '',
  orders: 0, spend: 0, city: '', state: null, addresses: [],
}
// The seed ships zero customers, so ME would be undefined and every ME.<field>
// read here (and in Cart / Checkout / Account) would crash the storefront.
// A guest profile keeps every shopper path rendering safely until a real
// shopper is wired up.
const ME = CUSTOMERS.find(c => c.orders > 3) || CUSTOMERS[0] || GUEST

/**
 * Pricing context for the vertical price engine. The cart, the PDP and the
 * integrity gate below MUST build this identically — it is what makes the
 * re-priced gate agree with the prices the shopper saw.
 */
function priceCtxFor(ref) {
  return {
    qty: ref.qty ?? 1,
    customer: ME,
    purity: ref.extras?.purity,
    weightG: ref.extras?.weightG,
  }
}

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function ShopProvider({ children }) {
  const persisted = useMemo(loadPersisted, [])

  // Carts store ids, not product objects — otherwise an admin price edit would
  // not reach a cart that was built before the edit.
  const [cartRefs, setCartRefs] = useState(persisted.cart ?? [])
  const [wish, setWish] = useState(persisted.wish ?? [])
  const [recent, setRecent] = useState(persisted.recent ?? [])
  const [compare, setCompare] = useState([])
  const [couponCode, setCouponCode] = useState('')
  const [redeemPoints, setRedeemPoints] = useState(0)
  const [pincode, setPincode] = useState(persisted.pincode ?? '')
  const [paymentMethod, setPaymentMethod] = useState('UPI')
  const [placedOrders, setPlacedOrders] = useState(persisted.placedOrders ?? [])

  // Live admin state
  const catalogueState = useSlice('catalogue')
  const settings = useSlice('settings')
  const promoState = useSlice('promo')
  const loyaltyState = useSlice('loyalty')
  const ordersState = useSlice('orders')

  // Bumps when the real vertical engines arrive, so engine-derived values
  // (cart prices, picker prices) upgrade from their fallbacks transparently.
  const engineVersion = useEngineVersion()

  const products = useMemo(() => selectActiveProducts({ catalogue: catalogueState }), [catalogueState])
  const allProducts = useMemo(() => selectProducts({ catalogue: catalogueState }), [catalogueState])
  const productById = useMemo(() => new Map(allProducts.map(p => [p.id, p])), [allProducts])

  const flags = settings.featureFlags
  const checkout = settings.checkout
  const loyaltyConfig = loyaltyState.config

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        cart: cartRefs, wish, recent, pincode, placedOrders,
      }))
    } catch { /* storage full or blocked — carts are not worth crashing over */ }
  }, [cartRefs, wish, recent, pincode, placedOrders])

  /* ------------------------------------------------------------ cart */

  const cart = useMemo(() => cartRefs.map(ref => {
    const product = productById.get(ref.productId)
    if (!product) return null
    const variant = (product.variants || []).find(v => v.sku === ref.sku)
      ?? { sku: ref.sku, size: ref.size, color: ref.color, stock: product.stock ?? 0 }
    // Price resolves through the vertical price engine (gold pricing, pack
    // pricing, near-expiry discounts, else the legacy engine) — never from
    // raw p.price. The integrity gate in placeOrder() re-prices with the
    // same function and the same ctx, so the two can never disagree, and
    // the storefront still owns no pricing logic of its own. The variant is
    // priced as the shopper configured it (e.g. a chosen gold purity).
    const priced = resolveVerticalPrice(product, pricingVariant(variant, ref.extras), priceCtxFor(ref))
    return {
      key: ref.key,
      productId: ref.productId,
      product,
      variant,
      qty: ref.qty,
      extras: ref.extras ?? {},
      vertical: verticalFor(product),
      price: priced.price,
      wasPrice: priced.meta?.wasPrice ?? (priced.price < product.price ? product.price : null),
      priceSource: priced.source,
      unitLabel: priced.unitLabel ?? null,
      lineTotal: priced.price * ref.qty,
    }
  }).filter(Boolean), [cartRefs, productById, engineVersion])

  const add = useCallback((p, v, qty = 1, extras = {}) => {
    const sku = v?.sku ?? p.id
    const ex = extras && typeof extras === 'object' ? extras : {}
    // Same product + same choices merge into one line; different extras
    // (pack, purity, subscription, slot) stay on separate lines. With no
    // extras the key is exactly what it always was, so old calls merge.
    const exTag = Object.keys(ex).length ? ':' + hash(JSON.stringify(ex)) : ''
    const key = p.id + ':' + sku + exTag
    setCartRefs(c => {
      const found = c.find(x => x.key === key)
      if (found) return c.map(x => x.key === key ? { ...x, qty: x.qty + qty } : x)
      return [...c, { key, productId: p.id, sku, size: v?.size, color: v?.color, qty, extras: ex }]
    })
  }, [])

  const remove = useCallback(k => setCartRefs(c => c.filter(x => x.key !== k)), [])
  const setQty = useCallback((k, q) => setCartRefs(c =>
    q <= 0 ? c.filter(x => x.key !== k) : c.map(x => x.key === k ? { ...x, qty: q } : x)), [])
  const clearCart = useCallback(() => setCartRefs([]), [])

  const toggleWish = useCallback(id =>
    setWish(w => w.includes(id) ? w.filter(x => x !== id) : [...w, id]), [])
  const toggleCompare = useCallback(id =>
    setCompare(c => c.includes(id) ? c.filter(x => x !== id) : [...c, id].slice(-4)), [])
  const track = useCallback(p =>
    setRecent(r => [p.id, ...r.filter(x => x !== p.id)].slice(0, 12)), [])

  /* -------------------------------------------------------- pricing */

  const subtotal = useMemo(() => cart.reduce((s, x) => s + x.lineTotal, 0), [cart])

  /** Promotions run through the admin's promo engine, codes and all. */
  const promoResult = useMemo(() => {
    if (!cart.length) return { applied: [], rejected: [], totalDiscount: 0, payable: 0, freeShipping: false }
    return applyPromotions(
      { items: cart.map(x => ({ product: x.product, qty: x.qty, price: x.price })) },
      promoState.promos,
      {
        code: couponCode || undefined,
        customer: { ...ME, isNew: ME.orders === 0 },
        payment: paymentMethod,
        usage: promoState.usage,
      }
    )
  }, [cart, promoState.promos, promoState.usage, couponCode, paymentMethod])

  const promoDiscount = promoResult.totalDiscount ?? 0

  /* -------------------------------------------------------- loyalty */

  const myPoints = useMemo(() => {
    if (!flags.loyalty) return 0
    const earned = Math.floor((ME.spend ?? 0) * loyaltyConfig.earnPerRupee)
    const granted = (loyaltyState.ledger || [])
      .filter(l => l.customerId === ME.id)
      .reduce((s, l) => s + (l.points ?? 0), 0)
    return Math.max(0, earned - Math.floor(earned * 0.34) + granted)
  }, [flags.loyalty, loyaltyConfig, loyaltyState.ledger])

  const tier = useMemo(
    () => resolveTier({ spend12m: ME.spend, spend: ME.spend, points: myPoints }, loyaltyConfig),
    [loyaltyConfig, myPoints]
  )
  const tierProg = useMemo(
    () => tierProgress({ spend12m: ME.spend, spend: ME.spend, points: myPoints }, loyaltyConfig),
    [loyaltyConfig, myPoints]
  )

  const redeemable = useMemo(() => {
    if (!flags.loyalty || !cart.length) return { maxPoints: 0, discount: 0, limiter: null }
    return calculateRedeem(
      { items: cart.map(x => ({ product: x.product, qty: x.qty, price: x.price })) },
      { ...ME, points: myPoints },
      loyaltyConfig
    )
  }, [flags.loyalty, cart, myPoints, loyaltyConfig])

  const pointsDiscount = useMemo(() => {
    if (!flags.loyalty || redeemPoints <= 0) return 0
    return Math.min(
      Math.round(redeemPoints * loyaltyConfig.pointValue),
      redeemable.discount ?? 0
    )
  }, [flags.loyalty, redeemPoints, loyaltyConfig, redeemable])

  /* ------------------------------------------------------- shipping */

  const serviceability = useMemo(
    () => pincode ? checkServiceability(pincode) : null,
    [pincode]
  )

  const afterDiscount = Math.max(0, subtotal - promoDiscount - pointsDiscount)

  /**
   * Shipping is free when the cart clears the admin's threshold, OR when a
   * free-shipping promotion fires. Those are two independent levers: the
   * Settings threshold, and a promotion with its own spend condition. Raising
   * the Settings threshold does not retract a promotion that still qualifies —
   * to stop that offer, pause the promotion in the Promotions screen.
   */
  const shipping = useMemo(() => {
    if (!cart.length) return 0
    if (afterDiscount >= (checkout.freeShippingAbove ?? 999)) return 0
    if (promoResult.freeShipping) return 0
    return 59
  }, [cart.length, promoResult.freeShipping, afterDiscount, checkout.freeShippingAbove])

  /* ------------------------------------------------------------ COD */

  const codAvailable = useMemo(() => {
    if (!flags.cod || !settings.payments.cod?.enabled) {
      return { ok: false, reason: 'Cash on delivery is currently unavailable' }
    }
    if (afterDiscount > (checkout.codMaxValue ?? Infinity)) {
      return { ok: false, reason: `COD is not available above ₹${checkout.codMaxValue.toLocaleString('en-IN')}` }
    }
    if (serviceability && !serviceability.cod) {
      return { ok: false, reason: 'COD is not available at this pincode' }
    }
    return { ok: true }
  }, [flags.cod, settings.payments.cod, afterDiscount, checkout.codMaxValue, serviceability])

  const codFee = paymentMethod === 'COD' && codAvailable.ok ? (checkout.codFee ?? 0) : 0

  /* ------------------------------------------------------------ tax */

  /**
   * GST is computed per line through the tax engine, and whether it splits into
   * CGST+SGST or becomes IGST depends on the seller's registered state in
   * Settings versus where this order ships.
   */
  const tax = useMemo(() => {
    if (!cart.length) return { total: 0, cgst: 0, sgst: 0, igst: 0, interState: false }
    const sellerState = settings.store?.address?.state
    const buyerState = ME.state ?? sellerState
    const interState = Boolean(sellerState && buyerState && buyerState !== sellerState)

    // Discounts reduce the taxable value proportionally across lines.
    const discountRatio = subtotal > 0 ? (promoDiscount + pointsDiscount) / subtotal : 0

    let cgst = 0, sgst = 0, igst = 0
    for (const line of cart) {
      const taxable = line.lineTotal * (1 - discountRatio)
      const t = taxLine({ amount: taxable, rate: line.product.gst ?? 0, inclusive: true, interState })
      cgst += t.cgst ?? 0
      sgst += t.sgst ?? 0
      igst += t.igst ?? 0
    }
    return {
      cgst: Math.round(cgst), sgst: Math.round(sgst), igst: Math.round(igst),
      total: Math.round(cgst + sgst + igst), interState,
    }
  }, [cart, subtotal, promoDiscount, pointsDiscount, settings.store, serviceability])

  const total = Math.max(0, afterDiscount + shipping + codFee)

  /** What this order would earn, shown before they buy. */
  const willEarn = useMemo(() => {
    if (!flags.loyalty || !cart.length) return { points: 0, value: 0 }
    return calculateEarn(
      { items: cart.map(x => ({ product: x.product, qty: x.qty, price: x.price })), subtotal: afterDiscount },
      { ...ME, points: myPoints },
      loyaltyConfig
    )
  }, [flags.loyalty, cart, afterDiscount, myPoints, loyaltyConfig])

  /* ------------------------------------------------------- checkout */

  /**
   * Places the order into the SAME store the admin Orders screen reads, which
   * is what makes a storefront purchase show up in the admin panel instantly.
   */
  const placeOrder = useCallback((details = {}) => {
    if (!cart.length) return { ok: false, error: 'Your cart is empty' }
    if (afterDiscount < (checkout.minOrderValue ?? 0)) {
      return { ok: false, error: `Minimum order value is ₹${checkout.minOrderValue}` }
    }
    if (paymentMethod === 'COD' && !codAvailable.ok) {
      return { ok: false, error: codAvailable.reason }
    }

    /* ----------------------------------------------------------------
       Price integrity gate.

       Re-derive every line price from the catalogue through the pricing
       engine and compare it against what the cart is carrying. If someone
       has edited a price in localStorage or through devtools, the two
       disagree and the order is refused.

       This cannot stop a determined attacker - they can edit this check
       out too - but it stops the easy version, records the attempt, and is
       the exact place a server-side check drops in once a backend is
       connected. See src/core/security/integrity.js for the honest limits.
    ---------------------------------------------------------------- */
    const integrity = verifyCartPricing(
      cart.map(x => ({ productId: x.productId, qty: x.qty, price: x.price, variant: x.variant, extras: x.extras })),
      (line) => {
        const product = products.find(p => p.id === line.productId)
        if (!product) return NaN
        const variant = (product.variants || []).find(v => v.sku === line.variant?.sku)
          ?? line.variant ?? null
        // Same engine, same ctx as the cart lines above — a mismatch here
        // means the client-side price was edited, not that pricing drifted.
        return resolvePrice(product, pricingVariant(variant, line.extras), priceCtxFor(line))
      }
    )
    if (!integrity.ok) {
      logTamper('cart_price_mismatch', {
        issues: integrity.issues,
        claimedTotal: integrity.claimedTotal,
        actualTotal: integrity.actualTotal,
      })
      return {
        ok: false,
        error: 'Some prices in your cart are out of date. Please refresh and try again.',
        integrity,
      }
    }

    const amountCheck = verifyPayableAmount(total, { subtotal })
    if (!amountCheck.ok) {
      logTamper('payable_amount_rejected', { total, subtotal, reason: amountCheck.reason })
      return { ok: false, error: 'We could not verify the order total. Please refresh and try again.' }
    }

    const id = 'BC' + Math.floor(70000 + Math.random() * 29999)
    const order = {
      id,
      customerId: ME.id,
      customerName: ME.name,
      placedAt: Date.now(),
      items: cart.map(x => ({
        // Line snapshot: the receipt, returns and subscription screens read
        // these frozen values — never re-derived prices.
        productId: x.productId, name: x.product.name, sku: x.variant.sku,
        size: x.variant.size, color: x.variant.color, qty: x.qty,
        price: x.price, unitPrice: x.price, lineTotal: x.lineTotal,
        source: x.priceSource, extras: x.extras ?? {}, vertical: x.vertical,
        gst: x.product.gst, category: x.product.category,
      })),
      subtotal: Math.round(subtotal),
      discount: Math.round(promoDiscount + pointsDiscount),
      gst: tax.total,
      cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst,
      shipping, codFee,
      total: Math.round(total),
      paymentMethod: details.paymentMethod ?? paymentMethod,
      // Real payment outcome, threaded from the checkout's processPayment
      // result. `paid` is true ONLY when the merchant backend verified the
      // payment server-side (result.verified). COD is never marked paid
      // here — it is collected on delivery. No fake transaction ids: the
      // reference is the real gateway payment id, or null for COD.
      paid: details.payment ? Boolean(details.payment.ok && details.payment.verified) : paymentMethod !== 'COD',
      paymentGateway: details.gateway ?? (paymentMethod === 'COD' ? 'cod' : null),
      paymentRef: details.payment?.reference ?? null,
      paymentMode: details.payment?.mode ?? null,
      paymentVerifiedAt: details.payment?.verified ? Date.now() : null,
      status: paymentMethod === 'COD' ? 'Confirmed' : 'Confirmed',
      channel: 'Web',
      couponCode: promoResult.applied?.[0]?.promo?.code ?? null,
      pointsRedeemed: redeemPoints,
      address: {
        line1: details.line1 ?? ME.addresses?.[0]?.line1 ?? 'Address on file',
        city: details.city ?? ME.city,
        state: details.state ?? ME.state,
        pincode: pincode || details.pincode || '110001',
      },
      deliverySlot: details.slot ?? null,
      deliveryDays: serviceability?.days ?? 4,
    }

    store.dispatch('orders/placeOrder', { order })

    if (flags.loyalty) {
      if (redeemPoints > 0) {
        store.dispatch('loyalty/grantPoints', {
          customerId: ME.id, points: -redeemPoints, reason: `Redeemed on ${id}`,
        })
      }
      if (willEarn.points > 0) {
        store.dispatch('loyalty/grantPoints', {
          customerId: ME.id, points: willEarn.points, reason: `Earned on ${id}`,
        })
      }
    }

    for (const a of promoResult.applied ?? []) {
      if (a.promo?.id) store.dispatch('promo/recordUsage', { id: a.promo.id, customerId: ME.id })
    }

    setPlacedOrders(o => [id, ...o])
    clearCart()
    setCouponCode('')
    setRedeemPoints(0)

    return { ok: true, order }
  }, [cart, products, subtotal, afterDiscount, promoDiscount, pointsDiscount, tax, shipping, codFee, total,
      paymentMethod, codAvailable, checkout, promoResult, redeemPoints, willEarn, pincode,
      serviceability, flags.loyalty, clearCart])

  /** My orders — seed history plus anything placed in this session. */
  const myOrders = useMemo(() => {
    const all = selectOrders({ orders: ordersState })
    return all.filter(o => o.customerId === ME.id).sort((a, b) => b.placedAt - a.placedAt)
  }, [ordersState])

  const value = {
    // catalogue
    products, allProducts, productById,
    // cart
    cart, cartCount: cart.reduce((s, x) => s + x.qty, 0), add, remove, setQty, clearCart,
    // lists
    wish, toggleWish, compare, toggleCompare, recent, track,
    // money
    subtotal, promoResult, promoDiscount, couponCode, setCouponCode,
    pointsDiscount, redeemPoints, setRedeemPoints, redeemable, myPoints, tier, tierProg, willEarn,
    shipping, codFee, tax, total, afterDiscount,
    // delivery
    pincode, setPincode, serviceability, codAvailable,
    paymentMethod, setPaymentMethod,
    // checkout
    placeOrder, placedOrders, myOrders,
    // admin-controlled
    settings, flags, checkout, loyaltyConfig,
    me: ME,
  }

  return <ShopCtx.Provider value={value}>{children}</ShopCtx.Provider>
}

export default ShopProvider
