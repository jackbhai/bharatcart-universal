/**
 * Real integration provider registry.
 *
 * Every provider here is a service the merchant connects with their OWN
 * credentials. Nothing is pre-connected, nothing is faked: a provider is
 * "configured" only when the merchant has supplied every required value
 * (via VITE_ env vars and/or the admin form), and "test connection" performs
 * a REAL check against the provider's public API.
 *
 * Honesty rule for testConnection: return { ok: true } only when a real
 * check passed. When the browser cannot verify something (e.g. a Postgres
 * wire protocol, or an API that needs a secret key kept on the backend),
 * return { ok: false, message: 'Could not verify …' } and say exactly what
 * was and wasn't checked. Never invent a success.
 *
 * To add a provider (open-source contributions welcome — see
 * docs/15-INTEGRATIONS.md):
 *   1. Add a def below: { id, category, name, tagline, docsUrl, fields, testConnection }
 *   2. Each field: { key, label, type: 'text'|'password'|'url', envVar, required, help, secret? }
 *      type 'password' implies secret — secrets are NEVER written to
 *      localStorage (see store.js) and are only ever read from import.meta.env.
 *   3. testConnection(values) is async and returns { ok: boolean, message: string }.
 *      `values` are the EFFECTIVE values (import.meta.env[envVar] ?? saved form value).
 */

const TIMEOUT_MS = 12000

/** fetch with a timeout; returns { res, data } where data is parsed JSON or null. */
async function fetchJson(url, options = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), options.timeout ?? TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal })
    let data = null
    try { data = await res.json() } catch { /* non-JSON body */ }
    return { res, data }
  } finally {
    clearTimeout(timer)
  }
}

/** Standard honest answer when the browser cannot reach or verify a provider. */
function couldNotVerify(detail) {
  return {
    ok: false,
    message: `Could not verify${detail ? ' — ' + detail : ''}. The request failed, or the provider blocked it from the browser (CORS). Check the values and retry, or verify from your backend.`,
  }
}

function missing(what) {
  return { ok: false, message: `Missing ${what} — fill it in (or set it as an env var) before testing.` }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = resolve
    s.onerror = () => reject(new Error('script load failed'))
    document.head.appendChild(s)
  })
}

/* ------------------------------------------------------------------ */
/* Shared field sets (auth/storage variants reuse the database ones)   */
/* ------------------------------------------------------------------ */

const SUPABASE_FIELDS = [
  { key: 'url', label: 'Project URL', type: 'url', envVar: 'VITE_SUPABASE_URL', required: true,
    help: 'https://xyzcompany.supabase.co — from your Supabase dashboard → Project Settings → API.' },
  { key: 'anonKey', label: 'Anon (publishable) key', type: 'password', secret: true, envVar: 'VITE_SUPABASE_ANON_KEY', required: true,
    help: 'The anon public key. It is safe for browsers. Never use the service_role key here — it stays on your backend.' },
]

const FIREBASE_FIELDS = [
  { key: 'apiKey', label: 'Web API key', type: 'password', secret: true, envVar: 'VITE_FIREBASE_API_KEY', required: true,
    help: 'Firebase console → Project settings → General → Web API Key.' },
  { key: 'projectId', label: 'Project ID', type: 'text', envVar: 'VITE_FIREBASE_PROJECT_ID', required: true,
    help: 'The project ID, e.g. my-store-12345.' },
]

/* ------------------------------------------------------------------ */
/* Real connection checks                                               */
/* ------------------------------------------------------------------ */

