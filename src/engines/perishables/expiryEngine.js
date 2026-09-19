/**
 * Perishables expiry engine.
 *
 * Pure, side-effect free. Every date-sensitive function takes a `now` param
 * so it stays deterministic and testable.
 *
 * Product shape: vertical attributes live under `product.attributes`
 * (e.g. `attributes.expiryDate`, `attributes.shelfLifeDays`), variants are
 * `{ sku, stock, reserved, price?, expiryDate?, ...axis values }`.
 */

const DAY = 86400000

/**
 * Earliest expiry timestamp (ms) found on the product or its variants.
 * Prefers explicit `attributes.expiryDate`, then `shelfLifeDays + createdAt`,
 * then the earliest variant `expiryDate`. Returns null when nothing is found.
 */
function earliestExpiryMs(product) {
  const attrs = product.attributes || {}

  if (attrs.expiryDate) {
    const ms = toMs(attrs.expiryDate)
    if (ms != null) return ms
  }

  if (attrs.shelfLifeDays != null && product.createdAt) {
    const ms = toMs(product.createdAt)
    if (ms != null) return ms + Number(attrs.shelfLifeDays) * DAY
  }

  let earliest = null
  for (const v of product.variants || []) {
    if (!v || !v.expiryDate) continue
    const ms = toMs(v.expiryDate)
    if (ms != null && (earliest == null || ms < earliest)) earliest = ms
  }
  return earliest
}

function toMs(value) {
  if (value == null) return null
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

/**
 * Freshness verdict for a product.
 *
 * @param {object} product
 * @param {number} [now=Date.now()]
 * @param {object} [opts]
 * @param {number} [opts.nearDays=3]  within this many days of expiry → 'near-expiry'
 * @returns {{ status:'fresh'|'near-expiry'|'expired'|'non-perishable', daysLeft, label }}
 */
export function expiryStatus(product, now = Date.now(), { nearDays = 3 } = {}) {
  const expiryMs = earliestExpiryMs(product || {})

  if (expiryMs == null) {
    return { status: 'non-perishable', daysLeft: null, label: 'No expiry tracked' }
  }

  const daysLeft = Math.floor((expiryMs - now) / DAY)

  if (daysLeft < 0) {
    const ago = -daysLeft
    return {
      status: 'expired',
      daysLeft,
      label: ago === 1 ? 'Expired yesterday' : `Expired ${ago} days ago`,
    }
  }
  if (daysLeft <= nearDays) {
    return {
      status: 'near-expiry',
      daysLeft,
      label: daysLeft === 0 ? 'Expires today' : daysLeft === 1 ? 'Expires tomorrow' : `Expires in ${daysLeft} days`,
    }
  }
  return {
    status: 'fresh',
    daysLeft,
    label: daysLeft <= 14 ? `Fresh — ${daysLeft} days left` : 'Fresh',
  }
}

/** Sort variants FEFO: earliest expiryDate first, no-expiry last. Pure (copies). */
export function fefoSort(variants = []) {
  return [...variants].sort((a, b) => {
    const ea = toMs(a?.expiryDate)
    const eb = toMs(b?.expiryDate)
    if (ea == null && eb == null) return 0
    if (ea == null) return 1
    if (eb == null) return -1
    return ea - eb
  })
}

function availableUnits(variant) {
  return Math.max(0, (variant.stock ?? 0) - (variant.reserved ?? 0))
}

/**
 * Allocate `qty` units oldest-expiry-first (FEFO).
 * @returns {{ lines:[{variant, qty}], shortfall:number }}
 */
export function allocateFefo(product, qty) {
  let remaining = Math.max(0, qty || 0)
  const lines = []

  for (const variant of fefoSort(product?.variants || [])) {
    if (remaining <= 0) break
    const avail = availableUnits(variant)
    if (avail <= 0) continue
    const take = Math.min(avail, remaining)
    lines.push({ variant, qty: take })
    remaining -= take
  }

  return { lines, shortfall: remaining }
}

/**
 * Discount percent (number, or 0) to push stock that is near expiry.
 *
 * @param {object} product
 * @param {number} [now=Date.now()]
 * @param {object} [cfg]
 * @param {number} [cfg.nearDays=3]
 * @param {number} [cfg.pct=25]
 */
export function nearExpiryDiscount(product, now = Date.now(), cfg = {}) {
  const { nearDays = 3, pct = 25 } = cfg
  const { status } = expiryStatus(product, now, { nearDays })
  return status === 'near-expiry' ? pct : 0
}

export default { expiryStatus, fefoSort, allocateFefo, nearExpiryDiscount }
