/**
 * Unit-of-measure engine for grocery / dairy / confectionery packs.
 *
 * Turns pack strings like "500 g" into per-kg / per-L unit prices so the
 * storefront can show "₹240/kg" style comparisons. Pure and dependency-free.
 */

/** Canonical unit → base unit it converts into. */
const UNIT_TO_BASE = {
  g: 'kg',
  kg: 'kg',
  ml: 'L',
  L: 'L',
  pcs: 'pcs',
}

/** Aliases → canonical unit. */
const UNIT_ALIASES = {
  g: 'g', gm: 'g', gram: 'g', grams: 'g', grm: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'L', lt: 'L', ltr: 'L', litre: 'L', litres: 'L', liter: 'L', liters: 'L',
  pc: 'pcs', pcs: 'pcs', piece: 'pcs', pieces: 'pcs', pkt: 'pcs', pack: 'pcs', packs: 'pcs',
}

/** Canonical unit → qty of it in one base unit. */
const TO_BASE = { g: 1000, kg: 1, ml: 1000, L: 1, pcs: 1 }

/**
 * Parse a pack string.
 *   parsePack('500 g') → { qty: 500, unit: 'g' }
 *   parsePack('1 kg')  → { qty: 1,   unit: 'kg' }
 *   parsePack('250 ml')→ { qty: 250, unit: 'ml' }
 *   parsePack('1 L')   → { qty: 1,   unit: 'L' }
 * Returns null when the string can't be parsed.
 */
export function parsePack(pack) {
  if (pack == null) return null
  const m = String(pack).trim().match(/^([\d]+(?:[.,]\d+)?)\s*([a-zA-Z]+)$/)
  if (!m) return null
  const qty = parseFloat(m[1].replace(',', '.'))
  const unit = UNIT_ALIASES[m[2].toLowerCase()]
  if (!Number.isFinite(qty) || qty <= 0 || !unit) return null
  return { qty, unit }
}

/** Which pack string belongs to this product/variant? */
function packOf(product, variant) {
  return variant?.pack
    ?? variant?.packSize
    ?? variant?.attributes?.pack
    ?? product?.attributes?.packSize
    ?? product?.attributes?.pack
    ?? product?.packSize
    ?? product?.pack
    ?? null
}

/**
 * Quantity of `pack` expressed in `baseUnit` ('kg', 'L' or 'pcs').
 * Returns null when the pack can't be parsed or can't convert to baseUnit.
 */
export function packToBase(pack, baseUnit) {
  const parsed = typeof pack === 'string' ? parsePack(pack) : pack
  if (!parsed) return null
  const { qty, unit } = parsed
  if (UNIT_TO_BASE[unit] !== baseUnit) return null
  return qty / TO_BASE[unit]
}

/** Detect weight vs volume vs count packs for this line. */
function baseUnitFor(pack) {
  const parsed = typeof pack === 'string' ? parsePack(pack) : pack
  if (!parsed) return null
  return UNIT_TO_BASE[parsed.unit] ?? null
}

/**
 * Price per base unit (kg / L / pcs), rounded to 2 decimals.
 * Uses variant.price, falling back to product.price. Returns null when the
 * pack can't be parsed or there's no price.
 */
export function uomUnitPrice(product, variant = null) {
  const pack = packOf(product, variant)
  const base = baseUnitFor(pack)
  if (!base) return null
  const inBase = packToBase(pack, base)
  const price = variant?.price ?? product?.price
  if (inBase == null || inBase <= 0 || price == null) return null
  return Math.round((price / inBase) * 100) / 100
}

/**
 * Symbol-agnostic unit label: `{ amount, per }`, e.g. `{ amount: 240, per: 'kg' }`.
 * Returns null when no unit price can be computed.
 */
export function uomLabel(product, variant = null) {
  const pack = packOf(product, variant)
  const base = baseUnitFor(pack)
  const amount = uomUnitPrice(product, variant)
  if (!base || amount == null) return null
  return { amount, per: base }
}

/**
 * Human label, e.g. '₹240/kg' or '₹60/L'.
 * Returns null when no unit price can be computed.
 */
export function formatUom(product, variant = null, symbol = '₹') {
  const label = uomLabel(product, variant)
  if (!label) return null
  const amount = Number.isInteger(label.amount) ? label.amount : label.amount.toFixed(2)
  return `${symbol}${amount}/${label.per}`
}

export default { parsePack, packToBase, uomUnitPrice, uomLabel, formatUom }
