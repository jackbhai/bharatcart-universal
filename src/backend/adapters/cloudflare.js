/**
 * Cloudflare adapter — Workers + D1 + KV + R2, with Cloudflare Access
 * (Zero Trust) handling identity.
 *
 * This one works differently from Supabase and Firebase, and the difference
 * is worth understanding before using it.
 *
 * Supabase and Firebase are client-side SDKs: the browser talks to them
 * directly with a public key. Cloudflare has no such SDK. Identity is handled
 * by Cloudflare Access, which sits IN FRONT of your Worker as a reverse proxy.
 * By the time a request reaches your code the user is already authenticated,
 * and Access passes the identity down as a signed JWT header. The browser
 * never performs the login itself; it simply gets redirected to Cloudflare's
 * login page and back.
 *
 * What that means in practice:
 *
 *   - `signIn` here does not take a password. It sends the user to the Access
 *     login page. Which providers appear on that page (Google, GitHub, Apple,
 *     one-time PIN by email, and so on) is configured in the Zero Trust
 *     dashboard, not in this file.
 *
 *   - Reading the current user is a GET to `/cdn-cgi/access/get-identity`,
 *     an endpoint Cloudflare injects. No key needed.
 *
 *   - Data operations go to your own Worker routes. There is no generic
 *     client SDK, so `db` maps the standard contract onto REST calls against
 *     a base URL you configure. The Worker template is documented in
 *     ARCHITECTURE.md.
 *
 * Free tier: Cloudflare Access is free for up to 50 users, Workers gives
 * 100,000 requests/day, D1 gives 5 GB of storage and 5 million reads/day.
 * That is comfortably enough for a shop of this size.
 */
import { ok, fail, normaliseUser, ROLES } from '../types.js'
import storage from '../../core/persist/storage.js'

const CFG_KEY = 'bharatcart:backend:cloudflare'

export function getConfig() {
  const saved = storage.getJSON(CFG_KEY, {})
  return {
    // Base URL of your Worker, e.g. https://shop-api.yourname.workers.dev
    apiUrl: saved.apiUrl || import.meta.env?.VITE_CF_API_URL || '',
    // Your Zero Trust team domain, e.g. yourteam.cloudflareaccess.com
    teamDomain: saved.teamDomain || import.meta.env?.VITE_CF_TEAM_DOMAIN || '',
  }
}

export function setConfig(cfg) {
  storage.setJSON(CFG_KEY, {
    apiUrl: (cfg.apiUrl || '').trim().replace(/\/$/, ''),
    teamDomain: (cfg.teamDomain || '').trim().replace(/^https?:\/\//, ''),
  })
}

function isConfigured() {
  const { apiUrl } = getConfig()
  return Boolean(apiUrl)
}

/** Every call funnels through here so a network failure never throws. */
async function req(path, { method = 'GET', body, headers } = {}) {
  const { apiUrl } = getConfig()
  if (!apiUrl) {
    return fail('Cloudflare is not configured. Add your Worker URL in Settings → Backend.', 'not_configured')
  }
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      method,
      // Access identity travels as a cookie, so credentials must be included.
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch { json = { raw: text } }

    if (res.status === 401 || res.status === 302) {
      return fail('Not signed in with Cloudflare Access.', 'unauthenticated')
    }
    if (!res.ok) {
      return fail(json?.error || json?.message || `Request failed (${res.status})`, `http_${res.status}`)
    }
    return ok(json)
  } catch (err) {
    return fail(err?.message || 'Cloudflare request failed', 'network_error')
  }
}

const auth = {
  /**
   * Access owns the login UI, so there is nothing to submit. Redirect and let
   * Cloudflare present whichever providers the operator enabled.
   */
  signIn: async () => {
    const { apiUrl } = getConfig()
    if (!apiUrl) return fail('Cloudflare is not configured.', 'not_configured')
    if (typeof window !== 'undefined') {
      const back = encodeURIComponent(window.location.href)
      window.location.href = `${apiUrl}/cdn-cgi/access/login?redirect_url=${back}`
    }
    return ok({ redirecting: true })
  },

  // Account creation is governed by the Access policy (who is allowed in),
  // not by the application. Saying so is more useful than a generic error.
  signUp: async () => fail(
    'Cloudflare Access does not create accounts from the app. Add the email to your Zero Trust access policy, then sign in.',
    'managed_externally'
  ),

  // The provider choice lives on Cloudflare's login page, so every provider
  // funnels through the same redirect.
  signInWithOAuth: async () => auth.signIn(),

  // One-time PIN is a built-in Access login method, again on their page.
  signInWithOtp: async () => auth.signIn(),
  verifyOtp: async () => fail(
    'Cloudflare Access verifies one-time PINs on its own login page.',
    'managed_externally'
  ),
  signInAnonymously: async () => fail(
    'Cloudflare Access requires an identity — anonymous sessions are not supported. Use the local or Supabase backend for guest checkout.',
    'unsupported'
  ),

  signOut: async () => {
    const { apiUrl } = getConfig()
    if (typeof window !== 'undefined' && apiUrl) {
      window.location.href = `${apiUrl}/cdn-cgi/access/logout`
    }
    return { error: null }
  },

  /**
   * Cloudflare injects this endpoint on any Access-protected hostname and
   * returns the signed-in identity.
   */
  getUser: async () => {
    const res = await req('/cdn-cgi/access/get-identity')
    if (res.error) return res
    const raw = res.data || {}
    return ok({
      user: normaliseUser({
        id: raw.user_uuid || raw.id || raw.email,
        email: raw.email,
        name: raw.name || raw.given_name || (raw.email || '').split('@')[0],
        // Access groups are the natural place to express staff roles.
        role: mapRole(raw.groups),
      }),
    })
  },

  getSession: async () => {
    const res = await auth.getUser()
    if (res.error) return ok({ session: null })
    return ok({ session: res.data.user ? { user: res.data.user } : null })
  },

  /**
   * There is no push channel for Access identity, so this polls. The interval
   * is deliberately slow: identity only changes when someone logs in or out,
   * and each check is a request against the free-tier quota.
   */
  onAuthStateChange(cb) {
    let last = null
    let alive = true
    const tick = async () => {
      if (!alive) return
      const { data } = await auth.getSession()
      const id = data?.session?.user?.id || null
      if (id !== last) {
        last = id
        cb(id ? 'SIGNED_IN' : 'SIGNED_OUT', data?.session || null)
      }
    }
    tick()
    const timer = setInterval(tick, 60_000)
    return () => { alive = false; clearInterval(timer) }
  },

  resetPassword: async () => fail(
    'Passwords are managed by your identity provider, not by Cloudflare Access.',
    'managed_externally'
  ),

  updateUser: async ({ data }) => req('/api/me', { method: 'PATCH', body: data }),
}

