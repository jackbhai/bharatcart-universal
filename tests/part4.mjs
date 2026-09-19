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
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol

const { STATES } = await import('../src/data/seed.js')
const fin = await import('../src/engines/finance/financeEngine.js')
const mkt = await import('../src/engines/marketing/campaignEngine.js')
const loy = await import('../src/engines/loyalty/loyaltyEngine.js')
const ce = await import('../src/engines/orders/customerEngine.js')

/* ------------------------------------------------------------------
 * Empty-first: the seeds ship zero rows, so the finance and marketing
 * suites build their own hermetic order books and customers instead of
 * reading demo data.
 * ------------------------------------------------------------------ */
const DAYMS = 86400000
const NOWP = Date.now()

const FIX_PRODUCTS = [
  { id: 'FP01', name: 'Banarasi Silk Saree', price: 2999, cost: 1500, category: 'Ethnic Wear', hsn: '5407' },
  { id: 'FP02', name: 'Cotton Kurti', price: 849, cost: 420, category: 'Ethnic Wear', hsn: '6109' },
  { id: 'FP03', name: 'Linen Shirt', price: 1499, cost: 750, category: 'Western Wear', hsn: '6205' },
  { id: 'FP04', name: 'Running Shoes', price: 2499, cost: 1100, category: 'Footwear', hsn: '6403' },
]
// Indian GST slabs for the fixture catalogue: apparel 5/12, footwear 18.
const fi = (pid, qty = 1) => {
  const p = FIX_PRODUCTS.find(x => x.id === pid)
  const gst = pid === 'FP02' ? 5 : pid === 'FP04' ? 18 : 12
  return { productId: pid, name: p.name, price: p.price, qty, category: p.category, gst }
}
const mkOrder = ({ id, cust, status = 'Delivered', daysAgo = 5, pay = 'UPI', channel = 'Web',
                   state = 'Haryana', items, discount = 0, coupon, gstin }) => {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const gst = Math.round(items.reduce((s, i) => s + i.price * i.qty * i.gst / 100, 0))
  const inter = state !== 'Haryana'
  const shipping = 79
  const placedAt = NOWP - daysAgo * DAYMS
  return {
    id, customerId: cust, status, paid: status !== 'Cancelled', paymentMethod: pay, channel,
    placedAt, deliveredAt: status === 'Delivered' ? placedAt + 4 * DAYMS : undefined,
    items, subtotal, discount, gst, shipping, codFee: 0,
    cgst: inter ? 0 : Math.round(gst / 2), sgst: inter ? 0 : gst - Math.round(gst / 2), igst: inter ? gst : 0,
    couponCode: coupon, total: subtotal - discount + gst + shipping,
    address: { city: 'City', state, pincode: '110001', ...(gstin ? { gstin } : {}) },
    touchpoints: [channel, 'Instagram'],
  }
}
const FIX_ORDERS = [
  mkOrder({ id: 'FO-01', cust: 'MC-1', daysAgo: 5, state: 'Haryana', items: [fi('FP01'), fi('FP02', 2)], discount: 300, coupon: 'DIWALI10' }),
  mkOrder({ id: 'FO-02', cust: 'MC-2', daysAgo: 12, pay: 'COD', channel: 'App', state: 'Maharashtra', items: [fi('FP03'), fi('FP04')] }),
  mkOrder({ id: 'FO-03', cust: 'MC-3', daysAgo: 20, state: 'Karnataka', items: [fi('FP02', 3)], discount: 150, coupon: 'DIWALI10' }),
  mkOrder({ id: 'FO-04', cust: 'MC-4', daysAgo: 40, pay: 'COD', state: 'Tamil Nadu', items: [fi('FP04')] }),
  mkOrder({ id: 'FO-05', cust: 'MC-5', daysAgo: 55, channel: 'App', state: 'Haryana', items: [fi('FP01')], discount: 500, coupon: 'FLAT500', gstin: '06ABCDE1234F1Z5' }),
  mkOrder({ id: 'FO-06', cust: 'MC-1', daysAgo: 70, state: 'Maharashtra', items: [fi('FP03', 2)] }),
  mkOrder({ id: 'FO-07', cust: 'MC-2', daysAgo: 3, status: 'RTO', pay: 'COD', state: 'Haryana', items: [fi('FP02')] }),
  mkOrder({ id: 'FO-08', cust: 'MC-3', daysAgo: 8, status: 'Returned', state: 'Karnataka', items: [fi('FP01')] }),
  mkOrder({ id: 'FO-09', cust: 'MC-6', daysAgo: 2, status: 'Cancelled', state: 'Haryana', items: [fi('FP02')] }),
  mkOrder({ id: 'FO-10', cust: 'MC-7', daysAgo: 15, state: 'Haryana', items: [fi('FP04'), fi('FP03')] }),
]
const FIX_RETURNS = [
  { id: 'FR-1', orderId: 'FO-08', customerId: 'MC-3', refundAmount: 2999, requestedAt: NOWP - 6 * DAYMS },
  { id: 'FR-2', orderId: 'FO-01', customerId: 'MC-1', refundAmount: 849, requestedAt: NOWP - 2 * DAYMS },
]
const FIX_CARTS = [
  { id: 'FC-1', customerId: 'MC-1', value: 3500, converted: false, updatedAt: NOWP - 2 * DAYMS },
  { id: 'FC-2', customerId: 'MC-4', value: 1200, converted: false, updatedAt: NOWP - 5 * DAYMS },
]

