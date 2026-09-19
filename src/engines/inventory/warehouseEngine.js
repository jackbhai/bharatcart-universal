/**
 * Multi-warehouse stock, reorder planning and ABC analysis.
 *
 * The existing inventory engine looked at a single total stock number per
 * product. Real fulfilment asks harder questions: which warehouse ships this
 * pincode, what do I reorder this week, and which 20% of SKUs earn 80% of the
 * revenue.
 */
import { PRODUCTS, ORDERS, NOW } from '../../data/seed.js'
import { WAREHOUSES, STOCK_BY_WAREHOUSE, STOCK_MOVEMENTS, PRODUCT_VENDOR } from '../../data/vendorSeed.js'
import { VENDOR_BY_ID } from '../../data/vendorSeed.js'

const DAY = 86400000

/** Units sold per product over a window — the basis of every forecast below. */
export function velocityByProduct(orders = ORDERS, { days = 365, now = NOW } = {}) {
  const safeDays = days > 0 ? days : 0
  const since = now - safeDays * DAY
  const map = new Map()
  for (const o of orders) {
    if (o.placedAt < since || o.status === 'Cancelled') continue
    for (const it of o.items) {
      const cur = map.get(it.productId) || { productId: it.productId, units: 0, revenue: 0, orders: 0 }
      cur.units += it.qty
      cur.revenue += it.qty * it.price
      cur.orders += 1
      map.set(it.productId, cur)
    }
  }
  for (const v of map.values()) v.perDay = safeDays > 0 ? Number((v.units / safeDays).toFixed(3)) : 0
  return map
}

/** Stock position per product, joined with velocity and vendor lead time. */
// A 365-day window is the default: this catalogue is handloom and seasonal, and
// a 60-day window left two-thirds of SKUs reading as zero-demand dead stock
// purely because nobody bought a Banarasi sari that particular month.
export function stockPositions(products = PRODUCTS, { days = 365, now = NOW } = {}) {
  const velocity = velocityByProduct(ORDERS, { days, now })
  return products.map(p => {
    const v = velocity.get(p.id) || { units: 0, revenue: 0, perDay: 0 }
    const vendor = VENDOR_BY_ID[PRODUCT_VENDOR[p.id]]
    const leadDays = vendor?.leadDays ?? 14
    // Days of cover is the number that actually drives a buying decision.
    const coverDays = v.perDay > 0 ? Math.round(p.stock / v.perDay) : (p.stock > 0 ? 999 : 0)
    // Safety stock covers demand variability during the lead time; half the
    // lead-time demand is a standard rule of thumb for stable products.
    const safetyStock = Math.ceil(v.perDay * leadDays * 0.5)
    const reorderPoint = Math.ceil(v.perDay * leadDays + safetyStock)
    const needsReorder = p.stock <= reorderPoint && v.perDay > 0
    return {
      productId: p.id,
      name: p.name,
      category: p.category,
      sku: p.variants?.[0]?.sku ?? p.id,
      price: p.price,
      stock: p.stock,
      byWarehouse: STOCK_BY_WAREHOUSE[p.id] ?? {},
      unitsSold: v.units,
      revenue: v.revenue,
      perDay: v.perDay,
      coverDays,
      leadDays,
      safetyStock,
      reorderPoint,
      needsReorder,
      // Order up to lead-time demand plus safety, rounded to a sane pack size.
      suggestedQty: needsReorder ? Math.max(5, Math.ceil((reorderPoint * 2 - p.stock) / 5) * 5) : 0,
      vendorId: vendor?.id ?? null,
      vendorName: vendor?.name ?? 'Unassigned',
      stockValue: p.stock * Math.round(p.price * 0.6),
      status: p.stock === 0 ? 'Out of stock'
        : coverDays <= 7 ? 'Critical'
        : coverDays <= 21 ? 'Low'
        : coverDays > 180 ? 'Overstocked' : 'Healthy',
    }
  })
}

