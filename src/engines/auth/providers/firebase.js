/**
 * Firebase Auth provider — real Identity Toolkit REST, no SDK dependency.
 *
 * Uses only the Web API key (publishable, safe for browsers). Sessions are
 * persisted in localStorage and the ID token is refreshed silently with the
 * stored refresh token — the same persistence model as the official Firebase
 * browser SDK (see docs/17-AUTH.md for the security note).
 *
 * Roles: read from the user's custom claims (`role`), which the merchant
 * sets with the Firebase Admin SDK on their backend. Best-effort lookup via
 * accounts:lookup; if claims can't be read the user is a customer.
 * Mapped with mapCloudRole().
 */
import { storage } from '../../../core/persist/storage.js'
import { AuthError, normaliseAuthUser, mapCloudRole, assertAuthProvider } from '../AuthProvider.js'

const SESSION_KEY = 'bc.auth.session.firebase-auth'
const listeners = new Set()

function readSession() {
  const s = storage.getJSON(SESSION_KEY, null)
  return s && typeof s === 'object' ? s : null
}
function writeSession(s) { storage.setJSON(SESSION_KEY, s) }
function clearSession() { storage.remove(SESSION_KEY) }
function emit(user) {
  for (const cb of [...listeners]) {
    try { cb(user) } catch (e) { console.error('[auth:firebase]', e) }
  }
}

function toolkitError(data, fallback) {
  const msg = data?.error?.message || fallback
  // Identity Toolkit returns SCREAMING_SNAKE codes; make them human.
  const friendly = {
    EMAIL_EXISTS: 'An account with this email already exists.',
    EMAIL_NOT_FOUND: 'No account found with this email.',
    INVALID_PASSWORD: 'Incorrect password.',
    INVALID_LOGIN_CREDENTIALS: 'Incorrect email or password.',
    USER_DISABLED: 'This account has been disabled.',
    WEAK_PASSWORD: 'Password must be at least 6 characters.',
    OPERATION_NOT_ALLOWED: 'Email/password sign-in is not enabled for this Firebase project. Enable it in Authentication → Sign-in method.',
  }[msg] || msg?.replace(/_/g, ' ').toLowerCase()
  return new AuthError(friendly || fallback, 'firebase_auth_error')
}

/** Decode the middle segment of a JWT without verifying (display fields only). */
function decodePayload(idToken) {
  try {
    const seg = String(idToken).split('.')[1] || ''
    const b64 = seg.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const bin = typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('binary')
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch { return {} }
}

/** Factory. Pass credentials explicitly, or let index.js resolve them. */
export function createFirebaseProvider({ apiKey } = {}) {
  apiKey = String(apiKey || '').trim()

  function needConfig() {
    if (!apiKey) {
      throw new AuthError(
        'Firebase Auth is selected but not configured. Add your Web API key in Admin → Integrations → Auth (or set VITE_FIREBASE_API_KEY).',
        'not_configured'
      )
    }
  }

  async function toolkit(path, body) {
    needConfig()
    let res, data = null
    try {
      res = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnSecureToken: true, ...body }),
      })
      data = await res.json().catch(() => null)
    } catch {
      throw new AuthError('Could not reach Firebase Authentication. Check your network connection.', 'network_error')
    }
    if (!res.ok) throw toolkitError(data, `Firebase sign-in failed (HTTP ${res.status})`)
    return data
  }

  /** Best-effort custom-claims role lookup. Never blocks sign-in. */
  async function lookupRole(idToken) {
    try {
      const data = await toolkit('accounts:lookup', { idToken })
      const attrs = data?.users?.[0]?.customAttributes
      if (attrs) {
        const parsed = JSON.parse(attrs)
        return parsed.role || null
      }
    } catch { /* claims unreadable -> customer */ }
    return null
  }

  async function persist(data) {
    const claims = decodePayload(data.idToken)
    const role = await lookupRole(data.idToken)
    const user = normaliseAuthUser({
      id: data.localId || claims.user_id || claims.sub,
      email: data.email || claims.email,
      name: data.displayName || claims.name,
      role: mapCloudRole(role),
      emailVerified: data.emailVerified ?? claims.email_verified ?? false,
    })
    const session = {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + (Number(data.expiresIn) || 3600) * 1000,
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
      needConfig()
      const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(s.refreshToken)}`,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw toolkitError(data, 'Session refresh failed')
      // securetoken speaks snake_case; persist() speaks camelCase.
      return persist({
        idToken: data.id_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        localId: data.user_id,
      })
    } catch {
      clearSession()
      emit(null)
      return null
    }
  }

  const provider = {
    id: 'firebase-auth',
    label: 'Firebase Auth',

    async signUp({ name, email, password } = {}) {
      const data = await toolkit('accounts:signUp', { email, password, displayName: name })
      return persist(data)
    },

    async signIn({ email, password } = {}) {
      const data = await toolkit('accounts:signInWithPassword', { email, password })
      return persist(data)
    },

    async signOut() {
      clearSession()
      emit(null)
    },

    async getSession() {
      const s = readSession()
      if (!s) return null
      if (s.expiresAt && s.expiresAt > Date.now() + 30_000) return s.user
      return refresh()
    },

    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }

  assertAuthProvider(provider, 'firebase-auth')
  return provider
}
