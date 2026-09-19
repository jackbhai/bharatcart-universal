/**
 * Fine-jewellery (gold) pricing engine.
 *
 * Prices hallmarked gold jewellery from the live(ish) per-gram rate:
 *   metal value + wastage + making charges + stone value, then 3% GST
 * (the standard Indian fine-jewellery GST norm).
 *
 * Pure and dependency-free. `now` is injectable for determinism.
 */

/**
 * DEMO seed rates per gram in INR.
 *
 * These are DEMO seed rates only — the admin is expected to override them
 * via `cfg.rates` (fetched from a live gold-rate feed) before going live.
 * Never treat them as market prices.
 */
export const DEMO_GOLD_RATES = {
  '24K': 8250,
  '22K': 7250,
  '18K': 5950,
  '14K': 4650,
}

/** Fine-jewellery GST percent (Indian norm). */
export const FINE_JEWELLERY_GST_PCT = 3

/* ------------------------------------------------- live rate source */

/**
 * Live gold-rate feed with graceful fallback.
 *
 * The DEMO table above is only ever a fallback. In production the operator
 * points `VITE_GOLD_RATE_URL` at a rates endpoint that returns JSON shaped
 * like `{ rates: { '24K': 8420, '22K': 7718, ... } }` (a `{ data: { rates } }`
 * wrapper is tolerated too). Rates are cached in memory for `ttlMs`
 * (default 15 minutes, `VITE_GOLD_RATE_TTL_MS`) and refreshed on demand.
 *
 * When the feed is unreachable or unconfigured, pricing falls back to the
 * DEMO table and `getRateStatus()` reports `{ stale: true }` so the PDP can
 * say "indicative rate" instead of pretending the price is live.
 */

const DEFAULT_RATE_TTL_MS = 15 * 60 * 1000

let rateSource = {
  url: null,
  ttlMs: DEFAULT_RATE_TTL_MS,
  rates: null,       // last good live rates, or null
  fetchedAt: null,   // ISO timestamp of the last good fetch
  lastError: null,
}

function envRateConfig() {
  const e = (typeof import.meta !== 'undefined' && import.meta.env) || {}
  const url = String(e.VITE_GOLD_RATE_URL || '').trim()
  const ttl = Number(e.VITE_GOLD_RATE_TTL_MS)
  return { url: url || null, ttlMs: Number.isFinite(ttl) && ttl > 0 ? ttl : DEFAULT_RATE_TTL_MS }
}

/**
 * Point the engine at a live rates endpoint. `fetcher` defaults to
 * `window.fetch` and is injectable for tests. Pass `{ url: null }` to go
 * back to DEMO-only pricing.
 */
export function setRateSource({ url, ttlMs, fetcher } = {}) {
  const envCfg = envRateConfig()
  rateSource = {
    url: url !== undefined ? url : (rateSource.url ?? envCfg.url),
    ttlMs: ttlMs ?? rateSource.ttlMs ?? envCfg.ttlMs,
    rates: rateSource.rates,
    fetchedAt: rateSource.fetchedAt,
    lastError: rateSource.lastError,
    fetcher,
  }
  return getRateStatus()
}

/** Where the current rates came from and whether they are fresh. */
export function getRateStatus() {
  const fresh = rateSource.rates != null
    && rateSource.fetchedAt != null
    && (Date.now() - new Date(rateSource.fetchedAt).getTime()) < rateSource.ttlMs
  return {
    source: fresh ? 'live' : (rateSource.rates ? 'live-cached' : 'demo'),
    stale: !fresh,
    fetchedAt: rateSource.fetchedAt,
    lastError: rateSource.lastError,
  }
}

/** Live rates if a fresh fetch exists, else null (sync, never throws). */
export function getActiveRates() {
  return getRateStatus().stale ? null : rateSource.rates
}

/** Forget cached live rates (e.g. on sign-out or in tests). */
export function clearRateCache() {
  rateSource.rates = null
  rateSource.fetchedAt = null
  rateSource.lastError = null
}

/**
 * Fetch live rates now. Never throws: returns `{ ok, rates?, error? }` and
 * keeps serving the previous cache (marked stale) on failure. Safe to call
 * fire-and-forget at app boot.
 */
