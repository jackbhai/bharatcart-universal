/**
 * AuthProvider interface.
 *
 * Every auth provider in `src/engines/auth/providers/` implements this exact
 * contract, so the app never knows which identity service is behind sign-in.
 * The merchant picks the provider in Admin → Integrations → Auth; see
 * `src/engines/auth/index.js` (`getAuth()`).
 *
 * All methods are async. Success returns the documented value; failure
 * THROWS an AuthError with an honest, human-readable message. Nothing here
 * ever pretends a login succeeded.
 *
 *   signIn({ email, password })  -> Promise<User>
 *       Sign in with email + password. Throws AuthError on bad credentials.
 *       (The custom-jwt provider instead accepts { token } — see its docs.)
 *
 *   signUp({ name, email, password }) -> Promise<User>
 *       Create an account and sign in. The requested role is deliberately
 *       ignored by every provider: a public signup can never self-promote.
 *       The merchant assigns staff roles inside the provider's own dashboard
 *       (Supabase / Firebase / Clerk) or, for local dev, the first-ever
 *       account becomes the store owner.
 *
 *   signOut() -> Promise<void>
 *       End the session everywhere this provider tracks it.
 *
 *   getSession() -> Promise<User | null>
 *       Restore the persisted session (page reload). Returns null when there
 *       is no session or it has expired. Cloud providers refresh the access
 *       token silently when a valid refresh token is stored.
 *
 *   onAuthChange(cb) -> unsubscribe
 *       cb receives the new User, or null on sign-out / expiry.
 *       Returns a function that removes the listener.
 *
 * User shape:
 *   { id, name, email, role, emailVerified? }
 * where role is one of the ROLES values from src/backend/types.js.
 *
 * SECURITY NOTES (also in docs/17-AUTH.md):
 * - Provider SDKs (and our REST providers) persist session tokens in
 *   localStorage so a reload keeps you signed in. That matches what the
 *   official Supabase/Firebase/Clerk browser SDKs do. Access/refresh tokens
 *   are bearer tokens: anyone with the device can use them, so treat a
 *   signed-in browser like a signed-in browser. For higher assurance the
 *   merchant should move sessions to httpOnly cookies on their own backend.
 * - Secrets (service_role keys, client secrets, JWKS private keys) NEVER
 *   belong in the browser. Providers only ever use publishable keys and
 *   public JWKS documents.
 */
import { ROLES } from '../../backend/types.js'

/** Thrown by every AuthProvider method on failure. Never a fake success. */
export class AuthError extends Error {
  constructor(message, code = 'auth_error') {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}

/**
 * Map a role string coming from a cloud identity provider to our roles.
 *
 * The merchant owns role assignment inside the provider's dashboard
 * (Supabase user_metadata/app_metadata, Firebase custom claims, Clerk
 * publicMetadata). We only need a coarse mapping for back-office access:
 * owner -> owner, admin -> admin, anything staff-like -> staff, everyone
 * else -> customer. Fine-grained permissions still come from
 * src/auth/rbac.jsx + the people permission templates.
 */
export function mapCloudRole(raw) {
  const r = String(raw ?? '').trim().toLowerCase()
  if (r === 'owner' || r === 'superowner') return ROLES.OWNER
  if (['admin', 'administrator', 'superadmin'].includes(r)) return ROLES.ADMIN
  if (['manager', 'staff', 'editor', 'support', 'ops', 'finance', 'merchandiser', 'viewer'].includes(r)) {
    return r === 'manager' ? ROLES.MANAGER : ROLES.STAFF
  }
  // Unknown or absent roles (including Clerk's default org "member") are
  // shoppers. Staff access is granted explicitly by the merchant, never
  // by default.
  return ROLES.CUSTOMER
}

/** Build the canonical User object from provider-specific fields. */
export function normaliseAuthUser({ id, name, email, role, emailVerified = false }) {
  if (!id) throw new AuthError('Identity provider returned a user without an id', 'bad_user')
  return {
    id: String(id),
    name: name || (email ? String(email).split('@')[0] : 'User'),
    email: email ? String(email).toLowerCase() : null,
    role: Object.values(ROLES).includes(role) ? role : ROLES.CUSTOMER,
    emailVerified: Boolean(emailVerified),
  }
}

/**
 * Runtime check used by tests (and getAuth) to guarantee every provider
 * honours the interface. Throws if a method is missing or mis-shaped.
 */
export function assertAuthProvider(p, label = 'provider') {
  for (const m of ['signIn', 'signUp', 'signOut', 'getSession', 'onAuthChange']) {
    if (typeof p?.[m] !== 'function') {
      throw new AuthError(`${label} does not implement AuthProvider.${m}()`, 'bad_provider')
    }
  }
  return true
}

export { ROLES }
