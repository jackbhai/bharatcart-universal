/**
 * Inventory engine — ATP (available to promise), reorder points,
 * stock valuation, ageing, forecasting and multi-warehouse allocation.
 */

export const STOCK_STATUS = {
  IN_STOCK: 'in_stock',
  LOW: 'low',
  CRITICAL: 'critical',
  OUT: 'out',
  BACKORDER: 'backorder',
  DISCONTINUED: 'discontinued',
}

/** Available to promise = on hand − reserved − safety, plus incoming if allowed. */
export function atp(variant, config = {}) {
  const {
    safetyStock = 0,
    countIncoming = false,
    allowBackorder = false,
    backorderLimit = 0,
  } = config

  const onHand = variant.stock ?? 0
  const reserved = variant.reserved ?? 0
  const incoming = countIncoming ? (variant.incoming ?? 0) : 0

  const available = Math.max(0, onHand - reserved - safetyStock + incoming)
  const sellable = allowBackorder ? available + backorderLimit : available

  return {
    onHand,
    reserved,
    safetyStock,
    incoming,
    available,
    sellable,
    canSell: sellable > 0,
    backordering: available <= 0 && sellable > 0,
  }
}

/** Status band for a product, driven by admin thresholds. */
export function stockStatus(product, config = {}) {
  const { lowThreshold = 10, criticalThreshold = 3, allowBackorder = false } = config
  if (product.status === 'archived') return STOCK_STATUS.DISCONTINUED

  const total = product.variants
    ? product.variants.reduce((s, v) => s + atp(v, config).available, 0)
    : (product.stock ?? 0)

  if (total <= 0) return allowBackorder ? STOCK_STATUS.BACKORDER : STOCK_STATUS.OUT
  if (total <= criticalThreshold) return STOCK_STATUS.CRITICAL
  if (total <= lowThreshold) return STOCK_STATUS.LOW
  return STOCK_STATUS.IN_STOCK
}

/**
 * Reorder point = (average daily demand × lead time) + safety stock.
 * Safety stock uses a service-level Z score against demand variability.
 */
export function reorderPoint(history = [], config = {}) {
  const { leadTimeDays = 14, serviceLevel = 0.95, reviewPeriodDays = 7 } = config

  const daily = history.length ? history : [0]
  const avg = daily.reduce((s, d) => s + d, 0) / daily.length
  const variance = daily.reduce((s, d) => s + Math.pow(d - avg, 2), 0) / daily.length
  const stdDev = Math.sqrt(variance)

  const Z = { 0.80: 0.84, 0.85: 1.04, 0.90: 1.28, 0.95: 1.65, 0.98: 2.05, 0.99: 2.33 }[serviceLevel] ?? 1.65
  const cycle = leadTimeDays + reviewPeriodDays
  const safety = Math.ceil(Z * stdDev * Math.sqrt(cycle))
  const rop = Math.ceil(avg * cycle + safety)

  return {
    avgDailyDemand: round1(avg),
    stdDev: round1(stdDev),
    leadTimeDays,
    safetyStock: safety,
    reorderPoint: rop,
    serviceLevel,
    economicOrderQty: eoq(avg * 365, config),
  }
}

/** Classic EOQ — balances ordering cost against holding cost. */
export function eoq(annualDemand, { orderCost = 500, holdingCostPerUnit = 40 } = {}) {
  if (annualDemand <= 0 || holdingCostPerUnit <= 0) return 0
  return Math.ceil(Math.sqrt((2 * annualDemand * orderCost) / holdingCostPerUnit))
}

/** Which products need reordering right now. */
export function reorderSuggestions(products, salesByProduct = {}, config = {}) {
  return products
    .map(p => {
      const history = salesByProduct[p.id] || []
      const rp = reorderPoint(history, { ...config, leadTimeDays: p.leadTimeDays ?? config.leadTimeDays })
      const available = p.variants
        ? p.variants.reduce((s, v) => s + atp(v, config).available, 0)
        : (p.stock ?? 0)
      const daysOfCover = rp.avgDailyDemand > 0 ? Math.floor(available / rp.avgDailyDemand) : 999
      return {
        product: p,
        available,
        ...rp,
        daysOfCover,
        needsReorder: available <= rp.reorderPoint,
        urgency: daysOfCover <= 3 ? 'critical' : daysOfCover <= 7 ? 'high' : daysOfCover <= 14 ? 'medium' : 'low',
        suggestedQty: Math.max(rp.economicOrderQty, rp.reorderPoint - available),
        estimatedCost: Math.round(Math.max(rp.economicOrderQty, rp.reorderPoint - available) * (p.cost ?? p.price * 0.58)),
      }
    })
    .filter(s => s.needsReorder)
    .sort((a, b) => a.daysOfCover - b.daysOfCover)
}

