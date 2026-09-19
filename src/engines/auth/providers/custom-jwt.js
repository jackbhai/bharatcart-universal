/**
 * Custom JWT (JWKS) provider.
 *
 * For merchants who run their own identity provider (Auth0, Keycloak,
 * Zitadel, a home-grown auth server…). The merchant's login flow issues a
 * JWT; this provider VERIFIES it in the browser against the provider's
 * public JWKS document using WebCrypto — a real RS256 signature check, not
 * a decode-and-trust.
 *
 * Supported: RS256 tokens whose `kid` matches a key in the JWKS document,
 * with a valid `exp` and (optionally) matching `iss`.
 *
 * Honest limits, stated plainly:
 * - Only RS256. HS256 is refused on purpose: it needs the shared secret,
 *   and secrets must never enter the browser.
 * - signIn({ email, password }) cannot exist here — we have no login
 *   endpoint. The merchant's own login page (or their backend) produces
 *   the token; the user pastes it, or the merchant wires their page to
 *   hand it over (see docs/17-AUTH.md). We say this instead of faking it.
 * - Browser verification is a genuine cryptographic check, but the final
 *   trust decision for sensitive operations belongs on the merchant's
 *   backend, which must verify the token again server-side.
 *
 * The verified token is the session: it is stored in localStorage so a
 * reload keeps the user signed in, and re-verified (signature + expiry)
 * on every getSession(). See docs/17-AUTH.md for the security note.
 */
import { storage } from '../../../core/persist/storage.js'
import { AuthError, normaliseAuthUser, mapCloudRole, assertAuthProvider } from '../AuthProvider.js'

const SESSION_KEY = 'bc.auth.session.custom-jwt'
const listeners = new Set()

function emit(user) {
  for (const cb of [...listeners]) {
    try { cb(user) } catch (e) { console.error('[auth:custom-jwt]', e) }
  }
}

