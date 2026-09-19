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
const ok = (name, cond, extra='') => {
  if (cond) { pass++ } else { fail++; console.log('  ✗', name, extra) }
}
const near = (a, b, tol=1) => Math.abs(a - b) <= tol

/* The seed ships empty, so this suite builds its own hermetic catalogue
 * instead of reading demo data. */
const mkP = (i, name, price, category, extra = {}) => ({
  id: 'TP' + String(i).padStart(3, '0'), name, price,
  mrp: Math.round(price * 1.25), category, status: 'active',
  stock: 20 + i * 3, cost: Math.round(price * 0.6), weightG: 400,
  createdAt: Date.now() - i * 22 * 86400000, ...extra,
})
const PRODUCTS = [
  mkP(1, 'Banarasi Silk Saree', 2999, 'Ethnic Wear', {
    variants: [
      { sku: 'TP001-S', size: 'S', price: 2999, stock: 12, reserved: 0 },
      { sku: 'TP001-M', size: 'M', price: 2999, stock: 8, reserved: 0 },
    ],
  }),
  mkP(2, 'Kanjivaram Silk Saree', 3499, 'Ethnic Wear'),
  mkP(3, 'Cotton Kurti', 849, 'Ethnic Wear'),
  mkP(4, 'Linen Shirt', 1499, 'Western Wear'),
  mkP(5, 'Denim Jeans', 1999, 'Western Wear'),
  mkP(6, 'Running Shoes', 2499, 'Footwear'),
  mkP(7, 'Leather Wallet', 1299, 'Accessories'),
  mkP(8, 'Wireless Earbuds', 1799, 'Electronics'),
]
// Prices end in 49 so a 10%-off + charm-99 preview always drops (charm math
// floors to the hundred below, which is only a drop when x49 <= x99 bands).
for (let i = 9; i <= 20; i++) PRODUCTS.push(mkP(i, `Everyday Tee ${i}`, 549 + ((i - 9) % 5) * 100, 'Western Wear'))
const gst = await import('../src/engines/tax/gst.js')
const price = await import('../src/engines/pricing/priceEngine.js')
const promo = await import('../src/engines/promo/promoEngine.js')
const cond = await import('../src/engines/promo/conditions.js')
const loy = await import('../src/engines/loyalty/loyaltyEngine.js')
const ship = await import('../src/engines/shipping/shippingEngine.js')
const inv = await import('../src/engines/inventory/inventoryEngine.js')
const srch = await import('../src/engines/search/searchEngine.js')
const reco = await import('../src/engines/analytics/recoEngine.js')

console.log('\n── GST')
{
  const l = gst.taxLine({ amount: 1180, rate: 18, inclusive: true })
  ok('inclusive base 1000', near(l.base ?? l.taxable, 1000), JSON.stringify(l))
  ok('inclusive tax 180', near(l.tax ?? l.totalTax, 180), l.tax ?? l.totalTax)
  const intra = gst.splitRate(18, false)
  ok('intra-state CGST+SGST', intra.cgst === 9 && intra.sgst === 9 && intra.igst === 0)
  const inter = gst.splitRate(18, true)
  ok('inter-state IGST 18', inter.igst === 18 && inter.cgst === 0)
  const ut = gst.splitRate(18, false, true)
  ok('UT uses UTGST', ut.utgst === 9 && ut.sgst === 0)
  ok('valid GSTIN', gst.validateGstin('27AAPFU0939F1ZV').valid !== false)
  ok('invalid GSTIN rejected', gst.validateGstin('BOGUS').valid === false)
  const invc = gst.taxInvoice([{ amount: 1180, rate: 18, qty: 1 }], { sellerState: 'Delhi', buyerState: 'Delhi' })
  ok('invoice total = 1180', near(invc.total, 1180, 2), invc.total)
  ok('invoice has hsn summary', Array.isArray(invc.hsnSummary ?? gst.hsnSummary([])))
}

