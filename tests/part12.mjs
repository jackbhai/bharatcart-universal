/**
 * Part 12 — multi-vertical system tests (Chunk E).
 *
 * Covers the vertical registry, the seven new engines (gold, uom, expiry,
 * size charts, subscriptions, cold chain, vertical pricing), the vertical
 * return rules + FEFO batch allocation, and the empty-first seed (the catalogue
 * ships with zero products). Engines are
 * imported directly (five-layer rule); a small jsdom render section at the end
 * checks the storefront pickers. Run: npx vite-node tests/part12.mjs
 */
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' })
global.window = dom.window; global.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true })
global.HTMLElement = dom.window.HTMLElement
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
const near = (a, b, tol=1e-6) => Math.abs(a - b) <= tol

const { PRODUCTS } = await import('../src/data/seed.js')
const vert = await import('../src/engines/catalogue/verticals.js')
const gold = await import('../src/engines/pricing/goldEngine.js')
const uom = await import('../src/engines/pricing/uomEngine.js')
const exp = await import('../src/engines/perishables/expiryEngine.js')
const sz = await import('../src/engines/catalogue/sizeChartEngine.js')
const sub = await import('../src/engines/subscriptions/subscriptionEngine.js')
const cold = await import('../src/engines/shipping/coldChainEngine.js')
const vp = await import('../src/engines/pricing/verticalPriceEngine.js')
const price = await import('../src/engines/pricing/priceEngine.js')
const re = await import('../src/engines/returns/returnEngine.js')
const inv = await import('../src/engines/inventory/inventoryEngine.js')

const DAY = 86400000
const NOWT = Date.parse('2026-09-19T00:00:00Z')
const iso = (ms) => new Date(ms).toISOString()
const byVertical = (id) => PRODUCTS.filter(p => p.vertical === id)

/* ------------------------------------------------------------------
 * The seed catalogue ships empty, so engine tests use small inline
 * fixtures instead of seeded products. Keeping them hermetic also makes
 * the tests independent of demo-data trivia.
 * ------------------------------------------------------------------ */
const dairyP = { id: 'T-DAIRY-1', vertical: 'dairy', name: 'Toned Milk 1L', price: 60,
  attributes: { needsColdChain: true } }
const fashionP = { id: 'T-FASH-1', vertical: 'fashion', name: 'Denim Jacket', price: 999,
  category: 'Fashion', attributes: { fabric: 'Denim', care: 'Machine wash cold' } }
const groceryP = { id: 'T-GR-1', vertical: 'grocery', name: 'Basmati Rice', price: 95,
  variants: [
    { sku: 'T-GR-250', pack: '250 g', price: 95, stock: 50, reserved: 0 },
    { sku: 'T-GR-1K', pack: '1 kg', price: 380, stock: 50, reserved: 0 },
  ] }
const fjP = { id: 'T-FJ-1', vertical: 'fine-jewellery', name: 'Gold Ring', price: 0,
  attributes: { makingPct: 12 },
  variants: [{ sku: 'T-FJ-22', purity: '22K', weightG: 10, price: 0, stock: 3 }] }