/** Inventory valuation across a catalogue. */
export function valuation(products, method = 'cost') {
  let totalCost = 0, totalRetail = 0, totalUnits = 0
  const byCategory = {}

  for (const p of products) {
    const units = p.variants ? p.variants.reduce((s, v) => s + (v.stock ?? 0), 0) : (p.stock ?? 0)
    const cost = p.cost ?? p.price * 0.58
    const c = units * cost
    const r = units * p.price

    totalUnits += units
    totalCost += c
    totalRetail += r

    const k = p.category || 'Uncategorised'
    byCategory[k] = byCategory[k] || { category: k, units: 0, cost: 0, retail: 0, skus: 0 }
    byCategory[k].units += units
    byCategory[k].cost += c
    byCategory[k].retail += r
    byCategory[k].skus++
  }

  return {
    method,
    totalUnits,
    totalCost: Math.round(totalCost),
    totalRetail: Math.round(totalRetail),
    potentialMargin: Math.round(totalRetail - totalCost),
    marginPct: totalRetail > 0 ? Math.round(((totalRetail - totalCost) / totalRetail) * 100) : 0,
    byCategory: Object.values(byCategory)
      .map(c => ({ ...c, cost: Math.round(c.cost), retail: Math.round(c.retail) }))
      .sort((a, b) => b.cost - a.cost),
  }
}

/** Stock ageing buckets — finds capital stuck in slow movers. */
export function ageing(products, now = Date.now()) {
  const buckets = [
    { id: '0-30', label: '0–30 days', min: 0, max: 30, units: 0, value: 0, skus: 0 },
    { id: '31-60', label: '31–60 days', min: 31, max: 60, units: 0, value: 0, skus: 0 },
    { id: '61-90', label: '61–90 days', min: 61, max: 90, units: 0, value: 0, skus: 0 },
    { id: '91-180', label: '91–180 days', min: 91, max: 180, units: 0, value: 0, skus: 0 },
    { id: '180+', label: 'Over 180 days', min: 181, max: Infinity, units: 0, value: 0, skus: 0 },
  ]

  for (const p of products) {
    const age = Math.floor((now - (p.createdAt ?? now)) / 86400000)
    const units = p.variants ? p.variants.reduce((s, v) => s + (v.stock ?? 0), 0) : (p.stock ?? 0)
    const b = buckets.find(x => age >= x.min && age <= x.max)
    if (!b) continue
    b.units += units
    b.value += units * (p.cost ?? p.price * 0.58)
    b.skus++
  }

  const total = buckets.reduce((s, b) => s + b.value, 0)
  return buckets.map(b => ({
    ...b,
    value: Math.round(b.value),
    pct: total > 0 ? Math.round((b.value / total) * 100) : 0,
  }))
}

/** Dead stock — no movement, capital locked. */
export function deadStock(products, salesByProduct = {}, { days = 90, now = Date.now() } = {}) {
  return products
    .filter(p => {
      const sold = (salesByProduct[p.id] || []).reduce((s, d) => s + d, 0)
      const age = Math.floor((now - (p.createdAt ?? now)) / 86400000)
      return sold === 0 && age >= days
    })
    .map(p => {
      const units = p.variants ? p.variants.reduce((s, v) => s + (v.stock ?? 0), 0) : (p.stock ?? 0)
      const cost = p.cost ?? p.price * 0.58
      return {
        product: p,
        units,
        lockedCapital: Math.round(units * cost),
        ageDays: Math.floor((now - (p.createdAt ?? now)) / 86400000),
        suggestion: units > 20 ? 'Deep discount or bundle' : 'Clear via flash sale',
      }
    })
    .filter(d => d.units > 0)
    .sort((a, b) => b.lockedCapital - a.lockedCapital)
}