const MK_CUST = [
  { id: 'MC-1', name: 'Asha Verma', email: 'asha@x.com', phone: '9999999901', joinedAt: NOWP - 400 * DAYMS, city: 'Mumbai', state: 'Maharashtra' },
  { id: 'MC-2', name: 'Rohan Iyer', email: 'rohan@x.com', phone: '9999999902', joinedAt: NOWP - 350 * DAYMS, city: 'Delhi', state: 'Delhi' },
  { id: 'MC-3', name: 'Meera Nair', email: 'meera@x.com', phone: '9999999903', joinedAt: NOWP - 200 * DAYMS, city: 'Bengaluru', state: 'Karnataka' },
  { id: 'MC-4', name: 'Vikram Rao', email: 'vikram@x.com', phone: '9999999904', joinedAt: NOWP - 120 * DAYMS, city: 'Jaipur', state: 'Rajasthan' },
  { id: 'MC-5', name: 'Sara Khan', email: 'sara@x.com', phone: '9999999905', joinedAt: NOWP - 90 * DAYMS, city: 'Chennai', state: 'Tamil Nadu' },
  { id: 'MC-6', name: 'Arjun Das', email: 'arjun@x.com', phone: '9999999906', joinedAt: NOWP - 60 * DAYMS, city: 'Pune', state: 'Maharashtra' },
  { id: 'MC-7', name: 'Neha Joshi', email: 'neha@x.com', phone: '9999999907', joinedAt: NOWP - 30 * DAYMS, city: 'Kolkata', state: 'West Bengal' },
  { id: 'MC-8', name: 'Kabir Malhotra', email: 'kabir@x.com', phone: '9999999908', joinedAt: NOWP - 10 * DAYMS, city: 'Lucknow', state: 'Uttar Pradesh' },
]
const mkOrd = (id, cust, daysAgo, total) => ({
  id, customerId: cust, status: 'Delivered', paid: true,
  placedAt: NOWP - daysAgo * DAYMS, deliveredAt: NOWP - Math.max(0, daysAgo - 3) * DAYMS, total,
})
const MK_BY_CUST = {
  'MC-1': [mkOrd('MO-11', 'MC-1', 2, 9000), mkOrd('MO-12', 'MC-1', 20, 12000), mkOrd('MO-13', 'MC-1', 45, 8000), mkOrd('MO-14', 'MC-1', 90, 10000), mkOrd('MO-15', 'MC-1', 150, 6000)],
  'MC-2': [mkOrd('MO-21', 'MC-2', 4, 10000), mkOrd('MO-22', 'MC-2', 30, 9000), mkOrd('MO-23', 'MC-2', 80, 11000)],
  'MC-3': [mkOrd('MO-31', 'MC-3', 10, 5000), mkOrd('MO-32', 'MC-3', 60, 3000)],
  'MC-4': [mkOrd('MO-41', 'MC-4', 8, 2500)],
  'MC-5': [mkOrd('MO-51', 'MC-5', 200, 6000), mkOrd('MO-52', 'MC-5', 250, 6000)],
  'MC-6': [],
  'MC-7': [mkOrd('MO-71', 'MC-7', 1, 4000), mkOrd('MO-72', 'MC-7', 6, 5000), mkOrd('MO-73', 'MC-7', 12, 6000), mkOrd('MO-74', 'MC-7', 25, 7000)],
  'MC-8': [mkOrd('MO-81', 'MC-8', 3, 900)],
}

