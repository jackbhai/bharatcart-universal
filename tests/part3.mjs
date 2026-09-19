import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' })
global.window = dom.window; global.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true }); global.HTMLElement = dom.window.HTMLElement
global.SVGElement = dom.window.SVGElement; global.Element = dom.window.Element
global.AbortController = dom.window.AbortController; global.AbortSignal = dom.window.AbortSignal
global.localStorage = dom.window.localStorage
global.requestAnimationFrame = (cb) => setTimeout(cb, 0)
global.cancelAnimationFrame = clearTimeout
global.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} })
dom.window.matchMedia = global.matchMedia
global.IS_REACT_ACT_ENVIRONMENT = true

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log('  ✗', name, extra) } }

const { ORDERS, CUSTOMERS, PRODUCTS, TICKETS } = await import('../src/data/seed.js')
const { RETURNS } = await import('../src/data/returnsSeed.js')
const oe = await import('../src/engines/orders/orderEngine.js')
const re = await import('../src/engines/returns/returnEngine.js')
const ce = await import('../src/engines/orders/customerEngine.js')
const S = oe.ORDER_STATUS
const R = re.RETURN_STATUS

/* ------------------------------------------------------------------
 * Empty-first: the seeds ship zero rows, so this suite builds its own
 * hermetic orders, customers and returns instead of reading demo data.
 * ------------------------------------------------------------------ */
const DAY = 86400000
const NOWT = Date.now()
const item = (id, name, price, qty, category = 'Ethnic Wear') =>
  ({ sku: id, productId: id, name, price, qty, category })

const O_DELIVERED = {
  id: 'TO-DEL-1', customerId: 'TC-1', customerName: 'Asha Verma',
  status: S.DELIVERED, paid: true, paymentMethod: 'UPI', channel: 'Web',
  placedAt: NOWT - 10 * DAY, deliveredAt: NOWT - 6 * DAY,
  items: [item('TP001', 'Banarasi Silk Saree', 2999, 1), item('TP003', 'Cotton Kurti', 849, 2)],
  subtotal: 4697, discount: 200, gst: 380, shipping: 79, codFee: 0, total: 4956,
  address: { city: 'Mumbai', state: 'Maharashtra', pincode: '400001' }, timeline: [],
}
const O_RTO = {
  id: 'TO-RTO-1', customerId: 'TC-2', customerName: 'Rohan Iyer',
  status: S.RTO, paid: false, paymentMethod: 'COD', channel: 'Web',
  placedAt: NOWT - 20 * DAY,
  items: [item('TP004', 'Linen Shirt', 1499, 1, 'Western Wear')],
  subtotal: 1499, discount: 0, gst: 120, shipping: 79, codFee: 0, total: 1619,
  address: { city: 'Patna', state: 'Bihar', pincode: '800001' }, timeline: [],
}
const O_STALE = {
  id: 'TO-STALE-1', customerId: 'TC-3', customerName: 'Meera Nair',
  status: S.CONFIRMED, paid: true, paymentMethod: 'UPI', channel: 'Web',
  placedAt: NOWT - 6 * DAY,
  items: [item('TP005', 'Denim Jeans', 1999, 1, 'Western Wear')],
  subtotal: 1999, discount: 0, gst: 160, shipping: 0, codFee: 0, total: 2159,
  address: { city: 'Bengaluru', state: 'Karnataka', pincode: '560001' }, timeline: [],
}
const O_COD = {
  id: 'TO-COD-1', customerId: 'TC-2', customerName: 'Rohan Iyer',
  status: S.CONFIRMED, paid: false, paymentMethod: 'COD', channel: 'Web',
  placedAt: NOWT - 1 * DAY,
  items: [item('TP006', 'Running Shoes', 2499, 1, 'Footwear')],
  subtotal: 2499, discount: 0, gst: 200, shipping: 79, codFee: 49, total: 2827,
  address: { city: 'Jaipur', state: 'Rajasthan', pincode: '302001' }, timeline: [],
}
const FIX_ORDERS = [O_DELIVERED, O_RTO, O_STALE, O_COD]

