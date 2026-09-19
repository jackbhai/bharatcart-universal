/**
 * Payment method catalogues for Razorpay and Stripe.
 *
 * This module describes WHAT the shopper can pay with (method labels,
 * gateway fee hints). The actual charge always runs through the real
 * gateway SDKs in `src/engines/payments/paymentGateway.js` — there is no
 * simulation anywhere in this codebase. A gateway's methods are offered at
 * checkout only when that gateway is genuinely ready (enabled in admin +
 * publishable key resolves + payments backend URL is set).
 */

import {
  gatewayStatus,
  modeLabel,
} from '../engines/payments/paymentGateway.js'

export const PAYMENT_STATUS = {
  CREATED: 'created',
  AUTHORIZED: 'authorized',
  CAPTURED: 'captured',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
}

/* ------------------------------------------------------------ Razorpay */

/**
 * Methods Razorpay's checkout modal supports for Indian shoppers.
 * feePct is the indicative gateway fee — shown as info, never charged
 * to the shopper by us.
 */
export const RAZORPAY_METHODS = {
  upi:        { id: 'upi', label: 'UPI', note: 'GPay, PhonePe, Paytm, BHIM', feePct: 0 },
  card:       { id: 'card', label: 'Credit / Debit card', note: 'Visa, Mastercard, RuPay, Amex', feePct: 2 },
  netbanking: { id: 'netbanking', label: 'Net banking', note: '50+ banks', feePct: 1.9 },
  wallet:     { id: 'wallet', label: 'Wallets', note: 'Paytm, Amazon Pay, Freecharge', feePct: 2 },
  emi:        { id: 'emi', label: 'EMI', note: 'No-cost EMI on select cards', feePct: 2.5 },
  paylater:   { id: 'paylater', label: 'Pay later', note: 'Simpl, LazyPay, ICICI PayLater', feePct: 2.5 },
}

/* -------------------------------------------------------------- Stripe */

/**
 * Stripe methods this storefront can genuinely complete. Card runs on
 * Stripe Elements (`mountStripeCard`); wallet buttons (Apple Pay / Google
 * Pay) need the Payment Request API and are not wired yet, so they are
 * deliberately NOT offered.
 */
export const STRIPE_METHODS = {
  card: { id: 'card', label: 'Card', note: 'Visa, Mastercard, Amex', feePct: 2.9 },
}

/* --------------------------------------------------------- unified API */

/**
 * Honest payment entry for flows that don't need a gateway SDK.
 * Cash on delivery never touches a gateway — no online charge exists and
 * there is deliberately no fake transaction id; the order id is the
 * reference. Online gateways MUST go through `processPayment()` in the
 * engine (real SDK + shopper confirmation + server verification).
 */
export async function pay({ gateway, amount, method }) {
  if (gateway === 'cod') {
    if (!amount || amount <= 0) {
      return { ok: false, error: { message: 'The order total must be greater than zero.' } }
    }
    return {
      ok: true, verified: false, gateway: 'cod', method: 'cod', mode: 'cod',
      reference: null, captured: false,
      message: 'Order confirmed — pay in cash or UPI when it arrives.',
    }
  }
  return {
    ok: false,
    error: {
      message:
        'Online payments run through the real gateway checkout with your explicit ' +
        'confirmation. Please use the checkout payment step.',
    },
  }
}

/** Which gateway should handle a given method, based on admin settings. */
export function gatewayForMethod(method, settings) {
  const p = settings?.payments ?? {}
  if (method === 'cod') return p.cod?.enabled ? 'cod' : null
  if (p.razorpay?.enabled && (p.razorpay.methods || []).includes(method)) return 'razorpay'
  if (p.stripe?.enabled && (p.stripe.methods || []).includes(method)) return 'stripe'
  return null
}

/**
 * Payment options the storefront should show, derived from admin settings
 * AND real readiness. An enabled gateway with no key or no backend is
 * excluded — the checkout shows an honest notice instead (see
 * `paymentsNotice` in the engine). Each online method carries its real
 * `mode` ('test' | 'live') derived from the key prefix.
 *
 * `apiBase` overrides VITE_PAYMENTS_API_URL (used by tests).
 */
export function availableMethods(settings, apiBase) {
  const p = settings?.payments ?? {}
  const out = []

  const rzp = gatewayStatus('razorpay', settings, apiBase)
  if (rzp.enabled && rzp.ready) {
    for (const id of p.razorpay.methods || []) {
      const m = RAZORPAY_METHODS[id]
      if (m) out.push({ ...m, gateway: 'razorpay', mode: rzp.mode, modeLabel: modeLabel(rzp.mode) })
    }
  }
  const strp = gatewayStatus('stripe', settings, apiBase)
  if (strp.enabled && strp.ready) {
    for (const id of p.stripe.methods || []) {
      const m = STRIPE_METHODS[id]
      // Card exists in both; prefer Razorpay for Indian cards and avoid a duplicate row.
      if (m && !out.some((x) => x.id === id)) {
        out.push({ ...m, gateway: 'stripe', mode: strp.mode, modeLabel: modeLabel(strp.mode) })
      }
    }
  }
  if (p.cod?.enabled) {
    out.push({ id: 'cod', label: 'Cash on delivery', note: 'Pay when it arrives', feePct: 0, gateway: 'cod', mode: 'cod', modeLabel: 'COD' })
  }
  return out
}

/**
 * REALITY NOTES (replaces the old migration doc — there is nothing left
 * to migrate; these ARE the real flows):
 *
 * Client-safe (may live in the browser bundle / admin Settings):
 *   - razorpay.keyId            (rzp_test_… / rzp_live_…)
 *   - stripe.publishableKey     (pk_test_… / pk_live_…)
 *   - VITE_PAYMENTS_API_URL     (your server's base URL)
 *
 * Server-only (NEVER in the browser — keep in backend env vars):
 *   - RAZORPAY_KEY_SECRET, STRIPE_SECRET_KEY, webhook signing secrets
 *
 * Backend endpoints the merchant must implement (documented in
 * docs/14-PRODUCTION.md → "Real payments"):
 *   POST /payments/razorpay/create-order
 *   POST /payments/razorpay/verify
 *   POST /payments/stripe/create-intent
 *   POST /payments/stripe/confirm
 */
export const REALITY = {
  clientSafeKeys: ['razorpay.keyId', 'stripe.publishableKey', 'VITE_PAYMENTS_API_URL'],
  serverOnlyKeys: ['RAZORPAY_KEY_SECRET', 'STRIPE_SECRET_KEY', 'webhook signing secrets'],
  endpointsNeeded: [
    '/payments/razorpay/create-order',
    '/payments/razorpay/verify',
    '/payments/stripe/create-intent',
    '/payments/stripe/confirm',
  ],
}

export default { pay, availableMethods, gatewayForMethod, PAYMENT_STATUS, REALITY }