export async function refreshLiveRates(fetcher) {
  const envCfg = envRateConfig()
  const url = rateSource.url ?? envCfg.url
  const ttlMs = rateSource.ttlMs ?? envCfg.ttlMs
  const run = fetcher || rateSource.fetcher
    || (typeof fetch !== 'undefined' ? fetch : null)
  if (!url) return { ok: false, error: 'No gold-rate URL configured (VITE_GOLD_RATE_URL)' }
  if (!run) return { ok: false, error: 'No fetch implementation available' }
  let res
  try {
    res = await run(url, { headers: { Accept: 'application/json' } })
  } catch (e) {
    rateSource.lastError = String(e?.message || e)
    return { ok: false, error: 'Gold-rate feed unreachable — using indicative rates' }
  }
  let body = null
  try { body = await res.json() } catch {
    rateSource.lastError = 'Gold-rate feed returned invalid JSON'
    return { ok: false, error: 'Gold-rate feed returned invalid data — using indicative rates' }
  }
  const rates = body?.rates ?? body?.data?.rates ?? null
  if (!res.ok || !rates || typeof rates !== 'object') {
    rateSource.lastError = `Gold-rate feed responded ${res.status}`
    return { ok: false, error: 'Gold-rate feed returned invalid data — using indicative rates' }
  }
  // Keep only recognised purities with sane numeric values.
  const clean = {}
  for (const k of Object.keys(DEMO_GOLD_RATES)) {
    const v = Number(rates[k])
    if (Number.isFinite(v) && v > 0) clean[k] = v
  }
  if (!Object.keys(clean).length) {
    rateSource.lastError = 'Gold-rate feed had no usable purities'
    return { ok: false, error: 'Gold-rate feed returned invalid data — using indicative rates' }
  }
  rateSource = { url, ttlMs, rates: clean, fetchedAt: new Date().toISOString(), lastError: null, fetcher: rateSource.fetcher }
  return { ok: true, rates: clean }
}

/* ------------------------------------------------------- rate lookup */

/**
 * Per-gram rate for a purity. Precedence: `cfg.rates` (admin override) →
 * fresh live feed → DEMO seed rates. Throws on unknown purity — pricing must
 * never silently fall back to the wrong rate.
 */
export function goldRateFor(purity, cfg = {}) {
  const live = getActiveRates()
  const rate = cfg.rates?.[purity] ?? live?.[purity] ?? DEMO_GOLD_RATES[purity]
  if (rate == null) {
    throw new Error(
      `Unknown gold purity "${purity}" — expected one of ${Object.keys(DEMO_GOLD_RATES).join(', ')} or a cfg.rates override`
    )
  }
  return rate
}

const r2 = (n) => Math.round(n * 100) / 100

/**
 * Price a fine-jewellery line from its gold content.
 *
 * @param {object} p
 * @param {string} p.purity      '24K' | '22K' | '18K' | '14K' (+ cfg.rates overrides)
 * @param {number} p.weightG     gold weight in grams
 * @param {number} [p.makingPct=12]  making charges as % of metal value
 * @param {number} [p.stoneValue=0]  flat stone/diamond value in INR
 * @param {number} [p.wastagePct=2]  wastage as % of metal value
 * @param {object} [cfg]         { rates } to override DEMO_GOLD_RATES
 * @returns {{ total, breakdown:{ metalValue, wastage, making, stone, subtotal, gst }, ratePerGram }}
 */
export function fineJewelleryPrice(
  { purity, weightG, makingPct = 12, stoneValue = 0, wastagePct = 2 } = {},
  cfg = {}
) {
  const ratePerGram = goldRateFor(purity, cfg)
  const weight = Number(weightG) || 0

  const metalValue = ratePerGram * weight
  const wastage = metalValue * (wastagePct / 100)
  const making = metalValue * (makingPct / 100)
  const stone = Number(stoneValue) || 0

  const subtotal = metalValue + wastage + making + stone
  const gst = subtotal * (FINE_JEWELLERY_GST_PCT / 100)
  const total = subtotal + gst

  return {
    total: r2(total),
    breakdown: {
      metalValue: r2(metalValue),
      wastage: r2(wastage),
      making: r2(making),
      stone: r2(stone),
      subtotal: r2(subtotal),
      gst: r2(gst),
    },
    ratePerGram,
  }
}

/**
 * Freeze the rate used on an order line so later rate moves don't rewrite
 * history. `now` is injectable for determinism. `source` records where the
 * rate came from: 'override' (admin cfg.rates), 'live' (rates feed), or
 * 'demo' (bundled table) — the checkout audit trail depends on it.
 */
export function snapshotRate(purity, cfg = {}, now = Date.now()) {
  const source = cfg.rates?.[purity] != null ? 'override'
    : getActiveRates()?.[purity] != null ? 'live'
    : 'demo'
  return {
    purity,
    ratePerGram: goldRateFor(purity, cfg),
    at: new Date(now).toISOString(),
    source,
  }
}

export default {
  DEMO_GOLD_RATES, FINE_JEWELLERY_GST_PCT, goldRateFor, fineJewelleryPrice,
  snapshotRate, setRateSource, getRateStatus, getActiveRates, clearRateCache,
  refreshLiveRates,
}
