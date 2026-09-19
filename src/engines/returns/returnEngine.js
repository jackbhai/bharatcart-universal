/**
 * Returns / RMA engine.
 *
 * Indian D2C apparel lives and dies on returns, so this models the real thing:
 * per-item eligibility windows, reason codes that drive different refund
 * treatment, QC outcomes that decide whether stock goes back on the shelf,
 * and refund maths that respects what was actually collected (including COD).
 */

export const RETURN_STATUS = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  PICKUP_SCHEDULED: 'Pickup Scheduled',
  IN_TRANSIT: 'In Transit',
  RECEIVED: 'Received',
  QC_PASSED: 'QC Passed',
  QC_FAILED: 'QC Failed',
  REFUNDED: 'Refunded',
  CLOSED: 'Closed',
}

const R = RETURN_STATUS

export const RETURN_TYPE = {
  REFUND: 'refund',
  EXCHANGE: 'exchange',
  STORE_CREDIT: 'store_credit',
  REPLACEMENT: 'replacement',
}

/**
 * Reason codes. `fault` decides who pays the reverse-shipping bill, and
 * `restockable` decides whether the unit can be resold at full price.
 */
export const RETURN_REASONS = [
  { code: 'size_issue',    label: 'Size / fit issue',        fault: 'customer', restockable: true,  windowDays: 7,  requiresPhoto: false },
  { code: 'not_as_shown',  label: 'Looks different to photos', fault: 'seller', restockable: true,  windowDays: 7,  requiresPhoto: true },
  { code: 'damaged',       label: 'Damaged in transit',      fault: 'courier',  restockable: false, windowDays: 3,  requiresPhoto: true },
  { code: 'defective',     label: 'Manufacturing defect',    fault: 'seller',   restockable: false, windowDays: 14, requiresPhoto: true },
  { code: 'wrong_item',    label: 'Wrong item shipped',      fault: 'seller',   restockable: true,  windowDays: 7,  requiresPhoto: true },
  { code: 'quality',       label: 'Quality below expectation', fault: 'seller', restockable: true,  windowDays: 7,  requiresPhoto: false },
  { code: 'late_delivery', label: 'Arrived too late',        fault: 'courier',  restockable: true,  windowDays: 7,  requiresPhoto: false },
  { code: 'changed_mind',  label: 'Changed my mind',         fault: 'customer', restockable: true,  windowDays: 5,  requiresPhoto: false },
  { code: 'better_price',  label: 'Found a better price',    fault: 'customer', restockable: true,  windowDays: 5,  requiresPhoto: false },
]

export const REASON_BY_CODE = Object.fromEntries(RETURN_REASONS.map(r => [r.code, r]))

/** Categories that can never come back, for hygiene/legal reasons. */
export const NON_RETURNABLE_CATEGORIES = ['Beauty & Wellness', 'Innerwear']

/**
 * Per-vertical return rules. These layer on top of (not instead of) the
 * generic category/reason rules above:
 *
 *  - Fresh-food verticals (dairy / confectionery / grocery) and any item that
 *    has already expired: never returnable → code 'PERISHABLE'.
 *  - Fine jewellery: never a plain return — instead a buyback at 90% of the
 *    day rate within 7 days of delivery, paid out as store credit.
 *
 * `verticalReturnRule(product)` returns the matching rule (with the product's
 * vertical attached) or null when no vertical rule applies.
 */
export const VERTICAL_RETURN_RULES = {
  dairy: {
    code: 'PERISHABLE',
    eligible: false,
    reason: 'Fresh dairy items cannot be returned once delivered',
  },
  confectionery: {
    code: 'PERISHABLE',
    eligible: false,
    reason: 'Perishable food items cannot be returned once delivered',
  },
  grocery: {
    code: 'PERISHABLE',
    eligible: false,
    reason: 'Perishable grocery items cannot be returned once delivered',
  },
  'fine-jewellery': {
    code: 'BUYBACK_ONLY',
    eligible: true,
    windowDays: 7,
    buybackPct: 90,
    creditType: 'store_credit',
    note: 'Fine jewellery is not returnable — buyback at 90% of the day rate within 7 days as store credit',
  },
}

export function verticalReturnRule(product = {}, { now = Date.now() } = {}) {
  const vertical = product.vertical ?? product.attributes?.vertical ?? null
  const expiryMs = product.attributes?.expiryDate != null
    ? new Date(product.attributes.expiryDate).getTime()
    : null

  // Expired perishables are out regardless of vertical.
  if (expiryMs != null && Number.isFinite(expiryMs) && expiryMs <= now) {
    return {
      ...VERTICAL_RETURN_RULES.dairy,
      vertical,
      reason: 'This item has expired and cannot be returned',
    }
  }

  const rule = vertical ? VERTICAL_RETURN_RULES[vertical] : null
  return rule ? { ...rule, vertical } : null
}

