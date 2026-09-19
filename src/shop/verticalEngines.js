/**
 * verticalEngines — the storefront's safe bridge to the vertical engine contracts.
 *
 * Chunk D (storefront) is built in parallel with the chunks that own these engines:
 *
 *   src/engines/catalogue/verticals.js            verticalFor, getVertical, variantAxesFor, attributeSchemaFor
 *   src/engines/pricing/verticalPriceEngine.js    resolveVerticalPrice, linePriceSnapshot
 *   src/engines/pricing/uomEngine.js              formatUom
 *   src/engines/pricing/goldEngine.js             snapshotRate, fineJewelleryPrice
 *   src/engines/catalogue/sizeChartEngine.js      getSizeChart
 *   src/engines/subscriptions/subscriptionEngine.js  FREQUENCIES, nextDeliverySlots, buildSchedule
 *   src/engines/shipping/coldChainEngine.js       requiresColdChain, deliverySlots, validateColdChainOrder
 *   src/engines/perishables/expiryEngine.js       expiryStatus
 *
 * A static `import` of a file that does not exist yet breaks `vite build`, and a
 * dynamic `import()` of one breaks it too — so the engines are discovered with
 * `import.meta.glob`, which matches nothing (harmlessly) until the files land and
 * bundles them as lazy chunks once they do. Until then, every contract has a
 * sane fallback below: legacy pricing, seed-driven labels, and generic slots.
 * Nothing here invents business rules — fallbacks only re-express data that is
 * already on the product, and the real engines take over the moment they arrive.
 *
 * All exports below are stable references that delegate to a mutable impl table,
 * so the swap from fallback to real engine is transparent to callers. Components
 * that render engine-derived values should call `useEngineVersion()` and include
 * it in their memo deps, so they re-render when the real engines arrive.
 */
import { useState, useEffect } from 'react'
import { resolvePrice } from '../engines/pricing/priceEngine.js'

/* ============================================================ fallbacks */

/** Seed products already carry `vertical`; map anything else defensively. */
function fbVerticalFor(p) {
  if (!p) return 'general'
  if (p.vertical) return p.vertical
  const fromAttrs = p.attributes?.vertical
  if (fromAttrs) return fromAttrs
  const cat = String(p.category ?? '').toLowerCase()
  if (/footwear|shoe|sandal/.test(cat)) return 'footwear'
  if (/grocery|staple/.test(cat)) return 'grocery'
  if (/dairy/.test(cat)) return 'dairy'
  if (/sweet|confection|chocolate|bakery/.test(cat)) return 'confectionery'
  if (/innerwear|lingerie/.test(cat)) return 'innerwear'
  if (/jewellery|jewelry/.test(cat)) return 'artificial-jewellery'
  if (/fashion|apparel|clothing/.test(cat)) return 'fashion'
  return 'general'
}

const VERTICAL_LABELS = {
  fashion: 'Fashion',
  innerwear: 'Innerwear',
  footwear: 'Footwear',
  'artificial-jewellery': 'Artificial Jewellery',
  'fine-jewellery': 'Fine Jewellery',
  grocery: 'Grocery',
  dairy: 'Dairy',
  confectionery: 'Confectionery',
  general: 'General',
}

function fbGetVertical(id) {
  return {
    id,
    label: VERTICAL_LABELS[id] ?? String(id ?? 'general'),
    // sizeChart keys are resolved by the size-chart engine when it lands
    sizeChart: id === 'footwear' ? 'footwear' : id === 'innerwear' ? 'innerwear'
      : id === 'fashion' ? 'apparel' : null,
  }
}

const AXIS_META_KEYS = new Set([
  'sku', 'stock', 'reserved', 'price', 'mrp', 'cost', 'expiryDate',
  'barcode', 'id', 'hex', 'packQty', 'packUnit',
])