/* ============================================================ */
console.log('\n── Vertical registry')
{
  ok('nine verticals registered', vert.VERTICAL_IDS.length === 9, vert.VERTICAL_IDS.length)
  ok('expected vertical ids',
    [...vert.VERTICAL_IDS].sort().join(',') ===
    ['artificial-jewellery','confectionery','dairy','fashion','fine-jewellery','footwear','general','grocery','innerwear'].sort().join(','))
  ok('VERTICALS keyed by id', vert.VERTICAL_IDS.every(id => vert.VERTICALS[id]?.id === id))
  ok('getVertical resolves', vert.getVertical('fashion').id === 'fashion')
  ok('getVertical falls back to general', vert.getVertical('nope').id === 'general')
  ok('getVertical() falls back to general', vert.getVertical().id === 'general')
  ok('verticalFor honours explicit vertical', vert.verticalFor({ vertical: 'dairy' }) === 'dairy')
  ok('verticalFor maps legacy category Ethnic Wear', vert.verticalFor({ category: 'Ethnic Wear' }) === 'fashion')
  ok('verticalFor maps legacy category Footwear', vert.verticalFor({ category: 'Footwear' }) === 'footwear')
  ok('verticalFor maps legacy category Jewellery', vert.verticalFor({ category: 'Jewellery' }) === 'artificial-jewellery')
  ok('verticalFor defaults to general', vert.verticalFor({}) === 'general')
  ok('verticalFor ignores unknown vertical, uses category', vert.verticalFor({ vertical: 'bogus', category: 'Footwear' }) === 'footwear')
  ok('verticalFor unknown vertical + unknown category', vert.verticalFor({ vertical: 'bogus' }) === 'general')

  for (const id of vert.VERTICAL_IDS) {
    const axes = vert.variantAxesFor({ vertical: id })
    const schema = vert.attributeSchemaFor({ vertical: id })
    ok(`${id} has variant axes`, Array.isArray(axes) && axes.length > 0, axes.length)
    ok(`${id} has attribute schema`, Array.isArray(schema) && schema.length > 0, schema.length)
  }
  ok('axes carry key + label',
    vert.VERTICAL_IDS.every(id => vert.variantAxesFor({ vertical: id }).every(a => a.key && a.label)))
  ok('schema fields carry key + label + type',
    vert.VERTICAL_IDS.every(id => vert.attributeSchemaFor({ vertical: id }).every(f => f.key && f.label && f.type)))

  const dairy = vert.getVertical('dairy')
  ok('dairy needs cold chain + subscriptions + perishable',
    dairy.needsColdChain === true && dairy.supportsSubscription === true && dairy.perishable === true)
  ok('fine-jewellery is gold-priced', vert.getVertical('fine-jewellery').goldPriced === true)
  ok('confectionery is perishable, no cold chain',
    vert.getVertical('confectionery').perishable === true && vert.getVertical('confectionery').needsColdChain === false)
  ok('grocery supports subscriptions', vert.getVertical('grocery').supportsSubscription === true)
  ok('general has no special flags',
    ['perishable','needsColdChain','supportsSubscription','goldPriced'].every(k => vert.getVertical('general')[k] === false))
  ok('fashion size chart', vert.getVertical('fashion').sizeChart === 'apparel')
  ok('footwear size chart', vert.getVertical('footwear').sizeChart === 'footwear')
  ok('storefront picker hints',
    vert.getVertical('fashion').storefront.picker === 'fashion' &&
    vert.getVertical('dairy').storefront.picker === 'food' &&
    vert.getVertical('fine-jewellery').storefront.picker === 'jewellery' &&
    vert.getVertical('general').storefront.picker === 'generic')
}

/* ============================================================ */
console.log('\n── Gold engine')
{
  ok('22K demo rate', gold.goldRateFor('22K') === 7250)
  ok('24K demo rate', gold.goldRateFor('24K') === 8250)
  ok('18K demo rate', gold.goldRateFor('18K') === 5950)
  ok('14K demo rate', gold.goldRateFor('14K') === 4650)
  ok('cfg rates override demo rates', gold.goldRateFor('22K', { rates: { '22K': 8000 } }) === 8000)
  let threw = false
  try { gold.goldRateFor('99K') } catch { threw = true }
  ok('unknown purity throws', threw)
  ok('fine-jewellery GST is 3%', gold.FINE_JEWELLERY_GST_PCT === 3)

  const p = gold.fineJewelleryPrice({ purity: '22K', weightG: 10, makingPct: 12, wastagePct: 2, stoneValue: 0 })
  ok('metal value = rate × weight', p.breakdown.metalValue === 72500, p.breakdown.metalValue)
  ok('wastage 2%', p.breakdown.wastage === 1450, p.breakdown.wastage)
  ok('making 12%', p.breakdown.making === 8700, p.breakdown.making)
  ok('stone value passes through', p.breakdown.stone === 0)
  ok('subtotal', p.breakdown.subtotal === 82650, p.breakdown.subtotal)
  ok('3% GST on subtotal', near(p.breakdown.gst, 2479.5), p.breakdown.gst)
  ok('total incl GST', near(p.total, 85129.5), p.total)
  ok('ratePerGram echoed', p.ratePerGram === 7250)

  const withStone = gold.fineJewelleryPrice({ purity: '18K', weightG: 5, stoneValue: 5000 })
  ok('stone value added pre-GST', near(withStone.breakdown.subtotal, 5950 * 5 * 1.14 + 5000), withStone.breakdown.subtotal)
  const custom = gold.fineJewelleryPrice({ purity: '14K', weightG: 8, makingPct: 20, wastagePct: 0 })
  ok('custom making/wastage respected', near(custom.breakdown.making, 4650 * 8 * 0.20), custom.breakdown.making)

  const snap = gold.snapshotRate('22K', {}, NOWT)
  ok('snapshot shape', snap.purity === '22K' && snap.ratePerGram === 7250 && typeof snap.at === 'string')
  ok('snapshot time frozen', snap.at === new Date(NOWT).toISOString(), snap.at)
  ok('snapshot honours cfg override', gold.snapshotRate('22K', { rates: { '22K': 8100 } }, NOWT).ratePerGram === 8100)
}