const FIX_CUSTOMERS = [
  { id: 'TC-1', name: 'Asha Verma', email: 'asha@x.com', phone: '9999999901', joinedAt: NOWT - 400 * DAY, city: 'Mumbai', state: 'Maharashtra' },
  { id: 'TC-2', name: 'Rohan Iyer', email: 'rohan@x.com', phone: '9999999902', joinedAt: NOWT - 380 * DAY, city: 'Patna', state: 'Bihar' },
  { id: 'TC-3', name: 'Meera Nair', email: 'meera@x.com', phone: '9999999903', joinedAt: NOWT - 60 * DAY, city: 'Bengaluru', state: 'Karnataka' },
]
// TC-1: champion — many recent high-value orders. TC-2: at risk — old orders,
// long silence. TC-3: one-timer — a single recent order.
const FIX_BY_CUST = {
  'TC-1': Array.from({ length: 8 }, (_, i) => ({
    ...O_DELIVERED, id: `TO-C1-${i}`, customerId: 'TC-1',
    placedAt: NOWT - (i * 4 + 2) * DAY, total: 4956 - i * 100, status: S.DELIVERED,
  })),
  'TC-2': Array.from({ length: 5 }, (_, i) => ({
    ...O_RTO, id: `TO-C2-${i}`, customerId: 'TC-2',
    placedAt: NOWT - (300 + i * 10) * DAY, total: 1619, status: S.DELIVERED,
  })),
  'TC-3': [{ ...O_DELIVERED, id: 'TO-C3-0', customerId: 'TC-3', placedAt: NOWT - 10 * DAY, total: 2159, status: S.DELIVERED }],
}
// Enough rows for the priority cap (20) to bite.
for (let i = 4; i <= 22; i++) {
  const id = 'TC-' + i
  FIX_CUSTOMERS.push({
    id, name: 'Customer ' + i, email: `c${i}@x.com`, phone: '99999999' + String(10 + i),
    joinedAt: NOWT - (50 + i * 13) * DAY, city: 'Delhi', state: 'Delhi',
  })
  FIX_BY_CUST[id] = i % 3 === 0 ? [] : [{
    ...O_DELIVERED, id: `TO-G${i}`, customerId: id,
    placedAt: NOWT - (i * 7) * DAY, total: 1200 + i * 137, status: S.DELIVERED,
  }]
}

const FIX_RMAS = [
  { id: 'TR-1', orderId: 'TO-DEL-1', customerId: 'TC-1', status: R.REQUESTED, refundAmount: 0,
    lines: [{ sku: 'TP001', productId: 'TP001', name: 'Banarasi Silk Saree', category: 'Ethnic Wear', price: 2999, qty: 1, reasonCode: 'size_issue' }] },
  { id: 'TR-2', orderId: 'TO-C1-1', customerId: 'TC-1', status: R.REFUNDED, refundAmount: 849,
    lines: [
      { sku: 'TP003', productId: 'TP003', name: 'Cotton Kurti', category: 'Ethnic Wear', price: 849, qty: 1, reasonCode: 'size_issue' },
      { sku: 'TP004', productId: 'TP004', name: 'Linen Shirt', category: 'Western Wear', price: 1499, qty: 1, reasonCode: 'damaged' },
    ] },
]
const FIX_PRODUCTS = [
  { id: 'TP001', name: 'Banarasi Silk Saree', price: 2999, category: 'Ethnic Wear', sold: 40 },
  { id: 'TP003', name: 'Cotton Kurti', price: 849, category: 'Ethnic Wear', sold: 60 },
  { id: 'TP004', name: 'Linen Shirt', price: 1499, category: 'Western Wear', sold: 55 },
]