/** Access group names mapped onto application roles. */
function mapRole(groups) {
  const names = (groups || []).map(g => String(g.name || g).toLowerCase())
  if (names.some(n => n.includes('owner'))) return ROLES.OWNER
  if (names.some(n => n.includes('admin'))) return ROLES.ADMIN
  if (names.some(n => n.includes('manager'))) return ROLES.MANAGER
  if (names.some(n => n.includes('staff'))) return ROLES.STAFF
  return ROLES.CUSTOMER
}

/**
 * D1 through your Worker. The contract is identical to the other adapters, so
 * nothing upstream changes; only the transport differs.
 */
const db = {
  list: async (table, { filter, sort, limit, offset } = {}) => {
    const qs = new URLSearchParams()
    if (filter) qs.set('filter', JSON.stringify(filter))
    if (sort) qs.set('sort', JSON.stringify(sort))
    if (limit != null) qs.set('limit', String(limit))
    if (offset != null) qs.set('offset', String(offset))
    const res = await req(`/api/${table}?${qs}`)
    if (res.error) return res
    return ok(res.data?.rows || res.data || [], { count: res.data?.count })
  },
  get: (table, id) => req(`/api/${table}/${encodeURIComponent(id)}`),
  insert: (table, row) => req(`/api/${table}`, { method: 'POST', body: row }),
  update: (table, id, patch) => req(`/api/${table}/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }),
  remove: (table, id) => req(`/api/${table}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  upsert: (table, rows) => req(`/api/${table}/upsert`, { method: 'POST', body: { rows } }),
  count: async (table, filter) => {
    const res = await req(`/api/${table}/count?filter=${encodeURIComponent(JSON.stringify(filter || {}))}`)
    if (res.error) return res
    return { count: res.data?.count ?? 0, error: null }
  },
}

/** R2 object storage, again proxied by the Worker so no keys reach the browser. */
const cfStorage = {
  upload: async (bucket, path, file) => {
    const { apiUrl } = getConfig()
    if (!apiUrl) return fail('Cloudflare is not configured.', 'not_configured')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${apiUrl}/api/storage/${bucket}/${encodeURIComponent(path)}`, {
        method: 'PUT', credentials: 'include', body: form,
      })
      if (!res.ok) return fail(`Upload failed (${res.status})`, `http_${res.status}`)
      return ok({ path, url: cfStorage.getUrl(bucket, path) })
    } catch (err) {
      return fail(err?.message || 'Upload failed', 'network_error')
    }
  },
  getUrl: (bucket, path) => {
    const { apiUrl } = getConfig()
    return `${apiUrl}/api/storage/${bucket}/${encodeURIComponent(path)}`
  },
  remove: (bucket, path) => req(`/api/storage/${bucket}/${encodeURIComponent(path)}`, { method: 'DELETE' }),
}

/**
 * Durable Objects can push over WebSocket. If the Worker does not expose one,
 * this degrades to no-op rather than breaking the caller.
 */
const realtime = {
  subscribe(table, cb) {
    const { apiUrl } = getConfig()
    if (!apiUrl || typeof WebSocket === 'undefined') return () => {}
    let ws
    try {
      ws = new WebSocket(`${apiUrl.replace(/^http/, 'ws')}/api/realtime/${table}`)
      ws.onmessage = e => {
        try { cb(JSON.parse(e.data)) } catch { /* ignore malformed frame */ }
      }
    } catch {
      return () => {}
    }
    return () => { try { ws?.close() } catch { /* already closed */ } }
  },
}

export default {
  id: 'cloudflare',
  label: 'Cloudflare',
  description: 'Workers + D1 + R2, with Cloudflare Access for identity. Free for up to 50 users.',
  isConfigured,
  getConfig,
  setConfig,
  auth,
  db,
  storage: cfStorage,
  realtime,
}