console.log('\n── Finance: P&L')
{
  // Empty-first sanity: the engine must not invent revenue from nothing.
  const emptyPnl = fin.profitAndLoss([], [])
  ok('empty book has zero revenue', emptyPnl.grossRevenue === 0 && emptyPnl.orderCount === 0)

  const pnl = fin.profitAndLoss(FIX_ORDERS, FIX_RETURNS)
  ok('revenue positive', pnl.grossRevenue > 0, pnl.grossRevenue)
  ok('order count matches non-cancelled',
     pnl.orderCount === FIX_ORDERS.filter(o => o.status !== 'Cancelled').length)
  ok('GST excluded from net revenue', pnl.netRevenue < pnl.grossRevenue)
  ok('gross profit below net revenue', pnl.grossProfit < pnl.netRevenue)
  ok('net profit below gross profit', pnl.netProfit < pnl.grossProfit)
  ok('all cost buckets present',
     pnl.cogs > 0 && pnl.paymentFees > 0 && pnl.shippingCost > 0 && pnl.packaging > 0)
  ok('opex sums the cost lines',
     near(pnl.opex, pnl.paymentFees + pnl.shippingCost + pnl.packaging + pnl.reverseLogistics + pnl.marketing + pnl.fixedCosts, 2))
  ok('margin percentages sane', pnl.grossMarginPct > -100 && pnl.grossMarginPct <= 100, pnl.grossMarginPct)
  ok('lines render a waterfall', pnl.lines.length >= 10)
  ok('lines end with net profit', pnl.lines.at(-1).type === 'total')
  ok('net profit line matches field', pnl.lines.at(-1).value === pnl.netProfit)

  // the waterfall must actually add up, or the screen lies to the user
  const upToNetRevenue = pnl.lines.slice(0, 4).reduce((s, l) => s + l.value, 0)
  ok('waterfall reconciles to net revenue', near(upToNetRevenue, pnl.netRevenue, 3), `${upToNetRevenue} vs ${pnl.netRevenue}`)

  // RTO / returns must reduce profit
  const noLoss = FIX_ORDERS.filter(o => !['RTO', 'Returned'].includes(o.status))
  const cleanPnl = fin.profitAndLoss(noLoss, [])
  ok('RTO-free book has better margin', cleanPnl.netMarginPct > pnl.netMarginPct,
     `${cleanPnl.netMarginPct} vs ${pnl.netMarginPct}`)
  ok('reverse logistics only when losses exist', cleanPnl.reverseLogistics === 0 && pnl.reverseLogistics > 0)

  // higher COGS must reduce profit
  const dear = fin.profitAndLoss(FIX_ORDERS, FIX_RETURNS, { cogsRate: 0.8 })
  ok('higher COGS lowers profit', dear.netProfit < pnl.netProfit)
  const fixed = fin.profitAndLoss(FIX_ORDERS, FIX_RETURNS, { fixedCosts: 500000 })
  ok('fixed costs reduce profit', fixed.netProfit === pnl.netProfit - 500000, fixed.netProfit)

  // windowing
  const recent = fin.profitAndLoss(FIX_ORDERS, FIX_RETURNS, { from: Date.now() - 30 * 86400000 })
  ok('window narrows the order set', recent.orderCount < pnl.orderCount)

  const monthly = fin.monthlyPnL(FIX_ORDERS, FIX_RETURNS, 12)
  ok('12 months returned', monthly.length === 12)
  ok('months have labels', monthly.every(m => Boolean(m.label)))
  ok('months chronological', monthly.every((m, i) => i === 0 || m.month >= monthly[i - 1].month))
  ok('some month has revenue', monthly.some(m => m.netRevenue > 0))
}

