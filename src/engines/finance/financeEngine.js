/**
 * Finance engine — P&L, GST filing, settlements and cash flow.
 *
 * Everything derives from the order book rather than a separate ledger, so the
 * numbers on this screen can always be traced back to real orders. GST here
 * follows the Indian filing shape (GSTR-1 style B2B/B2C split by rate and
 * place of supply) because that is what an accountant actually needs.
 */

const DAY = 86400000

const isRealised = (o) => !['Cancelled'].includes(o.status)
const isLost = (o) => ['RTO', 'Returned'].includes(o.status)

/* ------------------------------------------------------------------ P&L */

/**
 * Full profit & loss for a period. Returns both the headline numbers and the
 * line-by-line breakdown, so the UI can render a waterfall without recomputing.
 */
export function profitAndLoss(orders = [], returns = [], opts = {}) {
  const {
    cogsRate = 0.58,
    marketingSpend = null,      // null → estimate from revenue
    fixedCosts = 0,
    from = 0,
    to = Date.now(),
  } = opts

  const window = orders.filter(o => o.placedAt >= from && o.placedAt <= to)
  const live = window.filter(isRealised)

  let grossRevenue = 0, gstCollected = 0, discounts = 0, shippingCharged = 0, codFees = 0
  let cogs = 0, paymentFees = 0, shippingCost = 0, packaging = 0, reverseLogistics = 0
  let lostRevenue = 0, recoveredStock = 0
  let units = 0

  for (const o of live) {
    const lost = isLost(o)
    grossRevenue += o.total ?? 0
    gstCollected += o.gst ?? 0
    discounts += o.discount ?? 0
    shippingCharged += o.shipping ?? 0
    codFees += o.codFee ?? 0

    const orderCogs = (o.items || []).reduce((s, i) => s + (i.cost ?? i.price * cogsRate) * (i.qty ?? 1), 0)
    units += (o.items || []).reduce((s, i) => s + (i.qty ?? 1), 0)

    const fee = (o.total ?? 0) * (o.paymentMethod === 'COD' ? 0.02 : 0.021)
    const ship = Math.max(45, (o.shipping ?? 0) * 1.4 || 62)

    paymentFees += fee
    shippingCost += ship
    packaging += 18 + (o.giftWrap ? 35 : 0)

    if (lost) {
      // The sale never lands, but the stock comes back and we eat both legs.
      lostRevenue += (o.total ?? 0) - (o.gst ?? 0)
      reverseLogistics += ship
      recoveredStock += orderCogs
    }
    cogs += orderCogs
  }

  const refunds = returns.reduce((s, r) => s + (r.refundAmount ?? 0), 0)

  const netRevenue = grossRevenue - gstCollected - lostRevenue - refunds
  const effectiveCogs = cogs - recoveredStock
  const grossProfit = netRevenue - effectiveCogs

  const marketing = marketingSpend ?? Math.round(grossRevenue * 0.11)
  const opex = paymentFees + shippingCost + packaging + reverseLogistics + marketing + fixedCosts
  const netProfit = grossProfit - opex

  const lines = [
    { label: 'Gross revenue', value: Math.round(grossRevenue), type: 'income' },
    { label: 'GST collected (pass-through)', value: -Math.round(gstCollected), type: 'deduction' },
    { label: 'RTO / returned orders', value: -Math.round(lostRevenue), type: 'deduction' },
    { label: 'Refunds paid', value: -Math.round(refunds), type: 'deduction' },
    { label: 'Net revenue', value: Math.round(netRevenue), type: 'subtotal' },
    { label: 'Cost of goods sold', value: -Math.round(effectiveCogs), type: 'cost' },
    { label: 'Gross profit', value: Math.round(grossProfit), type: 'subtotal' },
    { label: 'Payment gateway fees', value: -Math.round(paymentFees), type: 'cost' },
    { label: 'Shipping cost', value: -Math.round(shippingCost), type: 'cost' },
    { label: 'Reverse logistics', value: -Math.round(reverseLogistics), type: 'cost' },
    { label: 'Packaging', value: -Math.round(packaging), type: 'cost' },
    { label: 'Marketing', value: -Math.round(marketing), type: 'cost' },
    ...(fixedCosts ? [{ label: 'Fixed costs', value: -Math.round(fixedCosts), type: 'cost' }] : []),
    { label: 'Net profit', value: Math.round(netProfit), type: 'total' },
  ]

  return {
    orderCount: live.length,
    units,
    grossRevenue: Math.round(grossRevenue),
    gstCollected: Math.round(gstCollected),
    discounts: Math.round(discounts),
    shippingCharged: Math.round(shippingCharged),
    codFees: Math.round(codFees),
    lostRevenue: Math.round(lostRevenue),
    refunds: Math.round(refunds),
    netRevenue: Math.round(netRevenue),
    cogs: Math.round(effectiveCogs),
    grossProfit: Math.round(grossProfit),
    grossMarginPct: netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 100) : 0,
    paymentFees: Math.round(paymentFees),
    shippingCost: Math.round(shippingCost),
    reverseLogistics: Math.round(reverseLogistics),
    packaging: Math.round(packaging),
    marketing: Math.round(marketing),
    fixedCosts: Math.round(fixedCosts),
    opex: Math.round(opex),
    netProfit: Math.round(netProfit),
    netMarginPct: netRevenue > 0 ? Math.round((netProfit / netRevenue) * 100) : 0,
    aov: live.length ? Math.round(grossRevenue / live.length) : 0,
    contributionPerOrder: live.length ? Math.round(netProfit / live.length) : 0,
    lines,
    profitable: netProfit > 0,
  }
}