/** Option axes for a product's vertical, as { key, label } defs. */
function fbVariantAxesFor(product) {
  const seen = new Set()
  for (const v of product?.variants ?? []) {
    for (const k of Object.keys(v ?? {})) {
      if (!AXIS_META_KEYS.has(k)) seen.add(k)
    }
  }
  const preferred = ['size', 'color', 'design', 'width', 'pack', 'packWeight', 'flavour', 'purity', 'weightG']
  const ordered = [
    ...preferred.filter(k => seen.has(k)),
    ...[...seen].filter(k => !preferred.includes(k)),
  ]
  return ordered.map(k => ({ key: k, label: AXIS_LABELS[k] ?? k }))
}

const AXIS_LABELS = {
  size: 'Size', color: 'Colour', design: 'Design', width: 'Width',
  pack: 'Pack', packWeight: 'Pack weight', flavour: 'Flavour',
  purity: 'Purity', weightG: 'Weight',
}

const ATTR_LABELS = {
  metal: 'Metal', purity: 'Purity', weightG: 'Weight', makingPct: 'Making charges',
  stoneValue: 'Stone value', bisHallmark: 'BIS hallmark', certification: 'Certification',
  care: 'Care', flavour: 'Flavour', allergens: 'Allergens', vegMark: 'Food mark',
  bestBeforeDays: 'Best before', storageNote: 'Storage', customMessage: 'Custom message',
  fatPct: 'Fat', pasteurized: 'Pasteurized', shelfLifeDays: 'Shelf life',
  storageTemp: 'Storage temp', fssai: 'FSSAI Lic.', brand: 'Brand', expiryDate: 'Expiry',
  mrp: 'MRP', unitPriceBase: 'Unit price base', plating: 'Plating', width: 'Width',
  fabric: 'Fabric', craft: 'Craft', origin: 'Origin',
}

/**
 * Attribute schema for a product's vertical, as field definitions
 * [{ key, label, type, section }]. Values live on the product itself
 * (product.attributes[key] ?? product[key]) — the caller resolves them.
 * The fallback mirrors the PDP's old hardcoded Details list so the tab
 * looks identical until the catalogue engine provides the real schema.
 */
function fbAttributeSchemaFor(product) {
  if (!product) return []
  const defs = []
  const seen = new Set()
  const add = (key, label, section) => {
    if (seen.has(key)) return
    seen.add(key)
    defs.push({ key, label, type: 'text', section })
  }
  if (product.fabric) add('fabric', 'Fabric', 'Details')
  if (product.craft) add('craft', 'Craft', 'Details')
  if (product.origin) add('origin', 'Origin', 'Details')
  if (product.subCategory) add('subCategory', 'Category', 'Details')
  if (product.hsn) add('hsn', 'HSN', 'Details')
  if (product.weightG) add('weightG', 'Weight', 'Details')
  for (const k of Object.keys(product.attributes ?? {})) {
    add(k, ATTR_LABELS[k] ?? k, 'Specifications')
  }
  return defs
}

/** Resolve a schema field's display value from the product. */
export function attributeValue(product, key) {
  return product?.attributes?.[key] ?? product?.[key]
}

/**
 * The variant as the shopper configured it. E.g. a fine-jewellery purity
 * choice that differs from the catalogue variant's default — the pricing
 * engine reads purity from the variant first, so the override keeps the PDP,
 * cart and the order integrity gate pricing the same selection.
 */
export function pricingVariant(variant, extras) {
  if (variant && extras?.purity && variant.purity !== extras.purity) {
    return { ...variant, purity: extras.purity }
  }
  return variant
}

/**
 * Legacy pricing with the variant's own price as the base when it has one
 * (pack variants carry per-pack prices in the seed). The real vertical price
 * engine adds gold pricing, pack rules and near-expiry discounts on top.
 */
function fbResolveVerticalPrice(product, variant = null, ctx = {}) {
  const base = variant?.price != null
    ? { ...product, price: variant.price, mrp: variant.mrp ?? product.mrp }
    : product
  const r = resolvePrice(base, { qty: ctx.qty ?? 1, customerGroup: ctx.customerGroup })
  return {
    price: r.price,
    source: variant?.price != null ? 'pack' : r.source,
    trail: r.trail,
    unitLabel: fbFormatUom(product, variant) ?? null,
    meta: {},
  }
}