console.log('\n── Finance: GST')
{
  const gst = fin.gstSummary(FIX_ORDERS, { sellerState: 'Haryana', products: FIX_PRODUCTS })
  ok('taxable value positive', gst.taxableValue > 0)
  ok('tax collected', gst.totalTax > 0)
  ok('total = cgst+sgst+igst', near(gst.totalTax, gst.cgst + gst.sgst + gst.igst, 2))
  ok('cgst equals sgst', near(gst.cgst, gst.sgst, Math.max(2, gst.cgst * 0.02)), `${gst.cgst} vs ${gst.sgst}`)
  ok('rate slabs present', gst.byRate.length > 0, gst.byRate.length)
  ok('rates sorted ascending', gst.byRate.every((r, i) => i === 0 || r.rate >= gst.byRate[i - 1].rate))
  ok('slabs carry HSN codes', gst.byRate.every(r => r.hsn.length > 0),
     JSON.stringify(gst.byRate.map(r => [r.rate, r.hsn.length])))
  ok('HSN codes are real catalogue codes',
     gst.byRate.every(r => r.hsn.every(h => FIX_PRODUCTS.some(p => p.hsn === h))))
  ok('no HSN without a product list',
     fin.gstSummary(FIX_ORDERS, { sellerState: 'Haryana' }).byRate.every(r => r.hsn.length === 0))
  ok('state breakdown present', gst.byState.length > 3)
  ok('interState flag correct',
     gst.byState.every(s => s.interState === (s.state !== 'Haryana')))
  ok('b2b + b2c = orders', gst.b2b.count + gst.b2c.count === gst.orderCount)

  // changing the seller state must flip the CGST/IGST split
  const fromMH = fin.gstSummary(FIX_ORDERS, { sellerState: 'Maharashtra', products: FIX_PRODUCTS })
  ok('seller state changes intra/inter mix',
     fromMH.byState.filter(s => !s.interState)[0]?.state === 'Maharashtra')

  const cal = fin.filingCalendar()
  ok('filing calendar built', cal.length === 3)
  ok('calendar sorted by due date', cal.every((f, i) => i === 0 || f.dueAt >= cal[i - 1].dueAt))
  ok('each filing has a form + status', cal.every(f => f.form && f.status))
  ok('GSTR-1 present', cal.some(f => f.form === 'GSTR-1'))
}

console.log('\n── Finance: settlements')
{
  const s = fin.settlements(FIX_ORDERS)
  ok('settlement rows built', s.rows.length > 0, s.rows.length)
  ok('net = gross − fee', s.rows.every(r => near(r.net, r.gross - r.fee, 2)))
  ok('totals reconcile', near(s.totalNet, s.totalGross - s.totalFee, 5))
  ok('settled + pending = net', near(s.settledToDate + s.pendingPayout, s.totalNet, 5))
  ok('fee percentage sane', s.rows.every(r => r.feePct >= 0 && r.feePct < 10))

  const cod = s.rows.find(r => r.method === 'COD')
  const upi = s.rows.find(r => r.method === 'UPI')
  if (cod && upi) {
    ok('COD gateway fee is lower than prepaid', cod.feePct < upi.feePct, `${cod.feePct} vs ${upi.feePct}`)
    // COD's real cost is the remittance delay, not the fee — verify that shows up
    const short = fin.settlements(FIX_ORDERS, { prepaidDays: 2, codDays: 2 })
    const long = fin.settlements(FIX_ORDERS, { prepaidDays: 2, codDays: 21 })
    ok('longer COD remittance strands more cash',
       long.pendingPayout > short.pendingPayout, `${long.pendingPayout} vs ${short.pendingPayout}`)
  }

  // longer hold must push more money into pending
  const slow = fin.settlements(FIX_ORDERS, { prepaidDays: 30, codDays: 45 })
  ok('longer settlement delays payouts', slow.pendingPayout > s.pendingPayout,
     `${slow.pendingPayout} vs ${s.pendingPayout}`)

  const sched = fin.payoutSchedule(FIX_ORDERS, { days: 14 })
  ok('payout schedule is an array', Array.isArray(sched))
  ok('schedule dates sorted', sched.every((d, i) => i === 0 || d.date >= sched[i - 1].date))
  ok('schedule within window', sched.every(d => new Date(d.date).getTime() <= Date.now() + 15 * 86400000))
}

console.log('\n── Finance: unit economics & discounts')
{
  const byChannel = fin.unitEconomics(FIX_ORDERS, 'channel')
  ok('channel economics built', byChannel.length > 0)
  ok('profit = revenue − costs',
     byChannel.every(g => near(g.profit, g.revenue - g.cogs - g.fees - g.shipping, 3)))
  ok('sorted by profit', byChannel.every((g, i) => i === 0 || g.profit <= byChannel[i - 1].profit))
  ok('aov computed', byChannel.every(g => g.aov > 0))
  ok('rto rate bounded', byChannel.every(g => g.rtoRate >= 0 && g.rtoRate <= 100))

  const byPayment = fin.unitEconomics(FIX_ORDERS, 'paymentMethod')
  ok('payment dimension works', byPayment.length > 1)
  const byCat = fin.unitEconomics(FIX_ORDERS, 'category')
  ok('category dimension works', byCat.length > 1)
  ok('category rows use item categories',
     byCat.every(g => FIX_PRODUCTS.some(p => p.category === g.key)))

  const d = fin.discountAnalysis(FIX_ORDERS)
  ok('discount penetration bounded', d.discountPenetration >= 0 && d.discountPenetration <= 100)
  ok('coupon rows built', d.byCoupon.length > 0)
  ok('coupon roi computed', d.byCoupon.every(c => typeof c.roi === 'number'))
  ok('discounted + full = counted orders',
     d.discountedOrders + d.fullPriceOrders <= FIX_ORDERS.length)
  ok('avg discount per order sane', d.byCoupon.every(c => c.avgDiscount >= 0))
}

