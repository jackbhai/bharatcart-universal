/**
 * Promotion engine — applies coupons and automatic discounts to a cart.
 *
 * Supports: % off, ₹ off, free shipping, BOGO, buy-X-get-Y, tiered cart
 * discounts, free gifts, and bundle offers — each gated by the condition
 * engine, with stacking rules, priority, usage limits and a margin guard.
 */
import { deriveFacts, evalGroup } from './conditions.js'

export const DISCOUNT_TYPE = {
  PERCENT: 'percent',
  AMOUNT: 'amount',
  FREE_SHIPPING: 'free_shipping',
  BOGO: 'bogo',
  BUY_X_GET_Y: 'buy_x_get_y',
  TIERED: 'tiered',
  FREE_GIFT: 'free_gift',
  BUNDLE: 'bundle',
}

export const APPLIES_TO = {
  CART: 'cart',
  ITEMS: 'items',
  CHEAPEST: 'cheapest',
  MOST_EXPENSIVE: 'most_expensive',
  SHIPPING: 'shipping',
}

/**
 * @param {object} cart   { items: [{ product, qty, price }], shipping }
 * @param {Array}  promos all promo definitions
 * @param {object} ctx    { customer, address, payment, channel, device, code, usage, now }
 */
export function applyPromotions(cart, promos = [], ctx = {}) {
  // Empty-cart safe: a missing cart behaves like an empty one.
  const lines = cart?.items ?? []
  const shipping = cart?.shipping || 0
  const facts = deriveFacts({ ...ctx, cart: lines })
  const now = ctx.now ?? Date.now()

  const codes = normaliseCodes(ctx.codes ?? ctx.code)

  const applied = []
  const rejected = []

  const GATES = [
    [p => p.active !== false, 'Offer is switched off'],
    [p => withinWindow(p, now), 'Outside the offer validity window'],
    [p => hasBudget(p, ctx.usage), 'Usage limit for this offer has been reached'],
    [p => codeMatches(p, codes), 'Requires a coupon code'],
  ]

  const candidates = []
  for (const p of promos) {
    const failed = GATES.find(([test]) => !test(p))
    if (failed) rejected.push({ promo: p, reason: failed[1], reasons: [failed[1]] })
    else candidates.push(p)
  }
  candidates.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  let exclusiveTaken = false

  let workingItems = lines.map(i => ({
    ...i,
    price: i.price ?? i.product?.price ?? 0,
    qty: i.qty ?? 1,
    discount: 0,
  }))
  let shippingDiscount = 0
  let freeShipping = false
  const gifts = []

  for (const promo of candidates) {
    if (exclusiveTaken) {
      rejected.push({ promo, reason: 'Another exclusive offer is already applied' })
      continue
    }
    if (applied.length && promo.stackable === false && applied.some(a => a.promo.stackable === false)) {
      rejected.push({ promo, reason: 'Cannot be combined with the current offer' })
      continue
    }

    const check = evalGroup(promo.conditions, facts)
    if (!check.pass) {
      rejected.push({ promo, reason: check.reasons[0] || 'Conditions not met', reasons: check.reasons })
      continue
    }

    const result = computeDiscount(promo, workingItems, cart, facts)
    if (!result || result.amount <= 0 && !result.freeShipping && !result.gift) {
      rejected.push({ promo, reason: 'No eligible items in cart' })
      continue
    }

    // margin guard — never let a promo push the order below cost
    if (promo.marginGuard) {
      const after = totalOf(workingItems) - result.amount
      const cost = workingItems.reduce((s, i) => s + (i.product?.cost ?? i.price * 0.58) * i.qty, 0)
      if (after < cost) {
        rejected.push({ promo, reason: 'Blocked by margin guard (order would fall below cost)' })
        continue
      }
    }

    // commit
    if (result.perItem) {
      for (const [key, amt] of Object.entries(result.perItem)) {
        const item = workingItems.find(i => lineKey(i) === key)
        if (item) item.discount += amt
      }
    }
    if (result.freeShipping) { freeShipping = true; shippingDiscount = shipping }
    if (result.shippingOff) shippingDiscount += result.shippingOff
    if (result.gift) gifts.push(result.gift)

    applied.push({
      promo,
      amount: round(result.amount),
      label: promo.name,
      code: promo.code || null,
      type: promo.type,
      detail: result.detail,
    })

    if (promo.exclusive) exclusiveTaken = true
  }

  const subtotal = round(lines.reduce((s, i) => s + (i.price ?? i.product?.price ?? 0) * (i.qty ?? 1), 0))
  const itemDiscount = round(workingItems.reduce((s, i) => s + i.discount, 0))
  const totalDiscount = round(itemDiscount + shippingDiscount)

  return {
    items: workingItems.map(i => ({
      ...i,
      netPrice: round(i.price * i.qty - i.discount),
      effectiveUnit: round((i.price * i.qty - i.discount) / i.qty),
    })),
    applied,
    rejected,
    gifts,
    subtotal,
    itemDiscount,
    shippingDiscount: round(shippingDiscount),
    freeShipping,
    totalDiscount,
    payable: round(subtotal - itemDiscount),
    savingsPct: subtotal > 0 ? Math.round((totalDiscount / subtotal) * 100) : 0,
  }
}