function fbLinePriceSnapshot(product, variant = null, qty = 1, ctx = {}) {
  const r = fbResolveVerticalPrice(product, variant, { ...ctx, qty })
  return {
    unitPrice: r.price,
    qty,
    lineTotal: r.price * qty,
    source: r.source,
    meta: r.meta,
  }
}

/** '₹380/kg' style unit price from the seed's unitPriceBase; null when unknown. */
function fbFormatUom(product, variant = null, symbol = '₹') {
  const base = product?.attributes?.unitPriceBase
  const pack = variant?.pack ?? variant?.packWeight
  if (base == null || !pack) return null
  const unit = /(\d+\s*)?kg/i.test(pack) ? 'kg'
    : /(\d+\s*)?l\b/i.test(pack) && !/ml/i.test(pack) ? 'L'
    : null
  if (!unit) return null
  return `${symbol}${base}/${unit}`
}

function fbSnapshotRate(purity) {
  return { purity, ratePerGram: null, at: new Date().toISOString(), source: 'demo' }
}
function fbGoldRateStatus() { return { source: 'demo', stale: true, fetchedAt: null, lastError: null } }
async function fbRefreshLiveRates() { return { ok: false, error: 'gold engine unavailable' } }
function fbFineJewelleryPrice() { return null }
function fbGetSizeChart() { return null }

const fbFrequencies = [
  { id: 'daily', label: 'Every day', days: 1 },
  { id: 'alternate', label: 'Alternate days', days: 2 },
  { id: 'weekly', label: 'Weekly', days: 7 },
]

/** Upcoming delivery slots: [{ dateISO: 'YYYY-MM-DD', slot, label }]. */
function fbNextDeliverySlots(product, pincode, now = Date.now(), count = 3) {
  const out = []
  for (let i = 1; i <= count; i++) {
    const dt = new Date(now + i * 86400000)
    out.push({
      dateISO: dt.toISOString().slice(0, 10),
      slot: 'morning',
      label: dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) + ' — Morning (6–9 AM)',
    })
  }
  return out
}

const SUB_STEP_DAYS = { daily: 1, alternate: 2, weekly: 7 }

/**
 * Delivery schedule: [{ dateISO, qty, status:'scheduled', productId, variantSku, frequency }].
 */
function fbBuildSchedule({ productId, variantSku, qty = 1, frequency = 'daily', startDateISO, occurrences = 3 } = {}) {
  const freqId = typeof frequency === 'string' ? frequency : frequency?.id ?? 'daily'
  const step = SUB_STEP_DAYS[freqId] ?? 1
  let start = startDateISO ? Date.parse(`${startDateISO}T00:00:00Z`) : NaN
  if (!Number.isFinite(start)) start = Date.now()
  const out = []
  for (let i = 0; i < occurrences; i++) {
    out.push({
      dateISO: new Date(start + i * step * 86400000).toISOString().slice(0, 10),
      qty,
      status: 'scheduled',
      productId,
      variantSku,
      frequency: freqId,
    })
  }
  return out
}

function fbRequiresColdChain(product) {
  const v = fbVerticalFor(product)
  return v === 'dairy' || v === 'confectionery'
}

function fbDeliverySlots(pincode, now = Date.now()) {
  const slots = []
  const windows = ['10 AM – 1 PM', '4 PM – 7 PM']
  for (let i = 1; i <= 3; i++) {
    const dt = new Date(now + i * 86400000)
    const dateISO = dt.toISOString().slice(0, 10)
    const day = dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    for (let w = 0; w < windows.length; w++) {
      slots.push({
        id: `${dateISO}-${w}`,
        dateISO,
        window: windows[w],
        label: `${day} · ${windows[w]}`,
        cutoffISO: new Date(dt.getTime() + 12 * 3600000).toISOString(),
      })
    }
  }
  return slots
}

