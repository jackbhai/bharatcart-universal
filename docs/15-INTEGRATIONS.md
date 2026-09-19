# 15 — Integrations: real providers, no fake connections

The old system hardcoded integrations as "Connected" with fake delivery
counts and fake API keys. That is gone. This document describes the
replacement: a real provider registry, a real admin hub, and an honest
security model.

## Architecture

```
src/engines/integrations/
├── providers.js          # the registry: every provider, its fields, its real test
├── store.js              # persisted per-category config (non-secrets only)
└── integrationEngine.js  # webhook event list + test-payload builder (only)

src/admin/integrations/index.jsx   # the admin hub at #/admin/integrations
```

### providers.js — the registry

Providers are grouped into 8 categories: `database`, `auth`, `payments`,
`storage`, `sms`, `email`, `analytics`, `shipping`.

Each provider def:

```js
{
  id: 'supabase',            // unique within its category
  category: 'database',
  name: 'Supabase',
  tagline: '…',
  docsUrl: 'https://…',      // official docs, opened in a new tab
  fields: [                  // what the merchant must supply
    { key: 'url', label: 'Project URL', type: 'url',
      envVar: 'VITE_SUPABASE_URL', required: true,
      help: '…' , secret: false },
  ],
  testConnection: async (values) => ({ ok: true|false, message: '…' }),
}
```

Field types: `text` | `password` | `url`. `type: 'password'` (or
`secret: true`) marks a secret.

### store.js — the contract

```js
getProviders(category)                  // provider defs for the category
getProvider(category, providerId)        // def or null
getIntegrationConfig(category)          // { providerId: string|null, config: object }
setIntegrationConfig(category, providerId, config)  // strips secrets, persists rest
clearIntegration(category)              // removes the category config
isConfigured(category)                  // providerId set AND every required field
                                        // resolves via env or saved config
getEnvStatus(envVar)                    // 'set' | 'missing' — never reveals values
getEffectiveValue(field, config)        // import.meta.env[field.envVar] ?? config[field.key] ?? ''
```

Persistence: `bc.integrations.v1` in localStorage (via the safe storage
wrapper, which falls back to memory). Webhooks: `bc.webhooks.v1`.

## The honest security model

1. **Publishable keys are public.** `VITE_` variables are embedded in the
   client bundle at build time — anyone can read them. That is fine for
   publishable keys (`pk_…`), anon keys, measurement IDs and URLs. It is
   NOT fine for secrets.

2. **Secrets stay in env, never in the browser store.** `setIntegrationConfig`
   strips every secret field before writing to localStorage. The admin UI
   never renders a secret input — it shows the env var name with a
   Set/Missing badge and tells the merchant to add it in `.env` locally or
   in Environment Variables on Vercel/Netlify, then redeploy.

3. **"Connected" means verified or fully supplied — never faked.**
   `isConfigured()` is true only when every required field resolves.
   "Test connection" runs a REAL check (see below) and reports the real
   outcome, including honest "could not verify" answers.

## How testConnection works per provider

| Provider | Real check performed |
|---|---|
| Supabase (+auth/storage) | `GET {url}/rest/v1/` with the anon key; 200 = connected, 401 = bad key |
| Firebase (+auth/storage) | POST to Identity Toolkit `accounts:signUp` with empty body — a valid key returns a "missing password"-style 400, an invalid key returns "API key not valid". Nothing is created |
| Neon | Format validation only — Postgres needs a server-side TCP connection, which browsers cannot open. Says so honestly |
| Custom REST | `GET` the base URL (with Bearer token if given); reports the real HTTP status |
| Local dev | Honestly reports "development mode, nothing external to verify" |
| Clerk | Publishable-key format check; full verification needs the backend secret key |
| Custom JWT | Fetches the JWKS URL; valid only if it serves a JSON `keys` array |
| Razorpay | Key-ID format check; order creation (which needs the secret) happens on the backend |
| Stripe | Key format check + loads Stripe.js, which validates the key client-side |
| Cloudinary | Cloud-name/preset format check; upload presets need a real upload to confirm |
| S3-compatible | Anonymous `HEAD` on the bucket: 403 = exists & reachable, 404 = missing bucket |
| Twilio | Account-SID format check; SMS sending needs the backend-held auth token |
| MSG91 | Auth-key presence check; calls are authenticated server-side |
| Resend | `GET /domains` with the key — a real authenticated read; 401 = bad key |
| SendGrid | `GET /v3/scopes` with the key — a real authenticated read; 401 = bad key |
| GA4 / Plausible | ID/domain format check — the full browser-side check; confirm in Realtime/dashboard |
| Shiprocket | Real `POST` to the auth login endpoint; 200 + token = connected |

Every check has a ~12s timeout and reports network/CORS failures honestly
instead of inventing a result.

## Webhooks — real and merchant-owned

The webhook list starts **empty**. The merchant adds their own `https` URL
and picks events from `WEBHOOK_EVENTS`. "Send test event" POSTs a real
signed JSON payload:

- Headers: `X-BharatCart-Event`, `X-BharatCart-Test: true`,
  `X-BharatCart-Signature: sha256=<HMAC-SHA256 of the body>`
- The signing secret is generated per webhook at creation time.
- The recorded result is the REAL HTTP outcome (`200`, `404`, or
  `network error / CORS blocked`) — there are no fake delivery statistics.

## Backend API keys

The old fake `API_KEYS` list is deleted. This storefront is static: it
issues no keys. API keys for the mobile app, warehouse sync, etc. are
issued by the merchant's own backend — the contract for which is in
`docs/14-PRODUCTION.md`. The "Backend API" tab in the hub shows the real
env status of `VITE_BACKEND` and `VITE_PAYMENTS_API_URL`.

## Adding a new provider (open-source guide)

1. Open `src/engines/integrations/providers.js`.
2. Add a def to `PROVIDERS` under the right category (or add a category to
   `PROVIDER_CATEGORIES` — the admin hub renders categories automatically).
3. Write `testConnection(values)`:
   - Return `{ ok: true, message }` only when a real check passed.
   - Return `{ ok: false, message: 'Could not verify …' }` when the browser
     cannot check it, and say what the merchant should do instead.
   - Never `return { ok: true }` for a check you did not perform.
4. Mark secret fields with `type: 'password'` — the store and the UI handle
   the rest (stripped from localStorage, Set/Missing badge in the UI).
5. Add the `VITE_` variables to `.env.example`.
6. Run `npx vite build` and `npm test` — both must pass.

No new npm dependencies: use `fetch` and dynamic script loading only.
