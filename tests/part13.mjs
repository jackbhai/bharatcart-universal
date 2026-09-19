/**
 * Part 13 — real auth system tests.
 *
 * Covers the AuthProvider interface contract, role mapping, the local-dev
 * provider (including the first-user-becomes-OWNER invariant), provider
 * selection/fallback in src/engines/auth/index.js, and every cloud provider
 * with mocked fetch / injected fakes — no real network.
 * Run: npx vite-node tests/part13.mjs
 */
import { storage } from '../src/core/persist/storage.js'
import { ROLES } from '../src/backend/types.js'
import {
  AuthError, mapCloudRole, normaliseAuthUser, assertAuthProvider,
} from '../src/engines/auth/AuthProvider.js'
import localProvider from '../src/engines/auth/providers/local.js'
import { createSupabaseProvider } from '../src/engines/auth/providers/supabase.js'
import { createFirebaseProvider } from '../src/engines/auth/providers/firebase.js'
import { createClerkProvider, __setClerkModule } from '../src/engines/auth/providers/clerk.js'
import { createJwtProvider, verifyRs256Token } from '../src/engines/auth/providers/custom-jwt.js'
import {
  getAuth, getAuthInfo, refreshAuth,
} from '../src/engines/auth/index.js'
import {
  setIntegrationConfig, clearIntegration,
} from '../src/engines/integrations/store.js'

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++ } else { fail++; console.log('  ✗', name, extra) }
}
const throwsAuthError = async (name, fn, code) => {
  try {
    await fn()
    ok(name, false, 'did not throw')
  } catch (e) {
    ok(name, e instanceof AuthError && (!code || e.code === code), `got ${e?.constructor?.name}:${e?.code} ${e?.message}`)
  }
}

function resetAuthStorage() {
  for (const k of storage.keys('bharatcart:auth')) storage.remove(k)
  for (const k of storage.keys('bc.auth')) storage.remove(k)
  for (const k of storage.keys('bc.integrations')) storage.remove(k)
  refreshAuth()
}

/* ---------------- fetch mock ---------------- */
const realFetch = globalThis.fetch
let routes = []
function mockFetch(fn) { globalThis.fetch = fn }
function restoreFetch() { globalThis.fetch = realFetch }
const jsonRes = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data })

/* ================================================================ A: contract */
ok('assertAuthProvider accepts the local provider', assertAuthProvider(localProvider, 'local') === true)
ok('assertAuthProvider accepts all factories',
  [createSupabaseProvider({ url: 'https://x.supabase.co', anonKey: 'k' }),
   createFirebaseProvider({ apiKey: 'k' }),
   createClerkProvider({ publishableKey: 'pk_test_x' }),
   createJwtProvider({ jwksUrl: 'https://x/.well-known/jwks.json' })]
    .every(p => assertAuthProvider(p) === true))
await throwsAuthError('assertAuthProvider rejects a non-provider', async () => assertAuthProvider({}, 'bad'), 'bad_provider')

ok('mapCloudRole owner->owner', mapCloudRole('owner') === ROLES.OWNER)
ok('mapCloudRole Admin->admin', mapCloudRole('Admin') === ROLES.ADMIN)
ok('mapCloudRole manager->manager', mapCloudRole('manager') === ROLES.MANAGER)
ok('mapCloudRole staff/support->staff', mapCloudRole('staff') === ROLES.STAFF && mapCloudRole('support') === ROLES.STAFF)
ok('mapCloudRole unknown->customer', mapCloudRole('member') === ROLES.CUSTOMER && mapCloudRole('shopper') === ROLES.CUSTOMER)
ok('mapCloudRole empty->customer', mapCloudRole() === ROLES.CUSTOMER)
ok('normaliseAuthUser defaults role to customer', normaliseAuthUser({ id: '1', email: 'a@b.c' }).role === ROLES.CUSTOMER)
await throwsAuthError('normaliseAuthUser requires an id', async () => normaliseAuthUser({ email: 'a@b.c' }), 'bad_user')

