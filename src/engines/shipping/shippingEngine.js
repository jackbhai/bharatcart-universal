/**
 * Shipping engine — zones, rate cards, courier rate-shopping, serviceability,
 * free-shipping thresholds and estimated delivery dates.
 */

export const DEFAULT_ZONES = [
  { id: 'local',    name: 'Local',         states: [], sameCity: true,     baseDays: 1 },
  { id: 'zonal',    name: 'Zonal',         zones: ['North'],               baseDays: 2 },
  { id: 'metro',    name: 'Metro',         tiers: [1],                     baseDays: 2 },
  { id: 'national', name: 'Rest of India', all: true,                      baseDays: 4 },
  { id: 'remote',   name: 'Remote / NE',   zones: ['Northeast'],           baseDays: 7 },
]

export const DEFAULT_COURIERS = [
  { id: 'delhivery', name: 'Delhivery',   baseRate: 45, perKg: 32, codFee: 40, codPct: 1.2, maxWeight: 30000, sla: 3, rating: 4.2, codSupported: true },
  { id: 'bluedart',  name: 'Blue Dart',   baseRate: 78, perKg: 48, codFee: 55, codPct: 1.5, maxWeight: 25000, sla: 2, rating: 4.6, codSupported: true },
  { id: 'ekart',     name: 'Ekart',       baseRate: 42, perKg: 28, codFee: 35, codPct: 1.0, maxWeight: 20000, sla: 4, rating: 4.0, codSupported: true },
  { id: 'xpressbees',name: 'XpressBees',  baseRate: 38, perKg: 26, codFee: 35, codPct: 1.0, maxWeight: 15000, sla: 4, rating: 3.9, codSupported: true },
  { id: 'dtdc',      name: 'DTDC',        baseRate: 40, perKg: 30, codFee: 45, codPct: 1.3, maxWeight: 25000, sla: 5, rating: 3.7, codSupported: true },
  { id: 'indiapost', name: 'India Post',  baseRate: 28, perKg: 18, codFee: 25, codPct: 0.8, maxWeight: 20000, sla: 8, rating: 3.2, codSupported: true },
  { id: 'shadowfax', name: 'Shadowfax',   baseRate: 55, perKg: 35, codFee: 40, codPct: 1.2, maxWeight: 10000, sla: 1, rating: 4.1, codSupported: false },
]

export const RATE_STRATEGY = {
  CHEAPEST: 'cheapest',
  FASTEST: 'fastest',
  BEST_RATED: 'best_rated',
  BALANCED: 'balanced',
}

/** Which zone does this address fall into? */
export function resolveZone(address = {}, zones = DEFAULT_ZONES, origin = {}) {
  if (address.city && origin.city && address.city === origin.city) {
    const local = zones.find(z => z.sameCity)
    if (local) return local
  }
  for (const z of zones) {
    if (z.all) continue
    if (z.states?.includes(address.state)) return z
    if (z.zones?.includes(address.zone)) return z
    if (z.tiers?.includes(address.tier)) return z
  }
  return zones.find(z => z.all) || zones.at(-1)
}

/** Volumetric weight — couriers bill on whichever is higher. */
export function chargeableWeight(items = [], divisor = 5000) {
  const actual = items.reduce((s, i) => s + (i.product?.weightG ?? 300) * (i.qty ?? 1), 0)
  const volumetric = items.reduce((s, i) => {
    const d = i.product?.dimensions
    if (!d) return s + (i.product?.weightG ?? 300) * 0.6 * (i.qty ?? 1)
    return s + ((d.l * d.w * d.h) / divisor) * 1000 * (i.qty ?? 1)
  }, 0)
  return { actual, volumetric: Math.round(volumetric), chargeable: Math.max(actual, Math.round(volumetric)) }
}

