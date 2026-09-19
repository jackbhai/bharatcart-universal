/**
 * Size chart engine — static reference tables for fit-sensitive verticals
 * (innerwear, footwear, kids, apparel) plus a footwear size converter.
 *
 * Pure data + pure functions, no dependencies.
 */

/** Footwear: UK → US (men) → US (women) → EU → foot length (cm). */
const FOOTWEAR_ROWS = [
  { uk: 3,  usMen: 4,   usWomen: 5.5,  eu: 36,   cm: 22.8 },
  { uk: 4,  usMen: 5,   usWomen: 6.5,  eu: 37,   cm: 23.5 },
  { uk: 5,  usMen: 6,   usWomen: 7.5,  eu: 38.5, cm: 24.1 },
  { uk: 6,  usMen: 7,   usWomen: 8.5,  eu: 40,   cm: 25.1 },
  { uk: 7,  usMen: 8,   usWomen: 9.5,  eu: 41,   cm: 25.7 },
  { uk: 8,  usMen: 9,   usWomen: 10.5, eu: 42.5, cm: 26.7 },
  { uk: 9,  usMen: 10,  usWomen: 11.5, eu: 44,   cm: 27.3 },
  { uk: 10, usMen: 11,  usWomen: 12.5, eu: 45,   cm: 28.0 },
  { uk: 11, usMen: 12,  usWomen: 13.5, eu: 46.5, cm: 28.8 },
  { uk: 12, usMen: 13,  usWomen: 14.5, eu: 48,   cm: 29.5 },
]

/** Innerwear: band (inches) → sister cup volumes. */
const INNERWEAR_ROWS = [
  { band: 28, a: '28A', b: '28B', c: '28C', d: '28D', dd: '28DD' },
  { band: 30, a: '30A', b: '30B', c: '30C', d: '30D', dd: '30DD' },
  { band: 32, a: '32A', b: '32B', c: '32C', d: '32D', dd: '32DD' },
  { band: 34, a: '34A', b: '34B', c: '34C', d: '34D', dd: '34DD' },
  { band: 36, a: '36A', b: '36B', c: '36C', d: '36D', dd: '36DD' },
  { band: 38, a: '38A', b: '38B', c: '38C', d: '38D', dd: '38DD' },
  { band: 40, a: '40A', b: '40B', c: '40C', d: '40D', dd: '40DD' },
  { band: 42, a: '42A', b: '42B', c: '42C', d: '42D', dd: '42DD' },
  { band: 44, a: '44A', b: '44B', c: '44C', d: '44D', dd: '44DD' },
]

/** Kids apparel by age / height. */
const KIDS_ROWS = [
  { age: '2–3 yrs', heightCm: '92–98',   chestIn: 21, waistIn: 20, size: '2-3Y' },
  { age: '3–4 yrs', heightCm: '98–104',  chestIn: 22, waistIn: 21, size: '3-4Y' },
  { age: '4–5 yrs', heightCm: '104–110', chestIn: 23, waistIn: 22, size: '4-5Y' },
  { age: '5–6 yrs', heightCm: '110–116', chestIn: 24, waistIn: 23, size: '5-6Y' },
  { age: '6–7 yrs', heightCm: '116–122', chestIn: 25, waistIn: 24, size: '6-7Y' },
  { age: '7–8 yrs', heightCm: '122–128', chestIn: 26, waistIn: 25, size: '7-8Y' },
  { age: '8–9 yrs', heightCm: '128–134', chestIn: 27, waistIn: 26, size: '8-9Y' },
  { age: '9–10 yrs', heightCm: '134–140', chestIn: 28, waistIn: 27, size: '9-10Y' },
  { age: '10–11 yrs', heightCm: '140–146', chestIn: 29, waistIn: 28, size: '10-11Y' },
  { age: '11–12 yrs', heightCm: '146–152', chestIn: 30, waistIn: 29, size: '11-12Y' },
]

/** Adult apparel (India/UK alpha sizes). */
const APPAREL_ROWS = [
  { size: 'XS', chestIn: '32–34', waistIn: '26–28', hipIn: '34–36' },
  { size: 'S',  chestIn: '34–36', waistIn: '28–30', hipIn: '36–38' },
  { size: 'M',  chestIn: '36–38', waistIn: '30–32', hipIn: '38–40' },
  { size: 'L',  chestIn: '38–40', waistIn: '32–34', hipIn: '40–42' },
  { size: 'XL', chestIn: '40–42', waistIn: '34–36', hipIn: '42–44' },
  { size: 'XXL', chestIn: '42–44', waistIn: '36–38', hipIn: '44–46' },
  { size: '3XL', chestIn: '44–46', waistIn: '38–40', hipIn: '46–48' },
]

export const SIZE_CHARTS = {
  innerwear: {
    key: 'innerwear',
    label: 'Bra size chart (India)',
    note: 'Measure underbust for band, fullest part of bust for cup.',
    columns: ['Band (in)', 'Cup A', 'Cup B', 'Cup C', 'Cup D', 'Cup DD'],
    rows: INNERWEAR_ROWS,
  },
  footwear: {
    key: 'footwear',
    label: 'Footwear size conversion',
    note: 'UK sizes are the Indian standard; measure foot length in cm for best fit.',
    columns: ['UK', 'US (men)', 'US (women)', 'EU', 'Foot length (cm)'],
    rows: FOOTWEAR_ROWS,
  },
  kids: {
    key: 'kids',
    label: 'Kids apparel size chart',
    note: 'When between sizes, size up — kids grow fast.',
    columns: ['Age', 'Height (cm)', 'Chest (in)', 'Waist (in)', 'Size'],
    rows: KIDS_ROWS,
  },
  apparel: {
    key: 'apparel',
    label: 'Adult apparel size chart (India)',
    note: 'Alpha sizes map to UK/India numeric standards.',
    columns: ['Size', 'Chest (in)', 'Waist (in)', 'Hip (in)'],
    rows: APPAREL_ROWS,
  },
}

/** Look up a chart by key ('innerwear' | 'footwear' | 'kids' | 'apparel'); null when unknown. */
export function getSizeChart(key) {
  return SIZE_CHARTS[key] ?? null
}

/** Scale aliases accepted by convertFootwearSize. */
const SCALE_KEYS = {
  UK: 'uk',
  US: 'usMen',
  US_MEN: 'usMen',
  US_WOMEN: 'usWomen',
  EU: 'eu',
  CM: 'cm',
}

function normScale(scale) {
  const key = String(scale || 'UK').toUpperCase().replace(/[^A-Z]/g, '_').replace(/_+/g, '_')
  const map = {
    UK: 'uk', US: 'usMen', US_MEN: 'usMen', US_WOMEN: 'usWomen',
    EU: 'eu', CM: 'cm',
  }
  return map[key] ?? null
}

/**
 * Convert a footwear size between scales.
 *   convertFootwearSize(8, 'UK', 'EU') → 42.5
 * Returns null when the size/scale isn't in the table.
 */
export function convertFootwearSize(size, from = 'UK', to = 'US') {
  const fromKey = normScale(from)
  const toKey = normScale(to)
  if (!fromKey || !toKey) return null
  const row = SIZE_CHARTS.footwear.rows.find(r => r[fromKey] === Number(size))
  return row ? row[toKey] : null
}

export default { SIZE_CHARTS, getSizeChart, convertFootwearSize }
