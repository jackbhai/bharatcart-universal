# Production guide — taking BharatCart live

This is the honest path from "works on my laptop" to "takes real money".
Demo mode is deliberately fenced, not removed: everything still runs with
zero configuration, but every demo-ism is labelled and every production
switch is one env var away.

## 1. Environment variables

Copy `.env.example` to `.env`. Every variable is optional; unset values keep
the safe demo defaults.

| Variable | Values | Default | What it does |
|---|---|---|---|
| `VITE_BACKEND` | `local` `supabase` `firebase` `cloudflare` | `local` | Which backend adapter serves auth/data/storage |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | URL + anon key | — | Supabase project (recommended backend) |
| `VITE_FIREBASE_API_KEY` / `VITE_FIREBASE_AUTH_DOMAIN` / `VITE_FIREBASE_PROJECT_ID` / `VITE_FIREBASE_APP_ID` | Firebase web config | — | Firebase project |
| `VITE_CF_API_URL` / `VITE_CF_TEAM_DOMAIN` | URLs | — | Cloudflare Workers API + Access |
| `VITE_PAYMENT_MODE` | `simulated` `test` `live` | `simulated` | Payment world the checkout runs in. Env wins over admin settings |
| `VITE_PAYMENTS_API_URL` | `https://api.yourstore.com` | — | Your server that creates Razorpay orders / Stripe intents and verifies signatures |
| `VITE_RAZORPAY_KEY_ID` | `rzp_live_…` | — | Fallback if the admin Settings → Payments key ID is empty |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` | — | Fallback if the admin Settings → Payments key is empty |
| `VITE_GOLD_RATE_URL` | `https://…/gold-rates` | — | JSON `{ rates: { '24K': n, '22K': n, … } }` per-gram feed |
| `VITE_GOLD_RATE_TTL_MS` | ms | `900000` (15 min) | How long live gold rates are trusted |

> Secrets (Razorpay key secret, Stripe secret key, webhook secrets) live in
> **server** environment variables only. They must never appear in `VITE_*`
> vars, in admin settings, or in the repo — the browser bundle is public.

## 2. Choosing a backend

1. Pick one: `VITE_BACKEND=supabase` (recommended — Postgres + auth +
   storage + realtime in one), `firebase`, or `cloudflare`.
2. Fill in that section of `.env` (or enter the same values in the admin
   panel under Settings → Backend, which stores them in the browser).
3. If the selected backend is **not configured**, the app falls back to the
   local demo backend so nobody is stranded — but it is loud about it:
   a `console.error` on boot and a persistent ⚠️ banner at the top of every
   admin screen linking to Settings → Backend. Fix the credentials; the
   banner disappears on its own.

Note: the production build strips `console.*` (terser `drop_console`), so
the admin banner is the durable signal, not the console line.

## 3. Payments setup

There is no demo or simulated payment mode. Online payments are always
real: the genuine Razorpay / Stripe SDK, a real order or PaymentIntent
created by YOUR backend, and server-side verification before any order is
marked paid. If a gateway is not configured, checkout honestly offers Cash
on Delivery instead — nothing is faked.

### Test vs live — derived from the key, not a setting

- **`rzp_test_…` / `pk_test_…`**: the real gateway sandbox runs, but no
  real money moves. Use the gateway's test cards / test UPI IDs.
- **`rzp_live_…` / `pk_live_…`**: real money. The checkout shows an explicit
  **review step** ("Confirm payment · ₹X") and the gateway module *refuses*
  to start a charge without that confirmation, so a code slip can never
  skip consent.

The storefront labels each method "Test" or "Live" from its key prefix.
An unrecognized key is treated as test (never accidentally live).

### What your server must expose

The browser never creates orders or intents itself (that needs the key
secret). Implement these on any backend — Supabase Edge Function, Cloudflare
Worker, Firebase Function:

```
POST /payments/razorpay/create-order  { amount (paise), currency, receipt }
                                      → Razorpay order object { id, amount, currency, receipt }
POST /payments/razorpay/verify        { razorpay_order_id, razorpay_payment_id, razorpay_signature }
                                      → { ok: true, captured } only if HMAC-SHA256(order_id|payment_id) checks out
POST /payments/stripe/create-intent   { amount (paise), currency }
                                      → { clientSecret, id }
POST /payments/stripe/confirm         { paymentIntentId }
                                      → { status }  (server re-reads the intent from Stripe)
```

Set `VITE_PAYMENTS_API_URL` to that server's base URL, put the publishable
key ID in admin Settings → Payments (or `VITE_RAZORPAY_KEY_ID` /
`VITE_STRIPE_PUBLISHABLE_KEY`, or the Integrations hub). Start with test
keys for a sandbox order before going live.

### Stripe cards

The checkout mounts a real Stripe card Element on the payment step
(`mountStripeCard(container, publishableKey)` in
`src/engines/payments/paymentGateway.js`) and passes its `card` handle as
`stripeCard` to `processPayment()`. Card details go straight into Stripe's
secure element — they never touch the store's servers. Razorpay needs no
extra UI — its modal handles method selection.

## 4. Gold-rate endpoint

Fine jewellery is priced from a per-gram rate. Without configuration the
bundled DEMO table is used and the PDP honestly says **"Indicative rate"**.

To go live, serve `GET {VITE_GOLD_RATE_URL}` returning:

```json
{ "rates": { "24K": 8420, "22K": 7718, "18K": 6312, "14K": 4920 } }
```