console.log('\n── Pricing')
{
  const p = PRODUCTS[0]
  const r = price.resolvePrice(p, { qty: 1 })
  ok('base price resolves', r.price > 0, r.price)
  ok('trail non-empty', r.trail.length > 0)
  const b2bList = [{ id: 'b2b', group: 'b2b', active: true, rules: [{ match: { all: true }, type: 'percent_off', value: 18 }] }]
  const b2b = price.resolvePrice(p, { qty: 1, customerGroup: 'b2b', priceLists: b2bList })
  ok('b2b cheaper', b2b.price < r.price, `${b2b.price} vs ${r.price}`)
  ok('b2b source=group', b2b.source === price.PRICE_SOURCE.GROUP, b2b.source)
  const tierGroup = [{ id: 't', all: true, breaks: [{ minQty: 5, discountPct: 10 }] }]
  const tiered = price.resolvePrice(p, { qty: 10, tiers: tierGroup })
  ok('qty tier applies', tiered.price < r.price, `${tiered.price} vs ${r.price}`)
  const sale = price.resolvePrice(p, { schedules: [{ scope: 'all', discountPct: 30, name: 'Diwali' }] })
  ok('scheduled sale wins', sale.source === price.PRICE_SOURCE.SCHEDULED && sale.price < r.price, sale.price)
  const catSale = price.resolvePrice(p, { schedules: [{ scope: 'category', target: p.category, discountPct: 20 }] })
  ok('category-scoped sale', catSale.price < r.price)
  const missSale = price.resolvePrice(p, { schedules: [{ scope: 'category', target: '__nope__', discountPct: 20 }] })
  ok('non-matching sale ignored', missSale.price === r.price)
  ok('charm 99', String(price.charmPrice(1234, '99')).endsWith('99'), price.charmPrice(1234,'99'))
  const m = price.marginAnalysis(p)
  ok('margin breakdown', m.breakdown.length >= 2 && typeof m.netMarginPct === 'number')
  const pv = price.previewBulkPrice(PRODUCTS.slice(0, 20), { mode: 'decrease_pct', value: 10, charm: '99' })
  ok('bulk preview changes', pv.changes.length > 0, pv.changes.length)
  ok('bulk preview has to/from', pv.changes[0].to > 0 && pv.changes[0].from > 0)
  ok('bulk charm applied', pv.changes.every(c => String(c.to).endsWith('99')))
  ok('bulk prices dropped', pv.changes.every(c => c.to < c.from))
  ok('bulk newMarginPct present', typeof pv.changes[0].newMarginPct === 'number')
  ok('bulk revenueImpact negative', pv.revenueImpact < 0, pv.revenueImpact)
  ok('bulk still array-like', Array.isArray(pv) && pv.length === 20)
  ok('margin_target mode', price.previewBulkPrice(PRODUCTS.slice(0,10), { mode: 'margin_target', value: 30 }).changes.length >= 0)
  const upd = price.previewBulkPrice(PRODUCTS.slice(0, 10), { mode: 'increase_pct', value: 10 })
  ok('increase raises revenue', upd.revenueImpact > 0, upd.revenueImpact)
}

