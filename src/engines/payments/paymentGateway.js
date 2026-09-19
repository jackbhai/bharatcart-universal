/**
 * Payment gateway orchestration — REAL payments only.
 *
 * There is no simulated / demo mode anywhere in this module. Every online
 * payment goes through the genuine Razorpay or Stripe SDK, a real order or
 * PaymentIntent created by the MERCHANT'S backend, and a server-side
 * verification step before the order is ever marked paid. If a gateway is
 * not configured, the checkout says so honestly and falls back to COD.
 *
 * Key safety: the browser only ever sees publishable keys
 * (Razorpay key ID `rzp_test_/rzp_live_…`, Stripe publishable key
 * `pk_test_/pk_live_…`). Key secrets live on the merchant backend only —
 * creating a Razorpay order or Stripe PaymentIntent requires the secret,
 * so the frontend never does it.
 *
 * Key resolution order for each gateway:
 *   1. `VITE_RAZORPAY_KEY_ID` / `VITE_STRIPE_PUBLISHABLE_KEY` env vars
 *   2. The Integrations hub saved config (`integrations/store.js`)
 *   3. Admin Settings → Payments key fields (publishable keys are browser-safe)
 *
 * Mode is derived from the key prefix — `test` vs `live` is a fact about
 * the key, not a setting. An unrecognized key is treated as TEST (never
 * accidentally live) and labelled honestly.
 *
 * Backend contract (implemented on the merchant's server, NOT in this repo):
 *   POST {VITE_PAYMENTS_API_URL}/payments/razorpay/create-order
 *     { amount (paise), currency, receipt } → { id, amount, currency, receipt }
 *   POST {VITE_PAYMENTS_API_URL}/payments/razorpay/verify
 *     { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *     → { ok, captured }   (server checks HMAC-SHA256(order_id|payment_id))
 *   POST {VITE_PAYMENTS_API_URL}/payments/stripe/create-intent
 *     { amount (paise), currency } → { clientSecret, id }
 *   POST {VITE_PAYMENTS_API_URL}/payments/stripe/confirm
 *     { paymentIntentId } → { status }   (server re-reads the intent from Stripe)
 *
 * No new npm dependencies: SDKs load from the gateways' own CDNs.
 */

import {
  getIntegrationConfig,
  getProvider,
  getEffectiveValue,
} from '../integrations/store.js'

const envOf = (env) =>
  env ?? (typeof import.meta !== 'undefined' && import.meta.env) ?? {}

/** Base URL of the merchant's payments backend (server side). */
export function paymentsApiUrl(env) {
  return String(envOf(env).VITE_PAYMENTS_API_URL || '').replace(/\/+$/, '')
}

/* ------------------------------------------------------- key handling */

const KEY_FIELD = {
  razorpay: { providerId: 'razorpay', fieldKey: 'keyId', envVar: 'VITE_RAZORPAY_KEY_ID' },
  stripe: { providerId: 'stripe', fieldKey: 'publishableKey', envVar: 'VITE_STRIPE_PUBLISHABLE_KEY' },
}

/**
 * Resolve the publishable key for a gateway. Never returns a secret —
 * only the key ID / publishable key, which are safe in the browser.
 */
export function gatewayKey(gateway, settings, env) {
  const spec = KEY_FIELD[gateway]
  if (!spec) return ''
  const e = envOf(env)
  if (e[spec.envVar]) return String(e[spec.envVar])
  // Integrations hub saved config (non-secret fields only, enforced there).
  try {
    const { providerId, config } = getIntegrationConfig('payments')
    if (providerId === spec.providerId) {
      const def = getProvider('payments', spec.providerId)
      const field = def?.fields?.find((f) => f.key === spec.fieldKey)
      const v = getEffectiveValue(field, config)
      if (v) return String(v)
    }
  } catch { /* hub store unavailable — fall through */ }
  // Admin Settings → Payments (publishable keys are browser-safe).
  const saved = settings?.payments?.[gateway]?.[spec.fieldKey]
  return saved ? String(saved) : ''
}

