/**
 * Supabase Auth provider — real GoTrue REST, no SDK dependency.
 *
 * Uses only the publishable anon key (safe for browsers). Sessions are
 * persisted in localStorage and the access token is refreshed silently with
 * the stored refresh token — the same persistence model as the official
 * Supabase browser client (see docs/17-AUTH.md for the security note).
 *
 * Roles: read from the user's app_metadata.role or user_metadata.role,
 * which the merchant sets in the Supabase dashboard / via the Admin API.
 * Mapped with mapCloudRole(): owner/admin/manager/staff -> back-office
 * access, everyone else -> customer.
 */
import { storage } from '../../../core/persist/storage.js'
import { AuthError, normaliseAuthUser, mapCloudRole, assertAuthProvider } from '../AuthProvider.js'

const SESSION_KEY = 'bc.auth.session.supabase-auth'
const listeners = new Set()

function readSession() {
  const s = storage.getJSON(SESSION_KEY, null)
  return s && typeof s === 'object' ? s : null
}
function writeSession(s) { storage.setJSON(SESSION_KEY, s) }
function clearSession() { storage.remove(SESSION_KEY) }
function emit(user) {
  for (const cb of [...listeners]) {
    try { cb(user) } catch (e) { console.error('[auth:supabase]', e) }
  }
}

function gotrueError(data, fallback) {
  const msg = data?.msg || data?.message || data?.error_description || fallback
  return new AuthError(msg, data?.code || 'supabase_auth_error')
}

function userFromGoTrue(gu) {
  const meta = { ...(gu?.app_metadata || {}), ...(gu?.user_metadata || {}) }
  return normaliseAuthUser({
    id: gu.id,
    email: gu.email,
    name: meta.full_name || meta.name || gu.email,
    role: mapCloudRole(meta.role),
    emailVerified: Boolean(gu.email_confirmed_at),
  })
}

/**
 * Factory. Pass credentials explicitly (tests, scripts) or use
 * createSupabaseAuthFromConfig() which reads the Integrations hub config.
 */
export function createSupabaseProvider({ url, anonKey } = {}) {
  url = String(url || '').trim().replace(/\/+$/, '')
  anonKey = String(anonKey || '').trim()

  function needConfig() {
    if (!url || !anonKey) {
      throw new AuthError(
        'Supabase Auth is selected but not configured. Add your Project URL and anon key in Admin → Integrations → Auth (or set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).',
        'not_configured'
      )
    }
  }

  async function call(path, { method = 'POST', body, token } = {}) {
    needConfig()
    let res, data = null
    try {
      res = await fetch(`${url}/auth/v1${path}`, {
        method,
        headers: {
          apikey: anonKey,
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      data = await res.json().catch(() => null)
    } catch {
      throw new AuthError('Could not reach your Supabase project. Check the Project URL and your network connection.', 'network_error')
    }
    if (!res.ok) throw gotrueError(data, `Supabase sign-in failed (HTTP ${res.status})`)
    return data
  }

  function persist(data) {
    const user = userFromGoTrue(data.user)
    const session = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      user,
    }
    writeSession(session)
    emit(user)
    return user
  }

  async function refresh() {
    const s = readSession()
    if (!s?.refreshToken) return null
    try {
      const data = await call('/token?grant_type=refresh_token', { body: { refresh_token: s.refreshToken } })
      return persist(data)
    } catch {
      clearSession()
      emit(null)
      return null
    }
  }

  const provider = {
    id: 'supabase-auth',
    label: 'Supabase Auth',

    async signUp({ name, email, password } = {}) {
      const data = await call('/signup', { body: { email, password, data: { name, full_name: name } } })
      // With "confirm email" on, GoTrue returns a user but no session.
      if (!data.access_token) {
        throw new AuthError(
          'Account created — check your email for the confirmation link, then sign in.',
          'email_confirmation_required'
        )
      }
      return persist(data)
    },

    async signIn({ email, password } = {}) {
      const data = await call('/token?grant_type=password', { body: { email, password } })
      return persist(data)
    },

    async signOut() {
      const s = readSession()
      if (s?.accessToken) {
        try { await call('/logout', { token: s.accessToken }) } catch { /* session is cleared regardless */ }
      }
      clearSession()
      emit(null)
    },

    async getSession() {
      const s = readSession()
      if (!s) return null
      if (s.expiresAt && s.expiresAt > Date.now() + 30_000) return s.user
      // Access token expired (or nearly): try the refresh token once.
      return refresh()
    },

    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }

  assertAuthProvider(provider, 'supabase-auth')
  return provider
}