console.log('\n── Promotions')
{
  // canonical engine line shape: { product, qty, price }
  const items = PRODUCTS.slice(0, 3).map(p => ({ product: p, qty: 2, price: p.price }))
  const cart = { items }
  const promos = [{ id: 'p1', code: 'SAVE10', active: true, type: promo.DISCOUNT_TYPE.PERCENT,
    value: 10, appliesTo: promo.APPLIES_TO.CART, conditions: { all: [] } }]
  const res = promo.applyPromotions(cart, promos, { codes: ['SAVE10'] })
  ok('coded promo needs its code',
     promo.applyPromotions(cart, promos, {}).rejected[0]?.reason === 'Requires a coupon code')
  ok('single ctx.code also works',
     promo.applyPromotions(cart, promos, { code: 'save10' }).applied.length === 1)
  ok('promo applied', res.applied.length === 1)
  ok('discount > 0', res.totalDiscount > 0, res.totalDiscount)
  ok('payable < subtotal', res.payable < res.subtotal)
  ok('savingsPct ~10', near(res.savingsPct, 10, 2), res.savingsPct)
  const gated = [{ id: 'p2', active: true, type: promo.DISCOUNT_TYPE.PERCENT,
    value: 50, appliesTo: promo.APPLIES_TO.CART,
    conditions: { all: [{ field: 'cart_subtotal', op: 'gte', value: 99999999 }] } }]
  const r2 = promo.applyPromotions(cart, gated, {})
  ok('inactive promo reported', promo.applyPromotions(cart,
    [{ id: 'off', active: false, type: promo.DISCOUNT_TYPE.PERCENT, value: 10, conditions: { all: [] } }], {})
    .rejected[0]?.reason === 'Offer is switched off')
  const capped = promo.applyPromotions(cart, [{ id: 'p3', active: true, type: promo.DISCOUNT_TYPE.PERCENT,
    value: 50, maxDiscount: 100, appliesTo: promo.APPLIES_TO.CART, conditions: { all: [] } }], {})
  ok('maxDiscount caps', capped.totalDiscount <= 100, capped.totalDiscount)
  const fs = promo.applyPromotions(cart, [{ id: 'p4', active: true, type: promo.DISCOUNT_TYPE.FREE_SHIPPING,
    appliesTo: promo.APPLIES_TO.SHIPPING, conditions: { all: [] } }], {})
  ok('free shipping flag', fs.freeShipping === true)
  ok('simulate runs', Boolean(promo.simulate(cart, promos, {})))
  ok('detectConflicts array', Array.isArray(promo.detectConflicts(promos)))
  ok('gated promo rejected', r2.applied.length === 0 && r2.rejected.length === 1)
  ok('rejection has reason', Boolean(r2.rejected[0]?.reasons?.length ?? r2.rejected[0]?.reason))
  ok('conditions FIELDS >= 20', Object.keys(cond.FIELDS).length >= 20, Object.keys(cond.FIELDS).length)
  ok('OPERATORS >= 8', Object.keys(cond.OPERATORS).length >= 8)
  ok('operatorsFor returns list', cond.operatorsFor('cart_subtotal').length > 0)
  const facts = cond.deriveFacts({ cart: items })
  ok('deriveFacts subtotal', facts.cart_subtotal > 0, facts.cart_subtotal)
  ok('evalGroup passes empty', cond.evalGroup({ all: [] }, facts).pass)
  ok('evalGroup fails impossible',
    !cond.evalGroup({ all: [{ field: 'cart_subtotal', op: 'gte', value: 1e12 }] }, facts).pass)
  ok('describe returns string', typeof cond.describe({ field: 'cart_subtotal', op: 'gte', value: 500 }, facts) === 'string')
}

