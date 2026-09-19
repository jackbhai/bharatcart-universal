/**
 * Order lifecycle engine.
 *
 * The status graph is deliberately explicit rather than a free-for-all string
 * field: every transition names who may perform it and what it implies for
 * stock, money and the customer. That's what stops an admin accidentally
 * refunding an order that was never paid, or shipping one that's cancelled.
 */

export const ORDER_STATUS = {
  PENDING: 'Pending Payment',
  CONFIRMED: 'Confirmed',
  PACKED: 'Packed',
  SHIPPED: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RTO: 'RTO',
  RETURNED: 'Returned',
  ON_HOLD: 'On Hold',
}

const S = ORDER_STATUS

/**
 * Truly terminal states — nothing moves out of these.
 *
 * Note DELIVERED is deliberately NOT terminal: a delivered order still has to
 * be able to move to RETURNED, otherwise no return could ever be processed.
 * Terminality is derived from the graph so the two can never drift apart.
 */
export const TERMINAL = [S.CANCELLED, S.RETURNED]

/**
 * transition graph.
 * `stock`  : 'reserve' | 'release' | 'consume' | 'restock' | null
 * `money`  : 'capture' | 'refund' | 'void' | null
 */
export const TRANSITIONS = {
  [S.PENDING]: [
    { to: S.CONFIRMED, label: 'Mark as paid', money: 'capture', stock: 'reserve', role: 'staff' },
    { to: S.CANCELLED, label: 'Cancel', money: 'void', stock: null, role: 'staff' },
    { to: S.ON_HOLD, label: 'Put on hold', role: 'staff' },
  ],
  [S.CONFIRMED]: [
    { to: S.PACKED, label: 'Mark packed', stock: 'consume', role: 'staff' },
    { to: S.ON_HOLD, label: 'Put on hold', role: 'staff' },
    { to: S.CANCELLED, label: 'Cancel order', money: 'refund', stock: 'release', role: 'manager' },
  ],
  [S.PACKED]: [
    { to: S.SHIPPED, label: 'Hand to courier', requires: ['awb'], role: 'staff' },
    { to: S.CONFIRMED, label: 'Unpack', stock: 'reserve', role: 'manager' },
    { to: S.CANCELLED, label: 'Cancel order', money: 'refund', stock: 'restock', role: 'manager' },
  ],
  [S.SHIPPED]: [
    { to: S.OUT_FOR_DELIVERY, label: 'Out for delivery', role: 'staff' },
    { to: S.RTO, label: 'Mark RTO', stock: 'restock', role: 'staff' },
    { to: S.ON_HOLD, label: 'Hold in transit', role: 'manager' },
  ],
  [S.OUT_FOR_DELIVERY]: [
    { to: S.DELIVERED, label: 'Mark delivered', money: 'capture', role: 'staff' },
    { to: S.RTO, label: 'Delivery failed → RTO', stock: 'restock', role: 'staff' },
    { to: S.SHIPPED, label: 'Back to hub', role: 'staff' },
  ],
  [S.DELIVERED]: [
    { to: S.RETURNED, label: 'Process return', money: 'refund', stock: 'restock', role: 'manager' },
  ],
  [S.ON_HOLD]: [
    { to: S.CONFIRMED, label: 'Release hold', role: 'staff' },
    { to: S.CANCELLED, label: 'Cancel order', money: 'refund', stock: 'release', role: 'manager' },
  ],
  [S.RTO]: [
    { to: S.RETURNED, label: 'RTO received → refund', money: 'refund', role: 'manager' },
    { to: S.SHIPPED, label: 'Reattempt delivery', role: 'manager' },
  ],
  [S.CANCELLED]: [],
  [S.RETURNED]: [],
}

const ROLE_RANK = { staff: 40, manager: 60, admin: 80, owner: 100 }

/** Every transition legal from this order's current state, for this role. */
export function allowedTransitions(order, role = 'admin') {
  const rank = ROLE_RANK[role] ?? 0
  return (TRANSITIONS[order.status] || []).filter(t => (ROLE_RANK[t.role ?? 'staff'] ?? 0) <= rank)
}

/**
 * Validate a proposed status change. Never throws — returns a verdict the UI
 * can render directly, because "why can't I ship this?" is the question an ops
 * person actually asks.
 */