/** Quote every courier, then pick one using the chosen strategy. */
export function rateShop(cart, address, config = {}) {
  const {
    couriers = DEFAULT_COURIERS,
    zones = DEFAULT_ZONES,
    origin = { city: 'Gurugram', state: 'Haryana' },
    strategy = RATE_STRATEGY.BALANCED,
    isCod = false,
    freeShippingAbove = 999,
    markup = 0,
    handlingFee = 0,
  } = config

  const zone = resolveZone(address, zones, origin)
  const weights = chargeableWeight(cart.items || [])
  const kg = Math.max(0.5, weights.chargeable / 1000)
  const subtotal = (cart.items || []).reduce((s, i) => s + (i.price ?? i.product?.price ?? 0) * (i.qty ?? 1), 0)

  const zoneMultiplier = { local: 0.7, zonal: 0.9, metro: 1, national: 1.2, remote: 1.8 }[zone?.id] ?? 1

  const quotes = couriers
    .filter(c => weights.chargeable <= c.maxWeight)
    .filter(c => !isCod || c.codSupported)
    .map(c => {
      const base = c.baseRate * zoneMultiplier
      const weightCost = Math.max(0, kg - 0.5) * c.perKg * zoneMultiplier
      const codCharge = isCod ? Math.max(c.codFee, subtotal * (c.codPct / 100)) : 0
      const raw = base + weightCost + codCharge + handlingFee
      const cost = Math.round(raw * (1 + markup / 100))
      const days = Math.round((zone?.baseDays ?? 4) * (c.sla / 3.5))
      return {
        courier: c.id,
        name: c.name,
        cost,
        breakdown: {
          base: Math.round(base),
          weight: Math.round(weightCost),
          cod: Math.round(codCharge),
          handling: handlingFee,
        },
        days: Math.max(1, days),
        eta: etaFrom(Date.now(), Math.max(1, days)),
        rating: c.rating,
        score: 0,
      }
    })

  if (!quotes.length) {
    return { serviceable: false, reason: isCod ? 'No courier supports COD for this weight' : 'Parcel exceeds all courier weight limits', quotes: [], zone, weights }
  }

  // normalised scoring
  const maxCost = Math.max(...quotes.map(q => q.cost)) || 1
  const maxDays = Math.max(...quotes.map(q => q.days)) || 1
  for (const q of quotes) {
    const costScore = 1 - q.cost / maxCost
    const speedScore = 1 - q.days / maxDays
    const ratingScore = q.rating / 5
    q.score = Math.round((costScore * 0.4 + speedScore * 0.35 + ratingScore * 0.25) * 100)
  }

  const sorted = {
    [RATE_STRATEGY.CHEAPEST]: [...quotes].sort((a, b) => a.cost - b.cost),
    [RATE_STRATEGY.FASTEST]: [...quotes].sort((a, b) => a.days - b.days || a.cost - b.cost),
    [RATE_STRATEGY.BEST_RATED]: [...quotes].sort((a, b) => b.rating - a.rating),
    [RATE_STRATEGY.BALANCED]: [...quotes].sort((a, b) => b.score - a.score),
  }[strategy] || quotes

  const chosen = sorted[0]
  const qualifiesFree = freeShippingAbove > 0 && subtotal >= freeShippingAbove

  return {
    serviceable: true,
    zone,
    weights,
    quotes: sorted,
    recommended: chosen,
    strategy,
    charged: qualifiesFree ? 0 : chosen.cost,
    freeShipping: qualifiesFree,
    freeShippingGap: qualifiesFree ? 0 : Math.max(0, freeShippingAbove - subtotal),
    eta: chosen.eta,
    days: chosen.days,
  }
}

/** Pincode serviceability with COD and express flags. */
export function checkServiceability(pincode, config = {}) {
  const pin = String(pincode || '').trim()
  if (!/^[1-9][0-9]{5}$/.test(pin)) {
    return { ok: false, reason: 'Enter a valid 6-digit pincode' }
  }

  const { blockedPrefixes = [], codBlockedPrefixes = [], expressPrefixes = ['11', '40', '56', '60', '70', '50'] } = config
  const p2 = pin.slice(0, 2)
  const p3 = pin.slice(0, 3)

  if (blockedPrefixes.some(b => pin.startsWith(b))) {
    return { ok: false, pincode: pin, reason: 'We do not deliver to this pincode yet' }
  }

  // deterministic pseudo-data so the demo behaves consistently
  const h = hash(pin)
  const remote = ['79', '78', '73', '74', '19'].includes(p2)
  const days = remote ? 6 + (h % 3) : expressPrefixes.includes(p2) ? 1 + (h % 2) : 3 + (h % 3)
  const codOk = !codBlockedPrefixes.some(b => pin.startsWith(b)) && h % 11 !== 0

  return {
    ok: true,
    pincode: pin,
    city: null,
    days,
    eta: etaFrom(Date.now(), days),
    cod: codOk,
    express: expressPrefixes.includes(p2) && !remote,
    sameDay: expressPrefixes.includes(p2) && h % 7 === 0,
    returnPickup: !remote,
    zone: remote ? 'Remote' : expressPrefixes.includes(p2) ? 'Metro' : 'National',
  }
}

/** Estimated delivery date range, skipping Sundays. */
export function etaFrom(from, days) {
  const min = addBusinessDays(new Date(from), days)
  const max = addBusinessDays(new Date(from), days + 2)
  return {
    min: min.getTime(),
    max: max.getTime(),
    label: sameDay(min, max)
      ? fmt(min)
      : `${fmt(min)} – ${fmt(max)}`,
  }
}

function addBusinessDays(date, days) {
  const d = new Date(date)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0) added++
  }
  return d
}

const sameDay = (a, b) => a.toDateString() === b.toDateString()
const fmt = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) }

/** COD availability given the store's rules. */
export function codAvailable(cart, address, settings = {}) {
  const {
    codEnabled = true,
    codMaxValue = 15000,
    codMinValue = 0,
    codDisabledStates = [],
    codDisabledCategories = [],
  } = settings

  const subtotal = (cart.items || []).reduce((s, i) => s + (i.price ?? 0) * (i.qty ?? 1), 0)

  if (!codEnabled) return { available: false, reason: 'Cash on delivery is currently unavailable' }
  if (subtotal > codMaxValue) return { available: false, reason: `COD is not available above ₹${codMaxValue.toLocaleString('en-IN')}` }
  if (subtotal < codMinValue) return { available: false, reason: `COD needs a minimum order of ₹${codMinValue}` }
  if (codDisabledStates.includes(address?.state)) return { available: false, reason: `COD is unavailable in ${address.state}` }

  const blocked = (cart.items || []).find(i => codDisabledCategories.includes(i.product?.category))
  if (blocked) return { available: false, reason: `${blocked.product.category} items are prepaid only` }

  const ineligible = (cart.items || []).find(i => i.product?.codEligible === false)
  if (ineligible) return { available: false, reason: `"${ineligible.product.name}" is prepaid only` }

  return { available: true, fee: settings.codFee ?? 49 }
}

export default { rateShop, resolveZone, checkServiceability, codAvailable, chargeableWeight, etaFrom, DEFAULT_COURIERS, DEFAULT_ZONES, RATE_STRATEGY }