/* ================================================================ B: local provider */
resetAuthStorage()
const first = await localProvider.signUp({ name: 'First Owner', email: 'owner@shop.in', password: 'secret12' })
ok('local: first-ever signup becomes OWNER', first.role === ROLES.OWNER, first.role)
const second = await localProvider.signUp({ name: 'Shopper', email: 'shop@shop.in', password: 'secret12', role: 'admin' })
ok('local: later signup forced to CUSTOMER even when role requested', second.role === ROLES.CUSTOMER, second.role)
await throwsAuthError('local: duplicate email rejected', () => localProvider.signUp({ email: 'shop@shop.in', password: 'secret12' }), 'user_exists')
await throwsAuthError('local: wrong password rejected', () => localProvider.signIn({ email: 'shop@shop.in', password: 'nope' }), 'invalid_credentials')
await throwsAuthError('local: unknown email rejected', () => localProvider.signIn({ email: 'nobody@x.in', password: 'secret12' }), 'user_not_found')
const back = await localProvider.signIn({ email: 'shop@shop.in', password: 'secret12' })
ok('local: signIn returns the user', back.email === 'shop@shop.in' && back.id === second.id)
const restored = await localProvider.getSession()
ok('local: session restores (reload)', restored && restored.id === second.id)

let events = []
const unsub = localProvider.onAuthChange(u => events.push(u ? u.id : null))
await new Promise(r => setTimeout(r, 0)) // let the adapter's SESSION_RESTORED replay flush
events = []
await localProvider.signOut()
ok('local: signOut emits null', events.length === 1 && events[0] === null)
ok('local: session gone after signOut', (await localProvider.getSession()) === null)
unsub()
await localProvider.signIn({ email: 'shop@shop.in', password: 'secret12' })
ok('local: unsubscribe stops events', events.length === 1)
await localProvider.signOut()

/* ================================================================ C: selection */
resetAuthStorage()
clearIntegration('auth')
let info = getAuthInfo()
ok('select: nothing configured -> local-dev', info.providerId === 'local-dev' && info.isCloud === false)
ok('select: getAuth falls back to local provider', getAuth().id === 'local-dev')
setIntegrationConfig('auth', 'local-dev', {})
info = getAuthInfo()
ok('select: explicit local-dev is not misconfigured', info.providerId === 'local-dev' && info.misconfigured === false)

setIntegrationConfig('auth', 'supabase-auth', { url: 'https://xyz.supabase.co' })
info = getAuthInfo()
ok('select: supabase-auth chosen, isCloud', info.providerId === 'supabase-auth' && info.isCloud === true)
ok('select: supabase-auth without anon key is misconfigured', info.misconfigured === true)
ok('select: misconfigured cloud falls back to local-dev', getAuth().id === 'local-dev')
refreshAuth()
ok('select: refreshAuth keeps fallback', getAuth().id === 'local-dev')
clearIntegration('auth')
refreshAuth()

/* ================================================================ D: supabase (mocked) */
const sbUser = { id: 'sb-1', email: 'admin@shop.in', email_confirmed_at: '2024-01-01', user_metadata: { role: 'admin', full_name: 'Admin' } }
const sbSession = { access_token: 'acc1', refresh_token: 'ref1', expires_in: 3600, user: sbUser }
mockFetch(async (url, opts) => {
  const u = String(url)
  if (u.includes('/token?grant_type=password')) {
    const body = JSON.parse(opts.body)
    return body.password === 'right'
      ? jsonRes(sbSession)
      : jsonRes({ msg: 'Invalid login credentials' }, 400)
  }
  if (u.includes('/token?grant_type=refresh_token')) return jsonRes({ ...sbSession, access_token: 'acc2' })
  if (u.includes('/signup')) return jsonRes({ user: sbUser }) // no session -> email confirmation on
  if (u.includes('/logout')) return jsonRes({})
  return jsonRes({}, 404)
})
const sb = createSupabaseProvider({ url: 'https://xyz.supabase.co', anonKey: 'anon' })
const sbIn = await sb.signIn({ email: 'admin@shop.in', password: 'right' })
ok('supabase: signIn maps admin role', sbIn.role === ROLES.ADMIN && sbIn.id === 'sb-1', sbIn.role)
await throwsAuthError('supabase: bad password -> honest AuthError', () => sb.signIn({ email: 'admin@shop.in', password: 'wrong' }))
await throwsAuthError('supabase: signup without session -> confirm email', () => sb.signUp({ email: 'n@n.in', password: 'secret12' }), 'email_confirmation_required')
ok('supabase: session restores', (await sb.getSession())?.id === 'sb-1')

// expire the access token -> refresh flow must run
const stored = storage.getJSON('bc.auth.session.supabase-auth')
storage.setJSON('bc.auth.session.supabase-auth', { ...stored, expiresAt: Date.now() - 1000 })
const refreshed = await sb.getSession()
ok('supabase: expired access token refreshes silently', refreshed && refreshed.id === 'sb-1')

