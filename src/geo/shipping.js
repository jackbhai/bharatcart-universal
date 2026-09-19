import { getCountry, COUNTRY_LIST } from './countries.js'

/**
 * International shipping zones.
 *
 * The existing shipping engine only knew Indian pincodes and a flat ₹59. Once
 * the store quotes prices in 157 currencies it has to answer "can you even send
 * this to Chile, and what does that cost" — otherwise the currency switcher is
 * decorative.
 *
 * Rates are in INR (the base) and converted at display time like every other
 * amount.
 */

export const SHIPPING_ZONES = {
  domestic: {
    id: 'domestic', label: 'India', countries: ['IN'],
    baseRate: 59, perKg: 0, freeAbove: 999, minDays: 2, maxDays: 6,
    expressRate: 149, expressMinDays: 1, expressMaxDays: 2,
  },
  saarc: {
    id: 'saarc', label: 'South Asia', countries: ['PK', 'BD', 'LK', 'NP', 'BT', 'MV', 'AF'],
    baseRate: 890, perKg: 420, freeAbove: 14999, minDays: 5, maxDays: 12,
    expressRate: 2100, expressMinDays: 3, expressMaxDays: 6,
  },
  seasia: {
    id: 'seasia', label: 'Southeast & East Asia',
    countries: ['MM', 'TH', 'VN', 'ID', 'MY', 'SG', 'PH', 'KH', 'LA', 'BN', 'CN', 'JP', 'KR', 'TW', 'HK', 'MO', 'MN'],
    baseRate: 1450, perKg: 620, freeAbove: 19999, minDays: 6, maxDays: 14,
    expressRate: 3200, expressMinDays: 3, expressMaxDays: 7,
  },
  gulf: {
    id: 'gulf', label: 'Middle East',
    countries: ['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'JO', 'IL', 'TR', 'IQ', 'LB'],
    baseRate: 1150, perKg: 540, freeAbove: 16999, minDays: 4, maxDays: 10,
    expressRate: 2600, expressMinDays: 2, expressMaxDays: 5,
  },
  europe: {
    id: 'europe', label: 'Europe',
    countries: ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'IE', 'FI', 'GR', 'GB', 'CH', 'NO', 'SE', 'DK', 'IS', 'PL', 'CZ', 'HU', 'RO', 'BG', 'RS', 'UA', 'RU', 'BY', 'GE'],
    baseRate: 1950, perKg: 780, freeAbove: 24999, minDays: 7, maxDays: 16,
    expressRate: 4200, expressMinDays: 4, expressMaxDays: 8,
  },
  americas: {
    id: 'americas', label: 'Americas',
    countries: ['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'UY', 'EC'],
    baseRate: 2400, perKg: 950, freeAbove: 29999, minDays: 8, maxDays: 18,
    expressRate: 5200, expressMinDays: 4, expressMaxDays: 9,
  },
  africa: {
    id: 'africa', label: 'Africa',
    countries: ['ZA', 'NG', 'EG', 'KE', 'GH', 'MA', 'TZ', 'UG', 'ET', 'DZ', 'TN'],
    baseRate: 2250, perKg: 1020, freeAbove: 29999, minDays: 9, maxDays: 21,
    expressRate: 4900, expressMinDays: 5, expressMaxDays: 11,
  },
  oceania: {
    id: 'oceania', label: 'Oceania',
    countries: ['AU', 'NZ', 'FJ', 'PG'],
    baseRate: 2600, perKg: 1080, freeAbove: 29999, minDays: 8, maxDays: 18,
    expressRate: 5400, expressMinDays: 5, expressMaxDays: 10,
  },
}

export const ZONE_IDS = Object.keys(SHIPPING_ZONES)

/** Which zone a country falls into, or null if the store does not ship there. */
export function zoneFor(countryKey) {
  const country = getCountry(countryKey)
  if (!country) return null
  for (const zone of Object.values(SHIPPING_ZONES)) {
    if (zone.countries.includes(country.iso2)) return zone
  }
  return null
}

export function shipsTo(countryKey) {
  return zoneFor(countryKey) !== null
}

/** Every country the store can actually reach, for the destination picker. */
export function servedCountries() {
  const served = new Set()
  for (const zone of Object.values(SHIPPING_ZONES)) for (const c of zone.countries) served.add(c)
  return COUNTRY_LIST.filter(c => served.has(c.iso2))
}

/**
 * Quote shipping for a destination.
 *
 * `weightG` is billable weight in grams. Orders above the zone's `freeAbove`
 * ship free, mirroring the domestic rule so the two behave consistently.
 */
export function quoteShipping({ country, weightG = 500, orderValueInr = 0, express = false } = {}) {
  const zone = zoneFor(country)
  if (!zone) {
    return { ok: false, reason: 'We do not ship to this country yet', zone: null }
  }

  const kg = Math.max(0.5, weightG / 1000)
  // The first half kilo is included in the base rate; only the excess is billed
  // per kilo, which is how real carriers price and avoids double-charging light
  // parcels.
  const billableKg = Math.max(0, kg - 0.5)

  const base = express ? zone.expressRate : zone.baseRate
  const weightCost = Math.round(billableKg * zone.perKg)
  let cost = base + weightCost

  const free = !express && orderValueInr >= zone.freeAbove
  if (free) cost = 0

  return {
    ok: true,
    zone: zone.id,
    zoneLabel: zone.label,
    cost,
    free,
    freeAbove: zone.freeAbove,
    shortfall: free ? 0 : Math.max(0, zone.freeAbove - orderValueInr),
    express,
    minDays: express ? zone.expressMinDays : zone.minDays,
    maxDays: express ? zone.expressMaxDays : zone.maxDays,
    billableKg: Number(kg.toFixed(2)),
    breakdown: { base, weightCost, billableKg: Number(billableKg.toFixed(2)), perKg: zone.perKg },
  }
}

/**
 * Estimated import duty the buyer may owe on arrival.
 *
 * Deliberately an estimate shown as a warning, not a charge: the store cannot
 * collect duty without a customs agreement, and silently omitting any mention
 * of it is how customers get an unexpected bill at the door.
 */
export function estimateDuty({ country, orderValueInr = 0 } = {}) {
  const c = getCountry(country)
  if (!c || c.iso2 === 'IN') return { applies: false, amount: 0 }
  const deMinimis = { US: 66000, AU: 55000, CA: 1200, GB: 13500, EU: 13500, JP: 5500 }
  const threshold = deMinimis[c.iso2] ?? 8000
  if (orderValueInr <= threshold) {
    return { applies: false, amount: 0, threshold, note: 'Below the local duty-free threshold' }
  }
  const amount = Math.round(orderValueInr * c.taxRate)
  return {
    applies: true,
    amount,
    threshold,
    rate: c.taxRate,
    taxName: c.taxName,
    note: `${c.name} may charge ${c.taxName} of about ${(c.taxRate * 100).toFixed(0)}% on arrival. Collected by the carrier, not by us.`,
  }
}

export default quoteShipping
