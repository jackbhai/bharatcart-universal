/**
 * Cold-chain shipping engine — for dairy and other temperature-sensitive goods.
 *
 * Covers: detecting cold-chain requirement, insulated-packaging surcharge,
 * same-day / next-day delivery slots with order cutoffs, and validation of
 * cold-chain orders. Pure and dependency-free, except it reuses
 * `checkServiceability` from the core shipping engine.
 */

import { checkServiceability } from './shippingEngine.js'

const DAY = 86400000

/** Pincodes where cold-chain delivery is available (demo allow-list). */
export const COLD_CHAIN_PREFIXES = ['11', '40', '56', '60', '70', '50', '30', '20']

/** Storage-temp values that imply chilling/freezing is required. */
const CHILLED_MARKERS = ['chill', 'cold', 'frozen', 'freeze', '2-8', '0-4', '-18', 'refrigerat']

/**
 * Does this product need a cold chain?
 * True when the vertical is dairy, `attributes.needsColdChain` is set, or
 * `attributes.storageTemp` indicates chilled/frozen storage.
 */
export function requiresColdChain(product = {}) {
  const vertical = product.vertical ?? product.attributes?.vertical
  if (vertical === 'dairy') return true

  const attrs = product.attributes || {}
  if (attrs.needsColdChain) return true

  const temp = String(attrs.storageTemp ?? '').toLowerCase()
  if (temp && CHILLED_MARKERS.some(m => temp.includes(m))) return true

  return false
}

const r2 = (n) => Math.round(n * 100) / 100

/**
 * Insulated-packaging + cold-chain surcharge for a set of items.
 *
 * @param {Array<{product, qty}>} items
 * @param {string} zone           'local' | 'national' | 'remote'
 * @param {object} [cfg]         { flat, perKg, zoneMultiplier }
 * @returns {{ surcharge, coldItems, breakdown }}
 */
export function coldChainSurcharge(items = [], zone = 'national', cfg = {}) {
  const { flat = 60, perKg = 25, zoneMultiplier = { local: 1, national: 1.2, remote: 1.5 } } = cfg

  const cold = (items || []).filter(i => requiresColdChain(i.product))
  if (cold.length === 0) {
    return { surcharge: 0, coldItems: 0, breakdown: null }
  }

  const weightKg = cold.reduce((s, i) => s + ((i.product?.weightG ?? 300) * (i.qty ?? 1)) / 1000, 0)
  const mult = zoneMultiplier[zone] ?? 1
  const packaging = flat * mult
  const handling = weightKg * perKg * mult
  const surcharge = r2(packaging + handling)

  return {
    surcharge,
    coldItems: cold.length,
    breakdown: {
      packaging: r2(packaging),
      handling: r2(handling),
      weightKg: r2(weightKg),
      zone,
    },
  }
}

/** Slot windows offered for cold-chain delivery. */
const SLOT_WINDOWS = ['7–10 AM', '10 AM–1 PM', '4–7 PM', '7–10 PM']

/**
 * Same-day / next-day delivery slots for a pincode.
 *
 * @param {string} pincode
 * @param {number} [now=Date.now()]
 * @param {object} [cfg]  { orderByHour: 12, coldChainPrefixes }
 * @returns {Array<{ id, dateISO, window, label, cutoffISO }>}
 */
export function deliverySlots(pincode, now = Date.now(), cfg = {}) {
  const { orderByHour = 12, coldChainPrefixes = COLD_CHAIN_PREFIXES } = cfg
  const pin = String(pincode || '').trim()
  const serviceable = /^[1-9][0-9]{5}$/.test(pin) && coldChainPrefixes.some(p => pin.startsWith(p))
  if (!serviceable) return []

  const slots = []
  const dayStart = Math.floor(now / DAY) * DAY
  const nowDate = new Date(now)

  const pushDay = (dayMs, dayLabel, startIdx) => {
    SLOT_WINDOWS.forEach((window, i) => {
      const id = `${dayLabel.toLowerCase()}-${i}`
      slots.push({
        id,
        dateISO: new Date(dayMs).toISOString().slice(0, 10),
        window,
        label: `${dayLabel}, ${window}`,
        cutoffISO: new Date(dayMs + orderByHour * 3600000).toISOString(),
      })
    })
  }

  // Same-day slots only if ordered before the cutoff hour (UTC used for determinism).
  if (nowDate.getUTCHours() < orderByHour) {
    pushDay(dayStart, 'Today')
  }
  pushDay(dayStart + DAY, 'Tomorrow')

  return slots
}

/**
 * Validate a cold-chain order before checkout.
 *
 * @param {Array<{product, qty}>} items
 * @param {object} address  { pincode, deliverySlot }
 * @param {object} [cfg]    forwarded to checkServiceability / deliverySlots
 * @returns {{ ok, issues: Array<{ code, message }> }}
 */
export function validateColdChainOrder(items = [], address = {}, cfg = {}) {
  const issues = []
  const cold = (items || []).filter(i => requiresColdChain(i.product))

  if (cold.length === 0) {
    return { ok: true, issues: [] }
  }

  const svc = checkServiceability(address.pincode, cfg)
  if (!svc.ok) {
    issues.push({ code: 'PINCODE_NOT_SERVICEABLE', message: svc.reason || 'Pincode is not serviceable' })
  } else if (svc.zone === 'Remote') {
    issues.push({ code: 'COLD_CHAIN_UNAVAILABLE', message: 'Cold-chain delivery is not available in remote areas' })
  }

  const pin = String(address.pincode || '').trim()
  const coldPrefixes = cfg.coldChainPrefixes ?? COLD_CHAIN_PREFIXES
  if (/^[1-9][0-9]{5}$/.test(pin) && !coldPrefixes.some(p => pin.startsWith(p))) {
    issues.push({ code: 'COLD_CHAIN_UNAVAILABLE', message: 'Cold-chain delivery is not available for this pincode yet' })
  }

  if (!address.deliverySlot) {
    issues.push({ code: 'SLOT_MISSING', message: 'Please choose a delivery slot — cold-chain items need a scheduled drop' })
  }

  return { ok: issues.length === 0, issues }
}

export default { requiresColdChain, coldChainSurcharge, deliverySlots, validateColdChainOrder, COLD_CHAIN_PREFIXES }