/* ============================================================ */
console.log('\n── UoM engine')
{
  const pg = uom.parsePack('500 g')
  ok('parse 500 g', pg?.qty === 500 && pg?.unit === 'g')
  const kg = uom.parsePack('1 kg')
  ok('parse 1 kg', kg?.qty === 1 && kg?.unit === 'kg')
  const ml = uom.parsePack('250 ml')
  ok('parse 250 ml', ml?.qty === 250 && ml?.unit === 'ml')
  const L = uom.parsePack('2 L')
  ok('parse 2 L', L?.qty === 2 && L?.unit === 'L')
  ok('alias gm → g', uom.parsePack('500 gm')?.unit === 'g')
  ok('alias pcs', uom.parsePack('12 pcs')?.unit === 'pcs')
  ok('unparseable → null', uom.parsePack('abc') === null)
  ok('zero qty → null', uom.parsePack('0 g') === null)
  ok('null → null', uom.parsePack(null) === null)

  ok('500 g → 0.5 kg', uom.packToBase('500 g', 'kg') === 0.5)
  ok('1 L → 1 L', uom.packToBase('1 L', 'L') === 1)
  ok('incompatible base → null', uom.packToBase('500 g', 'L') === null)

  ok('500 g @ ₹120 → ₹240/kg', uom.uomUnitPrice({ price: 120, pack: '500 g' }) === 240)
  ok('variant pack wins over product', uom.uomUnitPrice({ price: 120, pack: '1 kg' }, { price: 60, pack: '250 g' }) === 240)
  ok('variant price falls back to product', uom.uomUnitPrice({ price: 95, pack: '250 g' }, { pack: '250 g' }) === 380)
  ok('unparseable pack → null', uom.uomUnitPrice({ price: 100, pack: 'family pack' }) === null)

  const label = uom.uomLabel({ price: 120, pack: '500 g' })
  ok('unit label shape', label?.amount === 240 && label?.per === 'kg')
  ok('format ₹240/kg', uom.formatUom({ price: 120, pack: '500 g' }) === '₹240/kg')
  ok('format volume ₹240/L', uom.formatUom({ price: 60, pack: '250 ml' }) === '₹240/L')
  ok('format unparseable → null', uom.formatUom({ price: 60 }) === null)
}