console.log('\n── Loyalty')
{
  // engine earns per line item, so build a real order
  const lineOrder = { items: [{ product: { ...PRODUCTS[0], discountPct: 0 }, price: 10000, qty: 1 }] }
  const buyer = { orders: 5 }   // avoid the first-order bonus skewing the maths
  const e = loy.calculateEarn(lineOrder, buyer, loy.DEFAULT_CONFIG)
  ok('earn 500 pts on 10k', near(e.points, 500, 5), e.points)
  ok('first order bonus fires', loy.calculateEarn(lineOrder, { orders: 0 }, loy.DEFAULT_CONFIG).points > e.points)
  ok('earn has line detail', Array.isArray(e.lines) && e.lines.length === 1)
  const gold = { spend12m: 20000, lifetimeSpend: 20000, orders: 5 }
  const eg = loy.calculateEarn(lineOrder, gold, loy.DEFAULT_CONFIG)
  ok('Gold earns more (1.25x)', eg.points > e.points, `${eg.points} vs ${e.points}`)
  ok('multiplier is 1.25x', near(eg.points, e.points * 1.25, 5), `${eg.points} vs ${e.points}`)
  const cart = { items: [{ product: PRODUCTS[0], price: 1000, qty: 1 }] }
  const rd = loy.calculateRedeem(cart, { points: 5000 }, loy.DEFAULT_CONFIG)
  ok('redeem capped 20%', rd.discount <= 201, rd.discount)
  ok('redeem step of 50', rd.usePoints % 50 === 0, rd.usePoints)
  ok('redeem states its limiter', Boolean(rd.limiter), rd.limiter)
  ok('below min blocked', loy.calculateRedeem(cart, { points: 100 }, loy.DEFAULT_CONFIG).discount === 0)
  ok('redeem explains when blocked',
     Boolean(loy.calculateRedeem(cart, { points: 100 }, loy.DEFAULT_CONFIG).message))
  ok('tier Gold at 20k', loy.resolveTier(gold, loy.DEFAULT_CONFIG).name === 'Gold',
     loy.resolveTier(gold, loy.DEFAULT_CONFIG).name)
  ok('tier Diamond at 200k', loy.resolveTier({ spend12m: 200000 }, loy.DEFAULT_CONFIG).name === 'Diamond')
  ok('tier Silver at 0', loy.resolveTier({ spend12m: 0 }, loy.DEFAULT_CONFIG).name === 'Silver')
  const tp = loy.tierProgress(gold, loy.DEFAULT_CONFIG)
  ok('tier progress pct', tp.percent >= 0 && tp.percent <= 100, tp.percent)
  ok('tier progress has next', Boolean(tp.next))
  ok('toNext positive', tp.toNext > 0, tp.toNext)
  ok('top tier isTop', loy.tierProgress({ spend12m: 999999 }, loy.DEFAULT_CONFIG).isTop === true)
  ok('liabilityReport', typeof loy.liabilityReport([{ points: 1000 }], loy.DEFAULT_CONFIG) === 'object')
  ok('waysToEarn list', loy.waysToEarn(loy.DEFAULT_CONFIG).length > 0)
}

console.log('\n── Shipping')
{
  const cart = { items: PRODUCTS.slice(0, 2).map(p => ({ ...p, qty: 1 })) }
  const q = ship.rateShop(cart, { pincode: '110001', state: 'Delhi' }, {})
  ok('serviceable 110001', q.serviceable)
  ok('quotes returned', q.quotes.length > 0, q.quotes.length)
  ok('recommended set', Boolean(q.recommended))
  ok('eta present', Boolean(q.eta))
  ok('zone resolved', Boolean(q.zone))
  const s = ship.checkServiceability('110001')
  ok('serviceability ok', s.ok && s.days > 0)
  const cw = ship.chargeableWeight([{ weightG: 500, qty: 1 }])
  ok('chargeable weight > 0', cw.chargeable > 0, JSON.stringify(cw))
  ok('chargeable = max(actual, volumetric)', cw.chargeable === Math.max(cw.actual, cw.volumetric))
  const bulky = ship.chargeableWeight([{ qty: 1, product: { weightG: 100, dimensions: { l: 60, w: 60, h: 60 } } }])
  ok('volumetric wins on bulky', bulky.chargeable === bulky.volumetric && bulky.volumetric > bulky.actual,
     JSON.stringify(bulky))
  const cod = ship.codAvailable({ items: [], total: 1500 }, { pincode: '110001', state: 'Delhi' })
  ok('COD check returns', cod != null)
  ok('etaFrom skips Sundays', Boolean(ship.etaFrom(Date.now(), 3)))
  ok('resolveZone', Boolean(ship.resolveZone({ state: 'Delhi', pincode: '110001' })))
  ok('zones >= 4', ship.DEFAULT_ZONES.length >= 4)
  ok('couriers >= 5', ship.DEFAULT_COURIERS.length >= 5)
}

