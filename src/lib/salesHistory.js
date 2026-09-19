import { ORDERS } from '../data/seed.js'

const DAY = 86400000

/**
 * Daily units-sold series per product, oldest → newest.
 * The inventory engine expects `{ [productId]: number[] }`, one entry per day.
 */
export function buildSalesHistory(days = 90, now = Date.now()) {
  // Guard against invalid windows: new Array(nonpositive) throws.
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 0
  const start = now - safeDays * DAY
  const out = {}
  for (const o of ORDERS) {
    if (o.placedAt < start) continue
    if (['Cancelled', 'RTO', 'Returned'].includes(o.status)) continue
    const day = Math.floor((o.placedAt - start) / DAY)
    if (day < 0 || day >= safeDays) continue
    for (const it of o.items) {
      const arr = out[it.productId] || (out[it.productId] = new Array(safeDays).fill(0))
      arr[day] += it.qty
    }
  }
  return out
}

/** Orders reduced to the `{ items: [{ productId, qty }] }` shape reco engine wants. */
export function recentOrders(days = 60, now = Date.now()) {
  const start = now - days * DAY
  return ORDERS.filter(o => o.placedAt >= start)
}

let _cache = null
export function salesHistory() {
  return _cache || (_cache = buildSalesHistory(90))
}

let _orders = null
export function ordersForReco() {
  return _orders || (_orders = recentOrders(60))
}