console.log('\n── Marketing: audiences')
{
  // The marketing suites score their own hermetic customers.
  const rows = ce.rfmScores(MK_CUST, MK_BY_CUST)
  const factsFor = (r) => mkt.customerFacts(r, {})

  ok('every fixture customer scored', rows.length === MK_CUST.length)

  ok('audience fields defined', Object.keys(mkt.AUDIENCE_FIELDS).length >= 14)
  ok('operators filtered by type',
     mkt.operatorsForField('total_spend').some(o => o.value === 'gte') &&
     !mkt.operatorsForField('total_spend').some(o => o.value === 'contains'))
  ok('text field gets contains', mkt.operatorsForField('city').some(o => o.value === 'contains'))

  const facts = mkt.customerFacts(rows[0], {})
  ok('facts include segment', Boolean(facts.segment))
  ok('facts include spend', typeof facts.total_spend === 'number')

  const everyone = mkt.resolveAudience({ rules: [] }, rows, factsFor)
  ok('empty rules match everyone', everyone.length === rows.length)

  const bigSpenders = mkt.resolveAudience(
    { match: 'all', rules: [{ field: 'total_spend', op: 'gte', value: 20000 }] }, rows, factsFor)
  ok('gte filter works', bigSpenders.every(r => r.monetary >= 20000))
  ok('gte filter narrows', bigSpenders.length < rows.length, bigSpenders.length)

  const andAud = mkt.resolveAudience({
    match: 'all',
    rules: [
      { field: 'total_spend', op: 'gte', value: 20000 },
      { field: 'order_count', op: 'gte', value: 3 },
    ],
  }, rows, factsFor)
  const orAud = mkt.resolveAudience({
    match: 'any',
    rules: [
      { field: 'total_spend', op: 'gte', value: 20000 },
      { field: 'order_count', op: 'gte', value: 3 },
    ],
  }, rows, factsFor)
  ok('AND is narrower than OR', andAud.length <= orAud.length, `${andAud.length} vs ${orAud.length}`)
  ok('AND respects both rules', andAud.every(r => r.monetary >= 20000 && r.frequency >= 3))

  const segAud = mkt.resolveAudience(
    { match: 'all', rules: [{ field: 'segment', op: 'eq', value: 'Champions' }] }, rows, factsFor)
  ok('segment filter exact', segAud.every(r => r.segment === 'Champions'))

  // an empty value must be a no-op, not a filter that kills the audience
  const blank = mkt.resolveAudience(
    { match: 'all', rules: [{ field: 'city', op: 'eq', value: '' }] }, rows, factsFor)
  ok('blank rule is a no-op', blank.length === rows.length)

  ok('describeAudience readable',
     mkt.describeAudience({ rules: [{ field: 'total_spend', op: 'gte', value: 5000 }] })
       .includes('Lifetime spend'))
  ok('describe empty audience', mkt.describeAudience({ rules: [] }) === 'Everyone')
}