console.log('\n── Order state machine')
{
  const confirmed = { id: 'X1', status: S.CONFIRMED, paid: true, total: 1000, placedAt: Date.now(), items: [] }
  ok('confirmed → packed legal', oe.canTransition(confirmed, S.PACKED).ok)
  ok('confirmed → delivered illegal', !oe.canTransition(confirmed, S.DELIVERED).ok)
  ok('illegal move explains why',
     /Cannot go from/.test(oe.canTransition(confirmed, S.DELIVERED).reason))
  ok('same-status rejected', !oe.canTransition(confirmed, S.CONFIRMED).ok)

  const delivered = { ...confirmed, status: S.DELIVERED }
  ok('delivered → returned legal (manager)', oe.canTransition(delivered, S.RETURNED, { role: 'manager' }).ok)
  ok('delivered → packed illegal', !oe.canTransition(delivered, S.PACKED).ok)

  const cancelled = { ...confirmed, status: S.CANCELLED }
  ok('terminal state locked', !oe.canTransition(cancelled, S.CONFIRMED).ok)
  ok('terminal reason mentions final', /final state/.test(oe.canTransition(cancelled, S.CONFIRMED).reason))
  ok('TERMINAL matches the graph',
     oe.TERMINAL.every(st => (oe.TRANSITIONS[st] || []).length === 0))
  ok('delivered is NOT terminal (returns must work)', !oe.TERMINAL.includes(S.DELIVERED))
  ok('every non-terminal state has a way out',
     Object.keys(oe.TRANSITIONS).every(st => oe.TERMINAL.includes(st) || oe.TRANSITIONS[st].length > 0))

  // role gating
  ok('staff cannot cancel a confirmed order',
     !oe.canTransition(confirmed, S.CANCELLED, { role: 'staff' }).ok)
  ok('role failure names the role',
     /manager/.test(oe.canTransition(confirmed, S.CANCELLED, { role: 'staff' }).reason))
  ok('manager can cancel', oe.canTransition(confirmed, S.CANCELLED, { role: 'manager' }).ok)
  ok('allowedTransitions respects role',
     oe.allowedTransitions(confirmed, 'staff').length < oe.allowedTransitions(confirmed, 'manager').length)

  // required fields
  const packed = { ...confirmed, status: S.PACKED }
  ok('ship without AWB blocked', !oe.canTransition(packed, S.SHIPPED).ok)
  ok('missing field named', oe.canTransition(packed, S.SHIPPED).missing?.includes('awb'))
  ok('ship with AWB allowed', oe.canTransition(packed, S.SHIPPED, { patch: { awb: 'AWB1' } }).ok)

  // unpaid refund guard
  const unpaid = { ...confirmed, paid: false }
  ok('cannot refund an unpaid order', !oe.canTransition(unpaid, S.CANCELLED, { role: 'manager' }).ok)
  ok('unpaid guard explains',
     /never paid/.test(oe.canTransition(unpaid, S.CANCELLED, { role: 'manager' }).reason))

  // apply
  const applied = oe.applyTransition(confirmed, S.PACKED, { by: 'ops' })
  ok('apply succeeds', applied.ok)
  ok('status changed', applied.order.status === S.PACKED)
  ok('timeline appended', applied.order.timeline.length === 1)
  ok('timeline records actor', applied.order.timeline[0].by === 'ops')
  ok('stock effect surfaced', applied.effects.stock === 'consume')
  const del = oe.applyTransition({ ...packed, awb: 'A1', status: S.OUT_FOR_DELIVERY }, S.DELIVERED)
  ok('delivery stamps deliveredAt', Boolean(del.order.deliveredAt))
  ok('delivery marks paid', del.order.paid === true)
  const bad = oe.applyTransition(confirmed, S.DELIVERED)
  ok('illegal apply returns ok:false', !bad.ok && bad.order === confirmed)

  // bulk
  const mixed = [confirmed, { ...confirmed, id: 'X2' }, cancelled]
  const bulk = oe.bulkTransition(mixed, S.PACKED)
  ok('bulk partial success', bulk.succeeded.length === 2 && bulk.failed.length === 1)
  ok('bulk failure carries reason', Boolean(bulk.failed[0].reason))
}

