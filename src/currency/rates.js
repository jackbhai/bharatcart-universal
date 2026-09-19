/**
 * Exchange rates, expressed as units of the target currency per 1 INR.
 *
 * INR is the base because every engine in the app — pricing, tax, loyalty,
 * shipping — computes in rupees. Storing rates the other way round would mean
 * a division on every single price render.
 *
 * This is a dated static snapshot, not a live feed. Swap `fetchLiveRates` for a
 * real call when you want live numbers; the shape it returns is already what
 * the store expects.
 */

export const BASE_CURRENCY = 'INR'
export const RATES_UPDATED_AT = '2026-09-01'
export const RATES_SOURCE = 'static snapshot (USD mid-market, converted to INR base)'

export const RATES = {
  INR: 1,
  PKR: 3.3365,
  BDT: 1.4352,
  LKR: 3.551,
  NPR: 1.6,
  BTN: 1,
  MVR: 0.184737,
  AFN: 0.825446,
  MMK: 25.1587,
  THB: 0.409728,
  VND: 304.0613,
  IDR: 194.6807,
  MYR: 0.052953,
  SGD: 0.015694,
  PHP: 0.696058,
  KHR: 48.8798,
  LAK: 262.3697,
  BND: 0.015694,
  TLS: 0.01198,
  CNY: 0.0853,
  JPY: 1.7815,
  KRW: 16.1136,
  KPW: 10.7823,
  TWD: 0.382173,
  HKD: 0.093327,
  MOP: 0.096082,
  MNT: 40.7332,
  KZT: 5.7266,
  UZS: 152.1505,
  KGS: 1.0207,
  TJS: 0.127591,
  TMT: 0.041931,
  AED: 0.043998,
  SAR: 0.044926,
  QAR: 0.043608,
  KWD: 0.00367198,
  BHD: 0.00450461,
  OMR: 0.00460645,
  JOD: 0.00849407,
  ILS: 0.044567,
  LBP: 1072.24,
  SYP: 155.7446,
  IQD: 15.6943,
  IRR: 503.1748,
  YER: 2.9951,
  TRY: 0.409129,
  EUR: 0.01104,
  GBP: 0.00927878,
  CHF: 0.010327,
  NOK: 0.128429,
  SEK: 0.125554,
  DKK: 0.082305,
  ISK: 1.6473,
  PLN: 0.047203,
  CZK: 0.277345,
  HUF: 4.3848,
  RON: 0.05493,
  BGN: 0.021595,
  RSD: 1.2927,
  MKD: 0.679286,
  ALL: 1.0722,
  BAM: 0.021595,
  MDL: 0.212052,
  UAH: 0.494789,
  BYN: 0.039176,
  RUB: 1.0734,
  GEL: 0.032467,
  AMD: 4.6364,
  AZN: 0.020367,
  GIP: 0.00927878,
  USD: 0.01198,
  CAD: 0.016233,
  MXN: 0.235414,
  BRL: 0.064934,
  ARS: 11.561,
  CLP: 11.2016,
  COP: 50.0779,
  PEN: 0.044926,
  UYU: 0.485204,
  PYG: 92.2487,
  BOB: 0.082784,
  VES: 0.479214,
  GYD: 2.5039,
  SRD: 0.34144,
  CRC: 6.2298,
  GTQ: 0.092488,
  HNL: 0.297712,
  NIO: 0.440877,
  PAB: 0.01198,
  DOP: 0.721217,
  CUP: 0.287528,
  HTG: 1.5754,
  JMD: 1.8809,
  TTD: 0.081227,
  BBD: 0.023961,
  BSD: 0.01198,
  BZD: 0.024081,
  XCD: 0.032347,
  KYD: 0.00997963,
  BMD: 0.01198,
  AWG: 0.021445,
  ANG: 0.021445,
  XPF: 1.3178,
  AUD: 0.017791,
  NZD: 0.019468,
  FJD: 0.026836,
  PGK: 0.046963,
  SBD: 0.101234,
  VUV: 1.4257,
  WST: 0.032826,
  TOP: 0.028274,
  ZAR: 0.211453,
  NGN: 18.929,
  EGP: 0.582245,
  KES: 1.5455,
  GHS: 0.188691,
  MAD: 0.117168,
  TZS: 32.5866,
  UGX: 44.3273,
  ETB: 1.4137,
  DZD: 1.5994,
  TND: 0.037019,
  LYD: 0.057865,
  SDG: 7.2002,
  SSP: 33.545,
  ZMW: 0.316281,
  ZWG: 0.161735,
  MWK: 20.7859,
  MZN: 0.765545,
  AOA: 10.962,
  BWP: 0.159938,
  NAD: 0.211453,
  LSL: 0.211453,
  SZL: 0.211453,
  MUR: 0.553492,
  SCR: 0.162933,
  MGA: 54.6304,
  KMF: 5.4271,
  DJF: 2.1289,
  SOS: 6.8408,
  ERN: 0.179705,
  RWF: 16.1136,
  BIF: 34.9227,
  CDF: 34.144,
  XAF: 7.2421,
  XOF: 7.2421,
  GNF: 103.3904,
  GMD: 0.844615,
  SLE: 0.270756,
  LRD: 2.3122,
  CVE: 1.2172,
  STN: 0.270756,
  MRU: 0.476818,
  SHP: 0.00927878,
  XAU: 0.00000461,
  XAG: 0.00038697,
  XDR: 0.00888942,
}