function fbValidateColdChainOrder(items, address) {
  const issues = []
  if (!address?.pincode || !/^[1-9][0-9]{5}$/.test(String(address.pincode))) {
    issues.push({ code: 'PINCODE_NOT_SERVICEABLE', message: 'A valid delivery pincode is required for refrigerated items.' })
  }
  for (const it of items ?? []) {
    if (!it?.slot && !it?.extras?.slot && !address?.deliverySlot) {
      issues.push({ code: 'SLOT_MISSING', message: `Choose a delivery slot for ${it?.product?.name ?? 'a refrigerated item'}.` })
    }
  }
  return { ok: issues.length === 0, issues, reason: issues[0]?.message ?? null }
}

function fbExpiryStatus(product, now = Date.now()) {
  const iso = product?.attributes?.expiryDate
  if (!iso) return { status: 'non-perishable', daysLeft: null, label: 'No expiry tracked' }
  const daysLeft = Math.ceil((new Date(iso).getTime() - now) / 86400000)
  const status = daysLeft < 0 ? 'expired'
    : daysLeft <= 3 ? 'near-expiry'
    : 'fresh'
  const label = daysLeft < 0 ? `Expired ${-daysLeft}d ago`
    : daysLeft === 0 ? 'Expires today'
    : `Expires in ${daysLeft}d`
  return { status, daysLeft, label }
}

/* ============================================================ impl table */

const impl = {
  verticalFor: fbVerticalFor,
  getVertical: fbGetVertical,
  variantAxesFor: fbVariantAxesFor,
  attributeSchemaFor: fbAttributeSchemaFor,
  resolveVerticalPrice: fbResolveVerticalPrice,
  linePriceSnapshot: fbLinePriceSnapshot,
  formatUom: fbFormatUom,
  snapshotRate: fbSnapshotRate,
  fineJewelleryPrice: fbFineJewelleryPrice,
  goldRateStatus: fbGoldRateStatus,
  refreshLiveRates: fbRefreshLiveRates,
  getSizeChart: fbGetSizeChart,
  FREQUENCIES: fbFrequencies,
  nextDeliverySlots: fbNextDeliverySlots,
  buildSchedule: fbBuildSchedule,
  requiresColdChain: fbRequiresColdChain,
  deliverySlots: fbDeliverySlots,
  validateColdChainOrder: fbValidateColdChainOrder,
  expiryStatus: fbExpiryStatus,
  ready: false,
}

/* ============================================ real-engine discovery */

const ENGINE_EXPORTS = {
  'verticals.js': ['verticalFor', 'getVertical', 'variantAxesFor', 'attributeSchemaFor'],
  'verticalPriceEngine.js': ['resolveVerticalPrice', 'linePriceSnapshot'],
  'uomEngine.js': ['formatUom'],
  'goldEngine.js': ['snapshotRate', 'fineJewelleryPrice', 'goldRateStatus', 'refreshLiveRates'],
  'sizeChartEngine.js': ['getSizeChart'],
  'subscriptionEngine.js': ['FREQUENCIES', 'nextDeliverySlots', 'buildSchedule'],
  'coldChainEngine.js': ['requiresColdChain', 'deliverySlots', 'validateColdChainOrder'],
  'expiryEngine.js': ['expiryStatus'],
}

// One glob per file: a missing file simply matches nothing, so the build
// stays green until the parallel chunks land theirs.
const loaders = {
  ...import.meta.glob('../engines/catalogue/verticals.js'),
  ...import.meta.glob('../engines/pricing/verticalPriceEngine.js'),
  ...import.meta.glob('../engines/pricing/uomEngine.js'),
  ...import.meta.glob('../engines/pricing/goldEngine.js'),
  ...import.meta.glob('../engines/catalogue/sizeChartEngine.js'),
  ...import.meta.glob('../engines/subscriptions/subscriptionEngine.js'),
  ...import.meta.glob('../engines/shipping/coldChainEngine.js'),
  ...import.meta.glob('../engines/perishables/expiryEngine.js'),
}