/** Inventory KPIs. */
export function inventoryKpis(positions = stockPositions()) {
  const value = positions.reduce((n, p) => n + p.stockValue, 0)
  const sold = positions.reduce((n, p) => n + p.revenue, 0)
  return {
    skus: positions.length,
    units: positions.reduce((n, p) => n + p.stock, 0),
    stockValue: value,
    outOfStock: positions.filter(p => p.status === 'Out of stock').length,
    critical: positions.filter(p => p.status === 'Critical').length,
    low: positions.filter(p => p.status === 'Low').length,
    overstocked: positions.filter(p => p.status === 'Overstocked').length,
    needsReorder: positions.filter(p => p.needsReorder).length,
    reorderValue: positions.filter(p => p.needsReorder)
      .reduce((n, p) => n + p.suggestedQty * Math.round(p.price * 0.6), 0),
    deadStock: positions.filter(p => p.unitsSold === 0 && p.stock > 0).length,
    deadStockValue: positions.filter(p => p.unitsSold === 0 && p.stock > 0)
      .reduce((n, p) => n + p.stockValue, 0),
    // Turnover: how many times the held stock sells through in a year.
    turnover: value > 0 ? Number((sold / value).toFixed(2)) : 0,
  }
}

/**
 * ABC classification by revenue contribution.
 * A = top 80% of revenue, B = next 15%, C = the long tail. Tells you where to
 * spend counting time and working capital.
 */
export function abcAnalysis(positions = stockPositions()) {
  const sorted = [...positions].sort((a, b) => b.revenue - a.revenue)
  const total = sorted.reduce((n, p) => n + p.revenue, 0) || 1
  let running = 0
  return sorted.map(p => {
    running += p.revenue
    const cumulative = (running / total) * 100
    return {
      ...p,
      revenueShare: Number(((p.revenue / total) * 100).toFixed(2)),
      cumulativeShare: Number(cumulative.toFixed(2)),
      abc: cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C',
    }
  })
}

/** Summary counts per ABC class. */
export function abcSummary(rows = abcAnalysis()) {
  return ['A', 'B', 'C'].map(cls => {
    const mine = rows.filter(r => r.abc === cls)
    return {
      abc: cls,
      skus: mine.length,
      skuShare: rows.length ? Math.round((mine.length / rows.length) * 100) : 0,
      revenue: mine.reduce((n, r) => n + r.revenue, 0),
      stockValue: mine.reduce((n, r) => n + r.stockValue, 0),
    }
  })
}

/** Everything that needs buying, most urgent first. */
export function reorderPlan(positions = stockPositions()) {
  return positions
    .filter(p => p.needsReorder || p.status === 'Out of stock')
    .map(p => ({
      ...p,
      unitCost: Math.round(p.price * 0.6),
      orderValue: (p.suggestedQty || 10) * Math.round(p.price * 0.6),
      urgency: p.status === 'Out of stock' ? 'Now' : p.coverDays <= 7 ? 'This week' : 'This month',
    }))
    .sort((a, b) => a.coverDays - b.coverDays)
}

/** Group a reorder plan by vendor so each becomes one purchase order. */
export function reorderByVendor(plan = reorderPlan()) {
  const map = new Map()
  for (const row of plan) {
    const key = row.vendorId ?? 'none'
    const cur = map.get(key) || { vendorId: row.vendorId, vendorName: row.vendorName, lines: [], value: 0, units: 0 }
    cur.lines.push(row)
    cur.value += row.orderValue
    cur.units += row.suggestedQty || 10
    map.set(key, cur)
  }
  return [...map.values()].map(v => {
    const vendor = VENDOR_BY_ID[v.vendorId]
    return {
      ...v,
      leadDays: vendor?.leadDays ?? 14,
      minOrderValue: vendor?.minOrderValue ?? 0,
      meetsMinimum: v.value >= (vendor?.minOrderValue ?? 0),
    }
  }).sort((a, b) => b.value - a.value)
}

/** Per-warehouse rollup: utilisation, value and SKU spread. */
export function warehouseSummary(positions = stockPositions()) {
  return WAREHOUSES.map(w => {
    let units = 0, value = 0, skus = 0, outOf = 0
    for (const p of positions) {
      const qty = p.byWarehouse?.[w.id] ?? 0
      if (qty > 0) { skus += 1; units += qty; value += qty * Math.round(p.price * 0.6) }
      else outOf += 1
    }
    return {
      ...w,
      units,
      value,
      skus,
      emptySkus: outOf,
      utilisation: w.capacity ? Math.min(100, Math.round((units / w.capacity) * 100)) : 0,
      unitsPerStaff: w.staff ? Math.round(units / w.staff) : 0,
    }
  })
}

/**
 * Suggest stock transfers: one warehouse is empty on a SKU while another is
 * sitting on a pile of it. Moving stock is cheaper and faster than buying more.
 */
