/**
 * Tamper detection for client-side state.
 *
 * Read this before trusting it with anything.
 *
 * WHAT THIS IS NOT: security. A browser application cannot defend itself
 * against the person operating the browser. Everything here runs on the
 * attacker's machine, in code they can read, pause, and rewrite. Anyone
 * willing to open devtools can neutralise every check in this file. There is
 * no arrangement of client-side JavaScript that changes that — it is a
 * property of where the code runs, not of how cleverly it is written.
 *
 * WHAT THIS IS: an integrity layer that makes tampering loud, attributable,
 * and non-silent. It catches:
 *
 *   - Casual editing of localStorage (by far the most common attempt: change
 *     a cart total, grant yourself the owner role, add loyalty points).
 *   - Corruption from a half-written state, a crashed tab, or a version skew
 *     between builds.
 *   - Prices that disagree with the catalogue at the moment of checkout.
 *
 * The real defence is the LAST one, generalised: nothing the client says
 * about money is trusted. Every price, discount, and total is recomputed from
 * source data rather than read from whatever the client stored. When the
 * operator connects Supabase, Firebase, or a Cloudflare Worker, those same
 * recomputations move server-side and become genuinely authoritative. This
 * module is the shape that migration slots into — the call sites do not
 * change, only where the verification runs.
 */

/**
 * FNV-1a, a small non-cryptographic hash.
 *
 * Deliberately not SHA-256 via SubtleCrypto: that API is async, which would
 * make every state write asynchronous, and it would buy nothing. A signature
 * whose key sits in the same bundle as the verifier is not a secret from
 * anyone who can read the bundle. The purpose is detecting edits, not
 * resisting a forger, and for that a fast synchronous hash is the right tool.
 */