/* ============================================================ */
console.log('\n── Expiry engine')
{
  const withExpiry = (days) => ({ variants: [{ sku: 'X', expiryDate: iso(NOWT + days * DAY) }] })
  let s = exp.expiryStatus(withExpiry(10), NOWT)
  ok('fresh at +10d', s.status === 'fresh' && s.daysLeft === 10, s.status)
  s = exp.expiryStatus(withExpiry(4), NOWT)
  ok('fresh boundary at +4d', s.status === 'fresh', s.status)
  s = exp.expiryStatus(withExpiry(3), NOWT)
  ok('near-expiry boundary at +3d', s.status === 'near-expiry' && s.daysLeft === 3, s.status)
  s = exp.expiryStatus(withExpiry(2), NOWT)
  ok('near-expiry at +2d', s.status === 'near-expiry', s.status)
  s = exp.expiryStatus(withExpiry(0), NOWT)
  ok('expires today', s.status === 'near-expiry' && /today/i.test(s.label), s.label)
  s = exp.expiryStatus(withExpiry(-1), NOWT)
  ok('expired at -1d', s.status === 'expired' && s.daysLeft === -1, s.status)
  s = exp.expiryStatus({}, NOWT)
  ok('no expiry → non-perishable', s.status === 'non-perishable' && s.daysLeft === null)
  s = exp.expiryStatus(withExpiry(2), NOWT, { nearDays: 1 })
  ok('custom nearDays respected', s.status === 'fresh', s.status)

  const attrFirst = {
    attributes: { expiryDate: iso(NOWT + 20 * DAY) },
    variants: [{ sku: 'X', expiryDate: iso(NOWT + 2 * DAY) }],
  }
  ok('attributes.expiryDate preferred', exp.expiryStatus(attrFirst, NOWT).daysLeft === 20)
  const shelf = { createdAt: iso(NOWT - 5 * DAY), attributes: { shelfLifeDays: 10 } }
  ok('shelfLifeDays + createdAt path', exp.expiryStatus(shelf, NOWT).daysLeft === 5)

  const vs = [
    { sku: 'c', expiryDate: iso(NOWT + 5 * DAY) },
    { sku: 'a', expiryDate: iso(NOWT + 1 * DAY) },
    { sku: 'b', expiryDate: iso(NOWT + 3 * DAY) },
    { sku: 'z' },
  ]
  const sorted = exp.fefoSort(vs)
  ok('fefoSort earliest first', sorted.map(v => v.sku).join(',') === 'a,b,c,z')
  ok('fefoSort is pure', vs[0].sku === 'c')
  ok('fefoSort empty → empty', exp.fefoSort([]).length === 0)

  const prod = {
    variants: [
      { sku: 'old', stock: 4, reserved: 0, expiryDate: iso(NOWT + 2 * DAY) },
      { sku: 'new', stock: 10, reserved: 0, expiryDate: iso(NOWT + 20 * DAY) },
    ],
  }
  let al = exp.allocateFefo(prod, 5)
  ok('allocateFefo oldest first', al.lines[0].variant.sku === 'old' && al.lines[0].qty === 4)
  ok('allocateFefo spills to next batch', al.lines[1].variant.sku === 'new' && al.lines[1].qty === 1)
  ok('allocateFefo no shortfall', al.shortfall === 0)
  al = exp.allocateFefo(prod, 100)
  ok('allocateFefo shortfall', al.shortfall === 86 && al.lines.reduce((n, l) => n + l.qty, 0) === 14, al.shortfall)
  const reserved = { variants: [{ sku: 'r', stock: 10, reserved: 4, expiryDate: iso(NOWT + 2 * DAY) }] }
  al = exp.allocateFefo(reserved, 8)
  ok('allocateFefo respects reserved', al.lines[0].qty === 6 && al.shortfall === 2)

  ok('near-expiry discount 25%', exp.nearExpiryDiscount(withExpiry(2), NOWT) === 25)
  ok('fresh → no discount', exp.nearExpiryDiscount(withExpiry(10), NOWT) === 0)
  ok('expired → no discount', exp.nearExpiryDiscount(withExpiry(-2), NOWT) === 0)
  ok('custom discount pct', exp.nearExpiryDiscount(withExpiry(2), NOWT, { pct: 10 }) === 10)
}

/* ============================================================ */
console.log('\n── Size chart engine')
{
  ok('four charts', Object.keys(sz.SIZE_CHARTS).join(',') === 'innerwear,footwear,kids,apparel')
  const fw = sz.getSizeChart('footwear')
  ok('footwear chart rows', fw?.rows?.length === 10)
  ok('footwear chart columns', fw?.columns?.length === 5)
  ok('innerwear chart rows', sz.getSizeChart('innerwear')?.rows?.length === 9)
  ok('kids chart label', /kids/i.test(sz.getSizeChart('kids')?.label ?? ''))
  ok('apparel chart rows', sz.getSizeChart('apparel')?.rows?.length === 7)
  ok('unknown chart → null', sz.getSizeChart('nope') === null)
  ok('UK8 → EU 42.5', sz.convertFootwearSize(8, 'UK', 'EU') === 42.5)
  ok('UK8 → US 9', sz.convertFootwearSize(8, 'UK', 'US') === 9)
  ok('EU44 → UK 9', sz.convertFootwearSize(44, 'EU', 'UK') === 9)
  ok('unknown size → null', sz.convertFootwearSize(99, 'UK', 'EU') === null)
  ok('unknown scale → null', sz.convertFootwearSize(8, 'UK', 'XX') === null)
}