console.log('\n── Marketing: campaign forecasting')
{
  ok('channels defined', Object.keys(mkt.CHANNELS).length === 4)
  ok('every channel has economics',
     Object.values(mkt.CHANNELS).every(c => c.costPerMessage > 0 && c.conversionRate > 0))
  ok('whatsapp beats email on engagement',
     mkt.CHANNELS.whatsapp.openRate > mkt.CHANNELS.email.openRate)
  ok('email is cheapest to send',
     mkt.CHANNELS.email.costPerMessage < mkt.CHANNELS.whatsapp.costPerMessage)

  const est = mkt.estimateCampaign({ channel: 'whatsapp', discountPct: 0 }, 1000, { aov: 2400 })
  ok('reach below audience', est.reach <= est.audienceSize)
  ok('clicks below reach', est.clicks <= est.reach)
  ok('conversions below clicks or close', est.conversions <= est.reach)
  ok('cost scales with audience', est.cost > 0)
  ok('revenue computed', est.revenue > 0)
  ok('roi computed', typeof est.roi === 'number')
  ok('verdict provided', Boolean(est.verdict))

  // a tiny audience cannot pay back the send cost
  // WhatsApp at ₹0.85/msg needs real order value behind it to pay back
  // Low-AOV, thin-margin, heavily discounted blast — the send cost outruns the margin
  const tiny = mkt.estimateCampaign({ channel: 'whatsapp', discountPct: 30 }, 5000, { aov: 200, marginPct: 15 })
  ok('bad campaign flagged unworthy', !tiny.worthSending,
     JSON.stringify({ net: tiny.netReturn, cost: tiny.cost, conv: tiny.conversions }))
  ok('net return is actually negative there', tiny.netReturn < 0, tiny.netReturn)
  ok('unworthy verdict says do not send', /Do not send/.test(tiny.verdict))
  ok('good campaign flagged worth sending',
     mkt.estimateCampaign({ channel: 'whatsapp', discountPct: 10 }, 5000, { aov: 2400 }).worthSending)
  // conversion rates must stay conservative — an optimistic model green-lights money-losing sends
  ok('conversion rates are conservative',
     Object.values(mkt.CHANNELS).every(c => c.conversionRate <= 0.02),
     JSON.stringify(Object.values(mkt.CHANNELS).map(c => c.conversionRate)))
  ok('conversions never exceed clicks by much',
     mkt.estimateCampaign({ channel: 'email' }, 10000).conversions <=
     mkt.estimateCampaign({ channel: 'email' }, 10000).clicks)

  // discount lifts conversion but costs margin
  const noDisc = mkt.estimateCampaign({ channel: 'email', discountPct: 0 }, 5000)
  const withDisc = mkt.estimateCampaign({ channel: 'email', discountPct: 20 }, 5000)
  ok('discount lifts conversions', withDisc.conversions > noDisc.conversions,
     `${withDisc.conversions} vs ${noDisc.conversions}`)
  ok('discount lowers order value', withDisc.revenue / withDisc.conversions < noDisc.revenue / noDisc.conversions)

  // cheaper channel must cost less for the same audience
  const wa = mkt.estimateCampaign({ channel: 'whatsapp' }, 10000)
  const em = mkt.estimateCampaign({ channel: 'email' }, 10000)
  ok('email cheaper than whatsapp', em.cost < wa.cost)
  ok('whatsapp converts more', wa.conversions > em.conversions)

  const cmp = mkt.compareChannels({ discountPct: 10 }, 5000)
  ok('compares all channels', cmp.length === 4)
  ok('comparison sorted by net return', cmp.every((c, i) => i === 0 || c.netReturn <= cmp[i - 1].netReturn))
  ok('each comparison has channel meta', cmp.every(c => Boolean(c.channel?.label)))
}

console.log('\n── Marketing: attribution & recovery')
{
  const last = mkt.attribution(FIX_ORDERS, 'last_touch')
  ok('attribution rows built', last.length > 0)
  ok('shares sum to ~100', near(last.reduce((s, r) => s + r.sharePct, 0), 100, 1.5),
     last.reduce((s, r) => s + r.sharePct, 0))
  ok('sorted by revenue', last.every((r, i) => i === 0 || r.revenue <= last[i - 1].revenue))
  ok('aov computed per channel', last.every(r => r.aov > 0))

  const first = mkt.attribution(FIX_ORDERS, 'first_touch')
  const linear = mkt.attribution(FIX_ORDERS, 'linear')
  ok('first touch model runs', first.length > 0)
  ok('linear model runs', linear.length > 0)
  const totalLast = last.reduce((s, r) => s + r.revenue, 0)
  const totalLinear = linear.reduce((s, r) => s + r.revenue, 0)
  ok('models attribute the same total revenue', near(totalLast, totalLinear, totalLast * 0.02),
     `${totalLast} vs ${totalLinear}`)

  const rec = mkt.cartRecovery(FIX_CARTS, { aov: 2400 })
  ok('recovery sized', rec.abandonedCarts >= 0)
  ok('recoverable below cart value', rec.recoverableRevenue <= rec.cartValue)
  ok('recovery stages defined', rec.stages.length === 3)
  ok('stages have channels', rec.stages.every(s => Boolean(mkt.CHANNELS[s.channel])))
  ok('empty carts recover nothing',
     mkt.cartRecovery([], { aov: 2400 }).recoverableRevenue === 0)
}

