import { CUSTOMERS, ORDERS, PRODUCTS, CARTS, TICKETS, NOW } from '../data/seed.js'
import { formatMoney, formatNumber } from '../currency/format.js'
import { getActiveCurrency, getActiveOverrides, getActiveLocale } from '../currency/active.js'

const DAY = 86400000

/**
 * Money formatters.
 *
 * These are still named `inr`/`inrShort` because ~295 call sites across the
 * admin and storefront import them under those names, and the amounts they
 * receive really are in INR — that is the base currency every engine computes
 * in. What changed in Part 6 is the *output*: they now convert to whatever
 * currency the viewer has selected before formatting.
 *
 * Reading the active currency from a module singleton rather than an argument
 * keeps all those call sites untouched, so switching currency is a single state
 * change instead of a 28-file refactor.
 */
export const inr = (n) =>
  formatMoney(n || 0, getActiveCurrency(), { rates: getActiveOverrides() })

export const inrShort = (n) =>
  formatMoney(n || 0, getActiveCurrency(), { rates: getActiveOverrides(), compact: true })

export const num = (n) => formatNumber(n || 0, getActiveLocale())
export const pct = (n) => (n > 0 ? '+' : '') + (n || 0).toFixed(1) + '%'
export const dt = (ts) => new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
export const dtShort = (ts) => new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
export const ago = (ts) => {
  const d = Math.round((NOW - ts) / DAY)
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return d + 'd ago'
  if (d < 365) return Math.round(d / 30) + 'mo ago'
  return (d / 365).toFixed(1) + 'y ago'
}

const valid = (o) => !['Cancelled', 'RTO', 'Returned'].includes(o.status)
export const VALID_ORDERS = ORDERS.filter(valid)

export function rangeOrders(days) {
  const from = NOW - days * DAY
  return VALID_ORDERS.filter(o => o.placedAt >= from)
}

export function kpis(days = 30) {
  const cur = rangeOrders(days)
  const prevFrom = NOW - days * 2 * DAY, prevTo = NOW - days * DAY
  const prev = VALID_ORDERS.filter(o => o.placedAt >= prevFrom && o.placedAt < prevTo)
  const rev = cur.reduce((s, o) => s + o.total, 0)
  const prevRev = prev.reduce((s, o) => s + o.total, 0)
  const aov = cur.length ? rev / cur.length : 0
  const prevAov = prev.length ? prevRev / prev.length : 0
  const units = cur.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0)
  const from = NOW - days * DAY
  const allInRange = ORDERS.filter(o => o.placedAt >= from)
  const rto = allInRange.filter(o => o.status === 'RTO').length
  const ret = allInRange.filter(o => o.status === 'Returned').length
  const codOrders = cur.filter(o => o.paymentMethod === 'COD').length
  const newCust = CUSTOMERS.filter(c => c.firstOrderAt >= from).length
  const repeat = cur.filter(o => {
    const c = CUSTOMERS.find(x => x.id === o.customerId)
    return c && o.placedAt > c.firstOrderAt
  }).length
  const g = (a, b) => (b ? ((a - b) / b) * 100 : 0)
  return {
    revenue: rev, revenueGrowth: g(rev, prevRev),
    orders: cur.length, ordersGrowth: g(cur.length, prev.length),
    aov, aovGrowth: g(aov, prevAov),
    units, customers: new Set(cur.map(o => o.customerId)).size,
    newCustomers: newCust,
    repeatRate: cur.length ? (repeat / cur.length) * 100 : 0,
    rtoRate: allInRange.length ? (rto / allInRange.length) * 100 : 0,
    returnRate: allInRange.length ? (ret / allInRange.length) * 100 : 0,
    codShare: cur.length ? (codOrders / cur.length) * 100 : 0,
    grossMargin: rev * 0.42,
    gstCollected: cur.reduce((s, o) => s + o.gst, 0),
    shippingCost: cur.reduce((s, o) => s + (o.shipping || 0), 0),
    discountGiven: cur.reduce((s, o) => s + o.discount, 0),
  }
}

export function revenueSeries(days = 30) {
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    const from = NOW - (i + 1) * DAY, to = NOW - i * DAY
    const os = VALID_ORDERS.filter(o => o.placedAt >= from && o.placedAt < to)
    out.push({
      label: dtShort(to),
      revenue: os.reduce((s, o) => s + o.total, 0),
      orders: os.length,
    })
  }
  return out
}

export function groupSum(items, keyFn, valFn = () => 1) {
  const m = new Map()
  for (const it of items) {
    const k = keyFn(it)
    if (k == null) continue
    m.set(k, (m.get(k) || 0) + valFn(it))
  }
  return [...m.entries()].map(([k, v]) => ({ key: k, value: v })).sort((a, b) => b.value - a.value)
}

export const segmentBreakdown = () => groupSum(CUSTOMERS, c => c.segment)
export const stateBreakdown = () => groupSum(VALID_ORDERS, o => {
  const c = CUSTOMERS.find(x => x.id === o.customerId); return c?.state
}, o => o.total)
export const paymentBreakdown = () => groupSum(VALID_ORDERS, o => o.paymentMethod, o => o.total)
export const channelBreakdown = () => groupSum(CUSTOMERS, c => c.channel)
export const categoryBreakdown = () => {
  const m = new Map()
  for (const o of VALID_ORDERS) for (const it of o.items)
    m.set(it.category, (m.get(it.category) || 0) + it.price * it.qty)
  return [...m.entries()].map(([k, v]) => ({ key: k, value: v })).sort((a, b) => b.value - a.value)
}
export const tierBreakdown = () => groupSum(CUSTOMERS, c => 'Tier ' + c.cityTier)
export const deviceBreakdown = () => groupSum(CUSTOMERS, c => c.device)
export const languageBreakdown = () => groupSum(CUSTOMERS, c => c.language)