/**
 * 'test' | 'live' from the key prefix. An unrecognized or missing key
 * reports 'test' semantics — we never guess "live". `keyRecognized`
 * tells the UI whether the prefix was actually known.
 */
export function keyMode(gateway, key) {
  if (!key) return null
  if (gateway === 'razorpay') {
    if (key.startsWith('rzp_live_')) return 'live'
    return 'test'
  }
  if (gateway === 'stripe') {
    if (key.startsWith('pk_live_')) return 'live'
    return 'test'
  }
  return 'test'
}

export function keyRecognized(gateway, key) {
  if (!key) return false
  if (gateway === 'razorpay') return key.startsWith('rzp_test_') || key.startsWith('rzp_live_')
  if (gateway === 'stripe') return key.startsWith('pk_test_') || key.startsWith('pk_live_')
  return false
}

export function modeLabel(mode) {
  return mode === 'live' ? 'Live' : 'Test'
}

/* ------------------------------------------------------------ status */

/**
 * The honest state of one gateway: enabled in admin, key present,
 * backend configured, and the derived test/live mode.
 * `apiBase` is an explicit override (tests); otherwise VITE_PAYMENTS_API_URL.
 */
export function gatewayStatus(gateway, settings, apiBase) {
  const key = gatewayKey(gateway, settings)
  const base = apiBase ?? paymentsApiUrl()
  const mode = key ? keyMode(gateway, key) : null
  return {
    gateway,
    enabled: Boolean(settings?.payments?.[gateway]?.enabled),
    keyPresent: Boolean(key),
    keyRecognized: keyRecognized(gateway, key),
    backendReady: Boolean(base),
    ready: Boolean(key && base),
    mode,
  }
}

/**
 * Honest notice for the checkout when an admin-enabled online gateway
 * cannot actually take money (no key, or no backend). Returns null when
 * everything enabled is genuinely ready.
 */
export function paymentsNotice(settings, apiBase) {
  const p = settings?.payments ?? {}
  const wanted = ['razorpay', 'stripe'].filter((g) => p[g]?.enabled)
  if (!wanted.length) return null
  const missing = wanted.filter((g) => !gatewayStatus(g, settings, apiBase).ready)
  if (!missing.length) return null
  const names = missing.map((g) => (g === 'razorpay' ? 'Razorpay' : 'Stripe'))
  return {
    kind: 'not-configured',
    gateways: missing,
    message:
      "Online payments aren't connected yet — complete your purchase with Cash on " +
      'Delivery, or ask the store owner to connect ' +
      names.join(' and ') +
      ' in Integrations.',
  }
}

/* ------------------------------------------------------- SDK loading */

const SDK_URLS = {
  razorpay: 'https://checkout.razorpay.com/v1/checkout.js',
  stripe: 'https://js.stripe.com/v3/',
}

const sdkPromises = {}

/**
 * Inject the gateway's SDK `<script>` once and resolve when its global
 * appears. Rejects with a human-readable error — never a raw exception.
 */
export function loadGatewaySdk(gateway) {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('Payments need a browser environment'))
  }
  if (sdkPromises[gateway]) return sdkPromises[gateway]
  const url = SDK_URLS[gateway]
  if (!url) return Promise.reject(new Error(`Unknown payment gateway "${gateway}"`))

  sdkPromises[gateway] = new Promise((resolve, reject) => {
    const globalName = gateway === 'razorpay' ? 'Razorpay' : 'Stripe'
    if (typeof window !== 'undefined' && window[globalName]) {
      resolve(window[globalName])
      return
    }
    const script = document.createElement('script')
    script.src = url
    script.async = true
    const timer = setTimeout(() => {
      script.remove()
      delete sdkPromises[gateway]
      reject(new Error(
        `Could not load the ${gateway === 'razorpay' ? 'Razorpay' : 'Stripe'} checkout. ` +
        'Check your connection and try again.'
      ))
    }, 20000)
    script.onload = () => {
      clearTimeout(timer)
      const g = window[globalName]
      if (!g) {
        delete sdkPromises[gateway]
        reject(new Error(
          `The ${gateway === 'razorpay' ? 'Razorpay' : 'Stripe'} checkout failed to start. Please try again.`
        ))
        return
      }
      resolve(g)
    }
    script.onerror = () => {
      clearTimeout(timer)
      script.remove()
      delete sdkPromises[gateway]
      reject(new Error(
        `Could not reach the ${gateway === 'razorpay' ? 'Razorpay' : 'Stripe'} checkout. ` +
        'Check your connection and try again.'
      ))
    }
    document.head.appendChild(script)
  })
  return sdkPromises[gateway]
}