export const RETURN_TRANSITIONS = {
  [R.REQUESTED]: [R.APPROVED, R.REJECTED],
  [R.APPROVED]: [R.PICKUP_SCHEDULED, R.REJECTED],
  [R.PICKUP_SCHEDULED]: [R.IN_TRANSIT, R.REJECTED],
  [R.IN_TRANSIT]: [R.RECEIVED],
  [R.RECEIVED]: [R.QC_PASSED, R.QC_FAILED],
  [R.QC_PASSED]: [R.REFUNDED],
  [R.QC_FAILED]: [R.CLOSED, R.REFUNDED],
  [R.REFUNDED]: [R.CLOSED],
  [R.REJECTED]: [R.CLOSED],
  [R.CLOSED]: [],
}

/**
 * Is this specific line item still returnable?
 * Returns a verdict with a human reason — the storefront shows it verbatim.
 */
export function checkEligibility(order, item, { reasonCode = 'changed_mind', now = Date.now(), policy = {}, product } = {}) {
  const reason = REASON_BY_CODE[reasonCode]
  const windowDays = policy.windowDays ?? reason?.windowDays ?? 7

  if (order.status !== 'Delivered') {
    return { eligible: false, reason: 'Only delivered orders can be returned' }
  }
  const delivered = order.deliveredAt ?? (order.placedAt + (order.deliveryDays ?? 4) * 86400000)
  const daysSince = Math.floor((now - delivered) / 86400000)

  // ---- vertical rules (fresh food, fine jewellery) — evaluated before the
  // generic reason window because they carry their own eligibility semantics.
  const verticalRule = verticalReturnRule(product ?? item ?? {}, { now })
  if (verticalRule?.code === 'PERISHABLE') {
    return { eligible: false, code: 'PERISHABLE', reason: verticalRule.reason }
  }
  if (verticalRule?.code === 'BUYBACK_ONLY') {
    const buybackWindow = verticalRule.windowDays
    if (daysSince > buybackWindow) {
      return {
        eligible: false,
        code: 'BUYBACK_EXPIRED',
        daysSince,
        windowDays: buybackWindow,
        reason: `Buyback window closed — ${daysSince} days since delivery, limit is ${buybackWindow}`,
      }
    }
    return {
      eligible: true,
      code: 'BUYBACK_ONLY',
      daysSince,
      windowDays: buybackWindow,
      daysLeft: buybackWindow - daysSince,
      requiresPhoto: true,
      note: verticalRule.note,
      buybackPct: verticalRule.buybackPct,
      creditType: verticalRule.creditType,
      reason: `Buyback available for ${buybackWindow - daysSince} more day${buybackWindow - daysSince === 1 ? '' : 's'} — ${verticalRule.buybackPct}% of the day rate as store credit`,
    }
  }

  if (daysSince > windowDays) {
    return {
      eligible: false,
      daysSince,
      windowDays,
      reason: `Return window closed — ${daysSince} days since delivery, limit is ${windowDays}`,
    }
  }
  if (NON_RETURNABLE_CATEGORIES.includes(item.category)) {
    return { eligible: false, reason: `${item.category} items cannot be returned for hygiene reasons` }
  }
  if (item.returned) {
    return { eligible: false, reason: 'This item has already been returned' }
  }
  if (order.paymentMethod === 'COD' && !order.paid) {
    return { eligible: false, reason: 'Order was never paid for' }
  }

  return {
    eligible: true,
    daysSince,
    windowDays,
    daysLeft: windowDays - daysSince,
    requiresPhoto: reason?.requiresPhoto ?? false,
    reason: `Returnable for ${windowDays - daysSince} more day${windowDays - daysSince === 1 ? '' : 's'}`,
  }
}

/**
 * Refund maths. Proportionally unwinds the order-level discount and GST so the
 * books stay balanced, and charges reverse shipping only when the customer is
 * at fault.
 */