/** Month-by-month P&L series for trend charts. */
export function monthlyPnL(orders = [], returns = [], months = 12, opts = {}) {
  const now = opts.now ?? Date.now()
  const out = []
  const retByMonth = {}
  for (const r of returns) {
    const d = new Date(r.requestedAt ?? now)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    retByMonth[k] = (retByMonth[k] || []).concat(r)
  }

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - i, 1)
    d.setHours(0, 0, 0, 0)
    const from = d.getTime()
    const end = new Date(d)
    end.setMonth(end.getMonth() + 1)
    const to = end.getTime() - 1
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    const pnl = profitAndLoss(orders, retByMonth[key] || [], { ...opts, from, to })
    out.push({
      month: key,
      label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      ...pnl,
    })
  }
  return out
}

/* ------------------------------------------------------------------ GST */

/**
 * GSTR-1 style summary. Splits by place of supply (intra vs inter state) and
 * by rate slab, which is exactly how the return is filed.
 */
export function gstSummary(orders = [], { from = 0, to = Date.now(), sellerState = 'Haryana', products = [] } = {}) {
  // Order lines record the GST rate but not the HSN code, so resolve HSN from
  // the catalogue. A GSTR-1 filing without HSN codes is rejected, which makes
  // this lookup load-bearing rather than cosmetic.
  const hsnByProduct = new Map(products.map(p => [p.id, p.hsn]))
  const hsnByCategory = new Map(products.map(p => [p.category, p.hsn]))
  const resolveHsn = (it) =>
    it.hsn || hsnByProduct.get(it.productId) || hsnByCategory.get(it.category) || null

  const window = orders.filter(o => o.placedAt >= from && o.placedAt <= to && isRealised(o))

  const byRate = {}
  const byState = {}
  let taxableValue = 0, cgst = 0, sgst = 0, igst = 0
  let b2bCount = 0, b2cCount = 0, b2bValue = 0, b2cValue = 0

  for (const o of window) {
    const isB2B = Boolean(o.gstin || o.address?.gstin)
    const state = o.address?.state || 'Unknown'
    const inter = state !== sellerState

    const orderTaxable = (o.subtotal ?? 0) - (o.discount ?? 0)
    taxableValue += orderTaxable
    cgst += o.cgst ?? 0
    sgst += o.sgst ?? 0
    igst += o.igst ?? 0

    if (isB2B) { b2bCount++; b2bValue += o.total ?? 0 }
    else { b2cCount++; b2cValue += o.total ?? 0 }

    for (const it of o.items || []) {
      const rate = it.gst ?? 0
      const lineValue = it.price * it.qty
      const share = (o.subtotal ?? 1) > 0 ? lineValue / o.subtotal : 0
      const lineTaxable = orderTaxable * share
      const lineTax = (o.gst ?? 0) * share

      byRate[rate] = byRate[rate] || { rate, taxableValue: 0, tax: 0, cgst: 0, sgst: 0, igst: 0, lines: 0, hsn: new Set() }
      byRate[rate].taxableValue += lineTaxable
      byRate[rate].tax += lineTax
      byRate[rate].lines++
      const hsn = resolveHsn(it)
      if (hsn) byRate[rate].hsn.add(hsn)
      if (inter) byRate[rate].igst += lineTax
      else { byRate[rate].cgst += lineTax / 2; byRate[rate].sgst += lineTax / 2 }
    }

    byState[state] = byState[state] || { state, orders: 0, taxableValue: 0, tax: 0, interState: inter }
    byState[state].orders++
    byState[state].taxableValue += orderTaxable
    byState[state].tax += o.gst ?? 0
  }

  const totalTax = cgst + sgst + igst

  return {
    period: { from, to },
    orderCount: window.length,
    taxableValue: Math.round(taxableValue),
    cgst: Math.round(cgst),
    sgst: Math.round(sgst),
    igst: Math.round(igst),
    totalTax: Math.round(totalTax),
    b2b: { count: b2bCount, value: Math.round(b2bValue) },
    b2c: { count: b2cCount, value: Math.round(b2cValue) },
    byRate: Object.values(byRate)
      .map(r => ({
        ...r,
        hsn: [...r.hsn],
        taxableValue: Math.round(r.taxableValue),
        tax: Math.round(r.tax),
        cgst: Math.round(r.cgst),
        sgst: Math.round(r.sgst),
        igst: Math.round(r.igst),
      }))
      .sort((a, b) => a.rate - b.rate),
    byState: Object.values(byState)
      .map(s => ({ ...s, taxableValue: Math.round(s.taxableValue), tax: Math.round(s.tax) }))
      .sort((a, b) => b.taxableValue - a.taxableValue),
  }
}

