/**
 * GST engine — India-correct tax computation.
 *
 * Rules implemented:
 *  - Intra-state supply  -> CGST + SGST (rate split in half)
 *  - Inter-state supply  -> IGST (full rate)
 *  - Union territory     -> CGST + UTGST
 *  - Prices are INCLUSIVE of GST by default (standard Indian retail practice),
 *    so tax is back-calculated: tax = price - price/(1+rate)
 *  - Composition / exempt / nil-rated / zero-rated handled
 *  - Cess supported for demerit goods
 *  - Rounding per invoice (Section 170: round to nearest rupee)
 */

export const GST_SLABS = [0, 0.25, 3, 5, 12, 18, 28]

/** Union territories use UTGST instead of SGST. */
export const UNION_TERRITORIES = new Set([
  'Delhi', 'Chandigarh', 'Puducherry', 'Ladakh', 'Jammu & Kashmir',
  'Andaman & Nicobar', 'Dadra & Nagar Haveli', 'Daman & Diu', 'Lakshadweep',
])

export const TAX_TREATMENT = {
  TAXABLE: 'taxable',
  EXEMPT: 'exempt',          // no GST, no ITC
  NIL_RATED: 'nil_rated',    // 0% rate
  ZERO_RATED: 'zero_rated',  // exports / SEZ
  NON_GST: 'non_gst',
}

/**
 * Split a GST rate into components based on place of supply.
 * @param {number} rate  total GST percent (e.g. 12)
 * @param {boolean} interState
 * @param {boolean} isUT
 */
export function splitRate(rate, interState, isUT = false) {
  if (interState) return { igst: rate, cgst: 0, sgst: 0, utgst: 0 }
  const half = rate / 2
  return isUT
    ? { igst: 0, cgst: half, sgst: 0, utgst: half }
    : { igst: 0, cgst: half, sgst: half, utgst: 0 }
}

/**
 * Compute tax for a single line.
 *
 * @param {object} p
 * @param {number} p.amount        line amount (qty * unit price), after line discount
 * @param {number} p.rate          GST percent
 * @param {boolean} p.inclusive    is `amount` GST-inclusive
 * @param {boolean} p.interState
 * @param {boolean} p.isUT
 * @param {number} p.cessRate      optional cess percent
 * @param {string} p.treatment
 */
export function taxLine({
  amount,
  rate = 0,
  inclusive = true,
  interState = false,
  isUT = false,
  cessRate = 0,
  treatment = TAX_TREATMENT.TAXABLE,
}) {
  const nonTaxable = treatment !== TAX_TREATMENT.TAXABLE || rate === 0
  const effRate = nonTaxable ? 0 : rate
  const effCess = nonTaxable ? 0 : cessRate
  const totalRate = effRate + effCess

  let taxable, tax, cess, gross

  if (inclusive) {
    taxable = totalRate > 0 ? amount / (1 + totalRate / 100) : amount
    tax = taxable * (effRate / 100)
    cess = taxable * (effCess / 100)
    gross = amount
  } else {
    taxable = amount
    tax = taxable * (effRate / 100)
    cess = taxable * (effCess / 100)
    gross = taxable + tax + cess
  }

  const parts = splitRate(effRate, interState, isUT)

  return {
    taxable: r2(taxable),
    rate: effRate,
    cgst: r2(taxable * (parts.cgst / 100)),
    sgst: r2(taxable * (parts.sgst / 100)),
    utgst: r2(taxable * (parts.utgst / 100)),
    igst: r2(taxable * (parts.igst / 100)),
    cess: r2(cess),
    tax: r2(tax + cess),
    gross: r2(gross),
    treatment,
    interState,
  }
}

/**
 * Invoice-level tax computation with HSN-wise summary.
 *
 * @param {Array} lines  [{ amount, rate, hsn, cessRate, treatment, description }]
 * @param {object} ctx   { sellerState, buyerState, inclusive, shipping, shippingRate }
 */
