import { getCountry, addressFieldsFor } from './countries.js'

/**
 * Render an address the way its own country writes it.
 *
 * The storefront previously hard-coded the Indian order (street, city, state,
 * PIN). Printing a Japanese address that way is not a cosmetic problem — Japan
 * Post reads postal code first, and the wrong order genuinely delays delivery.
 */

/** Human labels per field, with the country's own terminology for the postal code. */
export function fieldLabels(countryKey) {
  const country = getCountry(countryKey)
  return {
    name: 'Full name',
    line1: 'Address line 1',
    line2: 'Address line 2',
    city: 'City',
    state: stateLabelFor(countryKey),
    postal: country?.postalLabel || 'Postal code',
  }
}

/**
 * What a country calls its first-level subdivision. "State" is wrong in most of
 * the world and looks careless on a checkout form.
 */
export function stateLabelFor(countryKey) {
  const country = getCountry(countryKey)
  if (!country) return 'State'
  const byIso = {
    US: 'State', IN: 'State', AU: 'State', BR: 'State', MX: 'State', MY: 'State',
    CA: 'Province', ZA: 'Province', CN: 'Province', ID: 'Province', TR: 'Province',
    IT: 'Province', ES: 'Province', AR: 'Province', PH: 'Province', TH: 'Province',
    JP: 'Prefecture',
    GB: 'County', IE: 'County', KE: 'County',
    DE: 'State', AT: 'State', CH: 'Canton',
    FR: 'Region', RU: 'Region', UA: 'Region', VN: 'Region', CO: 'Department',
    PE: 'Department', UY: 'Department', NG: 'State', EG: 'Governorate',
    SA: 'Region', AE: 'Emirate', MM: 'State/Region',
  }
  return byIso[country.iso2] || 'Region'
}

/** Which fields a country actually requires. */
export function requiredFields(countryKey) {
  const order = addressFieldsFor(countryKey)
  const country = getCountry(countryKey)
  return order.filter(f => {
    if (f === 'line2') return false               // always optional
    if (f === 'postal') return Boolean(country?.postalRegex)
    if (f === 'state') return ['IN', 'US', 'CA', 'AU', 'BR', 'MX', 'CN', 'JP', 'ID', 'MY', 'IT', 'AR', 'RU'].includes(country?.iso2)
    return true
  })
}

/**
 * Format an address object into display lines, in local order.
 * Returns an array so callers can join with <br> or newlines as they prefer.
 */
export function formatAddress(address = {}, countryKey) {
  const country = getCountry(countryKey)
  const order = addressFieldsFor(countryKey)
  const get = (f) => String(address[f] ?? '').trim()

  const lines = []
  let pending = []

  const flush = () => { if (pending.length) { lines.push(pending.join(', ')); pending = [] } }

  for (const field of order) {
    const value = get(field)
    if (!value) continue
    if (field === 'name' || field === 'line1' || field === 'line2') {
      flush()
      lines.push(value)
    } else {
      pending.push(value)
    }
  }
  flush()
  if (country) lines.push(country.name)
  return lines
}

/** One-line form, for order tables and compact cards. */
export function formatAddressInline(address, countryKey) {
  return formatAddress(address, countryKey).join(', ')
}

/**
 * Validate a whole address against its country's rules.
 * Returns a per-field error map so a form can highlight the offending inputs
 * rather than showing one generic "invalid address".
 */
export function validateAddress(address = {}, countryKey) {
  const errors = {}
  const required = requiredFields(countryKey)
  const labels = fieldLabels(countryKey)

  for (const field of required) {
    if (!String(address[field] ?? '').trim()) {
      errors[field] = `${labels[field]} is required`
    }
  }
  return { ok: Object.keys(errors).length === 0, errors }
}

export default formatAddress