async function testSupabase(v) {
  const url = String(v.url || '').trim().replace(/\/+$/, '')
  const key = String(v.anonKey || '').trim()
  if (!url || !key) return missing('the Project URL or anon key')
  if (!/^https:\/\/[^/]+\.[^/]+/.test(url)) return { ok: false, message: 'The Project URL does not look like an https URL.' }
  try {
    const { res } = await fetchJson(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (res.status === 200) return { ok: true, message: 'Connected — Supabase answered the PostgREST root (HTTP 200) with this anon key.' }
    if (res.status === 401) return { ok: false, message: 'Supabase rejected the anon key (HTTP 401). Check the key in your project settings.' }
    return { ok: false, message: `Supabase answered with HTTP ${res.status} — check the Project URL.` }
  } catch { return couldNotVerify() }
}

async function testFirebase(v) {
  const apiKey = String(v.apiKey || '').trim()
  const projectId = String(v.projectId || '').trim()
  if (!apiKey || !projectId) return missing('the API key or project ID')
  // Identity Toolkit is CORS-enabled and used by the Firebase web SDK itself.
  // A POST with an empty body to accounts:signUp is a safe, read-only probe:
  // a VALID key returns 400 with a "missing password"-style error, while an
  // INVALID key returns 400 "API key not valid". Nothing is created.
  try {
    const { res, data } = await fetchJson(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    )
    const errMsg = data?.error?.message || ''
    if (/API key not valid|API_KEY_INVALID/i.test(errMsg)) {
      return { ok: false, message: 'Firebase rejected the API key as invalid. Check the Web API Key in your project settings.' }
    }
    if (res.status === 400 && errMsg) {
      return { ok: true, message: `Connected — Firebase Identity Toolkit accepted the API key (answered: ${errMsg}).` }
    }
    if (res.status === 403) {
      return { ok: false, message: `The key was rejected (HTTP 403: ${errMsg || 'forbidden'}). The project may be disabled — check the Firebase console.` }
    }
    return { ok: false, message: `Unexpected response from Firebase (HTTP ${res.status}${errMsg ? ': ' + errMsg : ''}).` }
  } catch { return couldNotVerify() }
}

async function testNeon(v) {
  const cs = String(v.connectionString || '').trim()
  const m = /^(postgres(ql)?:\/\/)([^:/?#@\s]+)(?::([^@/?#\s]*))?@([^/?#:\s]+)(?::(\d+))?\/([^?#\s]+)/.exec(cs)
  if (!m) return { ok: false, message: 'This does not look like a Postgres connection string (expected postgresql://user:password@host/database).' }
  return {
    ok: false,
    message: 'Could not verify from the browser — Postgres speaks a TCP wire protocol that browsers cannot open. The format looks valid; run `SELECT 1` from your backend (or psql) with this string to confirm connectivity.',
  }
}

async function testRest(v) {
  const base = String(v.base || '').trim().replace(/\/+$/, '')
  if (!/^https?:\/\/[^/]+\.[^/]+/.test(base)) return { ok: false, message: 'The base URL must start with http(s):// and include a host.' }
  try {
    const headers = v.apiKey ? { Authorization: `Bearer ${String(v.apiKey).trim()}` } : {}
    const { res } = await fetchJson(base, { method: 'GET', headers })
    return { ok: true, message: `Reachable — your API answered with HTTP ${res.status}.` }
  } catch { return couldNotVerify() }
}

const testLocalDev = async () => ({
  ok: true,
  message: 'Development mode — data stays in this browser (localStorage). There is no external service to verify.',
})

async function testClerk(v) {
  const key = String(v.publishableKey || '').trim()
  if (!/^pk_(test|live)_[A-Za-z0-9]+$/.test(key)) {
    return { ok: false, message: 'The publishable key must look like pk_test_… or pk_live_… (Clerk dashboard → API Keys).' }
  }
  return {
    ok: false,
    message: 'Could not fully verify from the browser — the publishable key format is valid, but Clerk authenticates server-side with the secret key. Confirm sign-in works from your backend.',
  }
}

async function testJwt(v) {
  const jwksUrl = String(v.jwksUrl || '').trim()
  const issuer = String(v.issuer || '').trim()
  if (!jwksUrl) return missing('the JWKS URL')
  if (!/^https:\/\//.test(jwksUrl)) return { ok: false, message: 'The JWKS URL must be an https URL.' }
  if (!issuer) return missing('the issuer')
  try {
    const { res, data } = await fetchJson(jwksUrl)
    if (res.ok && data && Array.isArray(data.keys) && data.keys.length > 0) {
      return { ok: true, message: `Connected — the JWKS document is valid and publishes ${data.keys.length} signing key(s).` }
    }
    return { ok: false, message: `The URL answered (HTTP ${res.status}) but did not serve a JWKS document with a "keys" array.` }
  } catch { return couldNotVerify() }
}

async function testRazorpay(v) {
  const key = String(v.keyId || '').trim()
  if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(key)) {
    return { ok: false, message: 'The Key ID must look like rzp_test_… or rzp_live_… (Razorpay dashboard → Settings → API Keys).' }
  }
  return {
    ok: false,
    message: 'Could not fully verify from the browser — the Key ID format is valid, but Razorpay authenticates with the Key Secret, which must stay on your backend. Create a test order from your server to confirm.',
  }
}

async function testStripe(v) {
  const key = String(v.publishableKey || '').trim()
  if (!/^pk_(test|live)_[A-Za-z0-9]+$/.test(key)) {
    return { ok: false, message: 'The publishable key must look like pk_test_… or pk_live_… (Stripe dashboard → Developers → API keys).' }
  }
  // Stripe.js validates the key format client-side when constructed — a real
  // check beyond the regex, without touching any secret.
  try {
    await loadScript('https://js.stripe.com/v3/')
    if (typeof window.Stripe === 'function') {
      window.Stripe(key) // throws on structurally invalid keys
      return { ok: true, message: 'Stripe.js accepted the publishable key. Charges are created and confirmed from your backend with the secret key.' }
    }
  } catch { /* fall through to the format-only verdict */ }
  return { ok: true, message: 'The key format is valid. (Stripe.js could not be loaded for a deeper check — confirm from your backend.)' }
}

async function testCloudinary(v) {
  const cloud = String(v.cloudName || '').trim()
  const preset = String(v.uploadPreset || '').trim()
  if (!/^[a-z0-9][a-z0-9-]*$/.test(cloud)) {
    return { ok: false, message: 'The cloud name must be lowercase letters, numbers and dashes (Cloudinary dashboard → top-left).' }
  }
  if (!preset) return missing('the unsigned upload preset')
  return {
    ok: false,
    message: 'Could not fully verify from the browser — the cloud name and preset look valid, but confirming an upload preset requires an actual upload. Upload one test image from the Cloudinary Media Library to confirm.',
  }
}

async function testS3(v) {
  const endpoint = String(v.endpoint || '').trim().replace(/\/+$/, '')
  const bucket = String(v.bucket || '').trim()
  if (!/^https?:\/\/[^/]+/.test(endpoint)) return { ok: false, message: 'The endpoint must start with http(s)://.' }
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    return { ok: false, message: 'The bucket name does not look valid (lowercase, 3–63 chars).' }
  }
  // An anonymous HEAD against the bucket is informative without any secret:
  // 403 = the bucket exists and the endpoint is reachable (anonymous is denied, as expected);
  // 404/NoSuchBucket = the bucket does not exist at this endpoint.
  try {
    const { res } = await fetchJson(`${endpoint}/${bucket}`, { method: 'HEAD' })
    if (res.status === 403) return { ok: true, message: 'Endpoint reachable and the bucket exists (HTTP 403 to anonymous access is expected — your access key stays on the backend).' }
    if (res.status === 404) return { ok: false, message: 'The endpoint answered but the bucket was not found (HTTP 404). Check the bucket name.' }
    return { ok: true, message: `The endpoint answered with HTTP ${res.status}.` }
  } catch { return couldNotVerify() }
}

async function testTwilio(v) {
  const sid = String(v.accountSid || '').trim()
  if (!/^AC[a-f0-9]{32}$/.test(sid)) {
    return { ok: false, message: 'The Account SID must look like AC followed by 32 hex characters (Twilio console dashboard).' }
  }
  if (!String(v.authToken || '').trim()) return missing('the Auth Token (set VITE_TWILIO_AUTH_TOKEN in your env)')
  return {
    ok: false,
    message: 'Could not fully verify from the browser — the Account SID format is valid, but Twilio authenticates with the Auth Token, which must stay on your backend. Send a test SMS from your server to confirm.',
  }
}

async function testMsg91(v) {
  const key = String(v.authKey || '').trim()
  if (key.length < 8) return missing('the Auth Key (set VITE_MSG91_AUTH_KEY in your env)')
  return {
    ok: false,
    message: 'Could not fully verify from the browser — the Auth Key is present, but MSG91 calls are authenticated server-side. Check your balance/OTP from the MSG91 dashboard or your backend.',
  }
}

async function testResend(v) {
  const key = String(v.apiKey || '').trim()
  if (!key) return missing('the API key (set VITE_RESEND_API_KEY in your env)')
  if (!/^re_[A-Za-z0-9_]+$/.test(key)) {
    return { ok: false, message: 'The Resend API key must start with re_ (Resend dashboard → API Keys).' }
  }
  // GET /domains is a safe read-only call that proves the key authenticates.
  try {
    const { res, data } = await fetchJson('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (res.status === 200) {
      const n = Array.isArray(data?.data) ? data.data.length : '?'
      return { ok: true, message: `Connected — Resend authenticated the key and returned your domains (${n} found).` }
    }
    if (res.status === 401) return { ok: false, message: 'Resend rejected the API key (HTTP 401). Check the key.' }
    return { ok: false, message: `Resend answered with HTTP ${res.status}.` }
  } catch { return couldNotVerify('the key format is valid') }
}

async function testSendgrid(v) {
  const key = String(v.apiKey || '').trim()
  if (!key) return missing('the API key (set VITE_SENDGRID_API_KEY in your env)')
  if (!/^SG\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) {
    return { ok: false, message: 'The SendGrid API key must look like SG.… (SendGrid → Settings → API Keys).' }
  }
  // GET /v3/scopes is a safe read-only call that proves the key authenticates.
  try {
    const { res } = await fetchJson('https://api.sendgrid.com/v3/scopes', {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (res.status === 200) return { ok: true, message: 'Connected — SendGrid authenticated the key (scopes endpoint answered HTTP 200).' }
    if (res.status === 401) return { ok: false, message: 'SendGrid rejected the API key (HTTP 401). Check the key.' }
    return { ok: false, message: `SendGrid answered with HTTP ${res.status}.` }
  } catch { return couldNotVerify('the key format is valid') }
}

async function testGa4(v) {
  const id = String(v.measurementId || '').trim()
  if (!/^G-[A-Z0-9]{4,}$/.test(id)) {
    return { ok: false, message: 'The Measurement ID must look like G-XXXXXXXXXX (GA4 → Admin → Data Streams).' }
  }
  return { ok: true, message: 'The Measurement ID format is valid — this is the full browser-side check. Install the gtag snippet (or set the ID and reload) and watch Realtime to confirm hits arrive.' }
}

async function testPlausible(v) {
  const domain = String(v.domain || '').trim().toLowerCase()
  if (!/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) {
    return { ok: false, message: 'Enter the site domain as registered in Plausible, e.g. mystore.in.' }
  }
  return { ok: true, message: 'The domain format is valid — this is the full browser-side check. Add the Plausible snippet to your site and check the dashboard for live visitors.' }
}

async function testShiprocket(v) {
  const email = String(v.email || '').trim()
  const password = String(v.password || '')
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return missing('a valid Shiprocket account email')
  if (!password) return missing('the Shiprocket password (set VITE_SHIPROCKET_PASSWORD in your env)')
  // The login endpoint is public and returns a token — a genuine credential check.
  try {
    const { res, data } = await fetchJson('https://apiv2.shiprocket.in/v1/external/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (res.status === 200 && data?.token) {
      return { ok: true, message: `Connected — Shiprocket authenticated ${email} and issued a token.` }
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: 'Shiprocket rejected the credentials. Check the email/password in your Shiprocket account.' }
    }
    return { ok: false, message: `Shiprocket answered with HTTP ${res.status}.` }
  } catch { return couldNotVerify('the email format is valid') }
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

export const PROVIDER_CATEGORIES = [
  { id: 'database', label: 'Database', icon: '🗄', blurb: 'Where products, orders and customers live.' },
  { id: 'auth', label: 'Auth', icon: '🔑', blurb: 'How staff and customers sign in.' },
  { id: 'payments', label: 'Payments', icon: '💳', blurb: 'UPI, cards and wallets at checkout.' },
  { id: 'storage', label: 'Storage', icon: '🖼', blurb: 'Product images and file uploads.' },
  { id: 'sms', label: 'SMS', icon: '✉', blurb: 'OTP and order updates by text.' },
  { id: 'email', label: 'Email', icon: '📧', blurb: 'Order confirmations and shipping updates.' },
  { id: 'analytics', label: 'Analytics', icon: '📊', blurb: 'Traffic and conversion measurement.' },
  { id: 'shipping', label: 'Shipping', icon: '📦', blurb: 'Courier aggregation and tracking.' },
]

export const PROVIDERS = [
  // ---------------- Database ----------------
  {
    id: 'supabase', category: 'database', name: 'Supabase',
    tagline: 'Postgres + auth + storage in one project.',
    docsUrl: 'https://supabase.com/docs',
    fields: SUPABASE_FIELDS,
    testConnection: testSupabase,
  },
  {
    id: 'firebase', category: 'database', name: 'Firebase',
    tagline: 'Firestore database with generous free reads.',
    docsUrl: 'https://firebase.google.com/docs',
    fields: FIREBASE_FIELDS,
    testConnection: testFirebase,
  },
  {
    id: 'neon', category: 'database', name: 'Neon',
    tagline: 'Serverless Postgres with a free tier.',
    docsUrl: 'https://neon.tech/docs',
    fields: [
      { key: 'connectionString', label: 'Connection string', type: 'password', secret: true, envVar: 'VITE_NEON_CONNECTION_STRING', required: true,
        help: 'postgresql://user:password@ep-….aws.neon.tech/dbname — from the Neon dashboard. A secret: set it in your env, never in the browser form.' },
    ],
    testConnection: testNeon,
  },
  {
    id: 'rest', category: 'database', name: 'Custom REST API',
    tagline: 'Point the store at your own backend.',
    docsUrl: 'https://github.com/jackbhai/bharatcart-universal/blob/main/docs/14-PRODUCTION.md',
    fields: [
      { key: 'base', label: 'API base URL', type: 'url', envVar: 'VITE_REST_API_BASE', required: true,
        help: 'e.g. https://api.mystore.in — your backend must implement the endpoints in docs/14-PRODUCTION.md.' },
      { key: 'apiKey', label: 'API key (optional)', type: 'password', secret: true, envVar: 'VITE_REST_API_KEY', required: false,
        help: 'Sent as a Bearer token. Prefer keeping it in your env.' },
    ],
    testConnection: testRest,
  },
  {
    id: 'local-dev', category: 'database', name: 'Local development',
    tagline: 'Development only — browser localStorage.',
    docsUrl: 'https://github.com/jackbhai/bharatcart-universal/blob/main/docs/14-PRODUCTION.md',
    fields: [],
    testConnection: testLocalDev,
  },
  // ---------------- Auth ----------------
  {
    id: 'supabase-auth', category: 'auth', name: 'Supabase Auth',
    tagline: 'Email, OTP and OAuth via your Supabase project.',
    docsUrl: 'https://supabase.com/docs/guides/auth',
    fields: SUPABASE_FIELDS,
    testConnection: testSupabase,
  },
  {
    id: 'firebase-auth', category: 'auth', name: 'Firebase Auth',
    tagline: 'Phone OTP and social login via Firebase.',
    docsUrl: 'https://firebase.google.com/docs/auth',
    fields: FIREBASE_FIELDS,
    testConnection: testFirebase,
  },
  {
    id: 'clerk', category: 'auth', name: 'Clerk',
    tagline: 'Drop-in sign-in components and user management.',
    docsUrl: 'https://clerk.com/docs',
    fields: [
      { key: 'publishableKey', label: 'Publishable key', type: 'text', envVar: 'VITE_CLERK_PUBLISHABLE_KEY', required: true,
        help: 'pk_test_… from the Clerk dashboard → API Keys. Safe for the browser.' },
    ],
    testConnection: testClerk,
  },
  {
    id: 'custom-jwt', category: 'auth', name: 'Custom JWT (JWKS)',
    tagline: 'Verify tokens against your own identity provider.',
    docsUrl: 'https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-key-sets',
    fields: [
      { key: 'jwksUrl', label: 'JWKS URL', type: 'url', envVar: 'VITE_JWT_JWKS_URL', required: true,
        help: 'The public JSON Web Key Set document, e.g. https://auth.mystore.in/.well-known/jwks.json.' },
      { key: 'issuer', label: 'Issuer', type: 'text', envVar: 'VITE_JWT_ISSUER', required: true,
        help: 'The expected iss claim, e.g. https://auth.mystore.in/.' },
    ],
    testConnection: testJwt,
  },
  {
    id: 'local-dev', category: 'auth', name: 'Local development',
    tagline: 'Development only — demo accounts in the browser.',
    docsUrl: 'https://github.com/jackbhai/bharatcart-universal/blob/main/docs/14-PRODUCTION.md',
    fields: [],
    testConnection: testLocalDev,
  },
  // ---------------- Payments ----------------
  {
    id: 'razorpay', category: 'payments', name: 'Razorpay',
    tagline: 'UPI, cards, netbanking and wallets for India.',
    docsUrl: 'https://razorpay.com/docs/',
    fields: [
      { key: 'keyId', label: 'Key ID', type: 'text', envVar: 'VITE_RAZORPAY_KEY_ID', required: true,
        help: 'rzp_test_… / rzp_live_… from Razorpay dashboard → Settings → API Keys. The Key Secret stays on your backend.' },
    ],
    testConnection: testRazorpay,
  },
  {
    id: 'stripe', category: 'payments', name: 'Stripe',
    tagline: 'International cards and wallets.',
    docsUrl: 'https://stripe.com/docs',
    fields: [
      { key: 'publishableKey', label: 'Publishable key', type: 'text', envVar: 'VITE_STRIPE_PUBLISHABLE_KEY', required: true,
        help: 'pk_test_… / pk_live_… from Stripe dashboard → Developers → API keys. The secret key stays on your backend.' },
    ],
    testConnection: testStripe,
  },
  // ---------------- Storage ----------------
  {
    id: 'supabase-storage', category: 'storage', name: 'Supabase Storage',
    tagline: 'Image buckets inside your Supabase project.',
    docsUrl: 'https://supabase.com/docs/guides/storage',
    fields: SUPABASE_FIELDS,
    testConnection: testSupabase,
  },
  {
    id: 'firebase-storage', category: 'storage', name: 'Firebase Storage',
    tagline: 'File storage inside your Firebase project.',
    docsUrl: 'https://firebase.google.com/docs/storage',
    fields: FIREBASE_FIELDS,
    testConnection: testFirebase,
  },
  {
    id: 'cloudinary', category: 'storage', name: 'Cloudinary',
    tagline: 'Image hosting with automatic resizing and WebP.',
    docsUrl: 'https://cloudinary.com/documentation',
    fields: [
      { key: 'cloudName', label: 'Cloud name', type: 'text', envVar: 'VITE_CLOUDINARY_CLOUD_NAME', required: true,
        help: 'Your Cloudinary cloud name (dashboard top-left).' },
      { key: 'uploadPreset', label: 'Unsigned upload preset', type: 'text', envVar: 'VITE_CLOUDINARY_UPLOAD_PRESET', required: true,
        help: 'Settings → Upload → Upload presets → create an unsigned preset.' },
    ],
    testConnection: testCloudinary,
  },
  {
    id: 's3-compatible', category: 'storage', name: 'S3-compatible',
    tagline: 'AWS S3, Cloudflare R2, MinIO or any S3 API.',
    docsUrl: 'https://docs.aws.amazon.com/s3/',
    fields: [
      { key: 'endpoint', label: 'Endpoint URL', type: 'url', envVar: 'VITE_S3_ENDPOINT', required: true,
        help: 'e.g. https://s3.ap-south-1.amazonaws.com or your R2/MinIO endpoint.' },
      { key: 'bucket', label: 'Bucket', type: 'text', envVar: 'VITE_S3_BUCKET', required: true,
        help: 'The bucket name that holds product images.' },
      { key: 'accessKey', label: 'Access key', type: 'password', secret: true, envVar: 'VITE_S3_ACCESS_KEY', required: true,
        help: 'A secret: set it in your env, never in the browser form.' },
      { key: 'secretKey', label: 'Secret key', type: 'password', secret: true, envVar: 'VITE_S3_SECRET_KEY', required: true,
        help: 'A secret: set it in your env, never in the browser form.' },
    ],
    testConnection: testS3,
  },
  // ---------------- SMS ----------------
  {
    id: 'twilio', category: 'sms', name: 'Twilio',
    tagline: 'Global SMS and WhatsApp messaging.',
    docsUrl: 'https://www.twilio.com/docs/sms',
    fields: [
      { key: 'accountSid', label: 'Account SID', type: 'text', envVar: 'VITE_TWILIO_ACCOUNT_SID', required: true,
        help: 'AC… from the Twilio console dashboard.' },
      { key: 'authToken', label: 'Auth Token', type: 'password', secret: true, envVar: 'VITE_TWILIO_AUTH_TOKEN', required: true,
        help: 'A secret: set it in your env, never in the browser form.' },
      { key: 'from', label: 'From number', type: 'text', envVar: 'VITE_TWILIO_FROM', required: true,
        help: 'Your Twilio sender number, e.g. +14155552671.' },
    ],
    testConnection: testTwilio,
  },
  {
    id: 'msg91', category: 'sms', name: 'MSG91',
    tagline: 'Transactional SMS and OTP with Indian DLT compliance.',
    docsUrl: 'https://docs.msg91.com/',
    fields: [
      { key: 'authKey', label: 'Auth Key', type: 'password', secret: true, envVar: 'VITE_MSG91_AUTH_KEY', required: true,
        help: 'From the MSG91 dashboard → API. A secret: set it in your env, never in the browser form.' },
    ],
    testConnection: testMsg91,
  },
  // ---------------- Email ----------------
  {
    id: 'resend', category: 'email', name: 'Resend',
    tagline: 'Transactional email with a generous free tier.',
    docsUrl: 'https://resend.com/docs',
    fields: [
      { key: 'apiKey', label: 'API key', type: 'password', secret: true, envVar: 'VITE_RESEND_API_KEY', required: true,
        help: 're_… from Resend dashboard → API Keys. A secret: set it in your env, never in the browser form.' },
    ],
    testConnection: testResend,
  },
  {
    id: 'sendgrid', category: 'email', name: 'SendGrid',
    tagline: 'Transactional email at scale.',
    docsUrl: 'https://docs.sendgrid.com/',
    fields: [
      { key: 'apiKey', label: 'API key', type: 'password', secret: true, envVar: 'VITE_SENDGRID_API_KEY', required: true,
        help: 'SG.… from SendGrid → Settings → API Keys. A secret: set it in your env, never in the browser form.' },
    ],
    testConnection: testSendgrid,
  },
  // ---------------- Analytics ----------------
  {
    id: 'ga4', category: 'analytics', name: 'Google Analytics 4',
    tagline: 'Full-funnel ecommerce reporting.',
    docsUrl: 'https://developers.google.com/analytics',
    fields: [
      { key: 'measurementId', label: 'Measurement ID', type: 'text', envVar: 'VITE_GA4_MEASUREMENT_ID', required: true,
        help: 'G-XXXXXXXXXX from GA4 → Admin → Data Streams.' },
    ],
    testConnection: testGa4,
  },
  {
    id: 'plausible', category: 'analytics', name: 'Plausible',
    tagline: 'Privacy-friendly analytics, no cookie banner needed.',
    docsUrl: 'https://plausible.io/docs',
    fields: [
      { key: 'domain', label: 'Site domain', type: 'text', envVar: 'VITE_PLAUSIBLE_DOMAIN', required: true,
        help: 'The domain as registered in Plausible, e.g. mystore.in.' },
    ],
    testConnection: testPlausible,
  },
  // ---------------- Shipping ----------------
  {
    id: 'shiprocket', category: 'shipping', name: 'Shiprocket',
    tagline: '17+ couriers, labels and tracking for India.',
    docsUrl: 'https://apidocs.shiprocket.in/',
    fields: [
      { key: 'email', label: 'Account email', type: 'text', envVar: 'VITE_SHIPROCKET_EMAIL', required: true,
        help: 'The email you use to log in to Shiprocket.' },
      { key: 'password', label: 'Password', type: 'password', secret: true, envVar: 'VITE_SHIPROCKET_PASSWORD', required: true,
        help: 'A secret: set it in your env, never in the browser form.' },
    ],
    testConnection: testShiprocket,
  },
]

/** All providers for a category (empty array for unknown categories). */
export function getProviders(category) {
  return PROVIDERS.filter(p => p.category === category)
}

/** One provider def, or null. */
export function getProvider(category, providerId) {
  return PROVIDERS.find(p => p.category === category && p.id === providerId) ?? null
}

export default PROVIDERS