(a `{ "data": { "rates": … } }` wrapper is tolerated). Rates cache in memory
for `VITE_GOLD_RATE_TTL_MS`; on any failure pricing keeps the last good
cache (marked stale) or the DEMO table, and the PDP keeps saying
"indicative". Every checkout snapshot records `source: 'live' | 'demo' |
'override'` so the audit trail shows which rate priced the order.
You can also drive rates programmatically: `setRateSource({ url })`,
`refreshLiveRates(fetcher)`, `getRateStatus()` in
`src/engines/pricing/goldEngine.js`.

## 5. Deployment

The app builds to plain static files (`dist/`, ~1.6 MB, 46 chunks with
route-level lazy splitting — each admin module is its own chunk):

```bash
npm run build     # → dist/
```

- **Vercel / Netlify / Cloudflare Pages** — build command `npm run build`,
  publish directory `dist`. Set the `VITE_*` vars in the host's env UI
  (never commit a real `.env`).
- **Any static host** — copy `dist/` into the document root.
- Hash routing (`HashRouter`) is used, so deep links work on hosts without
  SPA rewrite rules.

## 6. Going-live checklist

- [ ] `.env` filled: `VITE_BACKEND` + that backend's credentials
- [ ] Admin shows no ⚠️ backend banner
- [ ] Test keys (`rzp_test_…`/`pk_test_…`) + `VITE_PAYMENTS_API_URL` set; sandbox order succeeds end-to-end
- [ ] `/payments/razorpay/verify` rejects a forged signature
- [ ] Live keys; the review step shows before any charge
- [ ] `VITE_GOLD_RATE_URL` serving live rates (or accept "Indicative rate" on jewellery PDPs)
- [ ] Secrets only in server env — grep the repo for `sk_live`, `sk_test`, key secrets: none should be hardcoded
- [ ] `npm test` green, `npm run build` green
- [ ] Real `.env` never committed (it's gitignored; `.env.example` holds placeholders only)

## 7. What stays demo on purpose

- The local backend adapter and DEMO gold table remain for try-outs —
  each is labelled in the UI and fenced behind env flags.
- Product imagery in the seed is emoji placeholders; swap in real image URLs
  via the catalogue.

## 8. Real payments — backend reference implementation

The frontend flow (`src/engines/payments/paymentGateway.js`):

1. `POST /payments/razorpay/create-order` (or `/payments/stripe/create-intent`)
   — your server calls `razorpay.orders.create()` / `stripe.paymentIntents.create()`
   with the **secret** key and returns the order / client secret.
2. The real gateway SDK collects the shopper's payment (Razorpay modal,
   Stripe Elements). The handler firing is NOT success — it only means the
   shopper finished the gateway flow.
3. `POST /payments/razorpay/verify` (or `/payments/stripe/confirm`) —
   your server verifies and answers. Only then does the frontend report
   `ok: true`, and only then is the order written with `paid: true`.

### Node/Express handler (Razorpay verify)

```js
import crypto from 'node:crypto'
import express from 'express'

const app = express()
app.use(express.json())

// Create the order the checkout opens in the Razorpay modal.
app.post('/payments/razorpay/create-order', async (req, res) => {
  const { amount, currency = 'INR', receipt } = req.body // amount in PAISE
  // Re-price the cart server-side here — never trust the client's total.
  const order = await razorpay.orders.create({ amount, currency, receipt })
  res.json(order) // { id, amount, currency, receipt, ... }
})

// Verify the signature with the KEY SECRET (server env only).
app.post('/payments/razorpay/verify', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')
  if (expected !== razorpay_signature) {
    return res.status(400).json({ ok: false, error: 'Signature mismatch' })
  }
  // Optionally fetch the payment from Razorpay and confirm `captured`.
  res.json({ ok: true, captured: true })
})
```

### Stripe (create-intent + confirm + webhooks)

```js
app.post('/payments/stripe/create-intent', async (req, res) => {
  const { amount, currency = 'inr' } = req.body // amount in PAISE
  const intent = await stripe.paymentIntents.create({
    amount, currency,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
  })
  res.json({ clientSecret: intent.client_secret, id: intent.id })
})

// The frontend calls this AFTER confirmCardPayment resolves.
app.post('/payments/stripe/confirm', async (req, res) => {
  const intent = await stripe.paymentIntents.retrieve(req.body.paymentIntentId)
  res.json({ status: intent.status }) // only 'succeeded' counts as paid
})

// Webhook: the source of truth for async outcomes (refunds, disputes,
// 3DS redirects that finish later). Verify the Stripe signature first.
app.post('/payments/stripe/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const event = stripe.webhooks.constructEvent(
      req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET
    )
    if (event.type === 'payment_intent.succeeded') {
      // mark order paid in YOUR database; idempotency key = intent id
    }
    res.json({ received: true })
  })
```

Razorpay webhooks work the same way: verify with
`Razorpay.validateWebhookSignature(body, signature, webhookSecret)`.

### RBI / 3D Secure notes for India

- **3DS is mandatory for Indian cards.** `stripe.confirmCardPayment()` and
  the Razorpay modal handle the bank's 3D Secure challenge automatically —
  never try to bypass it.
- **Card tokenisation:** since RBI's tokenisation mandate, raw card numbers
  must not be stored. Both gateways tokenise — store only the gateway's
  payment/token ids, never PANs.
- **Refunds** go through the gateway dashboard or API (`razorpay.payments.refund`,
  `stripe.refunds.create`) — the storefront never initiates money movement.
- **Settlement:** Razorpay settles T+2 to the merchant's nodal account;
  keep the settlement account's KYC current or payouts pause.