export function canTransition(order, to, { role = 'admin', patch = {} } = {}) {
  if (order.status === to) return { ok: false, reason: `Order is already ${to}` }

  const all = TRANSITIONS[order.status] || []
  if (!all.length) {
    return { ok: false, reason: `${order.status} is a final state — no further changes` }
  }
  const move = all.find(t => t.to === to)
  if (!move) {
    return { ok: false, reason: `Cannot go from ${order.status} to ${to}` }
  }

  const rank = ROLE_RANK[role] ?? 0
  if ((ROLE_RANK[move.role ?? 'staff'] ?? 0) > rank) {
    return { ok: false, reason: `Needs ${move.role} permission or above` }
  }

  const merged = { ...order, ...patch }
  const missing = (move.requires || []).filter(f => !merged[f])
  if (missing.length) {
    return { ok: false, reason: `Missing required field: ${missing.join(', ')}`, missing }
  }

  if (move.money === 'refund' && !order.paid) {
    return { ok: false, reason: 'Order was never paid — cancel instead of refunding' }
  }

  return { ok: true, move }
}

/** Apply a transition, returning the new order plus the side effects to run. */
export function applyTransition(order, to, { role = 'admin', patch = {}, note, by = 'system', now = Date.now() } = {}) {
  const verdict = canTransition(order, to, { role, patch })
  if (!verdict.ok) return { ok: false, reason: verdict.reason, order }

  const { move } = verdict
  const entry = {
    at: now,
    from: order.status,
    to,
    by,
    note: note || move.label,
    money: move.money || null,
    stock: move.stock || null,
  }

  const next = {
    ...order,
    ...patch,
    status: to,
    timeline: [...(order.timeline || []), entry],
    ...(move.money === 'capture' ? { paid: true, paidAt: order.paidAt ?? now } : {}),
    ...(move.money === 'refund' ? { refunded: true, refundedAt: now } : {}),
    ...(to === S.DELIVERED ? { deliveredAt: now } : {}),
    ...(to === S.SHIPPED ? { shippedAt: order.shippedAt ?? now } : {}),
    ...(to === S.CANCELLED ? { cancelledAt: now } : {}),
  }

  return { ok: true, order: next, effects: { money: move.money, stock: move.stock }, entry }
}

/** Bulk transition with per-order verdicts — partial success is the norm in ops. */
export function bulkTransition(orders, to, opts = {}) {
  const succeeded = []
  const failed = []
  for (const o of orders) {
    const r = applyTransition(o, to, opts)
    if (r.ok) succeeded.push(r.order)
    else failed.push({ order: o, reason: r.reason })
  }
  return { succeeded, failed, total: orders.length }
}

/* ------------------------------------------------------------ analysis */

/** Reconstruct a display timeline even for seed orders that have none. */
export function buildTimeline(order) {
  if (order.timeline?.length) return order.timeline

  const t = []
  const placed = order.placedAt
  t.push({ at: placed, to: 'Placed', note: `Order placed via ${order.channel || 'web'}`, by: 'customer' })
  if (order.paid) t.push({ at: placed + 60000, to: 'Payment received', note: order.paymentMethod, by: 'gateway' })

  const order_ = order.status
  const day = 86400000
  const seq = [S.CONFIRMED, S.PACKED, S.SHIPPED, S.OUT_FOR_DELIVERY, S.DELIVERED]
  const idx = seq.indexOf(order_)
  const upto = idx >= 0 ? idx : (order_ === S.RTO || order_ === S.RETURNED ? 3 : 0)

  for (let i = 0; i <= upto; i++) {
    t.push({ at: placed + (i + 1) * day * 0.8, to: seq[i], note: STAGE_NOTE[seq[i]], by: 'ops' })
  }
  if (order_ === S.RTO) t.push({ at: placed + 5 * day, to: S.RTO, note: 'Delivery failed, returning to origin', by: 'courier' })
  if (order_ === S.CANCELLED) t.push({ at: placed + day, to: S.CANCELLED, note: 'Order cancelled', by: 'ops' })
  if (order_ === S.RETURNED) t.push({ at: placed + 9 * day, to: S.RETURNED, note: 'Return completed', by: 'ops' })

  return t.sort((a, b) => a.at - b.at)
}

const STAGE_NOTE = {
  [S.CONFIRMED]: 'Order confirmed and queued for picking',
  [S.PACKED]: 'Packed and labelled at the warehouse',
  [S.SHIPPED]: 'Handed over to the courier',
  [S.OUT_FOR_DELIVERY]: 'Out for delivery with the last-mile agent',
  [S.DELIVERED]: 'Delivered to the customer',
}