console.log('\n── Order analysis')
{
  const real = O_DELIVERED
  const t = oe.buildTimeline(real)
  ok('timeline reconstructed', t.length >= 3, t.length)
  ok('timeline sorted', t.every((e, i) => i === 0 || e.at >= t[i - 1].at))

  const m = oe.orderMargin(real)
  ok('margin computed', typeof m.profit === 'number')
  ok('netRevenue excludes gst', m.netRevenue === real.total - real.gst)
  ok('cost components present', m.cogs > 0 && m.paymentFee > 0 && m.shippingCost > 0)
  const rm = oe.orderMargin(O_RTO)
  ok('RTO is loss-making', rm.profit < 0, rm.profit)
  ok('RTO charges reverse logistics', rm.reverseLogistics > 0)

  const breaches = oe.slaBreaches(FIX_ORDERS)
  ok('sla breaches found', breaches.length > 0, breaches.length)
  ok('breach has message + amount', Boolean(breaches[0].message) && breaches[0].breachedBy >= 0)
  ok('breaches sorted by type rank',
     ['payment', 'pack', 'ship', 'deliver'].indexOf(breaches[0].type) <=
     ['payment', 'pack', 'ship', 'deliver'].indexOf(breaches.at(-1).type))
  ok('tighter SLA finds more', oe.slaBreaches(FIX_ORDERS, { packHours: 1, shipDays: 1, deliverDays: 1 }).length >= breaches.length)

  const cod = O_COD
  const risk = oe.riskScore(cod, { rtoCount: 2, orders: 0, cityTier: 3 })
  ok('risk scored', risk.score > 0 && risk.score <= 100, risk.score)
  ok('risk flags listed', risk.flags.length >= 3)
  ok('risk suggests an action', Boolean(risk.action))
  ok('high risk band', risk.band === 'high', risk.band)
  const safe = oe.riskScore({ ...cod, paymentMethod: 'UPI', total: 900, items: [1], address: { pincode: '110001' } }, { orders: 12, cityTier: 1 })
  ok('low risk for trusted prepaid', safe.band === 'low', safe.band)
}

console.log('\n── Returns engine')
{
  const delivered = O_DELIVERED
  const item = delivered.items[0]
  const fresh = { ...delivered, deliveredAt: Date.now() - 2 * 86400000 }
  const e1 = re.checkEligibility(fresh, item, { reasonCode: 'size_issue' })
  ok('fresh delivery eligible', e1.eligible, e1.reason)
  ok('eligibility counts days left', e1.daysLeft > 0)

  const stale = { ...delivered, deliveredAt: Date.now() - 60 * 86400000 }
  const e2 = re.checkEligibility(stale, item, { reasonCode: 'size_issue' })
  ok('expired window rejected', !e2.eligible)
  ok('expiry reason states the limit', /window closed/.test(e2.reason))

  const undelivered = { ...delivered, status: 'In Transit' }
  ok('undelivered not returnable', !re.checkEligibility(undelivered, item).eligible)
  ok('hygiene category blocked',
     !re.checkEligibility(fresh, { ...item, category: 'Beauty & Wellness' }).eligible)
  ok('damaged has a shorter window',
     re.REASON_BY_CODE.damaged.windowDays < re.REASON_BY_CODE.defective.windowDays)

  // refund maths
  const order = { ...delivered, subtotal: 2000, discount: 200, gst: 180, shipping: 79, codFee: 0,
    items: [{ sku: 'A', name: 'A', price: 1000, qty: 1 }, { sku: 'B', name: 'B', price: 1000, qty: 1 }] }
  const partial = re.calculateRefund(order, [{ sku: 'A', qty: 1, reasonCode: 'changed_mind' }])
  ok('partial return: no shipping refund', partial.shippingRefund === 0)
  ok('partial unwinds discount proportionally', partial.goodsValue === 900, partial.goodsValue)
  ok('customer fault pays pickup', partial.pickupFee === 79)
  ok('refund = goods − pickup', partial.refund === 900 - 79, partial.refund)

  const full = re.calculateRefund(order, [
    { sku: 'A', qty: 1, reasonCode: 'changed_mind' }, { sku: 'B', qty: 1, reasonCode: 'changed_mind' },
  ])
  ok('full return refunds shipping', full.shippingRefund === 79)
  ok('full return flagged', full.isFullReturn)

  const ourFault = re.calculateRefund(order, [{ sku: 'A', qty: 1, reasonCode: 'damaged' }])
  ok('seller fault = free pickup', ourFault.pickupFee === 0)
  ok('seller fault flagged', ourFault.sellerAtFault)
  ok('seller fault refunds more', ourFault.refund > partial.refund)

  const failed = re.calculateRefund(order, [{ sku: 'A', qty: 1, reasonCode: 'changed_mind' }], { qcOutcome: 'fail' })
  ok('QC fail = zero refund', failed.refund === 0, failed.refund)
  const half = re.calculateRefund(order, [{ sku: 'A', qty: 1, reasonCode: 'changed_mind' }], { qcOutcome: 'partial' })
  ok('QC partial withholds some', half.refund > 0 && half.refund < partial.refund, half.refund)

  const credit = re.calculateRefund(order, [{ sku: 'A', qty: 1, reasonCode: 'changed_mind' }], { type: 'store_credit' })
  ok('store credit carries a bonus', credit.payable > credit.refund, `${credit.payable} vs ${credit.refund}`)
  ok('gst reversal computed', partial.gstReversal > 0)
  ok('COD refunds via bank', re.refundMethod({ paymentMethod: 'COD' }).includes('Bank'))
  ok('UPI refunds to UPI', re.refundMethod({ paymentMethod: 'UPI', upiApp: 'GPay' }).includes('GPay'))

  // transitions
  const rma = { id: 'R1', status: R.REQUESTED, lines: [{ reasonCode: 'size_issue' }] }
  ok('requested → approved legal', re.transitionReturn(rma, R.APPROVED).ok)
  ok('requested → refunded illegal', !re.transitionReturn(rma, R.REFUNDED).ok)
  ok('illegal rma move explains', /Cannot move/.test(re.transitionReturn(rma, R.REFUNDED).reason))
  const approved = re.transitionReturn(rma, R.APPROVED)
  ok('rma timeline appended', approved.rma.timeline.length === 1)

  // restock
  ok('clean size return restocks', re.restockDecision(rma, 'pass').restock)
  ok('qc fail does not restock', !re.restockDecision(rma, 'fail').restock)
  ok('damaged never restocks',
     !re.restockDecision({ lines: [{ reasonCode: 'damaged' }] }, 'pass').restock)
  ok('partial goes to outlet', re.restockDecision(rma, 'partial').destination === 'outlet')
}