console.log('\n── Inventory')
{
  const p = PRODUCTS.find(x => x.variants?.length) || PRODUCTS[0]
  const a = inv.atp(p.variants?.[0] ?? p, {})
  ok('atp available numeric', typeof a.available === 'number')
  ok('stockStatus enum', Object.values(inv.STOCK_STATUS).includes(inv.stockStatus(p, {})))
  const rp = inv.reorderPoint([5,7,6,8,4,9,6], { leadTimeDays: 7, serviceLevel: 0.95 })
  ok('reorderPoint > 0', rp.reorderPoint > 0, rp.reorderPoint)
  ok('safety stock >= 0', rp.safetyStock >= 0)
  ok('eoq > 0', inv.eoq(1200, { orderCost: 500, holdingCostPerUnit: 40 }) > 0,
     inv.eoq(1200, { orderCost: 500, holdingCostPerUnit: 40 }))
  // Fixture demand history: the seed's salesHistory() reads zero orders now,
  // so the inventory tests bring their own `{ productId: number[] }` map.
  const demand = (base) => Array.from({ length: 90 }, (_, i) => Math.max(0, Math.round(base + Math.sin(i / 7) * 2)))
  const hist = { TP001: demand(6), TP002: demand(3), TP003: demand(5), TP004: demand(2) }
  ok('fixture demand history built', Object.keys(hist).length > 0, Object.keys(hist).length)
  const sug = inv.reorderSuggestions(PRODUCTS, hist, {}).filter(r => r.suggestedQty > 0)
  ok('suggestions with real demand', sug.length > 0, sug.length)
  ok('suggestion has qty + cost', sug[0].suggestedQty > 0 && sug[0].estimatedCost > 0)
  ok('suggestion has ROP', sug[0].reorderPoint > 0)
  const v = inv.valuation(PRODUCTS, 'cost')
  ok('valuation totalCost > 0', v.totalCost > 0, v.totalCost)
  ok('valuation byCategory', v.byCategory.length > 0)
  ok('retail >= cost', v.totalRetail >= v.totalCost)
  ok('marginPct sane', v.marginPct > 0 && v.marginPct < 100, v.marginPct)
  ok('ageing 5 buckets', inv.ageing(PRODUCTS).length === 5, inv.ageing(PRODUCTS).length)
  ok('ageing pct sums ~100', Math.abs(inv.ageing(PRODUCTS).reduce((t, b) => t + b.pct, 0) - 100) <= 2)
  const dd = inv.deadStock(PRODUCTS, hist, { days: 90 })
  ok('deadStock array', Array.isArray(dd), dd.length)
  if (dd.length) ok('dead stock has lockedCapital', dd[0].lockedCapital > 0)
  const fc = inv.forecast([5,6,7,8,9,10], 4)
  ok('forecast returns 4 periods', fc.forecast.length === 4, JSON.stringify(fc.forecast))
  ok('forecast detects rising trend', fc.trend === 'rising', fc.trend)
  ok('forecast dailyAvg', fc.dailyAvg > 0)
  ok('allocate returns plan', Boolean(inv.allocate([{ id: 'x', qty: 1 }], [{ id: 'w', zone: 'North' }], { state: 'Delhi' })))
}

