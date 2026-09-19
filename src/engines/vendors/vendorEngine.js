/**
 * Vendor and purchase-order analytics.
 *
 * The catalogue told you what you sell. This tells you who supplies it, whether
 * they deliver on time, and what you owe them — the half of a real back office
 * that was missing.
 */
import { VENDORS, VENDOR_BY_ID, PURCHASE_ORDERS, PRODUCT_VENDOR } from '../../data/vendorSeed.js'

const DAY = 86400000

/** Headline vendor metrics for the module's KPI row. */
export function vendorKpis(vendors = VENDORS, orders = PURCHASE_ORDERS) {
  const active = vendors.filter(v => v.status === 'Active')
  const open = orders.filter(o => !['Received', 'Cancelled'].includes(o.status))
  const openValue = open.reduce((n, o) => n + o.total, 0)
  const unpaid = orders.filter(o => o.status === 'Received' && !o.paid)
  return {
    total: vendors.length,
    active: active.length,
    onHold: vendors.filter(v => v.status === 'On hold').length,
    onboarding: vendors.filter(v => v.status === 'Onboarding').length,
    avgScore: Math.round(vendors.reduce((n, v) => n + v.score, 0) / (vendors.length || 1)),
    avgLeadDays: Math.round(vendors.reduce((n, v) => n + v.leadDays, 0) / (vendors.length || 1)),
    openPos: open.length,
    openValue,
    payable: unpaid.reduce((n, o) => n + o.total, 0),
    payableCount: unpaid.length,
  }
}

/**
 * Rank vendors on a blended score.
 * Punctuality alone rewards a supplier who ships fast but ships defects, so
 * quality carries the heavier weight.
 */
export function vendorScorecard(vendors = VENDORS, orders = PURCHASE_ORDERS) {
  return vendors.map(v => {
    const mine = orders.filter(o => o.vendorId === v.id)
    const received = mine.filter(o => o.status === 'Received')
    const late = received.filter(o => o.receivedAt && o.receivedAt > o.expectedAt)
    const spend = mine.reduce((n, o) => n + o.total, 0)
    const fillRates = mine.flatMap(o => o.items.map(it => (it.qty ? it.received / it.qty : 1)))
    const fillRate = fillRates.length
      ? Math.round((fillRates.reduce((a, b) => a + b, 0) / fillRates.length) * 100)
      : 100
    return {
      ...v,
      poCount: mine.length,
      spend,
      receivedCount: received.length,
      lateCount: late.length,
      latePct: received.length ? Math.round((late.length / received.length) * 100) : 0,
      fillRate,
      // Blend: quality 40, punctuality 35, fill rate 25.
      blendedScore: Math.round(v.qualityPct * 0.4 + v.onTimePct * 0.35 + fillRate * 0.25),
    }
  }).sort((a, b) => b.blendedScore - a.blendedScore)
}

/** Purchase orders grouped by status, for the pipeline view. */
export function poPipeline(orders = PURCHASE_ORDERS) {
  const out = {}
  for (const o of orders) {
    if (!out[o.status]) out[o.status] = { status: o.status, count: 0, value: 0, orders: [] }
    out[o.status].count += 1
    out[o.status].value += o.total
    out[o.status].orders.push(o)
  }
  return Object.values(out)
}

/**
 * Purchase orders that have slipped past their expected date and are still not
 * fully received. These are the ones that cause stockouts.
 */
export function overduePos(orders = PURCHASE_ORDERS, now = Date.now()) {
  return orders
    .filter(o => !['Received', 'Cancelled'].includes(o.status) && o.expectedAt < now)
    .map(o => ({
      ...o,
      // Ceiling, not round: an order that passed its date six hours ago is one
      // day late, not "0d late", which reads as a rendering bug on screen.
      daysLate: Math.max(1, Math.ceil((now - o.expectedAt) / DAY)),
      outstandingQty: o.items.reduce((n, it) => n + Math.max(0, it.qty - it.received), 0),
      outstandingValue: o.items.reduce((n, it) => n + Math.max(0, it.qty - it.received) * it.unitCost, 0),
    }))
    .sort((a, b) => b.daysLate - a.daysLate)
}