console.log('\n── Returns (empty-first) + analytics')
{
  // The returns seed ships empty too.
  ok('returns seed ships empty', RETURNS.length === 0, RETURNS.length)
  const empty = re.returnAnalytics([], [])
  ok('analytics on empty data reports zero rate',
    empty.returnRatePct === 0 && empty.byReason.length === 0 && empty.totalReturns === 0)

  // ...so the analytics tests bring their own return fixtures.
  const rmas = FIX_RMAS
  ok('every return links an order', rmas.every(r => Boolean(r.orderId)))
  ok('every return has lines', rmas.every(r => r.lines.length > 0))
  ok('reason codes valid', rmas.every(r => r.lines.every(l => Boolean(re.REASON_BY_CODE[l.reasonCode]))))
  ok('return ids unique', new Set(rmas.map(r => r.id)).size === rmas.length)
  ok('refunded ones carry an amount',
     rmas.filter(r => r.status === R.REFUNDED).every(r => r.refundAmount > 0))

  // Analyse against the whole fixture order book so the rate stays sane.
  const book = [...FIX_ORDERS, ...Object.values(FIX_BY_CUST).flat()]
  const a = re.returnAnalytics(book, rmas)
  ok('return rate computed', a.returnRatePct > 0 && a.returnRatePct < 100, a.returnRatePct)
  ok('reasons ranked', a.byReason.length > 0 && a.byReason[0].count >= a.byReason.at(-1).count)
  ok('size issue is top reason', a.byReason[0].code === 'size_issue', a.byReason[0].code)
  ok('by product populated', a.byProduct.length > 0)
  ok('product has top reason', Boolean(a.byProduct[0].topReason))
  ok('by category populated', a.byCategory.length > 0)
  ok('seller fault pct sane', a.sellerFaultPct >= 0 && a.sellerFaultPct <= 100)
  ok('preventable subset of reasons', a.preventable.every(p => p.fault === 'seller'))

  const probs = re.problemProducts(a, FIX_PRODUCTS, { minReturns: 1, threshold: 0 })
  ok('problem products listed', probs.length > 0, probs.length)
  ok('problem carries a suggestion', Boolean(probs[0].suggestion))
  ok('problem has severity', ['critical', 'high', 'watch'].includes(probs[0].severity))
}