export function hash(input) {
  const str = typeof input === 'string' ? input : JSON.stringify(input)
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

/**
 * Per-install salt. Stops a signature copied from one browser being replayed
 * into another, and stops someone precomputing a table of valid signatures
 * for common cart values. Not a secret — just an inconvenience multiplier.
 */
const SALT_KEY = 'bharatcart:sec:salt'

function salt() {
  try {
    let s = localStorage.getItem(SALT_KEY)
    if (!s) {
      s = Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem(SALT_KEY, s)
    }
    return s
  } catch {
    return 'volatile'
  }
}

export function sign(value) { return hash(salt() + '|' + JSON.stringify(value)) }

export function verify(value, signature) {
  if (!signature) return false
  return sign(value) === signature
}

/** Wrap a value with its signature for storage. */
export function seal(value) {
  return { v: value, sig: sign(value), at: Date.now() }
}

/**
 * Unwrap and check. Returns the value only if the signature still matches,
 * otherwise reports the tamper so the caller can fall back to a clean state.
 */
export function unseal(sealed, { onTamper } = {}) {
  if (!sealed || typeof sealed !== 'object' || !('v' in sealed)) {
    return { ok: false, value: null, reason: 'unsealed' }
  }
  if (!verify(sealed.v, sealed.sig)) {
    onTamper?.(sealed)
    return { ok: false, value: null, reason: 'signature_mismatch' }
  }
  return { ok: true, value: sealed.v, reason: null }
}

/* ============================================================
   Money integrity — the check that actually matters
============================================================ */

/**
 * Recompute a cart from the catalogue and compare against what the client
 * claims. A client-side price edit shows up here as a mismatch.
 *
 * `resolve(line)` must return the authoritative unit price for a line, read
 * from the catalogue rather than from the line itself. That indirection is
 * the whole point: the line is the untrusted input.
 */
export function verifyCartPricing(lines, resolve, { tolerance = 0.5 } = {}) {
  const issues = []
  let claimed = 0
  let actual = 0

  for (const line of lines || []) {
    const qty = Number(line.qty) || 0
    const claimedUnit = Number(line.price) || 0
    const actualUnit = Number(resolve(line)) || 0

    claimed += claimedUnit * qty
    actual += actualUnit * qty

    if (Math.abs(claimedUnit - actualUnit) > tolerance) {
      issues.push({
        productId: line.productId ?? line.id,
        claimed: claimedUnit,
        actual: actualUnit,
        delta: +(claimedUnit - actualUnit).toFixed(2),
      })
    }
    // Quantities are a favourite too: negatives create a credit.
    if (qty < 0 || !Number.isFinite(qty) || qty !== Math.floor(qty)) {
      issues.push({ productId: line.productId ?? line.id, invalidQty: line.qty })
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    claimedTotal: +claimed.toFixed(2),
    actualTotal: +actual.toFixed(2),
    // Always hand back the recomputed figure. Callers should charge THIS,
    // never the number that arrived from the client.
    trustedTotal: +actual.toFixed(2),
  }
}

/**
 * Sanity bounds on a final payable amount, as a last net before a gateway
 * call. Catches negative totals, absurd values, and discounts that exceed the
 * order value — the usual results of a successful tamper.
 */
export function verifyPayableAmount(amount, { subtotal, maxDiscountPct = 95 } = {}) {
  const a = Number(amount)
  if (!Number.isFinite(a)) return { ok: false, reason: 'not_a_number' }
  if (a < 0) return { ok: false, reason: 'negative_amount' }
  if (a > 100_00_00_000) return { ok: false, reason: 'implausibly_large' }

  if (Number.isFinite(subtotal) && subtotal > 0) {
    const discountPct = ((subtotal - a) / subtotal) * 100
    if (discountPct > maxDiscountPct) {
      return { ok: false, reason: 'discount_exceeds_limit', discountPct: +discountPct.toFixed(1) }
    }
  }
  return { ok: true, reason: null }
}

/* ============================================================
   Privilege integrity
============================================================ */

/**
 * Role escalation check. Someone editing localStorage to set role "owner" is
 * the single most likely admin-panel attack, because it is the easiest.
 *
 * With the local backend there is genuinely nothing to verify against — the
 * stored role IS the only record, so the best available answer is to flag the
 * change and log it. With a real backend the role comes from a server-issued
 * token and this becomes a real check.
 */
export function verifyRoleClaim(user, { backendId, session } = {}) {
  if (!user) return { ok: true, trusted: false, reason: 'no_user' }

  const privileged = ['owner', 'admin', 'manager', 'staff']
  const claimsPrivilege = privileged.includes(String(user.role || '').toLowerCase())

  if (!claimsPrivilege) return { ok: true, trusted: true, reason: null }

  // A privileged role backed by a real, server-issued session is credible.
  if (backendId && backendId !== 'local' && session?.access_token) {
    return { ok: true, trusted: true, reason: 'server_session' }
  }

  return {
    ok: true,
    trusted: false,
    reason: 'unverifiable_locally',
    warning: 'This admin session is not verified by a server. Connect a backend '
      + 'to enforce roles for real — in demo mode any browser can claim any role.',
  }
}

/* ============================================================
   Tamper log
============================================================ */

const LOG_KEY = 'bharatcart:sec:log'
const MAX_LOG = 50

/**
 * Record an incident. Kept deliberately small and append-only-ish; an
 * attacker can clear it, which is itself somewhat informative to an operator
 * who notices an empty log on an account with odd orders.
 */
export function logTamper(kind, detail = {}) {
  const entry = { kind, detail, at: new Date().toISOString() }
  try {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]')
    log.unshift(entry)
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, MAX_LOG)))
  } catch { /* storage unavailable; the console line below still lands */ }
  console.warn('[security] tamper detected:', kind, detail)
  return entry
}

export function readTamperLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]') } catch { return [] }
}

export function clearTamperLog() {
  try { localStorage.removeItem(LOG_KEY) } catch { /* nothing to clear */ }
}

/**
 * A single honest summary the UI can render, so the operator is never misled
 * about how protected they actually are.
 */
export function securityPosture(backendId) {
  const real = backendId && backendId !== 'local'
  return {
    backendId: backendId || 'local',
    enforced: !!real,
    level: real ? 'server-enforced' : 'demo',
    headline: real
      ? 'Prices, roles and orders are validated by your backend.'
      : 'Demo mode: all data lives in this browser and can be edited by anyone using it.',
    detail: real
      ? 'Client-side checks still run as a first line, but the backend has the final say on every amount and permission.'
      : 'Client-side checks detect and log tampering, but they cannot prevent it. '
        + 'Connect Supabase, Firebase or a Cloudflare Worker in Settings → Backend to enforce these rules for real.',
  }
}

export default {
  hash, sign, verify, seal, unseal,
  verifyCartPricing, verifyPayableAmount, verifyRoleClaim,
  logTamper, readTamperLog, clearTamperLog, securityPosture,
}