/* ============================================================ */
console.log('\n── Subscription engine')
{
  ok('three frequencies', sub.FREQUENCIES.map(f => f.id).join(',') === 'daily,alternate,weekly')
  ok('frequency lookup', sub.FREQUENCY_BY_ID.daily.days === 1 && sub.FREQUENCY_BY_ID.weekly.days === 7)

  const base = { productId: 'V1151', variantSku: 'VDA-000-1L', qty: 2 }
  const daily = sub.buildSchedule({ ...base, frequency: 'daily', startDateISO: '2026-09-20', occurrences: 3 })
  ok('daily dates', daily.map(d => d.dateISO).join(',') === '2026-09-20,2026-09-21,2026-09-22')
  const alt = sub.buildSchedule({ ...base, frequency: 'alternate', startDateISO: '2026-09-20', occurrences: 3 })
  ok('alternate dates', alt.map(d => d.dateISO).join(',') === '2026-09-20,2026-09-22,2026-09-24')
  const weekly = sub.buildSchedule({ ...base, frequency: 'weekly', startDateISO: '2026-09-20', occurrences: 2 })
  ok('weekly dates', weekly.map(d => d.dateISO).join(',') === '2026-09-20,2026-09-27')
  const custom = sub.buildSchedule({ ...base, frequency: { id: 'custom', days: 3 }, startDateISO: '2026-09-20', occurrences: 2 })
  ok('custom frequency object', custom.map(d => d.dateISO).join(',') === '2026-09-20,2026-09-23')
  ok('schedule entry shape',
    daily[0].status === 'scheduled' && daily[0].qty === 2 &&
    daily[0].productId === 'V1151' && daily[0].variantSku === 'VDA-000-1L' && daily[0].frequency === 'daily')
  let threw = false
  try { sub.buildSchedule({ ...base, frequency: 'daily', startDateISO: 'not-a-date', occurrences: 2 }) } catch { threw = true }
  ok('invalid start date throws', threw)
  threw = false
  try { sub.buildSchedule({ ...base, frequency: 'daily', startDateISO: '2026-09-20', occurrences: 0 }) } catch { threw = true }
  ok('zero occurrences throws', threw)

  const skipped = sub.skipDate(daily, '2026-09-21')
  ok('skipDate marks skipped', skipped[1].status === 'skipped' && skipped[0].status === 'scheduled')
  ok('skipDate is pure', daily[1].status === 'scheduled')
  ok('skipDate unknown date untouched', sub.skipDate(daily, '2026-10-01').every(d => d.status === 'scheduled'))

  const paused = sub.pauseSchedule(daily, '2026-09-20', '2026-09-21')
  ok('pauseSchedule range inclusive', paused[0].status === 'paused' && paused[1].status === 'paused' && paused[2].status === 'scheduled')
  ok('pauseSchedule is pure', daily[0].status === 'scheduled')

  const total = sub.scheduleTotal(daily, 110)
  ok('schedule total qty', total.totalQty === 6, total.totalQty)
  ok('schedule total value', total.total === 660, total.total)
  ok('schedule occurrences', total.occurrences === 3)
  const totalSkipped = sub.scheduleTotal(skipped, 110)
  ok('skipped excluded from total', totalSkipped.totalQty === 4 && totalSkipped.occurrences === 2)

  // Saturday 2026-09-19: slots start tomorrow (Sunday), which is a no-delivery day here.
  const satNow = Date.UTC(2026, 8, 19, 10, 0, 0)
  const slots = sub.nextDeliverySlots({ attributes: { noDeliveryDays: [0] } }, '110001', satNow, 4)
  ok('slot count honoured', slots.length === 4, slots.length)
  ok('no-delivery Sunday skipped', slots.every(s => s.dateISO !== '2026-09-20'))
  ok('first slot is Monday morning', slots[0].dateISO === '2026-09-21' && slots[0].slot === 'morning', JSON.stringify(slots[0]))
  ok('morning + evening per day', slots[1].dateISO === '2026-09-21' && slots[1].slot === 'evening')
  ok('slot shape', slots.every(s => s.dateISO && s.slot && /Morning|Evening/.test(s.label)))
  const mornings = sub.nextDeliverySlots({ attributes: { noDeliveryDays: [], eveningDelivery: false } }, '110001', satNow, 3)
  ok('evening off → mornings only', mornings.every(s => s.slot === 'morning') && mornings.length === 3)
}