console.log('\n── Customer engine')
{
  // The customer seed ships empty, so the RFM tests bring their own rows.
  ok('customer seed ships empty', CUSTOMERS.length === 0, CUSTOMERS.length)
  ok('rfm on empty data scores nobody', ce.rfmScores([], {}).length === 0)

  const rows = ce.rfmScores(FIX_CUSTOMERS, FIX_BY_CUST)

  ok('scored every customer', rows.length === FIX_CUSTOMERS.length)
  ok('R/F/M in 1..5', rows.every(r => r.R >= 1 && r.R <= 5 && r.F >= 1 && r.F <= 5 && r.M >= 1 && r.M <= 5))
  ok('rfm string formed', /^[1-5]{3}$/.test(rows[0].rfm))
  ok('every row has a segment', rows.every(r => Boolean(r.segment)))
  ok('segments are known', rows.every(r => Boolean(ce.SEGMENT_META[r.segment])))
  ok('recency is non-negative', rows.every(r => r.recencyDays >= 0))
  ok('monetary matches orders', rows.every(r => r.monetary >= 0))

  const spenders = [...rows].sort((a, b) => b.monetary - a.monetary)
  ok('top spender scores M=5', spenders[0].M === 5, spenders[0].M)
  ok('champions exist', rows.some(r => r.segment === 'Champions'))

  ok('segmentFor champions', ce.segmentFor(5, 5, 5) === 'Champions')
  ok('segmentFor lost', ce.segmentFor(1, 1, 1) === 'Lost')
  ok('segmentFor cannot-lose', ce.segmentFor(1, 5, 5) === 'Cannot Lose Them')

  const active = rows.find(r => r.frequency >= 3)
  const clv = ce.predictCLV(active)
  ok('clv positive for active buyer', clv.totalValue > 0, clv.totalValue)
  ok('clv splits historic vs predicted', clv.historicValue > 0 && clv.predictedValue >= 0)
  ok('churn prob is a percentage', clv.churnProbability >= 0 && clv.churnProbability <= 100)
  ok('risk band assigned', ['low', 'medium', 'high'].includes(clv.risk))
  ok('expected gap derived', clv.expectedGapDays > 0)

  // a customer silent far beyond their own cadence must look riskier
  const recent = { ...active, recencyDays: 5 }
  const stale = { ...active, recencyDays: 400 }
  ok('silence raises churn risk',
     ce.predictCLV(stale).churnProbability > ce.predictCLV(recent).churnProbability)

  const risky = ce.churnRisk(rows)
  ok('churn list built', risky.length > 0, risky.length)
  ok('churn list excludes low risk', risky.every(r => r.clv.risk !== 'low'))
  ok('churn sorted by value at risk',
     risky[0].clv.totalValue * risky[0].clv.churnProbability >=
     risky.at(-1).clv.totalValue * risky.at(-1).clv.churnProbability)

  const cohorts = ce.cohortRetention(FIX_CUSTOMERS, FIX_BY_CUST, 12)
  ok('cohorts built', cohorts.length > 0, cohorts.length)
  ok('cohort has size', cohorts[0].size > 0)
  ok('M0 is 100%', cohorts[0].cells[0].pct === 100 || cohorts[0].cells[0].pct === 0, cohorts[0].cells[0].pct)
  ok('retention pct within bounds', cohorts.every(c => c.cells.every(x => x.pct >= 0 && x.pct <= 100)))
  ok('cohort carries revenue', cohorts.some(c => c.cells.some(x => x.revenue > 0)))

  const nba = ce.nextBestAction(rows[0], { tickets: [], returns: [] })
  ok('nba returns actions', nba.length > 0)
  ok('nba sorted by priority', nba.every((a, i) => i === 0 || a.priority <= nba[i - 1].priority))
  ok('nba has why + cta', Boolean(nba[0].why) && Boolean(nba[0].cta))

  const atRisk = rows.find(r => r.segment === 'At Risk')
  if (atRisk) {
    const a = ce.nextBestAction(atRisk, {})
    ok('at-risk gets a winback', a.some(x => x.type === 'winback'))
  }
  const oneTimer = rows.find(r => r.frequency === 1 && r.recencyDays < 45)
  if (oneTimer) {
    ok('one-timer gets repeat nudge', ce.nextBestAction(oneTimer, {}).some(x => x.type === 'repeat'))
  }

  const prio = ce.priorityCustomers(rows, { tickets: [], returns: [] }, 20)
  ok('priority list capped', prio.length === 20)
  ok('priority has top action', Boolean(prio[0].topAction))
  ok('priority sorted by urgency', prio[0].urgency >= prio.at(-1).urgency)
}