export function calculateRefund(order, lines = [], { type = RETURN_TYPE.REFUND, policy = {}, qcOutcome = 'pass' } = {}) {
  const orderSubtotal = order.subtotal || (order.items || []).reduce((s, i) => s + i.price * i.qty, 0) || 1

  let goodsValue = 0
  const detail = []

  for (const line of lines) {
    const item = (order.items || []).find(i => i.sku === line.sku) || line
    const qty = Math.min(line.qty ?? 1, item.qty ?? 1)
    const gross = (item.price ?? 0) * qty

    // proportional share of the order-level discount
    const discountShare = (order.discount ?? 0) * (gross / orderSubtotal)
    const net = gross - discountShare
    const gstShare = (order.gst ?? 0) * (gross / orderSubtotal)

    goodsValue += net
    detail.push({
      sku: item.sku,
      name: item.name,
      qty,
      gross: Math.round(gross),
      discountShare: Math.round(discountShare),
      gstShare: Math.round(gstShare),
      net: Math.round(net),
      reasonCode: line.reasonCode,
    })
  }

  const allLines = lines.map(l => REASON_BY_CODE[l.reasonCode]).filter(Boolean)
  const sellerAtFault = allLines.some(r => r.fault === 'seller' || r.fault === 'courier')

  // reverse pickup: free when it's our mistake
  const pickupFee = sellerAtFault ? 0 : (policy.pickupFee ?? 79)

  // full order returned → refund the forward shipping too
  const returnedUnits = lines.reduce((s, l) => s + (l.qty ?? 1), 0)
  const totalUnits = (order.items || []).reduce((s, i) => s + (i.qty ?? 1), 0)
  const isFullReturn = returnedUnits >= totalUnits
  const shippingRefund = isFullReturn ? (order.shipping ?? 0) : 0
  const codFeeRefund = isFullReturn ? (order.codFee ?? 0) : 0

  // QC failure → partial refund, the unit can't be resold as new
  const qcPenaltyPct = qcOutcome === 'fail' ? (policy.qcFailPenaltyPct ?? 100)
    : qcOutcome === 'partial' ? (policy.qcPartialPenaltyPct ?? 30) : 0
  const qcPenalty = goodsValue * (qcPenaltyPct / 100)

  let refund = goodsValue + shippingRefund + codFeeRefund - pickupFee - qcPenalty
  refund = Math.max(0, Math.round(refund))

  // store credit usually carries a bonus — it keeps the money in the business
  const creditBonusPct = policy.storeCreditBonusPct ?? 10
  const storeCreditValue = type === RETURN_TYPE.STORE_CREDIT
    ? Math.round(refund * (1 + creditBonusPct / 100))
    : 0

  return {
    type,
    detail,
    goodsValue: Math.round(goodsValue),
    shippingRefund,
    codFeeRefund,
    pickupFee,
    qcPenalty: Math.round(qcPenalty),
    qcOutcome,
    sellerAtFault,
    isFullReturn,
    refund,
    storeCreditValue,
    payable: type === RETURN_TYPE.STORE_CREDIT ? storeCreditValue : refund,
    method: refundMethod(order),
    etaDays: refundEtaDays(order),
    gstReversal: Math.round(detail.reduce((s, d) => s + d.gstShare, 0)),
  }
}

/** Where the money goes back to — COD can't be reversed to a card. */
export function refundMethod(order) {
  if (order.paymentMethod === 'COD') return 'Bank transfer (NEFT)'
  if (order.paymentMethod === 'UPI') return `UPI — ${order.upiApp || 'original app'}`
  if (/card/i.test(order.paymentMethod || '')) return 'Original card'
  if (/wallet/i.test(order.paymentMethod || '')) return 'Wallet'
  return 'Original payment method'
}

function refundEtaDays(order) {
  if (order.paymentMethod === 'COD') return 7
  if (order.paymentMethod === 'UPI') return 3
  return 5
}

/** Guarded status change for an RMA. */
export function transitionReturn(rma, to, { by = 'system', note, now = Date.now() } = {}) {
  const allowed = RETURN_TRANSITIONS[rma.status] || []
  if (!allowed.includes(to)) {
    return { ok: false, reason: `Cannot move a ${rma.status} return to ${to}`, rma }
  }
  return {
    ok: true,
    rma: {
      ...rma,
      status: to,
      updatedAt: now,
      timeline: [...(rma.timeline || []), { at: now, to, by, note: note || to }],
      ...(to === R.REFUNDED ? { refundedAt: now } : {}),
      ...(to === R.RECEIVED ? { receivedAt: now } : {}),
    },
  }
}

/** Should stock go back on the shelf after QC? */
export function restockDecision(rma, qcOutcome = 'pass') {
  const reasons = (rma.lines || []).map(l => REASON_BY_CODE[l.reasonCode]).filter(Boolean)
  const anyNonRestockable = reasons.some(r => !r.restockable)

  if (qcOutcome === 'fail' || anyNonRestockable) {
    return { restock: false, destination: 'scrap', note: 'Cannot be resold as new — write off or send to outlet' }
  }
  if (qcOutcome === 'partial') {
    return { restock: true, destination: 'outlet', note: 'Resell at a discount through the outlet channel' }
  }
  return { restock: true, destination: 'main', note: 'Return to sellable stock' }
}

/* ----------------------------------------------------------- analytics */