/* --------------------------------------------- server order / verify */

const fail = (message) => ({ ok: false, error: { message } })

/**
 * Ask the merchant backend to create a Razorpay order or Stripe
 * PaymentIntent. `fetcher` defaults to window.fetch and is injectable
 * for tests. `apiBase` overrides VITE_PAYMENTS_API_URL (tests).
 */
export async function createServerOrder(
  { gateway, amount, currency = 'INR', receipt, metadata = {}, apiBase },
  fetcher = typeof fetch !== 'undefined' ? fetch : null,
) {
  const base = apiBase ?? paymentsApiUrl()
  if (!base) {
    return { error: { message: 'The store\u2019s payment server is not connected yet. Please use Cash on Delivery or contact the store.' } }
  }
  if (!fetcher) return { error: { message: 'Payments are unavailable in this environment.' } }
  if (!amount || amount <= 0) {
    return { error: { message: 'The order total must be greater than zero.' } }
  }
  const path = gateway === 'razorpay' ? '/payments/razorpay/create-order' : '/payments/stripe/create-intent'
  let res
  try {
    res = await fetcher(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // gateways work in the smallest unit (paise)
        currency,
        receipt,
        metadata,
      }),
    })
  } catch {
    return { error: { message: 'Could not reach the payment server. Please try again in a moment.' } }
  }
  let body = null
  try { body = await res.json() } catch { /* non-JSON error page */ }
  if (!res.ok || !body || body.error) {
    const msg = body?.error?.message || body?.message || body?.error
    return { error: { message: friendlyServerError(res.status, msg) } }
  }
  return { order: body }
}

function friendlyServerError(status, msg) {
  if (msg) return msg
  if (status === 401 || status === 403) return 'The payment server rejected the request. The store owner should check the gateway keys.'
  if (status === 404) return 'The payment server endpoint was not found. The store owner should deploy the payments backend.'
  if (status >= 500) return 'The payment server had a problem. Please try again in a moment.'
  return 'The payment could not be started. Please try again.'
}

/**
 * Server-side Razorpay verification. The browser NEVER trusts the
 * checkout handler's success on its own — the backend re-computes
 * HMAC-SHA256(order_id|payment_id) with the key secret. The order is
 * marked paid only when the backend answers { ok: true }.
 */