events = []
const sbUnsub = sb.onAuthChange(u => events.push(u ? 'in' : 'out'))
await sb.signOut()
ok('supabase: signOut clears + emits', events[0] === 'out' && (await sb.getSession()) === null)
sbUnsub()
await throwsAuthError('supabase: missing config -> honest error', () => createSupabaseProvider({}).signIn({ email: 'a@b.c', password: 'x' }), 'not_configured')
restoreFetch()

/* ================================================================ E: firebase (mocked) */
mockFetch(async (url, opts) => {
  const u = String(url)
  let body = {}
  try { body = opts.body ? JSON.parse(opts.body) : {} } catch { body = {} }
  if (u.includes('accounts:signInWithPassword')) {
    return body.password === 'right'
      ? jsonRes({ idToken: 'id1', refreshToken: 'rf1', expiresIn: '3600', localId: 'fb-1', email: body.email, displayName: 'Fb User' })
      : jsonRes({ error: { message: 'INVALID_PASSWORD' } }, 400)
  }
  if (u.includes('accounts:signUp')) {
    return jsonRes({ idToken: 'id2', refreshToken: 'rf2', expiresIn: '3600', localId: 'fb-2', email: body.email, displayName: body.displayName })
  }
  if (u.includes('accounts:lookup')) {
    return jsonRes({ users: [{ customAttributes: JSON.stringify({ role: 'manager' }) }] })
  }
  if (u.includes('securetoken')) {
    return jsonRes({ id_token: 'id3', refresh_token: 'rf3', expires_in: '3600', user_id: 'fb-1' })
  }
  return jsonRes({}, 404)
})
const fb = createFirebaseProvider({ apiKey: 'webkey' })
const fbUp = await fb.signUp({ name: 'Newbie', email: 'new@shop.in', password: 'secret12' })
ok('firebase: signUp maps manager custom claim', fbUp.role === ROLES.MANAGER && fbUp.id === 'fb-2', fbUp.role)
await throwsAuthError('firebase: wrong password -> friendly message', () => fb.signIn({ email: 'a@b.c', password: 'wrong' }))
try {
  await fb.signIn({ email: 'a@b.c', password: 'wrong' })
} catch (e) {
  ok('firebase: error message is human-readable', /incorrect password/i.test(e.message), e.message)
}
const fbStored = storage.getJSON('bc.auth.session.firebase-auth')
storage.setJSON('bc.auth.session.firebase-auth', { ...fbStored, expiresAt: Date.now() - 1000 })
const fbRef = await fb.getSession()
ok('firebase: expired id token refreshes via securetoken', fbRef && fbRef.id === 'fb-1')
await fb.signOut()
ok('firebase: signOut clears session', (await fb.getSession()) === null)
await throwsAuthError('firebase: missing config -> honest error', () => createFirebaseProvider({}).signIn({ email: 'a@b.c', password: 'x' }), 'not_configured')
restoreFetch()