/** Return-rate analytics — the number that decides which SKUs to fix or drop. */
export function returnAnalytics(orders = [], returns = []) {
  const delivered = orders.filter(o => o.status === 'Delivered' || o.status === 'Returned')
  const totalOrders = delivered.length || 1

  const byReason = {}
  const byProduct = {}
  const byCategory = {}
  let refundTotal = 0

  for (const r of returns) {
    refundTotal += r.refundAmount ?? 0
    for (const line of r.lines || []) {
      const rc = line.reasonCode || 'unknown'
      byReason[rc] = byReason[rc] || { code: rc, label: REASON_BY_CODE[rc]?.label || rc, count: 0, value: 0, fault: REASON_BY_CODE[rc]?.fault }
      byReason[rc].count += line.qty ?? 1
      byReason[rc].value += (line.price ?? 0) * (line.qty ?? 1)

      const pid = line.productId
      if (pid) {
        byProduct[pid] = byProduct[pid] || { productId: pid, name: line.name, count: 0, value: 0, reasons: {} }
        byProduct[pid].count += line.qty ?? 1
        byProduct[pid].value += (line.price ?? 0) * (line.qty ?? 1)
        byProduct[pid].reasons[rc] = (byProduct[pid].reasons[rc] || 0) + 1
      }
      const cat = line.category
      if (cat) {
        byCategory[cat] = byCategory[cat] || { category: cat, count: 0, value: 0 }
        byCategory[cat].count += line.qty ?? 1
        byCategory[cat].value += (line.price ?? 0) * (line.qty ?? 1)
      }
    }
  }

  const sellerFaultCount = Object.values(byReason)
    .filter(r => r.fault === 'seller')
    .reduce((s, r) => s + r.count, 0)
  const totalReturnUnits = Object.values(byReason).reduce((s, r) => s + r.count, 0) || 1

  return {
    totalReturns: returns.length,
    returnRatePct: Math.round((returns.length / totalOrders) * 1000) / 10,
    refundTotal: Math.round(refundTotal),
    avgRefund: returns.length ? Math.round(refundTotal / returns.length) : 0,
    byReason: Object.values(byReason).sort((a, b) => b.count - a.count),
    byProduct: Object.values(byProduct)
      .map(p => ({ ...p, topReason: topKey(p.reasons) }))
      .sort((a, b) => b.count - a.count),
    byCategory: Object.values(byCategory).sort((a, b) => b.count - a.count),
    sellerFaultPct: Math.round((sellerFaultCount / totalReturnUnits) * 100),
    preventable: Object.values(byReason)
      .filter(r => r.fault === 'seller')
      .sort((a, b) => b.count - a.count),
  }
}

function topKey(obj = {}) {
  let best = null, n = -1
  for (const [k, v] of Object.entries(obj)) if (v > n) { best = k; n = v }
  return best ? (REASON_BY_CODE[best]?.label || best) : null
}

/** Products whose return rate is bad enough to warrant action. */
export function problemProducts(analytics, products = [], { minReturns = 3, threshold = 25 } = {}) {
  const byId = new Map(products.map(p => [p.id, p]))
  return analytics.byProduct
    .filter(p => p.count >= minReturns)
    .map(p => {
      const product = byId.get(p.productId)
      const sold = product?.sold ?? 0
      const rate = sold > 0 ? Math.round((p.count / sold) * 100) : 0
      return {
        ...p,
        product,
        soldUnits: sold,
        returnRatePct: rate,
        severity: rate >= 40 ? 'critical' : rate >= threshold ? 'high' : 'watch',
        suggestion: suggestFix(p.topReason),
      }
    })
    .filter(p => p.returnRatePct >= threshold || p.count >= minReturns * 2)
    .sort((a, b) => b.returnRatePct - a.returnRatePct)
}

function suggestFix(topReason = '') {
  const r = String(topReason).toLowerCase()
  if (r.includes('size') || r.includes('fit')) return 'Add a detailed size chart and model measurements'
  if (r.includes('photo') || r.includes('different')) return 'Reshoot product photos in neutral daylight'
  if (r.includes('damage')) return 'Review packaging — add rigid protection'
  if (r.includes('defect')) return 'Audit the supplier batch and tighten inbound QC'
  if (r.includes('quality')) return 'Re-evaluate the supplier or adjust the price point'
  return 'Investigate recent customer feedback for this SKU'
}

export default {
  RETURN_STATUS, RETURN_TYPE, RETURN_REASONS, REASON_BY_CODE, RETURN_TRANSITIONS,
  VERTICAL_RETURN_RULES, verticalReturnRule,
  checkEligibility, calculateRefund, refundMethod, transitionReturn, restockDecision,
  returnAnalytics, problemProducts,
}