/* ============================================================ */
console.log('\n── Cold chain engine')
{
  ok('dairy needs cold chain', cold.requiresColdChain(dairyP) === true)
  ok('fashion does not', cold.requiresColdChain(fashionP) === false)
  ok('attributes flag', cold.requiresColdChain({ attributes: { needsColdChain: true } }) === true)
  ok('chilled storageTemp marker', cold.requiresColdChain({ attributes: { storageTemp: 'Keep refrigerated at 2-8°C' } }) === true)
  ok('frozen storageTemp marker', cold.requiresColdChain({ attributes: { storageTemp: 'Keep frozen at -18°C' } }) === true)
  ok('room temp is not cold chain', cold.requiresColdChain({ attributes: { storageTemp: 'Store at room temperature' } }) === false)
  ok('empty product', cold.requiresColdChain({}) === false)

  const none = cold.coldChainSurcharge([], 'national')
  ok('no cold items → zero surcharge', none.surcharge === 0 && none.coldItems === 0 && none.breakdown === null)
  const fashionOnly = cold.coldChainSurcharge([{ product: fashionP, qty: 2 }], 'national')
  ok('fashion-only → zero surcharge', fashionOnly.surcharge === 0)
  const withCold = cold.coldChainSurcharge([{ product: dairyP, qty: 2 }], 'national')
  ok('dairy attracts surcharge', withCold.surcharge > 0 && withCold.coldItems === 1, withCold.surcharge)
  ok('surcharge breakdown', withCold.breakdown?.zone === 'national' && withCold.breakdown.packaging > 0)
  const local = cold.coldChainSurcharge([{ product: dairyP, qty: 2 }], 'local')
  ok('local zone cheaper than national', local.surcharge < withCold.surcharge, `${local.surcharge} < ${withCold.surcharge}`)

  const slot = { id: 'tomorrow-0' }
  let v = cold.validateColdChainOrder([{ product: dairyP, qty: 1 }], { pincode: '110001', deliverySlot: slot })
  ok('valid cold order passes', v.ok === true && v.issues.length === 0, JSON.stringify(v.issues))
  v = cold.validateColdChainOrder([{ product: dairyP, qty: 1 }], { pincode: '110001' })
  ok('missing slot flagged', v.ok === false && v.issues.some(i => i.code === 'SLOT_MISSING'))
  v = cold.validateColdChainOrder([{ product: dairyP, qty: 1 }], { pincode: 'abc', deliverySlot: slot })
  ok('bad pincode flagged', v.issues.some(i => i.code === 'PINCODE_NOT_SERVICEABLE'))
  v = cold.validateColdChainOrder([{ product: dairyP, qty: 1 }], { pincode: '999999', deliverySlot: slot })
  ok('non-cold pincode flagged', v.issues.some(i => i.code === 'COLD_CHAIN_UNAVAILABLE'))
  v = cold.validateColdChainOrder([{ product: fashionP, qty: 1 }], { pincode: 'abc' })
  ok('no cold items → always ok', v.ok === true)
  ok('issue shape', cold.validateColdChainOrder([{ product: dairyP, qty: 1 }], {}).issues.every(i => i.code && i.message))

  const morningSlots = cold.deliverySlots('110001', Date.parse('2026-09-19T08:00:00Z'))
  ok('slots before cutoff: today + tomorrow', morningSlots.length === 8, morningSlots.length)
  ok('slot shape', morningSlots.every(s => s.id && s.dateISO && s.window && s.label && s.cutoffISO))
  const lateSlots = cold.deliverySlots('110001', Date.parse('2026-09-19T13:00:00Z'))
  ok('after cutoff: tomorrow only', lateSlots.length === 4 && lateSlots.every(s => /Tomorrow/.test(s.label)))
  ok('bad pincode → no slots', cold.deliverySlots('abc').length === 0)
}

/* ============================================================ */
console.log('\n── Vertical price engine')
{
  const legacy = price.resolvePrice(fashionP, {})
  const delegated = vp.resolveVerticalPrice(fashionP, null, {})
  ok('fashion delegates to legacy engine', delegated.price === legacy.price, `${delegated.price} vs ${legacy.price}`)
  ok('delegation recorded in trail', delegated.trail[0]?.step === 'delegate')
  ok('fashion source comes from legacy', delegated.source === legacy.source, delegated.source)

  const gv = groceryP.variants[0]
  const gp = vp.resolveVerticalPrice(groceryP, gv, {})
  ok('grocery pack variant source', gp.source === 'pack-price', gp.source)
  ok('grocery uses variant price', gp.price === gv.price, `${gp.price} vs ${gv.price}`)
  ok('grocery unit label', gp.unitLabel?.amount === 380 && gp.unitLabel?.per === 'kg', JSON.stringify(gp.unitLabel))
  ok('grocery unit label text', gp.unitLabelText === '₹380/kg', gp.unitLabelText)

  const fjv = fjP.variants[0]
  const fp = vp.resolveVerticalPrice(fjP, fjv, { now: NOWT })
  const expectGold = gold.fineJewelleryPrice(
    { purity: fjv.purity, weightG: fjv.weightG, makingPct: fjP.attributes.makingPct }, {})
  ok('fine-jewellery gold-rate source', fp.source === 'gold-rate', fp.source)
  ok('fine-jewellery matches gold math', near(fp.price, expectGold.total), `${fp.price} vs ${expectGold.total}`)
  ok('gold snapshot frozen', fp.meta?.snapshot?.purity === fjv.purity && fp.meta?.snapshot?.ratePerGram === gold.goldRateFor(fjv.purity))
  ok('gold breakdown in meta', fp.meta?.breakdown?.metalValue > 0)

  const override = vp.resolveVerticalPrice(
    { vertical: 'general', price: 999 }, null,
    { vertical: 'fine-jewellery', purity: '18K', weightG: 5, now: NOWT })
  ok('ctx.vertical overrides registry', override.source === 'gold-rate', override.source)
  ok('override uses ctx purity/weight',
    near(override.price, gold.fineJewelleryPrice({ purity: '18K', weightG: 5 }, {}).total))

  const perish = {
    vertical: 'dairy', price: 100,
    variants: [{ sku: 'T-PER-1', pack: '500 ml', price: 100, stock: 10, reserved: 0, expiryDate: iso(NOWT + 2 * DAY) }],
  }
  const np = vp.resolveVerticalPrice(perish, perish.variants[0], { now: NOWT })
  ok('near-expiry source', np.source === 'near-expiry', np.source)
  ok('near-expiry 25% markdown', np.price === 75, np.price)
  ok('near-expiry in meta', np.meta?.nearExpiryPct === 25)
  ok('near-expiry in trail', np.trail.some(t => t.step === 'near-expiry'))
  const freshP = {
    vertical: 'dairy', price: 100,
    variants: [{ sku: 'T-PER-2', pack: '500 ml', price: 100, stock: 10, reserved: 0, expiryDate: iso(NOWT + 30 * DAY) }],
  }
  const fr = vp.resolveVerticalPrice(freshP, freshP.variants[0], { now: NOWT })
  ok('fresh dairy keeps pack price', fr.source === 'pack-price' && fr.price === 100, fr.source)

  const snap = vp.linePriceSnapshot(groceryP, gv, 3, {})
  ok('line snapshot shape',
    snap.unitPrice === 95 && snap.qty === 3 && snap.lineTotal === 285 && snap.source === 'pack-price',
    JSON.stringify(snap))
  ok('line snapshot carries labels', snap.unitLabelText === '₹380/kg' && Array.isArray(snap.trail))
}