export function taxInvoice(lines, ctx = {}) {
  const {
    sellerState = 'Haryana',
    buyerState = 'Haryana',
    inclusive = true,
    shipping = 0,
    shippingRate = 18,   // shipping attracts 18% by default
    roundOff = true,
  } = ctx

  const interState = normaliseState(sellerState) !== normaliseState(buyerState)
  const isUT = UNION_TERRITORIES.has(normaliseState(buyerState))

  const computed = lines.map(l => ({
    ...l,
    ...taxLine({
      amount: l.amount,
      rate: l.rate ?? 0,
      cessRate: l.cessRate ?? 0,
      treatment: l.treatment ?? TAX_TREATMENT.TAXABLE,
      inclusive, interState, isUT,
    }),
  }))

  // shipping is a taxable supply too
  let shippingTax = null
  if (shipping > 0) {
    shippingTax = taxLine({
      amount: shipping, rate: shippingRate,
      inclusive, interState, isUT,
    })
  }

  const sum = (k) =>
    computed.reduce((s, l) => s + l[k], 0) + (shippingTax ? shippingTax[k] : 0)

  const taxable = r2(sum('taxable'))
  const cgst = r2(sum('cgst'))
  const sgst = r2(sum('sgst'))
  const utgst = r2(sum('utgst'))
  const igst = r2(sum('igst'))
  const cess = r2(sum('cess'))
  const totalTax = r2(cgst + sgst + utgst + igst + cess)

  const rawTotal = taxable + totalTax
  const total = roundOff ? Math.round(rawTotal) : r2(rawTotal)

  return {
    lines: computed,
    shipping: shippingTax,
    interState,
    isUT,
    placeOfSupply: normaliseState(buyerState),
    taxable,
    cgst, sgst, utgst, igst, cess,
    totalTax,
    roundOff: r2(total - rawTotal),
    total,
    hsnSummary: hsnSummary(computed),
    rateSummary: rateSummary(computed),
  }
}

/** GSTR-1 style HSN-wise breakup. */
export function hsnSummary(lines) {
  const map = new Map()
  for (const l of lines) {
    const key = l.hsn || '—'
    if (!map.has(key)) {
      map.set(key, { hsn: key, description: l.description || '', qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, rate: l.rate })
    }
    const e = map.get(key)
    e.qty += l.qty ?? 1
    e.taxable += l.taxable
    e.cgst += l.cgst
    e.sgst += l.sgst + l.utgst
    e.igst += l.igst
    e.cess += l.cess
  }
  return [...map.values()].map(e => ({
    ...e,
    taxable: r2(e.taxable), cgst: r2(e.cgst), sgst: r2(e.sgst), igst: r2(e.igst), cess: r2(e.cess),
    total: r2(e.taxable + e.cgst + e.sgst + e.igst + e.cess),
  })).sort((a, b) => b.taxable - a.taxable)
}

/** Rate-wise summary for the invoice footer. */
export function rateSummary(lines) {
  const map = new Map()
  for (const l of lines) {
    const key = l.rate
    if (!map.has(key)) map.set(key, { rate: key, taxable: 0, tax: 0 })
    const e = map.get(key)
    e.taxable += l.taxable
    e.tax += l.tax
  }
  return [...map.values()]
    .map(e => ({ ...e, taxable: r2(e.taxable), tax: r2(e.tax) }))
    .sort((a, b) => a.rate - b.rate)
}

/* -------------------------------------------------------------- GSTIN */

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Validate a GSTIN including its check digit. */
export function validateGstin(gstin) {
  const v = String(gstin || '').toUpperCase().trim()
  if (!v) return { valid: false, reason: 'GSTIN is empty' }
  if (v.length !== 15) return { valid: false, reason: 'GSTIN must be 15 characters' }
  if (!GSTIN_RE.test(v)) return { valid: false, reason: 'GSTIN format is invalid' }

  // check digit (mod 36)
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const code = GSTIN_CHARS.indexOf(v[i])
    const factor = i % 2 === 0 ? 1 : 2
    const product = code * factor
    sum += Math.floor(product / 36) + (product % 36)
  }
  const expected = GSTIN_CHARS[(36 - (sum % 36)) % 36]
  if (expected !== v[14]) return { valid: false, reason: 'Check digit does not match' }

  return {
    valid: true,
    stateCode: v.slice(0, 2),
    pan: v.slice(2, 12),
    entityNumber: v[12],
    state: STATE_BY_CODE[v.slice(0, 2)] || 'Unknown',
  }
}

export const STATE_BY_CODE = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
  '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '36': 'Telangana', '37': 'Andhra Pradesh',
}

export const CODE_BY_STATE = Object.fromEntries(
  Object.entries(STATE_BY_CODE).map(([k, v]) => [v, k])
)

/* ------------------------------------------------------------ helpers */
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const normaliseState = (s) => String(s || '').trim()

/** Reverse: given a GST-inclusive price and rate, get the base. */
export function baseFromInclusive(amount, rate) {
  return r2(amount / (1 + (rate || 0) / 100))
}

/** Given a base and rate, get the inclusive price. */
export function inclusiveFromBase(base, rate) {
  return r2(base * (1 + (rate || 0) / 100))
}

export default { taxLine, taxInvoice, splitRate, validateGstin, hsnSummary, rateSummary }