export function productPerf() {
  const m = new Map()
  for (const o of VALID_ORDERS) for (const it of o.items) {
    const cur = m.get(it.productId) || { units: 0, revenue: 0 }
    cur.units += it.qty; cur.revenue += it.price * it.qty
    m.set(it.productId, cur)
  }
  return PRODUCTS.map(p => ({ ...p, ...(m.get(p.id) || { units: 0, revenue: 0 }) }))
    .sort((a, b) => b.revenue - a.revenue)
}

export function cohorts() {
  // monthly acquisition cohorts, retention by month offset
  const cohortMap = new Map()
  for (const c of CUSTOMERS) {
    if (!c.orders) continue
    const d = new Date(c.firstOrderAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!cohortMap.has(key)) cohortMap.set(key, [])
    cohortMap.get(key).push(c)
  }
  const keys = [...cohortMap.keys()].sort().slice(-8)
  return keys.map(k => {
    const members = cohortMap.get(k)
    const start = new Date(k + '-01').getTime()
    const cells = []
    for (let m = 0; m < 6; m++) {
      const from = start + m * 30 * DAY, to = start + (m + 1) * 30 * DAY
      const active = members.filter(c =>
        ORDERS.some(o => o.customerId === c.id && o.placedAt >= from && o.placedAt < to)
      ).length
      cells.push(members.length ? Math.round((active / members.length) * 100) : 0)
    }
    return { cohort: k, size: members.length, cells }
  })
}

export function rfmGrid() {
  const grid = {}
  for (const c of CUSTOMERS) {
    const k = `${c.R}-${c.F}`
    grid[k] = (grid[k] || 0) + 1
  }
  return grid
}

export const atRisk = () => CUSTOMERS.filter(c => c.churnRisk > 60 && c.orders > 0)
  .sort((a, b) => b.clv - a.clv)
export const topCustomers = (n = 10) => [...CUSTOMERS].sort((a, b) => b.spend - a.spend).slice(0, n)
export const lowStock = () => PRODUCTS.filter(p => p.stock < 15 && p.status === 'active')
  .sort((a, b) => a.stock - b.stock)
export const abandonedValue = () => CARTS.filter(c => !c.recovered).reduce((s, c) => s + c.value, 0)
export const openTickets = () => TICKETS.filter(t => ['Open', 'Escalated', 'Pending customer'].includes(t.status))

export function customerTimeline(customerId) {
  const os = ORDERS.filter(o => o.customerId === customerId)
    .map(o => ({ kind: 'order', at: o.placedAt, data: o }))
  const ts = TICKETS.filter(t => t.customerId === customerId)
    .map(t => ({ kind: 'ticket', at: t.createdAt, data: t }))
  const cs = CARTS.filter(c => c.customerId === customerId)
    .map(c => ({ kind: 'cart', at: c.updatedAt, data: c }))
  const c = CUSTOMERS.find(x => x.id === customerId)
  const join = c ? [{ kind: 'signup', at: c.joinedAt, data: c }] : []
  return [...os, ...ts, ...cs, ...join].sort((a, b) => b.at - a.at)
}

export function nextBestAction(c) {
  const acts = []
  if (c.churnRisk > 70) acts.push({ t: 'Win-back campaign', d: `${c.recencyDays}d since last order. Send 15% WhatsApp offer.`, tone: 'red' })
  if (c.segment === 'Champion') acts.push({ t: 'Early access invite', d: 'Top 10% spender — invite to festive pre-sale.', tone: 'green' })
  if (c.codShare > 70) acts.push({ t: 'Nudge to prepaid', d: 'Offer ₹50 off on UPI to cut RTO exposure.', tone: 'amber' })
  if (c.discountDependency > 70) acts.push({ t: 'Reduce discount reliance', d: 'Test full-price bundle with free shipping.', tone: 'amber' })
  if (c.affinity[0]) acts.push({ t: `Cross-sell: ${c.affinity[0].cat}`, d: `${c.affinity[0].pct}% of spend here — recommend complementary SKUs.`, tone: 'blue' })
  if (c.referrals === 0 && c.orders >= 3) acts.push({ t: 'Referral ask', d: 'Loyal but never referred. Trigger referral flow.', tone: 'blue' })
  if (!c.waOptIn) acts.push({ t: 'Get WhatsApp consent', d: 'Highest-ROI channel in India, currently opted out.', tone: 'gray' })
  return acts.slice(0, 4)
}

export const ALERTS = () => {
  const a = []
  const ls = lowStock()
  if (ls.length) a.push({ sev: 'warn', t: `${ls.length} SKUs low on stock`, d: `${ls[0].name} has ${ls[0].stock} left` })
  const ar = atRisk()
  if (ar.length) a.push({ sev: 'high', t: `${ar.length} high-value customers at churn risk`, d: `${inrShort(ar.reduce((s, c) => s + c.clv, 0))} CLV exposed` })
  const k = kpis(30)
  if (k.rtoRate > 6) a.push({ sev: 'high', t: `RTO rate at ${k.rtoRate.toFixed(1)}%`, d: 'Above 6% threshold — review COD pincodes' })
  const av = abandonedValue()
  if (av > 0) a.push({ sev: 'warn', t: `${inrShort(av)} in abandoned carts`, d: `${CARTS.filter(c => !c.recovered).length} carts recoverable` })
  const ot = openTickets()
  if (ot.length) a.push({ sev: 'info', t: `${ot.length} open support tickets`, d: `${ot.filter(t => t.priority === 'Urgent').length} marked urgent` })
  return a
}
