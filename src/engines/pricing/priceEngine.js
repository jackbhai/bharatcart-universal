/**
 * Pricing engine.
 *
 * Resolution order (first match wins, highest priority first):
 *   1. Scheduled price override (date-bound sale)
 *   2. Customer-group price list
 *   3. Quantity / tier break
 *   4. Base sale price
 *   5. MRP
 *
 * Everything is pure — the admin edits config in the store, this computes.
 */

export const PRICE_SOURCE = {
  SCHEDULED: 'scheduled',
  GROUP: 'group',
  TIER: 'tier',
  SALE: 'sale',
  MRP: 'mrp',
}

/**
 * @param {object} product  { price, mrp, cost, id, category, brand }
 * @param {object} ctx
 * @param {number} ctx.qty
 * @param {string} ctx.customerGroup
 * @param {Array}  ctx.priceLists   [{ id, group, rules: [{ match, type, value }] }]
 * @param {Array}  ctx.tiers        [{ productId|category|all, breaks: [{ minQty, price|discountPct }] }]
 * @param {Array}  ctx.schedules    [{ productId, price, from, to }]
 * @param {number} ctx.now
 */
export function resolvePrice(product, ctx = {}) {
  const {
    qty = 1,
    customerGroup = 'retail',
    priceLists = [],
    tiers = [],
    schedules = [],
    now = Date.now(),
    roundTo = 1,
  } = ctx

  const mrp = product.mrp ?? product.price
  const trail = []
  let price = product.price
  let source = PRICE_SOURCE.SALE

  // ---- 4/5 baseline
  trail.push({ step: 'base', price, note: 'catalogue sale price' })

  // ---- 3 quantity tiers
  const tier = findTier(product, tiers)
  if (tier) {
    const brk = [...tier.breaks]
      .filter(b => qty >= b.minQty)
      .sort((a, b) => b.minQty - a.minQty)[0]
    if (brk) {
      const tierPrice = brk.price != null
        ? brk.price
        : round(product.price * (1 - (brk.discountPct || 0) / 100), roundTo)
      if (tierPrice < price) {
        price = tierPrice
        source = PRICE_SOURCE.TIER
        trail.push({ step: 'tier', price, note: `${brk.minQty}+ qty break` })
      }
    }
  }

  // ---- 2 customer group price list
  const list = priceLists.find(l => l.group === customerGroup && l.active !== false)
  if (list) {
    const rule = matchRule(product, list.rules || [])
    if (rule) {
      const listPrice = applyRule(product.price, rule, roundTo)
      if (listPrice < price) {
        price = listPrice
        source = PRICE_SOURCE.GROUP
        trail.push({ step: 'group', price, note: `${list.name || list.group} price list` })
      }
    }
  }

  // ---- 1 scheduled override (wins outright, even if higher)
  const inWindow = (s) => {
    const from = s.from ?? (s.startAt ? new Date(s.startAt).getTime() : null)
    const to = s.to ?? (s.endAt ? new Date(s.endAt + 'T23:59:59').getTime() : null)
    return (!from || now >= from) && (!to || now <= to)
  }
  const targets = (s) => {
    if (s.productId) return s.productId === product.id
    switch (s.scope) {
      case 'all': return true
      case 'category': return !s.target || product.category === s.target
      case 'brand': return !s.target || product.brand === s.target
      default: return false
    }
  }
  const sched = schedules.find(s => targets(s) && inWindow(s))
  if (sched) {
    price = sched.price != null
      ? sched.price
      : round(product.price * (1 - (sched.discountPct || 0) / 100), roundTo)
    source = PRICE_SOURCE.SCHEDULED
    trail.push({ step: 'scheduled', price, note: sched.name || 'scheduled sale' })
  }

  price = round(Math.max(0, price), roundTo)

  const cost = product.cost ?? estimateCost(product)
  const discount = Math.max(0, mrp - price)

  return {
    price,
    mrp,
    unitPrice: price,
    lineTotal: round(price * qty, 0.01),
    source,
    discount,
    discountPct: mrp > 0 ? Math.round((discount / mrp) * 100) : 0,
    cost,
    margin: round(price - cost, 0.01),
    marginPct: price > 0 ? Math.round(((price - cost) / price) * 100) : 0,
    markupPct: cost > 0 ? Math.round(((price - cost) / cost) * 100) : 0,
    trail,
  }
}

/** Bulk resolve for a cart / list. */
export function resolveMany(items, ctx) {
  return items.map(it => ({
    ...it,
    pricing: resolvePrice(it.product, { ...ctx, qty: it.qty ?? 1 }),
  }))
}

/* ------------------------------------------------------------ matching */

function findTier(product, tiers) {
  return tiers.find(t =>
    (t.productId && t.productId === product.id) ||
    (t.category && t.category === product.category) ||
    t.all === true
  )
}

function matchRule(product, rules) {
  // most specific first: product > variant > brand > category > all
  const order = ['productId', 'brand', 'category', 'all']
  for (const key of order) {
    const r = rules.find(rule => {
      if (key === 'all') return rule.match?.all === true
      return rule.match?.[key] != null && rule.match[key] === product[key === 'productId' ? 'id' : key]
    })
    if (r) return r
  }
  return null
}

function applyRule(base, rule, roundTo) {
  switch (rule.type) {
    case 'fixed': return round(rule.value, roundTo)
    case 'percent_off': return round(base * (1 - rule.value / 100), roundTo)
    case 'amount_off': return round(base - rule.value, roundTo)
    case 'markup_on_cost': return round((rule.cost ?? base * 0.58) * (1 + rule.value / 100), roundTo)
    default: return base
  }
}

/* ------------------------------------------------------------- margin */