/** Simple demand forecast: weighted moving average + linear trend. */
export function forecast(history = [], periods = 30) {
  if (history.length < 3) return { forecast: [], confidence: 'low', method: 'insufficient-data' }

  const n = history.length
  const weights = history.map((_, i) => i + 1)
  const wSum = weights.reduce((s, w) => s + w, 0)
  const wma = history.reduce((s, v, i) => s + v * weights[i], 0) / wSum

  const xMean = (n - 1) / 2
  const yMean = history.reduce((s, v) => s + v, 0) / n
  let num = 0, den = 0
  history.forEach((y, x) => { num += (x - xMean) * (y - yMean); den += Math.pow(x - xMean, 2) })
  const slope = den === 0 ? 0 : num / den

  const out = []
  for (let i = 1; i <= periods; i++) {
    out.push(Math.max(0, Math.round(wma + slope * i)))
  }

  const variance = history.reduce((s, v) => s + Math.pow(v - yMean, 2), 0) / n
  const cv = yMean > 0 ? Math.sqrt(variance) / yMean : 1

  return {
    forecast: out,
    total: out.reduce((s, v) => s + v, 0),
    dailyAvg: round1(out.reduce((s, v) => s + v, 0) / periods),
    trend: slope > 0.1 ? 'rising' : slope < -0.1 ? 'falling' : 'stable',
    slope: round1(slope),
    confidence: cv < 0.3 ? 'high' : cv < 0.6 ? 'medium' : 'low',
    method: 'weighted-moving-average + linear-trend',
  }
}

/**
 * FEFO batch allocation for perishables.
 *
 * A variant may carry `batches` — `[{ batch, expiryDate, qty }]` — otherwise it
 * counts as a single batch with the variant's own qty/expiryDate. Allocation
 * goes oldest-expiry-first across all batches of the product's variants.
 *
 * @param {object} product  { variants: [{ sku, stock, reserved, expiryDate, batches? }] }
 * @param {number} qty
 * @returns {{ lines: Array<{ variant, batch, expiryDate, qty }>, shortfall: number }}
 */
export function allocateBatches(product, qty) {
  const toMs = (v) => {
    if (v == null) return null
    const ms = v instanceof Date ? v.getTime() : new Date(v).getTime()
    return Number.isFinite(ms) ? ms : null
  }

  const batches = []
  for (const variant of product?.variants || []) {
    const list = variant.batches?.length
      ? variant.batches
      : [{ batch: variant.batch ?? variant.sku, expiryDate: variant.expiryDate, qty: variant.stock ?? 0, reserved: variant.reserved ?? 0 }]
    for (const b of list) {
      const avail = Math.max(0, (b.qty ?? 0) - (b.reserved ?? 0))
      if (avail <= 0) continue
      batches.push({ variant, batch: b.batch, expiryDate: b.expiryDate, expiryMs: toMs(b.expiryDate), avail })
    }
  }

  // FEFO: earliest expiry first; no-expiry batches last.
  batches.sort((a, b) => {
    if (a.expiryMs == null && b.expiryMs == null) return 0
    if (a.expiryMs == null) return 1
    if (b.expiryMs == null) return -1
    return a.expiryMs - b.expiryMs
  })

  let remaining = Math.max(0, qty || 0)
  const lines = []
  for (const b of batches) {
    if (remaining <= 0) break
    const take = Math.min(b.avail, remaining)
    lines.push({ variant: b.variant, batch: b.batch, expiryDate: b.expiryDate, qty: take })
    remaining -= take
  }

  return { lines, shortfall: remaining }
}

/** Allocate an order across warehouses — fewest splits, then nearest. */
export function allocate(items, warehouses = [], address = {}) {
  const scored = warehouses.map(w => ({
    ...w,
    distance: w.state === address.state ? 0 : w.zone === address.zone ? 1 : 2,
  })).sort((a, b) => a.distance - b.distance)

  const allocations = []
  const unfulfilled = []

  for (const item of items) {
    let remaining = item.qty ?? 1
    for (const w of scored) {
      if (remaining <= 0) break
      const stock = w.stock?.[item.product?.id] ?? 0
      if (stock <= 0) continue
      const take = Math.min(stock, remaining)
      allocations.push({ warehouse: w.id, warehouseName: w.name, product: item.product, qty: take, distance: w.distance })
      remaining -= take
    }
    if (remaining > 0) unfulfilled.push({ product: item.product, qty: remaining })
  }

  const usedWarehouses = [...new Set(allocations.map(a => a.warehouse))]
  return {
    allocations,
    unfulfilled,
    splitCount: usedWarehouses.length,
    fullyFulfilled: unfulfilled.length === 0,
    warehouses: usedWarehouses,
  }
}

const round1 = (n) => Math.round(n * 10) / 10

export default { atp, stockStatus, allocateBatches, reorderPoint, reorderSuggestions, valuation, ageing, deadStock, forecast, allocate, eoq, STOCK_STATUS }