/** Filing deadlines for the Indian GST calendar. */
export function filingCalendar(now = Date.now()) {
  const d = new Date(now)
  const month = d.getMonth()
  const year = d.getFullYear()
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  const mk = (label, day, form, note) => {
    const due = new Date(year, month, day).getTime()
    const daysLeft = Math.ceil((due - now) / DAY)
    return {
      form, label, note, dueAt: due, daysLeft,
      period: monthName,
      status: daysLeft < 0 ? 'overdue' : daysLeft <= 3 ? 'due-soon' : 'upcoming',
    }
  }

  return [
    mk('Outward supplies', 11, 'GSTR-1', 'Sales invoices for the previous month'),
    mk('Summary return & payment', 20, 'GSTR-3B', 'Net tax liability after input credit'),
    mk('TCS return', 10, 'GSTR-8', 'Only if you operate as a marketplace'),
  ].sort((a, b) => a.dueAt - b.dueAt)
}

/* ---------------------------------------------------- payment settlement */

/**
 * Gateway settlement view. Money collected today is not money in the bank —
 * gateways hold prepaid for ~2 days and COD for ~7, and that gap is what kills
 * cash flow for growing D2C brands.
 */
export function settlements(orders = [], { now = Date.now(), prepaidDays = 2, codDays = 7 } = {}) {
  const buckets = {}

  for (const o of orders) {
    if (!isRealised(o) || isLost(o)) continue
    if (!o.paid) continue

    const isCod = o.paymentMethod === 'COD'
    const holdDays = isCod ? codDays : prepaidDays
    const collectedAt = isCod
      ? (o.deliveredAt ?? o.placedAt + (o.deliveryDays ?? 4) * DAY)
      : o.placedAt
    const settleAt = collectedAt + holdDays * DAY

    const feeRate = isCod ? 0.02 : 0.021
    const fee = (o.total ?? 0) * feeRate
    const net = (o.total ?? 0) - fee

    const method = o.paymentMethod
    buckets[method] = buckets[method] || {
      method, gross: 0, fee: 0, net: 0, count: 0, pending: 0, settled: 0, pendingCount: 0,
    }
    buckets[method].gross += o.total ?? 0
    buckets[method].fee += fee
    buckets[method].net += net
    buckets[method].count++

    if (settleAt > now) { buckets[method].pending += net; buckets[method].pendingCount++ }
    else buckets[method].settled += net
  }

  const rows = Object.values(buckets).map(b => ({
    ...b,
    gross: Math.round(b.gross),
    fee: Math.round(b.fee),
    net: Math.round(b.net),
    pending: Math.round(b.pending),
    settled: Math.round(b.settled),
    feePct: b.gross > 0 ? Math.round((b.fee / b.gross) * 1000) / 10 : 0,
  })).sort((a, b) => b.gross - a.gross)

  return {
    rows,
    totalGross: rows.reduce((s, r) => s + r.gross, 0),
    totalFee: rows.reduce((s, r) => s + r.fee, 0),
    totalNet: rows.reduce((s, r) => s + r.net, 0),
    pendingPayout: rows.reduce((s, r) => s + r.pending, 0),
    settledToDate: rows.reduce((s, r) => s + r.settled, 0),
  }
}