/** Deterministic cost estimate when a product has no cost recorded. */
export function estimateCost(product) {
  // handmade / GI goods carry higher COGS
  let ratio = 0.58
  if (product.handmade) ratio += 0.06
  if (product.gi) ratio += 0.05
  if (product.category === 'Jewellery') ratio += 0.08
  if (product.category === 'Beauty') ratio -= 0.1
  const seed = hashId(product.id || product.name || '')
  ratio += ((seed % 100) / 100 - 0.5) * 0.08
  return round(product.price * clamp(ratio, 0.3, 0.85), 1)
}

/** Full margin analysis including fees. */
export function marginAnalysis(product, ctx = {}) {
  const {
    price = product.price,
    cost = product.cost ?? estimateCost(product),
    paymentFeePct = 2.0,
    shippingCost = 0,
    codFee = 0,
    returnRate = (product.returnRate ?? 0) / 100,
    packagingCost = 18,
    marketingPct = 6,
  } = ctx

  const paymentFee = price * (paymentFeePct / 100)
  const marketing = price * (marketingPct / 100)
  const returnLoss = price * returnRate * 0.4   // partial recovery on returns

  const totalCost = cost + paymentFee + shippingCost + codFee + packagingCost + marketing + returnLoss
  const netMargin = price - totalCost

  return {
    price: round(price, 0.01),
    breakdown: [
      { label: 'Product cost', value: round(cost, 0.01) },
      { label: 'Payment fee', value: round(paymentFee, 0.01) },
      { label: 'Shipping', value: round(shippingCost, 0.01) },
      { label: 'COD fee', value: round(codFee, 0.01) },
      { label: 'Packaging', value: round(packagingCost, 0.01) },
      { label: 'Marketing', value: round(marketing, 0.01) },
      { label: 'Return provision', value: round(returnLoss, 0.01) },
    ].filter(b => b.value > 0),
    totalCost: round(totalCost, 0.01),
    grossMargin: round(price - cost, 0.01),
    grossMarginPct: price > 0 ? Math.round(((price - cost) / price) * 100) : 0,
    netMargin: round(netMargin, 0.01),
    netMarginPct: price > 0 ? Math.round((netMargin / price) * 100) : 0,
    breakEvenPrice: round(totalCost, 1),
    healthy: netMargin / price > 0.15,
  }
}

/** Suggest a price for a target net margin. */
export function priceForMargin(product, targetPct, ctx = {}) {
  const cost = product.cost ?? estimateCost(product)
  let lo = cost, hi = cost * 6
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const m = marginAnalysis(product, { ...ctx, price: mid, cost })
    if (m.netMarginPct < targetPct) lo = mid
    else hi = mid
  }
  return round(hi, 1)
}

/* ------------------------------------------------------- bulk updates */

/**
 * Preview a bulk price change without applying it.
 * @param {Array} products
 * @param {object} rule { type, value, scope }
 */
export function previewBulkPrice(products, rule) {
  const rows = products.map(p => {
    let next = p.price
    switch (rule.type ?? rule.mode) {
      case 'increase_pct': next = p.price * (1 + rule.value / 100); break
      case 'decrease_pct': next = p.price * (1 - rule.value / 100); break
      case 'increase_amt': next = p.price + rule.value; break
      case 'decrease_amt': next = p.price - rule.value; break
      case 'set_fixed': next = rule.value; break
      case 'margin_target': next = priceForMargin(p, rule.value); break
      case 'mrp_discount': next = (p.mrp ?? p.price) * (1 - rule.value / 100); break
    }
    next = round(Math.max(1, next), rule.roundTo ?? 1)
    if (rule.charm) next = charmPrice(next, rule.charm)
    const cost = p.cost ?? estimateCost(p)
    return {
      id: p.id,
      name: p.name,
      from: p.price,
      to: next,
      delta: round(next - p.price, 0.01),
      deltaPct: p.price > 0 ? round(((next - p.price) / p.price) * 100, 0.1) : 0,
      marginPctBefore: p.price > 0 ? Math.round(((p.price - cost) / p.price) * 100) : 0,
      marginPctAfter: next > 0 ? Math.round(((next - cost) / next) * 100) : 0,
      belowCost: next < cost,
      newMarginPct: next > 0 ? Math.round(((next - cost) / next) * 100) : 0,
    }
  })

  const blocked = rule.respectMarginFloor !== false
  const changes = rows.filter(r => r.to !== r.from && !(blocked && r.belowCost))
  const skipped = rows.filter(r => blocked && r.belowCost && r.to !== r.from)
  const revenueImpact = changes.reduce((t, r) => t + r.delta, 0)

  return Object.assign(rows, { rows, changes, skipped, revenueImpact })
}

/* ------------------------------------------------------------ helpers */
function round(n, to = 1) {
  if (!to || to === 1) return Math.round(n)
  if (to === 0.01) return Math.round(n * 100) / 100
  if (to === 0.1) return Math.round(n * 10) / 10
  return Math.round(n / to) * to
}
const clamp = (n, a, b) => Math.max(a, Math.min(b, n))
function hashId(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return Math.abs(h)
}

/** Psychological price endings. */
export function charmPrice(price, style = '99') {
  const n = Math.round(price)
  if (style === '99') return n < 100 ? n : Math.floor(n / 100) * 100 + 99
  if (style === '95') return n < 100 ? n : Math.floor(n / 100) * 100 + 95
  if (style === '9')  return Math.floor(n / 10) * 10 + 9
  if (style === 'round') return Math.round(n / 50) * 50
  return n
}

export default { resolvePrice, resolveMany, marginAnalysis, priceForMargin, previewBulkPrice, charmPrice, estimateCost }