export async function verifyRazorpayPayment(
  { razorpay_order_id, razorpay_payment_id, razorpay_signature, apiBase },
  fetcher = typeof fetch !== 'undefined' ? fetch : null,
) {
  const base = apiBase ?? paymentsApiUrl()
  if (!base || !fetcher) return fail('Payment verification is unavailable right now.')
  let res
  try {
    res = await fetcher(`${base}/payments/razorpay/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ razorpay_order_id, razorpay_payment_id, razorpay_signature }),
    })
  } catch {
    return fail('Could not confirm the payment with the bank. No order was placed — please try again.')
  }
  let body = null
  try { body = await res.json() } catch { /* ignore */ }
  if (!res.ok || !body?.ok) {
    return fail(
      body?.error?.message || body?.error ||
      'The payment could not be verified. If money left your account it will be refunded automatically — please contact the store.'
    )
  }
  return { ok: true, captured: Boolean(body.captured) }
}

/**
 * Server-side Stripe confirmation. After `confirmCardPayment` the backend
 * re-reads the PaymentIntent from Stripe — only `succeeded` counts as paid.
 */
export async function confirmStripeIntent(
  { paymentIntentId, apiBase },
  fetcher = typeof fetch !== 'undefined' ? fetch : null,
) {
  const base = apiBase ?? paymentsApiUrl()
  if (!base || !fetcher) return fail('Payment confirmation is unavailable right now.')
  let res
  try {
    res = await fetcher(`${base}/payments/stripe/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentIntentId }),
    })
  } catch {
    return fail('Could not confirm the payment with the bank. No order was placed — please try again.')
  }
  let body = null
  try { body = await res.json() } catch { /* ignore */ }
  if (!res.ok || body?.status !== 'succeeded') {
    return fail(
      body?.error?.message || body?.error ||
      'The payment was not completed. No money was taken — please try again.'
    )
  }
  return { ok: true, status: body.status }
}

/* ------------------------------------------------------- live charge */

/**
 * Run a REAL charge through the gateway SDK.
 *
 * `confirmed` MUST be true — the checkout shows an explicit review step
 * and only calls this after the shopper taps "Confirm payment". Refusing
 * without it is deliberate: no real charge may start without consent.
 *
 * Injectable for tests: `fetcher` (HTTP), `loadSdk` (gateway SDK),
 * `apiBase` (backend URL override).
 */
export async function processPayment({
  gateway, amount, currency = 'INR', method, settings, customer = {}, receipt,
  confirmed = false, stripeCard = null, fetcher, loadSdk = loadGatewaySdk, apiBase,
}) {
  // Cash on delivery never touches a gateway — no online charge exists.
  // There is no transaction id: the order id is the reference.
  if (gateway === 'cod') {
    return {
      ok: true, verified: false, gateway: 'cod', method: 'cod', mode: 'cod',
      reference: null, captured: false,
      message: 'Order confirmed — pay in cash or UPI when it arrives.',
    }
  }

  const st = gatewayStatus(gateway, settings, apiBase)
  if (!st.enabled) return fail('This payment method is not enabled for the store.')
  if (!st.keyPresent) {
    return fail(
      "Online payments aren't connected yet. Please use Cash on Delivery " +
      'or contact the store.'
    )
  }
  if (!st.backendReady) {
    return fail(
      'The store\u2019s payment server is not connected yet. Please use Cash on ' +
      'Delivery or contact the store.'
    )
  }
  if (!confirmed) {
    return fail('Payment needs your confirmation before any charge is attempted.')
  }

  const created = await createServerOrder(
    { gateway, amount, currency, receipt, metadata: { customerId: customer.id }, apiBase },
    fetcher,
  )
  if (created.error) return { ok: false, error: created.error }

  try {
    if (gateway === 'razorpay') {
      return await chargeRazorpay({
        order: created.order, key: gatewayKey(gateway, settings),
        customer, method, mode: st.mode, settings,
        apiBase, fetcher, loadSdk,
      })
    }
    if (gateway === 'stripe') {
      return await chargeStripe({
        intent: created.order, key: gatewayKey(gateway, settings),
        stripeCard, mode: st.mode, apiBase, fetcher, loadSdk,
      })
    }
  } catch (e) {
    return fail(humanChargeError(e))
  }
  return fail(`Unknown gateway: ${gateway}`)
}