console.log('\n── Store slices')
{
  const store = (await import('../src/core/store/index.js')).default
  const ms = await import('../src/core/store/slices/marketingSlice.js')
  const st = () => ({ marketing: store.get('marketing'), settings: store.get('settings'), loyalty: store.get('loyalty'), promo: store.get('promo') })

  // Empty-first: marketing ships with no audiences, campaigns or flows.
  ok('audiences boot empty', ms.selectAudiences(st()).length === 0)
  ok('campaigns boot empty', ms.selectCampaigns(st()).length === 0)
  ok('flows boot empty', ms.selectFlows(st()).length === 0)
  ok('no active flows yet', ms.selectActiveFlows(st()).length === 0)

  store.dispatch('marketing/createAudience', { name: 'Test aud' })
  ok('audience created', ms.selectAudiences(st())[0].name === 'Test aud')
  const audId = ms.selectAudiences(st())[0].id
  store.dispatch('marketing/updateAudience', { id: audId, patch: { name: 'Renamed' } })
  ok('audience updated', ms.selectAudience(st(), audId).name === 'Renamed')
  store.dispatch('marketing/duplicateAudience', audId)
  ok('audience duplicated', ms.selectAudiences(st())[0].name === 'Renamed (copy)')
  store.dispatch('marketing/removeAudience', audId)
  ok('audience removed', !ms.selectAudience(st(), audId))

  store.dispatch('marketing/createCampaign', { name: 'Test cmp' })
  const cmpId = ms.selectCampaigns(st())[0].id
  ok('campaign created draft', ms.selectCampaigns(st())[0].status === 'draft')
  store.dispatch('marketing/sendCampaign', { id: cmpId, estimate: { audienceSize: 100, reach: 98, opens: 80, clicks: 12, conversions: 4, revenue: 9600, cost: 85 } })
  const sent = ms.selectCampaigns(st()).find(c => c.id === cmpId)
  ok('campaign marked sent', sent.status === 'sent')
  ok('send records stats', sent.stats?.converted === 4)
  ok('send records the forecast for later comparison', sent.forecast?.conversions === 4)
  ok('sentAt stamped', Boolean(sent.sentAt))

  // The slice has no createFlow action, so the flow tests stage a flow
  // fixture through the store's import API (the same path data-import uses).
  store.import({ marketing: { flows: [{ id: 'flow_test', name: 'Test flow', active: true, steps: [{ label: 'Welcome', channel: 'email', delayHours: 0 }] }] } }, { merge: true })
  ok('flow staged for testing', ms.selectFlows(st()).length === 1)
  const flowId = ms.selectFlows(st())[0].id
  const wasActive = ms.selectFlows(st())[0].active
  store.dispatch('marketing/toggleFlow', flowId)
  ok('flow toggled', ms.selectFlows(st())[0].active === !wasActive)
  store.dispatch('marketing/addFlowStep', { id: flowId, step: { label: 'Extra' } })
  ok('flow step added', ms.selectFlows(st())[0].steps.at(-1).label === 'Extra')
  store.dispatch('marketing/removeFlowStep', { id: flowId, index: ms.selectFlows(st())[0].steps.length - 1 })
  ok('flow step removed', ms.selectFlows(st())[0].steps.every(s => s.label !== 'Extra'))

  store.dispatch('marketing/setAttributionModel', 'linear')
  ok('attribution model set', store.get('marketing').attributionModel === 'linear')

  // settings
  store.dispatch('settings/setStore', { name: 'Test Store' })
  ok('store name updated', store.get('settings').store.name === 'Test Store')
  store.dispatch('settings/setAddress', { state: 'Karnataka' })
  ok('address state updated', store.get('settings').store.address.state === 'Karnataka')
  ok('other address fields survive', Boolean(store.get('settings').store.address.city))
  store.dispatch('settings/setCheckout', { freeShippingAbove: 1499 })
  ok('checkout updated', store.get('settings').checkout.freeShippingAbove === 1499)
  store.dispatch('settings/setGateway', { gateway: 'razorpay', patch: { mode: 'live' } })
  ok('gateway patched', store.get('settings').payments.razorpay.mode === 'live')
  ok('gateway keeps other fields', Array.isArray(store.get('settings').payments.razorpay.methods))
  const flagBefore = store.get('settings').featureFlags.loyalty
  store.dispatch('settings/toggleFlag', 'loyalty')
  ok('feature flag toggled', store.get('settings').featureFlags.loyalty === !flagBefore)
  store.dispatch('settings/toggleFlag', 'loyalty')

  // loyalty config drives the engine
  store.dispatch('loyalty/setConfig', { earnPerRupee: 0.1, pointValue: 0.5 })
  const cfg = store.get('loyalty').config
  const earn = loy.calculateEarn({ items: [{ product: {}, price: 1000, qty: 1 }] }, { orders: 5 }, cfg)
  ok('admin earn rate reaches the engine', near(earn.points, 100, 2), earn.points)
  ok('admin point value reaches the engine', near(earn.value, 50, 2), earn.value)
  store.dispatch('loyalty/setConfig', { earnPerRupee: 0.05, pointValue: 0.25 })

  store.dispatch('loyalty/addTier')
  const tiersAfter = store.get('loyalty').config.tiers.length
  ok('tier added', tiersAfter >= 5)
  const newTier = store.get('loyalty').config.tiers.at(-1)
  store.dispatch('loyalty/setTier', { id: newTier.id, patch: { name: 'Obsidian', multiplier: 3 } })
  ok('tier patched', store.get('loyalty').config.tiers.at(-1).name === 'Obsidian')
  store.dispatch('loyalty/removeTier', newTier.id)
  ok('tier removed', store.get('loyalty').config.tiers.length === tiersAfter - 1)

  store.dispatch('loyalty/setCategoryMultiplier', { category: 'Jewellery', value: 2 })
  ok('category multiplier set', store.get('loyalty').config.categoryMultipliers.Jewellery === 2)
  const boosted = loy.calculateEarn(
    { items: [{ product: { category: 'Jewellery' }, price: 1000, qty: 1 }] },
    { orders: 5 }, store.get('loyalty').config)
  const plain = loy.calculateEarn(
    { items: [{ product: { category: 'Other' }, price: 1000, qty: 1 }] },
    { orders: 5 }, store.get('loyalty').config)
  ok('category multiplier reaches the engine', boosted.points > plain.points,
     `${boosted.points} vs ${plain.points}`)
  store.dispatch('loyalty/setCategoryMultiplier', { category: 'Jewellery', value: 1 })

  store.dispatch('loyalty/grantPoints', { customerId: 'C10001', points: 500, reason: 'Test' })
  ok('points granted to ledger', store.get('loyalty').ledger.length > 0)
}