/* ------------------------------------------------------ discount math */

function computeDiscount(promo, items, cart, facts) {
  const eligible = filterEligible(items, promo)
  if (!eligible.length && promo.type !== DISCOUNT_TYPE.FREE_SHIPPING) return null

  const eligibleTotal = totalOf(eligible)
  const perItem = {}
  let amount = 0

  switch (promo.type) {
    case DISCOUNT_TYPE.PERCENT: {
      let raw = eligibleTotal * (promo.value / 100)
      if (promo.maxDiscount) raw = Math.min(raw, promo.maxDiscount)
      amount = raw
      distribute(eligible, raw, perItem)
      return { amount, perItem, detail: `${promo.value}% off` }
    }

    case DISCOUNT_TYPE.AMOUNT: {
      amount = Math.min(promo.value, eligibleTotal)
      distribute(eligible, amount, perItem)
      return { amount, perItem, detail: `₹${promo.value} off` }
    }

    case DISCOUNT_TYPE.FREE_SHIPPING:
      return { amount: 0, freeShipping: true, detail: 'Free shipping' }

    case DISCOUNT_TYPE.TIERED: {
      const tier = [...(promo.tiers || [])]
        .filter(t => facts.cart_subtotal >= t.min)
        .sort((a, b) => b.min - a.min)[0]
      if (!tier) return null
      let raw = tier.percent
        ? eligibleTotal * (tier.percent / 100)
        : tier.amount || 0
      if (promo.maxDiscount) raw = Math.min(raw, promo.maxDiscount)
      amount = raw
      distribute(eligible, raw, perItem)
      return { amount, perItem, detail: `Spend ₹${tier.min}+ tier` }
    }

    case DISCOUNT_TYPE.BOGO: {
      // buy N get N free, cheapest free
      const units = expand(eligible)
      const buyQty = promo.buyQty ?? 1
      const getQty = promo.getQty ?? 1
      const setSize = buyQty + getQty
      const sets = Math.floor(units.length / setSize)
      if (sets < 1) return null
      const freeCount = sets * getQty
      units.sort((a, b) => a.price - b.price)
      const freeUnits = units.slice(0, freeCount)
      for (const u of freeUnits) {
        const pct = promo.getDiscountPct ?? 100
        const off = u.price * (pct / 100)
        perItem[u.key] = (perItem[u.key] || 0) + off
        amount += off
      }
      return { amount, perItem, detail: `Buy ${buyQty} get ${getQty}` }
    }

    case DISCOUNT_TYPE.BUY_X_GET_Y: {
      const xItems = filterBy(items, promo.buyMatch)
      const yItems = filterBy(items, promo.getMatch)
      if (!xItems.length || !yItems.length) return null
      const xUnits = xItems.reduce((s, i) => s + i.qty, 0)
      const sets = Math.floor(xUnits / (promo.buyQty ?? 1))
      if (sets < 1) return null
      const yUnits = expand(yItems).sort((a, b) => a.price - b.price)
      const take = Math.min(sets * (promo.getQty ?? 1), yUnits.length)
      for (let i = 0; i < take; i++) {
        const u = yUnits[i]
        const off = u.price * ((promo.getDiscountPct ?? 100) / 100)
        perItem[u.key] = (perItem[u.key] || 0) + off
        amount += off
      }
      return { amount, perItem, detail: `Buy ${promo.buyQty} get ${promo.getQty}` }
    }

    case DISCOUNT_TYPE.FREE_GIFT: {
      if (facts.cart_subtotal < (promo.minSpend ?? 0)) return null
      return { amount: 0, gift: { productId: promo.giftProductId, name: promo.giftName || 'Free gift', qty: 1 },
        detail: `Free gift over ₹${promo.minSpend}` }
    }

    case DISCOUNT_TYPE.BUNDLE: {
      const required = promo.bundleProducts || []
      const present = required.every(pid => items.some(i => i.product?.id === pid && i.qty > 0))
      if (!present) return null
      const bundleItems = items.filter(i => required.includes(i.product?.id))
      const bundleTotal = totalOf(bundleItems)
      amount = promo.bundlePrice != null
        ? Math.max(0, bundleTotal - promo.bundlePrice)
        : bundleTotal * ((promo.value || 0) / 100)
      distribute(bundleItems, amount, perItem)
      return { amount, perItem, detail: 'Bundle offer' }
    }

    default:
      return null
  }
}

/* ---------------------------------------------------------- targeting */

function filterEligible(items, promo) {
  if (promo.appliesTo === APPLIES_TO.CHEAPEST) {
    const sorted = [...items].sort((a, b) => a.price - b.price)
    return sorted.slice(0, 1)
  }
  if (promo.appliesTo === APPLIES_TO.MOST_EXPENSIVE) {
    const sorted = [...items].sort((a, b) => b.price - a.price)
    return sorted.slice(0, 1)
  }
  return filterBy(items, promo.match)
}