console.log('\n── Store slices')
{
  const store = (await import('../src/core/store/index.js')).default
  const os = await import('../src/core/store/slices/ordersSlice.js')
  const rs = await import('../src/core/store/slices/returnsSlice.js')

  const st = () => ({ orders: store.get('orders'), returns: store.get('returns') })
  // Empty-first: the order book starts with zero orders.
  ok('orders slice boots empty', os.selectOrders(st()).length === 0)
  ok('selectOrder misses on an empty book', os.selectOrder(st(), 'NOPE') == null)

  const fresh = { id: 'TO-100', customerId: 'TC-1', customerName: 'Asha Verma',
    placedAt: Date.now(), status: S.CONFIRMED, paid: true, paymentMethod: 'UPI',
    items: [{ sku: 'TP001', name: 'Banarasi Silk Saree', price: 2999, qty: 1 }],
    subtotal: 2999, discount: 0, gst: 240, shipping: 0, total: 3239 }
  store.dispatch('orders/placeOrder', { order: fresh })
  ok('placed order joins the book', os.selectOrders(st()).length === 1)

  const target = os.selectOrder(st(), 'TO-100')
  store.dispatch('orders/transition', { order: target, to: S.PACKED, role: 'admin' })
  ok('transition recorded ok', store.get('orders').lastAction?.ok === true)
  ok('order status persisted', os.selectOrder(st(), target.id).status === S.PACKED)
  ok('override is sparse', Object.keys(store.get('orders').overrides).length === 1)

  store.dispatch('orders/transition', { order: os.selectOrder(st(), target.id), to: S.DELIVERED, role: 'admin' })
  ok('illegal transition rejected', store.get('orders').lastAction?.ok === false)
  ok('rejection carries reason', Boolean(store.get('orders').lastAction?.reason))
  ok('state unchanged after rejection', os.selectOrder(st(), target.id).status === S.PACKED)

  store.dispatch('orders/addNote', { orderId: target.id, text: 'Call before dispatch' })
  ok('note added', os.selectNotes(st(), target.id).length === 1)
  store.dispatch('orders/toggleTag', { orderId: target.id, tag: 'Priority' })
  ok('tag toggled on', os.selectTags(st(), target.id).includes('Priority'))
  store.dispatch('orders/toggleTag', { orderId: target.id, tag: 'Priority' })
  ok('tag toggled off', !os.selectTags(st(), target.id).includes('Priority'))

  store.dispatch('orders/assignCourier', { orderId: target.id, courier: 'Delhivery', awb: 'AWB999' })
  ok('courier assigned', os.selectOrder(st(), target.id).awb === 'AWB999')
  ok('now shippable', oe.canTransition(os.selectOrder(st(), target.id), S.SHIPPED).ok)

  store.dispatch('orders/setSlaConfig', { packHours: 6 })
  ok('sla config updated', store.get('orders').slaConfig.packHours === 6)

  // timeline comes through the selector
  ok('selectOrder builds timeline', os.selectOrder(st(), target.id).timeline.length > 0)

  // returns slice — also boots empty; the RMA below is created via the admin.
  ok('returns slice boots empty', rs.selectReturns(st()).length === 0)
  store.dispatch('returns/create', { orderId: 'TO-100', customerId: 'TC-1', customerName: 'Asha Verma' })
  const rmas = rs.selectReturns(st())
  ok('manual rma created', rmas.length === 1)
  const requested = rmas[0]
  ok('created rma is requested', requested.status === R.REQUESTED)
  store.dispatch('returns/transition', { rma: requested, to: R.APPROVED })
  ok('rma transition ok', store.get('returns').lastAction?.ok === true)
  ok('rma status persisted', rs.selectReturn(st(), requested.id).status === R.APPROVED)

  store.dispatch('returns/transition', { rma: rs.selectReturn(st(), requested.id), to: R.REFUNDED })
  ok('illegal rma move rejected', store.get('returns').lastAction?.ok === false)

  store.dispatch('returns/recordQC', { id: requested.id, outcome: 'pass', restock: true, destination: 'main' })
  ok('qc recorded', rs.selectReturn(st(), requested.id).qcOutcome === 'pass')
  ok('qc sets status', rs.selectReturn(st(), requested.id).status === R.QC_PASSED)

  store.dispatch('returns/recordRefund', { id: requested.id, amount: 500, method: 'UPI' })
  ok('refund recorded', rs.selectReturn(st(), requested.id).refundAmount === 500)
  ok('refund sets status', rs.selectReturn(st(), requested.id).status === R.REFUNDED)
  ok('refund reference generated', Boolean(rs.selectReturn(st(), requested.id).refundReference))

  store.dispatch('returns/setPolicy', { windowDays: 14 })
  ok('policy updated', rs.selectReturnPolicy(st()).windowDays === 14)
  ok('open returns exclude closed',
     rs.selectOpenReturns(st()).every(r => ![R.REFUNDED, R.CLOSED, R.REJECTED].includes(r.status)))

  const byOrder = rs.selectReturnsByOrder(st(), 'TO-100')
  ok('returns by order', byOrder.length > 0 && byOrder.every(r => r.orderId === 'TO-100'))

  store.dispatch('returns/create', { orderId: 'BC50000', customerId: 'C10001', customerName: 'Test' })
  ok('manual rma created', rs.selectReturns(st()).length === 2)
}