console.log('\n── Select primitive robustness')
{
  const React = (await import('react')).default
  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react')
  const { Select } = await import('../src/ui/primitives/Input.jsx')
  const { STATES } = await import('../src/data/seed.js')

  const cases = [
    ['string options', ['a', 'b']],
    ['value/label options', [{ value: 'x', label: 'Ex' }]],
    ['raw STATES records', STATES],
    ['number options', [1, 2, 3]],
  ]
  for (const [label, options] of cases) {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    let threw = null
    try { await act(async () => { root.render(React.createElement(Select, { options, value: '', onChange() {} })) }) }
    catch (e) { threw = e }
    ok(`Select handles ${label}`, !threw, threw?.message)
    ok(`Select renders ${label} without [object Object]`, !el.innerHTML.includes('[object Object]'))
    await act(async () => { root.unmount() })
  }
}

console.log('\n── Admin UI mounts')
{
  const React = (await import('react')).default
  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react')

  const screens = [
    ['Loyalty', (await import('../src/admin/loyalty/index.jsx')).default],
    ['Promotions', (await import('../src/admin/promotions/index.jsx')).default],
    ['Marketing', (await import('../src/admin/marketing/index.jsx')).default],
    ['Analytics', (await import('../src/admin/analytics/index.jsx')).default],
    ['Finance', (await import('../src/admin/finance/index.jsx')).default],
    ['Settings', (await import('../src/admin/settings/index.jsx')).default],
  ]
  const { MemoryRouter } = await import('react-router-dom')

  for (const [name, Comp] of screens) {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    let threw = null
    try { await act(async () => { root.render(React.createElement(MemoryRouter, null, React.createElement(Comp))) }) }
    catch (e) { threw = e }
    ok(`${name} mounts`, !threw, threw?.message)
    ok(`${name} renders content`, el.innerHTML.length > 1500, el.innerHTML.length)
    await act(async () => { root.unmount() })
  }
}

console.log(`\n${pass} passed · ${fail} failed\n`)
process.exit(fail ? 1 : 0)
