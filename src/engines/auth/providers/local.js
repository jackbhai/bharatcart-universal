/**
 * Local-dev auth provider.
 *
 * Wraps the existing local backend adapter (src/backend/adapters/local.js),
 * which stores hashed passwords + sessions in the browser. Clearly labelled
 * "Development only" in the Integrations hub — the login UI shows an honest
 * notice whenever this provider is active, so it is never mistaken for a
 * production identity service.
 *
 * SECURITY INVARIANT (preserved from the adapter): the first-ever account
 * created becomes the store OWNER (so the setup wizard can bootstrap the
 * admin); every account after that is forced to CUSTOMER. A public signup
 * can never self-promote to staff/owner — the requested role is ignored.
 */
import localBackend from '../../../backend/adapters/local.js'
import { AuthError, normaliseAuthUser, assertAuthProvider } from '../AuthProvider.js'

const auth = localBackend.auth

function toUser(result, what) {
  if (result?.error) throw new AuthError(result.error.message || `${what} failed`, result.error.code || 'auth_error')
  const u = result?.data?.user
  if (!u) throw new AuthError(`${what} did not return a user`, 'bad_response')
  return normaliseAuthUser(u)
}

const provider = {
  id: 'local-dev',
  label: 'Local development',

  async signIn({ email, password } = {}) {
    return toUser(await auth.signIn({ email, password }), 'Sign in')
  },

  async signUp({ name, email, password } = {}) {
    // role is intentionally not forwarded — see the invariant above.
    return toUser(await auth.signUp({ name, email, password }), 'Sign up')
  },

  async signOut() {
    await auth.signOut()
  },

  async getSession() {
    const res = await auth.getSession()
    const u = res?.data?.session?.user
    return u ? normaliseAuthUser(u) : null
  },

  onAuthChange(cb) {
    // Adapter emits (event, session); the interface wants (user | null).
    return auth.onAuthStateChange((_event, session) => {
      try { cb(session?.user ? normaliseAuthUser(session.user) : null) } catch (e) { console.error('[auth:local]', e) }
    })
  },

  /* ---- local-only extras: OAuth / OTP / reset / guest, kept for dev ---- */
  async signInWithOAuth(p) {
    const r = await auth.signInWithOAuth(p)
    return toUser(r, 'Social sign-in')
  },
  async signInWithOtp(p) {
    const r = await auth.signInWithOtp(p)
    if (r?.error) throw new AuthError(r.error.message || 'Could not send code', r.error.code || 'otp_error')
    return r.data
  },
  async verifyOtp(p) {
    return toUser(await auth.verifyOtp(p), 'Code verification')
  },
  async resetPassword(p) {
    const r = await auth.resetPassword(p)
    if (r?.error) throw new AuthError(r.error.message || 'Reset failed', r.error.code || 'reset_error')
    return r.data
  },
  async signInAnonymously() {
    return toUser(await auth.signInAnonymously(), 'Guest sign-in')
  },
  async updateUser(p) {
    const r = await auth.updateUser(p)
    const user = toUser(r, 'Profile update')
    return user
  },
}

assertAuthProvider(provider, 'local-dev')
export default provider