/* ================================================================ F: custom JWT (real WebCrypto) */
const subtle = globalThis.crypto.subtle
const kp = await subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, true, ['sign', 'verify'])
const pubJwk = await subtle.exportKey('jwk', kp.publicKey)
pubJwk.kid = 'test-key-1'
const JWKS_URL = 'https://auth.shop.in/.well-known/jwks.json'
const ISSUER = 'https://auth.shop.in/'
const b64u = (input) => {
  const buf = typeof input === 'string' ? Buffer.from(input)
    : Buffer.isBuffer(input) ? input
    : input instanceof ArrayBuffer ? Buffer.from(new Uint8Array(input))
    : ArrayBuffer.isView(input) ? Buffer.from(input.buffer, input.byteOffset, input.byteLength)
    : Buffer.from(JSON.stringify(input))
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function signToken(claims, { kid = 'test-key-1', alg = 'RS256' } = {}) {
  const h = b64u({ alg, typ: 'JWT', kid })
  const p = b64u(claims)
  const data = new TextEncoder().encode(`${h}.${p}`)
  const sig = await subtle.sign({ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, kp.privateKey, data)
  return `${h}.${p}.${b64u(Buffer.from(sig))}`
}
mockFetch(async (url) => {
  if (String(url) === JWKS_URL) return jsonRes({ keys: [pubJwk] })
  return jsonRes({}, 404)
})
const jwt = createJwtProvider({ jwksUrl: JWKS_URL, issuer: ISSUER })
const goodClaims = { sub: 'jwt-1', email: 'vip@shop.in', name: 'VIP', role: 'staff', iss: ISSUER, exp: Math.floor(Date.now() / 1000) + 3600 }
const goodToken = await signToken(goodClaims)
const jwtUser = await jwt.signIn({ token: goodToken })
ok('jwt: valid RS256 token verifies -> staff user', jwtUser.id === 'jwt-1' && jwtUser.role === ROLES.STAFF, jwtUser.role)
ok('jwt: session restores via re-verification', (await jwt.getSession())?.id === 'jwt-1')

const tampered = goodToken.slice(0, -4) + 'AAAA'
await throwsAuthError('jwt: tampered signature rejected', () => verifyRs256Token(tampered, { jwksUrl: JWKS_URL, issuer: ISSUER }), 'bad_signature')

const hsToken = b64u({ alg: 'HS256', typ: 'JWT' }) + '.' + b64u({ sub: 'x' }) + '.sig'
await throwsAuthError('jwt: HS256 refused honestly', () => jwt.signIn({ token: hsToken }), 'unsupported_alg')

const expiredToken = await signToken({ ...goodClaims, exp: Math.floor(Date.now() / 1000) - 10 })
await throwsAuthError('jwt: expired token rejected', () => jwt.signIn({ token: expiredToken }), 'token_expired')

const wrongIss = await signToken({ ...goodClaims, iss: 'https://evil.example/' })
await throwsAuthError('jwt: wrong issuer rejected', () => jwt.signIn({ token: wrongIss }), 'bad_issuer')

await throwsAuthError('jwt: email+password -> honest token_required', () => jwt.signIn({ email: 'a@b.c', password: 'x' }), 'token_required')
await throwsAuthError('jwt: signUp unsupported, honestly', () => jwt.signUp({ email: 'a@b.c', password: 'x' }), 'unsupported')

events = []
const jwtUnsub = jwt.onAuthChange(u => events.push(u ? 'in' : 'out'))
await jwt.signOut()
ok('jwt: signOut clears + emits', events[0] === 'out' && (await jwt.getSession()) === null)
jwtUnsub()
restoreFetch()

/* ================================================================ G: clerk (injected fake) */
const fakeUser = {
  id: 'clerk-1',
  primaryEmailAddress: { emailAddress: 'cl@shop.in', verification: { status: 'verified' } },
  emailAddresses: [],
  firstName: 'Cl', lastName: 'Erk', fullName: 'Cl Erk',
  publicMetadata: { role: 'staff' },
}
const fakeClerk = {
  __bcAttached: false,
  _listener: null,
  client: {
    signIn: { create: async ({ identifier }) => {
      if (identifier === 'mfa@shop.in') return { status: 'needs_second_factor' }
      if (identifier === 'bad@shop.in') { const e = new Error('x'); e.errors = [{ message: 'Invalid credentials' }]; throw e }
      return { status: 'complete', createdSessionId: 'sess-1' }
    } },
  },
  user: fakeUser,
  session: { id: 'sess-1' },
  signOutCalled: false,
  async load() {},
  async setActive() { this.session = { id: 'sess-1' } },
  async signOut() { this.signOutCalled = true; this.session = null; this._listener?.({ session: null }) },
  addListener(cb) { this._listener = cb; return () => { this._listener = null } },
}
__setClerkModule(fakeClerk)
const ck = createClerkProvider({ publishableKey: 'pk_test_abc' })
const ckIn = await ck.signIn({ email: 'cl@shop.in', password: 'secret12' })
ok('clerk: signIn maps staff role', ckIn.role === ROLES.STAFF && ckIn.id === 'clerk-1', ckIn.role)
await throwsAuthError('clerk: MFA step reported honestly', () => ck.signIn({ email: 'mfa@shop.in', password: 'x' }), 'verification_required')
await throwsAuthError('clerk: bad credentials surface provider message', () => ck.signIn({ email: 'bad@shop.in', password: 'x' }))
try { await ck.signIn({ email: 'bad@shop.in', password: 'x' }) } catch (e) {
  ok('clerk: provider error message preserved', e.message === 'Invalid credentials', e.message)
}
ok('clerk: getSession returns user while session active', (await ck.getSession())?.id === 'clerk-1')
events = []
const ckUnsub = ck.onAuthChange(u => events.push(u ? 'in' : 'out'))
await ck.signOut()
ok('clerk: signOut calls SDK + emits', fakeClerk.signOutCalled && events[0] === 'out')
fakeClerk.session = null
ok('clerk: getSession null when no session', (await ck.getSession()) === null)
ckUnsub()
__setClerkModule(null)
await throwsAuthError('clerk: bad key format rejected', () => createClerkProvider({ publishableKey: 'nope' }).signIn({ email: 'a@b.c', password: 'x' }), 'bad_key')

resetAuthStorage()

console.log(`\npart13: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