/** Upcoming payout schedule — literally what will hit the bank and when. */
export function payoutSchedule(orders = [], { now = Date.now(), days = 14, prepaidDays = 2, codDays = 7 } = {}) {
  const byDay = {}

  for (const o of orders) {
    if (!isRealised(o) || isLost(o) || !o.paid) continue
    const isCod = o.paymentMethod === 'COD'
    const collectedAt = isCod
      ? (o.deliveredAt ?? o.placedAt + (o.deliveryDays ?? 4) * DAY)
      : o.placedAt
    const settleAt = collectedAt + (isCod ? codDays : prepaidDays) * DAY
    if (settleAt <= now || settleAt > now + days * DAY) continue

    const key = new Date(settleAt).toISOString().slice(0, 10)
    const fee = (o.total ?? 0) * (isCod ? 0.02 : 0.021)
    byDay[key] = byDay[key] || { date: key, amount: 0, orders: 0 }
    byDay[key].amount += (o.total ?? 0) - fee
    byDay[key].orders++
  }

  return Object.values(byDay)
    .map(d => ({ ...d, amount: Math.round(d.amount) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/* -------------------------------------------------------- unit economics */

/** Contribution margin per channel / payment method / category. */
export function unitEconomics(orders = [], dimension = 'channel', { cogsRate = 0.58 } = {}) {
  const groups = {}

  for (const o of orders) {
    if (!isRealised(o)) continue
    const keys = dimension === 'category'
      ? [...new Set((o.items || []).map(i => i.category))]
      : [o[dimension] ?? 'Unknown']

    for (const key of keys) {
      groups[key] = groups[key] || {
        key, orders: 0, revenue: 0, cogs: 0, fees: 0, shipping: 0, profit: 0, rto: 0,
      }
      const g = groups[key]
      g.orders++
      g.revenue += o.total ?? 0
      g.cogs += (o.items || []).reduce((s, i) => s + (i.cost ?? i.price * cogsRate) * (i.qty ?? 1), 0)
      g.fees += (o.total ?? 0) * (o.paymentMethod === 'COD' ? 0.02 : 0.021)
      g.shipping += Math.max(45, (o.shipping ?? 0) * 1.4 || 62)
      if (isLost(o)) g.rto++
    }
  }

  return Object.values(groups).map(g => {
    const netRev = g.revenue
    const profit = netRev - g.cogs - g.fees - g.shipping
    return {
      ...g,
      revenue: Math.round(g.revenue),
      cogs: Math.round(g.cogs),
      fees: Math.round(g.fees),
      shipping: Math.round(g.shipping),
      profit: Math.round(profit),
      marginPct: netRev > 0 ? Math.round((profit / netRev) * 100) : 0,
      aov: g.orders ? Math.round(g.revenue / g.orders) : 0,
      rtoRate: g.orders ? Math.round((g.rto / g.orders) * 1000) / 10 : 0,
      contributionPerOrder: g.orders ? Math.round(profit / g.orders) : 0,
    }
  }).sort((a, b) => b.profit - a.profit)
}

/** Discount leakage — how much margin promotions actually cost. */
export function discountAnalysis(orders = [], { cogsRate = 0.58 } = {}) {
  const withDiscount = orders.filter(o => isRealised(o) && (o.discount ?? 0) > 0)
  const without = orders.filter(o => isRealised(o) && !(o.discount ?? 0))

  const byCoupon = {}
  for (const o of withDiscount) {
    const code = o.couponCode || 'Automatic'
    byCoupon[code] = byCoupon[code] || { code, orders: 0, discount: 0, revenue: 0, cogs: 0 }
    byCoupon[code].orders++
    byCoupon[code].discount += o.discount ?? 0
    byCoupon[code].revenue += o.total ?? 0
    byCoupon[code].cogs += (o.items || []).reduce((s, i) => s + (i.cost ?? i.price * cogsRate) * (i.qty ?? 1), 0)
  }

  const avg = (arr, f) => arr.length ? Math.round(arr.reduce((s, o) => s + f(o), 0) / arr.length) : 0

  return {
    discountedOrders: withDiscount.length,
    fullPriceOrders: without.length,
    discountPenetration: orders.length ? Math.round((withDiscount.length / orders.length) * 100) : 0,
    totalDiscount: Math.round(withDiscount.reduce((s, o) => s + (o.discount ?? 0), 0)),
    aovDiscounted: avg(withDiscount, o => o.total ?? 0),
    aovFullPrice: avg(without, o => o.total ?? 0),
    byCoupon: Object.values(byCoupon).map(c => {
      const profit = c.revenue - c.cogs
      return {
        ...c,
        discount: Math.round(c.discount),
        revenue: Math.round(c.revenue),
        profit: Math.round(profit),
        marginPct: c.revenue > 0 ? Math.round((profit / c.revenue) * 100) : 0,
        avgDiscount: c.orders ? Math.round(c.discount / c.orders) : 0,
        roi: c.discount > 0 ? Math.round((profit / c.discount) * 10) / 10 : 0,
      }
    }).sort((a, b) => b.discount - a.discount),
  }
}

export default {
  profitAndLoss, monthlyPnL, gstSummary, filingCalendar,
  settlements, payoutSchedule, unitEconomics, discountAnalysis,
}
