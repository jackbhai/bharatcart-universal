/**
 * Currency conversion and formatting.
 *
 * The whole app prices in INR. Everything a shopper or admin sees goes through
 * `formatMoney`, so switching currency is a single state change rather than 295
 * separate call-site edits.
 */
import { getCurrency, CURRENCIES } from './currencies.js'
import { getRate, ROUNDING, BASE_CURRENCY } from './rates.js'

/** Apply the currency's psychological rounding rule. */
export function roundPrice(value, code) {
  const rule = ROUNDING[code] ?? ROUNDING.default
  const v = Number(value) || 0

  if (rule.mode === 'nearest') {
    return Math.round(v / rule.to) * rule.to
  }
  if (rule.mode === 'decimal') {
    const f = 1 / rule.to
    return Math.round(v * f) / f
  }
  // charm: land on .99 just below a whole unit, but never below zero
  if (rule.mode === 'charm') {
    if (v < 1) return Math.round(v * 100) / 100
    const whole = Math.ceil(v)
    return Math.max(0, whole - 1 + rule.to)
  }
  return Math.round(v * 100) / 100
}

/**
 * Convert an INR amount into `code`.
 * `exact` skips psychological rounding — use it for tax, totals and anything
 * that has to reconcile against another number.
 */
export function convert(amountInr, code = BASE_CURRENCY, { rates = {}, exact = false } = {}) {
  const target = String(code || BASE_CURRENCY).toUpperCase()
  if (target === BASE_CURRENCY) return Number(amountInr) || 0

  const rate = getRate(target, rates)
  if (!rate) return Number(amountInr) || 0

  const converted = (Number(amountInr) || 0) * rate
  return exact ? converted : roundPrice(converted, target)
}

/** Convert back to INR — needed when a shopper types a price in their own currency. */
export function toBase(amount, code = BASE_CURRENCY, { rates = {} } = {}) {
  const target = String(code || BASE_CURRENCY).toUpperCase()
  if (target === BASE_CURRENCY) return Number(amount) || 0
  const rate = getRate(target, rates)
  if (!rate) return Number(amount) || 0
  return (Number(amount) || 0) / rate
}

/**
 * Format an amount that is ALREADY in the target currency.
 * Uses Intl where available and falls back to manual grouping, because a
 * missing locale in an older browser should degrade, not throw.
 */
export function formatAmount(amount, code = BASE_CURRENCY, opts = {}) {
  const cur = getCurrency(code)
  const { showCode = false, compact = false, decimals } = opts
  const v = Number(amount) || 0
  const dp = decimals ?? cur.decimals

  if (compact) return formatCompact(v, cur, dp)

  let body
  try {
    // `-u-nu-latn` pins Western digits. Without it hi-IN, ne-NP, bn-BD, my-MM
    // and fa-AF render native numerals, so a currency list mixes ३,९९८ with
    // 3,998 and stops being comparable at a glance.
    body = new Intl.NumberFormat(cur.locale + '-u-nu-latn', {
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    }).format(v)
  } catch {
    body = v.toFixed(dp)
  }

  const sign = body.startsWith('-') ? '-' : ''
  if (sign) body = body.slice(1)

  return `${sign}${cur.symbol}${body}${showCode ? ` ${cur.code}` : ''}`
}

/**
 * Compact notation. Indian-locale currencies use the lakh/crore scale because
 * "₹1.2 Cr" is what an Indian operator reads fluently; everything else uses
 * K/M/B.
 */
export function formatCompact(amount, currencyOrCode, decimals) {
  const cur = typeof currencyOrCode === 'string' ? getCurrency(currencyOrCode) : currencyOrCode
  const v = Number(amount) || 0
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  const s = cur.symbol

  const isIndic = ['INR', 'PKR', 'BDT', 'LKR', 'NPR'].includes(cur.code)

  if (isIndic) {
    if (abs >= 1e7) return `${sign}${s}${(abs / 1e7).toFixed(2)} Cr`
    if (abs >= 1e5) return `${sign}${s}${(abs / 1e5).toFixed(2)} L`
    if (abs >= 1e3) return `${sign}${s}${(abs / 1e3).toFixed(1)}K`
    return `${sign}${s}${Math.round(abs)}`
  }

  if (abs >= 1e9) return `${sign}${s}${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}${s}${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}${s}${(abs / 1e3).toFixed(1)}K`
  return `${sign}${s}${abs.toFixed(decimals ?? 0)}`
}

/**
 * The main entry point: takes an INR amount, converts, then formats.
 * This is what `inr()` now delegates to.
 */
export function formatMoney(amountInr, code = BASE_CURRENCY, opts = {}) {
  const converted = convert(amountInr, code, { rates: opts.rates, exact: opts.exact })
  return formatAmount(converted, code, opts)
}

/** Format a plain number in a locale (no currency symbol). */
export function formatNumber(n, locale = 'en-IN', opts = {}) {
  try {
    return new Intl.NumberFormat(locale, opts).format(Number(n) || 0)
  } catch {
    return String(Math.round(Number(n) || 0))
  }
}

/** Locale-aware date, so a Russian admin does not read US month/day order. */
export function formatDate(ts, locale = 'en-IN', opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  try {
    return new Intl.DateTimeFormat(locale, opts).format(new Date(ts))
  } catch {
    return new Date(ts).toDateString()
  }
}

export function formatRelative(ts, locale = 'en-IN') {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.round(diff / 60000)
  const units = [
    [Math.abs(mins) < 60, -mins, 'minute'],
    [Math.abs(mins) < 1440, -Math.round(mins / 60), 'hour'],
    [Math.abs(mins) < 43200, -Math.round(mins / 1440), 'day'],
    [true, -Math.round(mins / 43200), 'month'],
  ]
  const [, value, unit] = units.find(([cond]) => cond)
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit)
  } catch {
    return `${Math.abs(value)} ${unit}${Math.abs(value) === 1 ? '' : 's'} ago`
  }
}

export { getCurrency, CURRENCIES, BASE_CURRENCY }
export default formatMoney