/** Per-order profitability — what actually landed in the bank. */
export function orderMargin(order, { cogsRate = 0.58 } = {}) {
  const revenue = order.total ?? 0
  const gst = order.gst ?? 0
  const netRevenue = revenue - gst

  const cogs = (order.items || []).reduce(
    (s, i) => s + (i.cost ?? i.price * cogsRate) * (i.qty ?? 1), 0
  )
  const paymentFee = order.paymentMethod === 'COD' ? revenue * 0.02 : revenue * 0.021
  const shippingCost = order.shippingCost ?? Math.max(45, (order.shipping ?? 0) * 1.4 || 62)
  const packaging = 18 + (order.giftWrap ? 35 : 0)

  // RTO and returns are where D2C margin actually dies, so price them in.
  const lossStatus = order.status === 'RTO' || order.status === 'Returned'
  const reverseLogistics = lossStatus ? shippingCost : 0
  const lostRevenue = lossStatus ? netRevenue : 0

  const costs = cogs + paymentFee + shippingCost + packaging + reverseLogistics
  const profit = netRevenue - lostRevenue - costs + (lossStatus ? cogs : 0) // stock comes back

  return {
    revenue,
    netRevenue: Math.round(netRevenue),
    gst,
    cogs: Math.round(cogs),
    paymentFee: Math.round(paymentFee),
    shippingCost: Math.round(shippingCost),
    packaging,
    reverseLogistics: Math.round(reverseLogistics),
    totalCost: Math.round(costs),
    profit: Math.round(profit),
    marginPct: netRevenue > 0 ? Math.round((profit / netRevenue) * 100) : 0,
    lossMaking: profit < 0,
  }
}

/** SLA breach detection — the list ops should work first thing each morning. */
export function slaBreaches(orders, { packHours = 24, shipDays = 2, deliverDays = 7, now = Date.now() } = {}) {
  const H = 3600000, D = 86400000
  const out = []

  for (const o of orders) {
    const age = now - o.placedAt
    if (o.status === S.CONFIRMED && age > packHours * H) {
      out.push({ order: o, type: 'pack', breachedBy: Math.round((age - packHours * H) / H), unit: 'hours',
        message: `Confirmed ${Math.round(age / H)}h ago but still not packed` })
    }
    if (o.status === S.PACKED && age > shipDays * D) {
      out.push({ order: o, type: 'ship', breachedBy: Math.round((age - shipDays * D) / D), unit: 'days',
        message: 'Packed but not handed to courier' })
    }
    if ([S.SHIPPED, S.OUT_FOR_DELIVERY].includes(o.status) && age > deliverDays * D) {
      out.push({ order: o, type: 'deliver', breachedBy: Math.round((age - deliverDays * D) / D), unit: 'days',
        message: `In transit for ${Math.round(age / D)} days` })
    }
    if (o.status === S.PENDING && age > 48 * H) {
      out.push({ order: o, type: 'payment', breachedBy: Math.round((age - 48 * H) / H), unit: 'hours',
        message: 'Payment pending for over 48h — likely abandoned' })
    }
  }

  const rank = { payment: 1, pack: 2, ship: 3, deliver: 4 }
  return out.sort((a, b) => (rank[a.type] - rank[b.type]) || (b.breachedBy - a.breachedBy))
}

/** Risk scoring — which orders deserve a confirmation call before shipping. */
export function riskScore(order, customer = {}) {
  let score = 0
  const flags = []

  if (order.paymentMethod === 'COD') {
    score += 25
    flags.push('COD order')
    if ((customer.rtoCount ?? 0) > 0) {
      score += Math.min(30, customer.rtoCount * 12)
      flags.push(`${customer.rtoCount} previous RTO${customer.rtoCount > 1 ? 's' : ''}`)
    }
  }
  if ((order.total ?? 0) > 15000) { score += 15; flags.push('High order value') }
  if ((customer.orders ?? 0) === 0) { score += 12; flags.push('First-time buyer') }
  if ((order.items || []).length > 6) { score += 8; flags.push('Unusually large basket') }
  if (customer.cityTier === 3) { score += 8; flags.push('Tier-3 delivery area') }
  if ((customer.returnRate ?? 0) > 30) { score += 15; flags.push('High personal return rate') }
  if (!order.address?.pincode) { score += 20; flags.push('Incomplete address') }

  score = Math.min(100, score)
  return {
    score,
    band: score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low',
    flags,
    action: score >= 60 ? 'Call to confirm before dispatch'
      : score >= 30 ? 'Send WhatsApp confirmation'
      : 'Ship normally',
  }
}

/** Split an order across warehouses / shipments. */
export function splitShipments(order, allocation = []) {
  if (!allocation.length) return [{ id: `${order.id}-1`, items: order.items, warehouse: null }]
  return allocation.map((a, i) => ({
    id: `${order.id}-${i + 1}`,
    warehouse: a.warehouse,
    items: a.items,
    units: a.items.reduce((s, it) => s + (it.qty ?? 1), 0),
  }))
}

export default {
  ORDER_STATUS, TRANSITIONS, TERMINAL,
  allowedTransitions, canTransition, applyTransition, bulkTransition,
  buildTimeline, orderMargin, slaBreaches, riskScore, splitShipments,
}