/**
 * Psychological rounding per currency.
 *
 *  - charm  : land on x.99 (most retail markets)
 *  - nearest: round to the nearest N whole units (currencies where the smallest
 *             practical note is large, so x.99 would be meaningless)
 *  - decimal: plain rounding to the given precision (Gulf 3-decimal currencies,
 *             where charm pricing is not a local convention)
 */
export const ROUNDING = {
  default: { mode: 'charm', to: 0.99 },

  JPY: { mode: 'nearest', to: 10 },
  KRW: { mode: 'nearest', to: 100 },
  VND: { mode: 'nearest', to: 1000 },
  IDR: { mode: 'nearest', to: 1000 },
  CLP: { mode: 'nearest', to: 10 },
  ISK: { mode: 'nearest', to: 10 },
  HUF: { mode: 'nearest', to: 10 },
  PYG: { mode: 'nearest', to: 1000 },
  UGX: { mode: 'nearest', to: 100 },
  RWF: { mode: 'nearest', to: 100 },
  BIF: { mode: 'nearest', to: 100 },
  GNF: { mode: 'nearest', to: 500 },
  LAK: { mode: 'nearest', to: 1000 },
  MMK: { mode: 'nearest', to: 100 },
  KHR: { mode: 'nearest', to: 100 },
  UZS: { mode: 'nearest', to: 500 },
  IRR: { mode: 'nearest', to: 1000 },
  LBP: { mode: 'nearest', to: 1000 },
  SYP: { mode: 'nearest', to: 500 },
  COP: { mode: 'nearest', to: 100 },
  CRC: { mode: 'nearest', to: 100 },
  MGA: { mode: 'nearest', to: 100 },
  SOS: { mode: 'nearest', to: 100 },
  STN: { mode: 'nearest', to: 10 },
  VUV: { mode: 'nearest', to: 10 },
  XPF: { mode: 'nearest', to: 10 },
  KMF: { mode: 'nearest', to: 50 },
  DJF: { mode: 'nearest', to: 10 },
  XAF: { mode: 'nearest', to: 50 },
  XOF: { mode: 'nearest', to: 50 },
  MNT: { mode: 'nearest', to: 100 },
  KPW: { mode: 'nearest', to: 10 },
  ARS: { mode: 'nearest', to: 10 },
  AOA: { mode: 'nearest', to: 10 },
  MWK: { mode: 'nearest', to: 10 },
  SDG: { mode: 'nearest', to: 10 },
  SSP: { mode: 'nearest', to: 100 },
  CDF: { mode: 'nearest', to: 100 },
  ZMW: { mode: 'nearest', to: 1 },
  VES: { mode: 'nearest', to: 1 },
  TZS: { mode: 'nearest', to: 100 },
  KZT: { mode: 'nearest', to: 10 },
  NGN: { mode: 'nearest', to: 10 },
  ETB: { mode: 'nearest', to: 1 },
  LRD: { mode: 'nearest', to: 10 },
  AMD: { mode: 'nearest', to: 10 },
  KWD: { mode: 'decimal', to: 0.001 },
  BHD: { mode: 'decimal', to: 0.001 },
  OMR: { mode: 'decimal', to: 0.001 },
  JOD: { mode: 'decimal', to: 0.001 },
  IQD: { mode: 'decimal', to: 0.001 },
  TND: { mode: 'decimal', to: 0.001 },
  LYD: { mode: 'decimal', to: 0.001 },
}

/**
 * Rate for `code`, with an optional manual override map.
 * Returns null for an unknown code rather than 1, so callers fall back to
 * identity instead of silently pricing at a bogus 1:1.
 */
export function getRate(code, overrides = {}) {
  const c = String(code || '').toUpperCase()
  const override = overrides[c]
  if (typeof override === 'number' && override > 0) return override
  return RATES[c] ?? null
}

/** Rate between any two currencies, routed through the INR base. */
export function crossRate(from, to, overrides = {}) {
  const a = getRate(from, overrides)
  const b = getRate(to, overrides)
  if (!a || !b) return null
  return b / a
}

/**
 * Swap to a live feed by replacing the body of this function. All of these are
 * free at low volume and need no key: exchangerate.host, frankfurter.app,
 * open.er-api.com. Cache the response — rates move slowly, quotas do not.
 */
export async function fetchLiveRates() {
  return {
    ok: false,
    rates: RATES,
    updatedAt: RATES_UPDATED_AT,
    note: 'Using the bundled snapshot. Point fetchLiveRates() at exchangerate.host, frankfurter.app or open.er-api.com for live numbers.',
  }
}

export default RATES