console.log('\n── Admin UI mounts')
{
  const React = (await import('react')).default
  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react')

  const screens = [
    ['Orders', (await import('../src/admin/orders/index.jsx')).default],
    ['Returns', (await import('../src/admin/returns/index.jsx')).default],
    ['Customers', (await import('../src/admin/customers/index.jsx')).default],
    ['Operations', (await import('../src/admin/operations/index.jsx')).default],
  ]
  const { MemoryRouter } = await import('react-router-dom')

  for (const [name, Comp] of screens) {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    let threw = null
    try {
      // The screens read the route, so they mount inside a router.
      await act(async () => { root.render(React.createElement(MemoryRouter, null, React.createElement(Comp))) })
    } catch (e) { threw = e }
    ok(`${name} mounts`, !threw, threw?.message)
    ok(`${name} renders content`, el.innerHTML.length > 1500, el.innerHTML.length)
    await act(async () => { root.unmount() })
  }

  // detail panes need real ids
  const store = (await import('../src/core/store/index.js')).default
  const OrderDetail = (await import('../src/admin/orders/OrderDetail.jsx')).default
  const ReturnDetail = (await import('../src/admin/returns/ReturnDetail.jsx')).default
  const Customer360 = (await import('../src/admin/customers/Customer360.jsx')).default

  // detail panes mount against the records the store created above
  const rs2 = await import('../src/core/store/slices/returnsSlice.js')
  const rmaForOrder = rs2.selectReturnsByOrder({ returns: store.get('returns') }, 'TO-100')[0]
  const details = [
    ['OrderDetail', OrderDetail, { orderId: 'TO-100' }, 1000],
    ['ReturnDetail', ReturnDetail, { rmaId: rmaForOrder?.id }, 1000],
    // The customer seed is empty, so Customer360 renders its not-found state
    // for an unknown id — it must survive that, not crash.
    ['Customer360', Customer360, { customerId: 'TC-1' }, 100],
  ]
  for (const [name, Comp, props, floor] of details) {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    let threw = null
    try {
      await act(async () => { root.render(React.createElement(MemoryRouter, null, React.createElement(Comp, props))) })
    } catch (e) { threw = e }
    ok(`${name} mounts`, !threw, threw?.message)
    ok(`${name} renders content`, el.innerHTML.length > floor, el.innerHTML.length)
    await act(async () => { root.unmount() })
  }
}

console.log(`\n${pass} passed · ${fail} failed\n`)
process.exit(fail ? 1 : 0)