/** What we owe, bucketed by how overdue it is. */
export function payablesAgeing(orders = PURCHASE_ORDERS, now = Date.now()) {
  const termDays = { 'Net 15': 15, 'Net 30': 30, 'Net 45': 45, 'Advance 50%': 0, 'On delivery': 0 }
  const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 }
  const rows = []
  for (const o of orders) {
    if (o.status !== 'Received' || o.paid) continue
    const due = (o.receivedAt ?? o.raisedAt) + (termDays[o.terms] ?? 30) * DAY
    const overdue = Math.max(0, Math.round((now - due) / DAY))
    const bucket = overdue === 0 ? 'current'
      : overdue <= 30 ? 'd1_30'
      : overdue <= 60 ? 'd31_60'
      : overdue <= 90 ? 'd61_90' : 'd90plus'
    buckets[bucket] += o.total
    rows.push({ ...o, dueAt: due, overdueDays: overdue, bucket })
  }
  return { buckets, rows: rows.sort((a, b) => b.overdueDays - a.overdueDays), total: Object.values(buckets).reduce((a, b) => a + b, 0) }
}

/** Spend per vendor over a window, for the concentration chart. */
export function spendByVendor(orders = PURCHASE_ORDERS, { days = 180, now = Date.now() } = {}) {
  const since = now - days * DAY
  const out = new Map()
  for (const o of orders) {
    if (o.raisedAt < since || o.status === 'Cancelled') continue
    const cur = out.get(o.vendorId) || { vendorId: o.vendorId, name: o.vendorName, spend: 0, orders: 0 }
    cur.spend += o.total
    cur.orders += 1
    out.set(o.vendorId, cur)
  }
  const rows = [...out.values()].sort((a, b) => b.spend - a.spend)
  const total = rows.reduce((n, r) => n + r.spend, 0) || 1
  return rows.map(r => ({ ...r, share: Math.round((r.spend / total) * 100) }))
}

/**
 * Supplier concentration risk: how much of spend sits with the top vendors.
 * Above ~40% with one supplier is a single point of failure worth flagging.
 */
export function concentrationRisk(orders = PURCHASE_ORDERS) {
  const rows = spendByVendor(orders, { days: 3650 })
  const top1 = rows[0]?.share ?? 0
  const top3 = rows.slice(0, 3).reduce((n, r) => n + r.share, 0)
  return {
    top1, top3,
    topVendor: rows[0]?.name ?? '—',
    level: top1 >= 40 ? 'high' : top1 >= 25 ? 'medium' : 'low',
    note: top1 >= 40
      ? `${rows[0]?.name} carries ${top1}% of spend — a stoppage there stops the catalogue.`
      : top1 >= 25
        ? `${rows[0]?.name} carries ${top1}% of spend. Worth a second source.`
        : 'Spend is well spread across suppliers.',
  }
}

/** Which vendor supplies a product. */
export function vendorForProduct(productId) {
  const id = PRODUCT_VENDOR[productId]
  return id ? VENDOR_BY_ID[id] : null
}

/** Build a draft purchase order from reorder suggestions. */
export function draftPoFromSuggestions(suggestions = [], { vendorId } = {}) {
  const vendor = VENDOR_BY_ID[vendorId] || VENDORS[0]
  // No vendors exist yet (clean install) — return an empty-safe draft instead of
  // throwing on the missing vendor.
  if (!vendor) {
    return {
      ok: false, reason: 'No vendors configured',
      vendorId: null, vendorName: '', vendor, items: [],
      subtotal: 0, tax: 0, total: 0, terms: 'Net 30', leadDays: 3, minOrder: 0,
    }
  }
  const items = suggestions.map(s => ({
    productId: s.productId ?? s.id,
    name: s.name,
    sku: s.sku ?? s.productId ?? s.id,
    qty: s.suggestedQty ?? s.qty ?? 10,
    unitCost: s.unitCost ?? Math.round((s.price ?? 1000) * 0.6),
    gst: s.gst ?? 5,
    received: 0,
  })).map(it => ({ ...it, lineTotal: it.qty * it.unitCost }))

  const subtotal = items.reduce((n, it) => n + it.lineTotal, 0)
  const tax = Math.round(items.reduce((n, it) => n + it.lineTotal * (it.gst / 100), 0))
  return {
    id: 'PO-DRAFT',
    vendorId: vendor.id,
    vendorName: vendor.name,
    status: 'Draft',
    items,
    subtotal,
    tax,
    total: subtotal + tax,
    raisedAt: Date.now(),
    expectedAt: Date.now() + vendor.leadDays * DAY,
    terms: vendor.terms,
    paid: false,
    meetsMinimum: subtotal >= vendor.minOrderValue,
    minOrderValue: vendor.minOrderValue,
  }
}

export default vendorKpis