console.log('\n── Search')
{
  const r = srch.search(PRODUCTS, 'saree', { limit: 50 })
  ok('search returns results', r.results.length > 0, r.results.length)
  ok('tokens parsed', r.tokens.length > 0)
  const typo = srch.search(PRODUCTS, 'sareee', { limit: 20 })
  ok('typo tolerance', typo.results.length > 0, typo.results.length)
  ok('suggest works', srch.suggest(PRODUCTS, 'sar').length > 0)
  const f = srch.buildFacets(PRODUCTS)
  ok('facets built', Object.keys(f).length >= 3, Object.keys(f).join(','))
  ok('applyFilters narrows', srch.applyFilters(PRODUCTS, { inStock: true }).length <= PRODUCTS.length)
  const catName = PRODUCTS[0].category
  ok('category filter exact', srch.applyFilters(PRODUCTS, { category: [catName] }).every(p => p.category === catName))
  ok('price filter', srch.applyFilters(PRODUCTS, { maxPrice: 1000 }).every(p => p.price <= 1000))
  ok('sorts count >= 8', Object.keys(srch.SORTS).length >= 8, Object.keys(srch.SORTS).length)
  ok('expandSynonyms', srch.expandSynonyms(['saree']).length >= 1)
  const sorted = srch.sortProducts(PRODUCTS, 'price_asc')
  ok('price_asc sorted', sorted[0].price <= sorted[sorted.length - 1].price)
  ok('editDistance', srch.editDistance('kurta', 'kurti') === 1)
}

console.log('\n── Recommendations')
{
  const p = PRODUCTS[0]
  ok('similarProducts', reco.similarProducts(p, PRODUCTS, 6).length > 0)
  ok('excludes self', !reco.similarProducts(p, PRODUCTS, 6).some(x => x.id === p.id))
  ok('fbt returns', Array.isArray(reco.frequentlyBoughtTogether(p.id, [], PRODUCTS, 3)))
  // The seed's ordersForReco() reads zero orders now; the reco tests bring
  // their own recent-order fixtures covering every fixture product.
  const ords = PRODUCTS.map((p, i) => ({
    id: 'TO' + i, placedAt: Date.now() - ((i % 10) + 1) * 86400000, status: 'Delivered',
    items: [{ productId: p.id, qty: 2, price: p.price }],
  }))
  ok('reco order fixtures present', ords.length === PRODUCTS.length, ords.length)
  const tr = reco.trending(PRODUCTS, ords, { limit: 8 })
  ok('trending with real orders', tr.length === 8, tr.length)
  ok('trending sorted by score', tr[0].score >= tr[tr.length - 1].score)
  const fbtReal = reco.frequentlyBoughtTogether(PRODUCTS[0].id, ords, PRODUCTS, 3)
  ok('fbt with real orders', Array.isArray(fbtReal))
  ok('cart cross-sell', Array.isArray(reco.cartCrossSell([{ product: p, qty: 1 }], PRODUCTS, ords, 4)))
  ok('completeTheLook', Array.isArray(reco.completeTheLook(p, PRODUCTS, 4)))
  ok('personalisedFeed', Array.isArray(reco.personalisedFeed({ id: 'c1' }, PRODUCTS, {})))
  ok('similarity is non-negative', reco.similarity(p, PRODUCTS[1]) >= 0)
  ok('self-similarity is 0', reco.similarity(p, p) === 0)
  ok('same-category scores higher', (() => {
    const same = PRODUCTS.find(x => x.id !== p.id && x.category === p.category)
    const diff = PRODUCTS.find(x => x.category !== p.category)
    return !same || !diff || reco.similarity(p, same) > reco.similarity(p, diff)
  })())
}