/* ============================================================ */
console.log('\n── Vertical return rules')
{
  ok('rule keys', Object.keys(re.VERTICAL_RETURN_RULES).sort().join(',') === 'confectionery,dairy,fine-jewellery,grocery')
  const dairyRule = re.verticalReturnRule({ vertical: 'dairy' }, { now: NOWT })
  ok('dairy → PERISHABLE', dairyRule?.code === 'PERISHABLE' && dairyRule?.eligible === false)
  ok('confectionery → PERISHABLE', re.verticalReturnRule({ vertical: 'confectionery' }, { now: NOWT })?.code === 'PERISHABLE')
  ok('grocery → PERISHABLE', re.verticalReturnRule({ vertical: 'grocery' }, { now: NOWT })?.code === 'PERISHABLE')
  const fjRule = re.verticalReturnRule({ vertical: 'fine-jewellery' }, { now: NOWT })
  ok('fine-jewellery → BUYBACK_ONLY', fjRule?.code === 'BUYBACK_ONLY' && fjRule?.eligible === true)
  ok('buyback terms', fjRule?.windowDays === 7 && fjRule?.buybackPct === 90 && fjRule?.creditType === 'store_credit')
  ok('fashion → no vertical rule', re.verticalReturnRule({ vertical: 'fashion' }, { now: NOWT }) === null)
  const expired = re.verticalReturnRule(
    { vertical: 'grocery', attributes: { expiryDate: iso(NOWT - DAY) } }, { now: NOWT })
  ok('expired item → PERISHABLE regardless', expired?.code === 'PERISHABLE')

  const delivered = (daysAgo) => ({
    status: 'Delivered', deliveredAt: NOWT - daysAgo * DAY, placedAt: NOWT - (daysAgo + 4) * DAY,
    paymentMethod: 'UPI', paid: true,
  })
  let e = re.checkEligibility(delivered(2), { category: 'Dairy' }, { product: { vertical: 'dairy' }, now: NOWT })
  ok('dairy not returnable', e.eligible === false && e.code === 'PERISHABLE')
  e = re.checkEligibility(delivered(2), { category: 'Fine Jewellery' }, { product: { vertical: 'fine-jewellery' }, now: NOWT })
  ok('fine-jewellery buyback in window', e.eligible === true && e.code === 'BUYBACK_ONLY' && e.daysLeft === 5, JSON.stringify(e.daysLeft))
  e = re.checkEligibility(delivered(10), { category: 'Fine Jewellery' }, { product: { vertical: 'fine-jewellery' }, now: NOWT })
  ok('fine-jewellery buyback expires', e.eligible === false && e.code === 'BUYBACK_EXPIRED')
  e = re.checkEligibility(delivered(2), { category: 'Innerwear' }, { product: { vertical: 'innerwear' }, now: NOWT })
  ok('innerwear still non-returnable (legacy)', e.eligible === false && /hygiene/i.test(e.reason), e.reason)
  e = re.checkEligibility(delivered(2), { category: 'Western Wear' }, { product: { vertical: 'fashion' }, now: NOWT })
  ok('fashion returnable in window', e.eligible === true && e.daysLeft === 3, JSON.stringify(e.daysLeft))
}