function b64urlDecodeToBytes(seg) {
  const b64 = seg.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = (typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('binary'))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function b64urlDecodeToJson(seg) {
  const bytes = b64urlDecodeToBytes(seg)
  const text = typeof TextDecoder === 'function'
    ? new TextDecoder().decode(bytes)
    : Buffer.from(bytes).toString('utf8')
  return JSON.parse(text)
}

async function fetchJwks(jwksUrl) {
  let res, data
  try {
    res = await fetch(jwksUrl)
    data = await res.json().catch(() => null)
  } catch {
    throw new AuthError('Could not fetch the JWKS document. Check the JWKS URL and your network connection.', 'network_error')
  }
  if (!res.ok || !Array.isArray(data?.keys) || data.keys.length === 0) {
    throw new AuthError('The JWKS URL did not return a usable key set (expected JSON with a "keys" array).', 'bad_jwks')
  }
  return data.keys
}

/**
 * Real RS256 verification with WebCrypto. Throws AuthError on any failure.
 * Exported for tests.
 */
export async function verifyRs256Token(token, { jwksUrl, issuer } = {}) {
  const parts = String(token || '').trim().split('.')
  if (parts.length !== 3) throw new AuthError('That does not look like a JWT (expected three dot-separated parts).', 'bad_token')
  const [h64, p64, s64] = parts

  let header, claims
  try { header = b64urlDecodeToJson(h64); claims = b64urlDecodeToJson(p64) }
  catch { throw new AuthError('The token could not be decoded — it may be corrupted.', 'bad_token') }

  if (header.alg === 'HS256' || header.alg === 'HS384' || header.alg === 'HS512') {
    throw new AuthError(
      'HMAC-signed tokens (HS256) are not accepted here: verifying them needs the shared secret, which must stay on your backend. Use RS256.',
      'unsupported_alg'
    )
  }
  if (header.alg !== 'RS256') {
    throw new AuthError(`Only RS256 tokens are supported (this token uses ${header.alg || 'no alg'}).`, 'unsupported_alg')
  }

  const keys = await fetchJwks(jwksUrl)
  const jwk = (header.kid && keys.find(k => k.kid === header.kid && k.kty === 'RSA'))
    || keys.find(k => k.kty === 'RSA')
  if (!jwk) throw new AuthError('No RSA key in the JWKS document matches this token.', 'unknown_kid')

  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new AuthError('WebCrypto is not available in this browser, so the token cannot be verified.', 'no_crypto')

  // Full WebCrypto algorithm form — the JWA short name 'RS256' is not a
  // valid WebCrypto identifier in every browser.
  const ALG = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
  let key
  try {
    key = await subtle.importKey('jwk', jwk, ALG, false, ['verify'])
  } catch {
    throw new AuthError('The matching JWKS key could not be imported for verification.', 'bad_jwk')
  }
  const data = new TextEncoder().encode(`${h64}.${p64}`)
  const signature = b64urlDecodeToBytes(s64)
  let valid = false
  try { valid = await subtle.verify(ALG, key, signature, data) } catch { valid = false }
  if (!valid) throw new AuthError('Token signature did not verify against the JWKS document.', 'bad_signature')

  if (claims.exp && claims.exp * 1000 < Date.now()) {
    throw new AuthError('This token has expired. Sign in again to get a fresh one.', 'token_expired')
  }
  if (issuer && claims.iss !== issuer) {
    throw new AuthError(`Token issuer "${claims.iss || 'missing'}" does not match the configured issuer.`, 'bad_issuer')
  }
  return claims
}

function userFromClaims(claims) {
  return normaliseAuthUser({
    id: claims.sub,
    email: claims.email,
    name: claims.name || claims.preferred_username || claims.email,
    role: mapCloudRole(claims.role || claims['https://bharatcart/role'] || claims['bc_role']),
    emailVerified: claims.email_verified ?? true,
  })
}

/** Factory. */
export function createJwtProvider({ jwksUrl, issuer } = {}) {
  jwksUrl = String(jwksUrl || '').trim()
  issuer = String(issuer || '').trim()

  function needConfig() {
    if (!jwksUrl) {
      throw new AuthError(
        'Custom JWT is selected but not configured. Add your JWKS URL in Admin → Integrations → Auth (or set VITE_JWT_JWKS_URL).',
        'not_configured'
      )
    }
  }

  const provider = {
    id: 'custom-jwt',
    label: 'Custom JWT (JWKS)',

    /** The real flow: verify a token issued by the merchant's IdP. */
    async signIn({ token, email, password } = {}) {
      needConfig()
      if (!token && (email || password)) {
        throw new AuthError(
          'This store uses your own identity provider: sign in on its login page and paste the JWT it issues (see docs/17-AUTH.md). Email + password cannot be verified from here.',
          'token_required'
        )
      }
      if (!token) throw new AuthError('Paste the JWT your identity provider issued.', 'token_required')
      const claims = await verifyRs256Token(token, { jwksUrl, issuer })
      const user = userFromClaims(claims)
      storage.setJSON(SESSION_KEY, { token, user })
      emit(user)
      return user
    },

    async signUp() {
      throw new AuthError(
        'Accounts are created in your identity provider, not here. Create the account there, then sign in with its token.',
        'unsupported'
      )
    },

    async signOut() {
      storage.remove(SESSION_KEY)
      emit(null)
    },

    async getSession() {
      needConfig()
      const s = storage.getJSON(SESSION_KEY, null)
      if (!s?.token) return null
      try {
        const claims = await verifyRs256Token(s.token, { jwksUrl, issuer })
        const user = userFromClaims(claims)
        storage.setJSON(SESSION_KEY, { token: s.token, user })
        return user
      } catch {
        // Expired or tampered -> the session is over. Say so honestly.
        storage.remove(SESSION_KEY)
        emit(null)
        return null
      }
    },

    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }

  assertAuthProvider(provider, 'custom-jwt')
  return provider
}