export function transferSuggestions(positions = stockPositions(), { limit = 25 } = {}) {
  const out = []
  for (const p of positions) {
    if (p.perDay <= 0) continue
    const entries = Object.entries(p.byWarehouse)
    if (entries.length < 2) continue
    const sorted = entries.sort((a, b) => b[1] - a[1])
    const [richId, richQty] = sorted[0]
    const [poorId, poorQty] = sorted[sorted.length - 1]
    // Only worth a van if the surplus is meaningful and the gap is real.
    if (poorQty === 0 && richQty >= 4) {
      out.push({
        productId: p.productId, name: p.name, sku: p.sku,
        fromId: richId, from: WAREHOUSES.find(w => w.id === richId)?.name ?? richId,
        toId: poorId, to: WAREHOUSES.find(w => w.id === poorId)?.name ?? poorId,
        qty: Math.max(1, Math.floor(richQty / 3)),
        reason: 'Zero stock at destination while source holds ' + richQty,
        priority: p.perDay > 0.5 ? 'High' : 'Normal',
      })
    }
  }
  return out.sort((a, b) => (a.priority === 'High' ? -1 : 1) - (b.priority === 'High' ? -1 : 1)).slice(0, limit)
}

/** Stock that is not moving and is tying up cash. */
export function deadStock(positions = stockPositions(), { minValue = 0 } = {}) {
  return positions
    .filter(p => p.unitsSold === 0 && p.stock > 0 && p.stockValue >= minValue)
    .map(p => ({
      ...p,
      suggestion: p.stockValue > 50000 ? 'Deep discount or bundle' : 'Add to a clearance promotion',
    }))
    .sort((a, b) => b.stockValue - a.stockValue)
}

/** Recent stock movements, newest first, optionally filtered. */
export function movements({ warehouseId, productId, type, limit = 100 } = {}) {
  return STOCK_MOVEMENTS
    .filter(m => (!warehouseId || m.warehouseId === warehouseId)
      && (!productId || m.productId === productId)
      && (!type || m.type === type))
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
}

/** Which warehouse should ship an order to a state — nearest with stock wins. */
const STATE_TO_WAREHOUSE = {
  Delhi: 'WH1', Haryana: 'WH1', Punjab: 'WH1', 'Uttar Pradesh': 'WH1', Rajasthan: 'WH1', 'Himachal Pradesh': 'WH1',
  Maharashtra: 'WH2', Gujarat: 'WH2', Goa: 'WH2', 'Madhya Pradesh': 'WH2',
  Karnataka: 'WH3', 'Tamil Nadu': 'WH3', Kerala: 'WH3', Telangana: 'WH3', 'Andhra Pradesh': 'WH3',
  'West Bengal': 'WH4', Odisha: 'WH4', Bihar: 'WH4', Jharkhand: 'WH4',
  Assam: 'WH5',
}

export function routeOrder(state, productId, qty = 1) {
  // No warehouses configured yet (clean install) — return an empty-safe
  // shortage result instead of routing to a nonexistent warehouse.
  if (!WAREHOUSES.length) {
    const emptyStock = STOCK_BY_WAREHOUSE[productId] ?? {}
    const available = Object.values(emptyStock).reduce((a, b) => a + b, 0)
    return { ok: false, reason: 'No warehouses configured', available, allocations: [] }
  }
  const preferred = STATE_TO_WAREHOUSE[state] ?? 'WH1'
  const stock = STOCK_BY_WAREHOUSE[productId] ?? {}
  if ((stock[preferred] ?? 0) >= qty) {
    return { ok: true, warehouseId: preferred, name: WAREHOUSES.find(w => w.id === preferred)?.name, split: false, reason: 'Nearest warehouse has stock' }
  }
  // Fall back to any single warehouse that can fill the whole line.
  const fallback = WAREHOUSES.find(w => (stock[w.id] ?? 0) >= qty)
  if (fallback) {
    return { ok: true, warehouseId: fallback.id, name: fallback.name, split: false, reason: 'Nearest warehouse short; shipping from ' + fallback.name }
  }
  // Otherwise split the shipment, which costs more but beats cancelling.
  const total = Object.values(stock).reduce((a, b) => a + b, 0)
  if (total >= qty) {
    const parts = []
    let left = qty
    for (const w of WAREHOUSES) {
      const take = Math.min(left, stock[w.id] ?? 0)
      if (take > 0) { parts.push({ warehouseId: w.id, name: w.name, qty: take }); left -= take }
      if (left === 0) break
    }
    return { ok: true, split: true, parts, reason: 'Split across ' + parts.length + ' warehouses' }
  }
  return { ok: false, reason: 'Insufficient stock across all warehouses', available: total }
}

export default inventoryKpis