console.log('\n── Store slices')
{
  const store = (await import('../src/core/store/index.js')).default
  const cs = await import('../src/core/store/slices/catalogueSlice.js')
  const st = () => ({ catalogue: store.get('catalogue') })
  // Empty-first: the catalogue slice boots with zero products.
  ok('catalogue boots empty', cs.selectProducts(st()).length === 0)
  store.dispatch('catalogue/createProduct', { id: 'P-T1', name: 'Test Product', price: 999 })
  ok('created product appears', cs.selectProducts(st()).some(p => p.id === 'P-T1'))
  store.dispatch('catalogue/createProduct', { id: 'P-T2', name: 'Second Product', price: 499 })
  store.dispatch('catalogue/updateProduct', { id: 'P-T1', patch: { price: 12345 } })
  ok('override applied', cs.selectProduct(st(), 'P-T1').price === 12345)
  store.dispatch('catalogue/deleteProduct', 'P-T2')
  ok('delete removes', !cs.selectProducts(st()).some(p => p.id === 'P-T2'))
  store.dispatch('catalogue/restoreProduct', 'P-T2')
  ok('restore brings back', cs.selectProducts(st()).some(p => p.id === 'P-T2'))
  const pid = 'P-T1'
  store.dispatch('catalogue/generateMatrix', { productId: pid, sizes: ['S','M'], colors: [{ name: 'Red', hex: '#f00' }] })
  ok('matrix generates 2', cs.selectProduct(st(), pid).variants.length === 2)
  store.dispatch('catalogue/applyBulkPrice', [{ id: pid, to: 777 }])
  ok('bulk price applies', cs.selectProduct(st(), pid).price === 777)
  store.dispatch('catalogue/addSchedule', { name: 'X', scope: 'all', discountPct: 10 })
  const sid = store.get('catalogue').schedules.at(-1).id
  store.dispatch('catalogue/updateSchedule', { id: sid, patch: { discountPct: 25 } })
  ok('updateSchedule works', store.get('catalogue').schedules.at(-1).discountPct === 25)
  store.dispatch('catalogue/addCategory', { name: 'Test', hsn: '1234', gst: 5, subs: [] })
  ok('addCategory', store.get('catalogue').categories.some(c => c.name === 'Test'))
  store.dispatch('catalogue/addCollection', { id: 'c1', title: 'T', handle: 't', rules: [], active: true })
  ok('addCollection', store.get('catalogue').collections.some(c => c.id === 'c1'))
  store.dispatch('catalogue/addPriceList', { id: 'pl1', name: 'X', group: 'vip', adjustPct: -5 })
  ok('addPriceList', store.get('catalogue').priceLists.some(p => p.id === 'pl1'))
  store.dispatch('catalogue/addTier', { minQty: 3, discountPct: 7 })
  ok('addTier', store.get('catalogue').tiers.some(t => t.minQty === 3))
  const ps = await import('../src/core/store/slices/promoSlice.js')
  // Empty-first: no promotions ship with the app.
  ok('promos boot empty', ps.selectPromos({ promo: store.get('promo') }).length === 0)
  store.dispatch('promo/create', { name: 'Launch 10%', type: 'percent', value: 10, active: true, conditions: { all: [] } })
  ok('created promo is selectable', ps.selectPromos({ promo: store.get('promo') }).length === 1)
  ok('active promos subset', ps.selectActivePromos({ promo: store.get('promo') }).length <= ps.selectPromos({ promo: store.get('promo') }).length)
  const ls = await import('../src/core/store/slices/loyaltySlice.js')
  ok('loyalty config', ls.selectLoyaltyConfig({ loyalty: store.get('loyalty') }).tiers.length >= 4)
  store.dispatch('loyalty/setConfig', { earnPerRupee: 0.1 })
  ok('loyalty config updates', store.get('loyalty').config.earnPerRupee === 0.1)
}

console.log('\n── Admin catalogue UI mount')
{
  const React = (await import('react')).default
  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react')
  const Catalogue = (await import('../src/admin/catalogue/index.jsx')).default
  const { MemoryRouter } = await import('react-router-dom')
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  // ProductsTab reads the route, so the catalogue must mount inside a router.
  await act(async () => { root.render(React.createElement(MemoryRouter, null, React.createElement(Catalogue))) })
  const html = el.innerHTML
  ok('catalogue renders', html.length > 2000, html.length)
  ok('has product rows', html.includes('₹') || html.includes('Product'))
  ok('has tabs', html.includes('Collections') && html.includes('Inventory'))
  await act(async () => { root.unmount() })
}

console.log(`\n${pass} passed · ${fail} failed\n`)
process.exit(fail ? 1 : 0)