function chargeRazorpay({ order, key, customer, method, mode, settings, apiBase, fetcher, loadSdk }) {
  return loadSdk('razorpay').then(
    (Razorpay) =>
      new Promise((resolve) => {
        let settled = false
        const done = (result) => { if (!settled) { settled = true; resolve(result) } }
        const rzp = new Razorpay({
          key,
          order_id: order.id || order.order_id,
          amount: order.amount,
          currency: order.currency || 'INR',
          name: settings?.store?.name || 'BharatCart',
          description: `Order ${order.receipt || ''}`.trim(),
          prefill: { email: customer.email, contact: customer.phone, name: customer.name },
          theme: { color: '#F97316' },
          modal: {
            ondismiss: () => done(fail('Payment was cancelled before completion.')),
          },
          // The handler firing is NOT payment success — it only means the
          // shopper completed the gateway flow. The backend must verify the
          // signature before we report ok.
          handler: async (res) => {
            const verified = await verifyRazorpayPayment(
              {
                razorpay_order_id: res.razorpay_order_id,
                razorpay_payment_id: res.razorpay_payment_id,
                razorpay_signature: res.razorpay_signature,
                apiBase,
              },
              fetcher,
            )
            if (!verified.ok) { done(verified); return }
            done({
              ok: true, verified: true, gateway: 'razorpay', method, mode,
              reference: res.razorpay_payment_id,
              orderRef: res.razorpay_order_id,
              captured: verified.captured,
              message: 'Payment verified and confirmed.',
            })
          },
        })
        rzp.on('payment.failed', (res) => done(fail(
          res?.error?.description || 'The payment failed. No money was taken.'
        )))
        try {
          rzp.open()
        } catch (e) {
          done(fail(humanChargeError(e)))
        }
      })
  )
}

async function chargeStripe({ intent, key, stripeCard, mode, apiBase, fetcher, loadSdk }) {
  const Stripe = await loadSdk('stripe')
  const stripe = Stripe(key)
  const clientSecret = intent.clientSecret || intent.client_secret
  if (!clientSecret) {
    return fail('The payment server did not return a usable payment session.')
  }
  if (!stripeCard) {
    return fail('Card details could not be read. Please re-enter them and try again.')
  }
  const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
    payment_method: { card: stripeCard },
  })
  if (error) {
    return fail(humanChargeError(error))
  }
  // confirmCardPayment resolving is not enough — the backend re-reads the
  // intent from Stripe before we call it paid.
  const conf = await confirmStripeIntent({ paymentIntentId: paymentIntent.id, apiBase }, fetcher)
  if (!conf.ok) return conf
  return {
    ok: true, verified: true, gateway: 'stripe', mode,
    reference: paymentIntent.id,
    orderRef: paymentIntent.id,
    captured: true,
    message: 'Payment verified and confirmed.',
  }
}

function humanChargeError(e) {
  const msg = String(e?.message || e?.code || '')
  if (/network|fetch|failed to fetch/i.test(msg)) return 'Network problem while contacting the payment gateway. Please check your connection and try again.'
  if (/popup|blocked/i.test(msg)) return 'Your browser blocked the payment window. Please allow pop-ups for this site and try again.'
  if (/card_declined|insufficient/i.test(msg)) return 'Your card was declined. Please try another card or payment method.'
  if (/expired/i.test(msg)) return 'Your card has expired. Please use a different card.'
  if (/authentication_required/i.test(msg)) return 'Your bank needs extra verification (3D Secure). Please complete it and try again.'
  return msg || 'The payment could not be completed. No money was taken — please try again.'
}

/**
 * Mount a Stripe card Element into `container` and return handles the
 * checkout needs for `chargeStripe`. The checkout owns the Element's
 * lifecycle (mount on the payment step, unmount on leave).
 */
export async function mountStripeCard(container, publishableKey, loadSdk = loadGatewaySdk) {
  const Stripe = await loadSdk('stripe')
  const stripe = Stripe(publishableKey)
  const elements = stripe.elements()
  const card = elements.create('card')
  card.mount(container)
  return { stripe, elements, card, unmount: () => card.unmount() }
}

export default {
  paymentsApiUrl,
  gatewayKey,
  keyMode,
  keyRecognized,
  modeLabel,
  gatewayStatus,
  paymentsNotice,
  loadGatewaySdk,
  createServerOrder,
  verifyRazorpayPayment,
  confirmStripeIntent,
  processPayment,
  mountStripeCard,
}