const listeners = new Set()
let version = 0
function notify() {
  version += 1
  impl.ready = true
  for (const fn of listeners) {
    try { fn() } catch { /* a dead listener is not worth crashing over */ }
  }
}

function adoptEngines() {
  for (const [path, load] of Object.entries(loaders)) {
    const base = path.split('/').pop()
    const names = ENGINE_EXPORTS[base] ?? []
    load().then(mod => {
      let changed = false
      for (const name of names) {
        const candidate = mod?.[name]
        const ok = name === 'FREQUENCIES' ? Array.isArray(candidate) : typeof candidate === 'function'
        if (ok && impl[name] !== candidate) {
          impl[name] = candidate
          changed = true
        }
      }
      if (changed) notify()
    }).catch(() => { /* engine failed to load — fallbacks stay in place */ })
  }
}

// Kick off at import time; in tests and pre-chunk builds `loaders` is empty.
adoptEngines()

/**
 * Re-render the calling component when real engines arrive. Include the
 * returned version in memo deps for engine-derived values.
 */
export function useEngineVersion() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const fn = () => setTick(t => t + 1)
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  }, [])
  return version
}

/** True once at least one real engine module has been adopted. */
export function enginesReady() { return impl.ready }

/* ============================================================ exports */

export const verticalFor = (product) => impl.verticalFor(product)
export const getVertical = (id) => impl.getVertical(id)
export const variantAxesFor = (product) => impl.variantAxesFor(product)
export const attributeSchemaFor = (product) => impl.attributeSchemaFor(product)
export const resolveVerticalPrice = (product, variant = null, ctx = {}) =>
  impl.resolveVerticalPrice(product, variant, ctx)
export const linePriceSnapshot = (product, variant = null, qty = 1, ctx = {}) =>
  impl.linePriceSnapshot(product, variant, qty, ctx)
export const formatUom = (product, variant = null, symbol = '₹') =>
  impl.formatUom(product, variant, symbol)
export const snapshotRate = (purity, cfg) => impl.snapshotRate(purity, cfg)
export const fineJewelleryPrice = (...args) => impl.fineJewelleryPrice(...args)
export const getSizeChart = (key) => impl.getSizeChart(key)
export const nextDeliverySlots = (product, pincode, now, count) =>
  impl.nextDeliverySlots(product, pincode, now, count)
export const buildSchedule = (args) => impl.buildSchedule(args)
export const requiresColdChain = (product) => impl.requiresColdChain(product)
export const deliverySlots = (pincode, now, cfg) => impl.deliverySlots(pincode, now, cfg)
export const validateColdChainOrder = (items, address) => impl.validateColdChainOrder(items, address)
export const expiryStatus = (product, now) => impl.expiryStatus(product, now)

/** Where the gold rate came from: { source: 'live'|'live-cached'|'demo', stale, fetchedAt }. */
export const goldRateStatus = () => impl.goldRateStatus()
/** Fire-and-forget live-rate refresh; safe to call at shop boot. */
export const refreshLiveRates = (...args) => impl.refreshLiveRates(...args)

// Kick off one live-rate refresh once the real gold engine lands. If no
// VITE_GOLD_RATE_URL is configured the engine no-ops and pricing stays on
// the DEMO table with `stale: true` (PDP shows "indicative rate").
{
  let fired = false
  const onAdopt = () => {
    if (fired || impl.goldRateStatus === fbGoldRateStatus) return
    fired = true
    listeners.delete(onAdopt)
    try { impl.refreshLiveRates()?.catch?.(() => {}) } catch { /* stay on demo rates */ }
  }
  listeners.add(onAdopt)
}

/** Frequency list — a getter so the real engine's array is picked up on swap. */
export function frequencies() { return impl.FREQUENCIES }
export function frequencyLabel(id) {
  return (impl.FREQUENCIES.find(f => f.id === id)?.label) ?? String(id ?? '')
}