function filterBy(items, match) {
  if (!match || match.all) return items
  return items.filter(i => {
    const p = i.product || {}
    if (match.productIds?.length && !match.productIds.includes(p.id)) return false
    if (match.categories?.length && !match.categories.includes(p.category)) return false
    if (match.brands?.length && !match.brands.includes(p.brand)) return false
    if (match.tags?.length && !(p.tags || []).some(t => match.tags.includes(t))) return false
    if (match.excludeProductIds?.length && match.excludeProductIds.includes(p.id)) return false
    if (match.excludeCategories?.length && match.excludeCategories.includes(p.category)) return false
    if (match.minPrice != null && i.price < match.minPrice) return false
    if (match.maxPrice != null && i.price > match.maxPrice) return false
    if (match.excludeDiscounted && (p.discountPct || 0) > 0) return false
    return true
  })
}

/** Spread a cart-level discount proportionally across lines. */
function distribute(items, total, out) {
  const base = totalOf(items)
  if (base <= 0) return
  let allocated = 0
  items.forEach((it, idx) => {
    const key = lineKey(it)
    const share = idx === items.length - 1
      ? total - allocated
      : round((it.price * it.qty / base) * total)
    out[key] = (out[key] || 0) + share
    allocated += share
  })
}

function expand(items) {
  const out = []
  for (const i of items) {
    for (let q = 0; q < i.qty; q++) out.push({ key: lineKey(i), price: i.price, product: i.product })
  }
  return out
}

/* ---------------------------------------------------------- gatekeeping */

function withinWindow(p, now) {
  if (p.startsAt && now < p.startsAt) return false
  if (p.endsAt && now > p.endsAt) return false
  return true
}

function hasBudget(p, usage = {}) {
  const used = usage[p.id]?.total ?? p.usedCount ?? 0
  if (p.usageLimit && used >= p.usageLimit) return false
  const perCustomer = usage[p.id]?.byCustomer ?? 0
  if (p.perCustomerLimit && perCustomer >= p.perCustomerLimit) return false
  return true
}

function codeMatches(p, codes = []) {
  if (!p.code) return true             // automatic discount
  const list = normaliseCodes(codes)
  return list.includes(String(p.code).toUpperCase().trim())
}

/** Accept ctx.code (single), ctx.codes (array), or a comma string. */
function normaliseCodes(codes) {
  if (!codes) return []
  const arr = Array.isArray(codes) ? codes : String(codes).split(',')
  return arr.map(c => String(c).toUpperCase().trim()).filter(Boolean)
}

/* ------------------------------------------------------------ helpers */
const lineKey = (i) => i.key || `${i.product?.id}::${i.variant?.sku || 'default'}`
const totalOf = (items) => items.reduce((s, i) => s + i.price * i.qty, 0)
const round = (n) => Math.round((Number(n) || 0) * 100) / 100

/* ---------------------------------------------------------- simulator */

/**
 * Explain exactly what would happen for a given cart — powers the
 * "test this promotion" panel in the admin UI.
 */
export function simulate(cart, promos, ctx) {
  const result = applyPromotions(cart, promos, ctx)
  const facts = deriveFacts({ ...ctx, cart: cart?.items ?? [] })
  return {
    ...result,
    facts,
    explanation: [
      ...result.applied.map(a => ({
        status: 'applied',
        name: a.promo.name,
        detail: a.detail,
        amount: a.amount,
      })),
      ...result.rejected.map(r => ({
        status: 'rejected',
        name: r.promo.name,
        detail: r.reason,
        amount: 0,
        allReasons: r.reasons,
      })),
    ],
  }
}

/** Detect promos that can never fire together. */
export function detectConflicts(promos) {
  const conflicts = []
  const exclusives = promos.filter(p => p.exclusive && p.active !== false)
  if (exclusives.length > 1) {
    conflicts.push({
      severity: 'warn',
      message: `${exclusives.length} exclusive promotions are active — only the highest priority will ever apply.`,
      promos: exclusives.map(p => p.name),
    })
  }
  const byCode = new Map()
  for (const p of promos) {
    if (!p.code) continue
    const k = p.code.toUpperCase()
    byCode.set(k, [...(byCode.get(k) || []), p])
  }
  for (const [code, list] of byCode) {
    if (list.length > 1) {
      conflicts.push({ severity: 'error', message: `Code "${code}" is used by ${list.length} promotions.`, promos: list.map(p => p.name) })
    }
  }
  const noLimit = promos.filter(p => p.active !== false && p.type === DISCOUNT_TYPE.PERCENT && p.value >= 50 && !p.maxDiscount)
  for (const p of noLimit) {
    conflicts.push({ severity: 'warn', message: `"${p.name}" gives ${p.value}% off with no maximum discount cap.`, promos: [p.name] })
  }
  return conflicts
}

export default { applyPromotions, simulate, detectConflicts, DISCOUNT_TYPE, APPLIES_TO }