/* ============================================================ */
console.log('\n── Inventory batch allocation (FEFO)')
{
  const prod = {
    variants: [
      { sku: 'A', stock: 10, reserved: 0, batches: [
        { batch: 'B2', expiryDate: iso(NOWT + 30 * DAY), qty: 6, reserved: 0 },
        { batch: 'B1', expiryDate: iso(NOWT + 10 * DAY), qty: 4, reserved: 0 },
      ]},
      { sku: 'B', stock: 5, reserved: 0, expiryDate: iso(NOWT + 5 * DAY) },
    ],
  }
  let al = inv.allocateBatches(prod, 8)
  ok('FEFO across batches', al.lines.map(l => l.batch).join(',') === 'B,B1')
  ok('FEFO quantities', al.lines[0].qty === 5 && al.lines[1].qty === 3)
  ok('batch rows carry expiry', al.lines.every(l => l.expiryDate) && al.shortfall === 0)
  al = inv.allocateBatches(prod, 20)
  ok('shortfall reported', al.shortfall === 5 && al.lines.reduce((n, l) => n + l.qty, 0) === 15, al.shortfall)
  const resv = { variants: [{ sku: 'C', stock: 10, reserved: 4, expiryDate: iso(NOWT + 2 * DAY) }] }
  al = inv.allocateBatches(resv, 8)
  ok('reserved excluded', al.lines[0].qty === 6 && al.shortfall === 2)
  al = inv.allocateBatches({}, 5)
  ok('empty product', al.lines.length === 0 && al.shortfall === 5)
  al = inv.allocateBatches(prod, 0)
  ok('zero qty', al.lines.length === 0 && al.shortfall === 0)
}

/* ============================================================ */
console.log('\n── Seed catalogue (empty-first)')
{
  // The app boots with zero products. The registry and engines must stand on
  // their own without any demo rows.
  ok('PRODUCTS ships empty', PRODUCTS.length === 0, PRODUCTS.length)
  ok('no product has a bogus vertical',
    PRODUCTS.every(p => vert.VERTICAL_IDS.includes(p.vertical)))
  ok('nine verticals still registered without any seed rows',
    vert.VERTICAL_IDS.length === 9, vert.VERTICAL_IDS.length)

  // Empty-first is deliberate, not an accident: the vertical seed module
  // itself exports an empty product list.
  const { VERTICAL_SEED_PRODUCTS } = await import('../src/data/verticalSeed.js')
  ok('vertical seed products export is empty', VERTICAL_SEED_PRODUCTS.length === 0)
  // Engines must tolerate a zero-row catalogue without crashing.
  const bare = price.resolvePrice({ vertical: 'general', price: 999 }, {})
  ok('price engine works on a bare fixture', bare.price > 0, bare.price)
  ok('perishable fixtures need no seed rows',
    cold.requiresColdChain(dairyP) === true && cold.requiresColdChain({}) === false)
}

/* ============================================================ */
console.log('\n── Storefront pickers (render)')
{
  const React = (await import('react')).default
  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react')
  const { VerticalPicker, AttributeSections } = await import('../src/shop/verticalPickers.jsx')

  const mountHtml = async (el) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => { root.render(el) })
    const html = host.innerHTML
    await act(async () => { root.unmount() })
    host.remove()
    return html
  }

  const pickerHtml = await mountHtml(
    React.createElement(VerticalPicker, { product: groceryP, onChange: () => {} }))
  ok('grocery picker renders pack pills', pickerHtml.includes('250 g') && pickerHtml.includes('1 kg'), pickerHtml.length)
  ok('grocery picker has pack label', /pack size/i.test(pickerHtml))
  ok('grocery picker shows prices', pickerHtml.includes('₹'))

  const attrHtml = await mountHtml(React.createElement(AttributeSections, { product: fashionP }))
  ok('PDP details shows schema field labels', attrHtml.includes('Fabric'))
  ok('PDP details shows attribute values', attrHtml.includes('Denim'))
  ok('PDP details groups by section', /Details/i.test(attrHtml))
}

console.log(`\n${pass} passed · ${fail} failed\n`)
process.exit(fail ? 1 : 0)
