/**
 * Part 9 — the storefront/admin split, the provider registry, and the
 * integrity layer.
 *
 * Each section here corresponds to a claim made to the user. Anything this
 * suite does not prove should not be described as done.
 */
import { JSDOM } from 'jsdom'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/*
 * Resolve paths relative to this file rather than hard-coding an absolute one.
 *
 * These suites originally used an absolute /home/... path, which worked only
 * on the machine they were written on. A fresh clone anywhere else loaded a
 * SECOND copy of React from the old absolute path, producing "Invalid hook
 * call / cannot read properties of null (reading 'useContext')" — an error
 * that points at React and has nothing to do with React.
 */
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SRC_DIR = resolve(ROOT, 'src')


const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true, url: 'http://localhost/',
})
global.window = dom.window
global.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true })
global.localStorage = dom.window.localStorage
global.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 16)
global.cancelAnimationFrame = clearTimeout
global.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} })
global.window.matchMedia = global.matchMedia
if (!global.structuredClone) global.structuredClone = v => JSON.parse(JSON.stringify(v))

let pass = 0, fail = 0
const ok = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ' · ' + detail : ''}`) }
}
const section = t => console.log(`\n── ${t}`)

const SRC = SRC_DIR
const stripComments = s => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

/* ============================================================ */
section('The storefront exposes no route into the admin panel')
{
  const app = stripComments(await readFile(`${SRC}/App.jsx`, 'utf8'))

  // The switcher used to be two-way and rendered on the shop as a floating
  // button. It is now admin-only and one-directional.
  ok('PanelSwitch no longer takes a mode', !/PanelSwitch\s*\(\s*\{\s*mode/.test(app))
  ok('PanelSwitch is not rendered inside ShopView', (() => {
    const shop = app.slice(app.indexOf('function ShopView'), app.indexOf('function ShopView') + 600)
    return !shop.includes('PanelSwitch')
  })())
  ok('the switcher only ever navigates to the shop', !/nav\(\s*['"]\/admin/.test(app.slice(app.indexOf('function PanelSwitch'), app.indexOf('function PanelSwitch') + 1200)))

  // The admin rail keeps its link back to the shop; that direction is safe.
  ok('the admin rail still links out to the storefront', app.includes('<PanelSwitch />'))

  for (const file of ['Storefront.jsx', 'Cart.jsx', 'Checkout.jsx', 'Account.jsx']) {
    const src = stripComments(await readFile(`${SRC}/shop/${file}`, 'utf8'))
    ok(`${file} contains no link to an /admin route`, !/['"]\/admin/.test(src))
    ok(`${file} shows the shopper no "Admin" label`, !/>[^<]*\bAdmin\b[^<]*</.test(src))
  }

  // The route itself must still exist - hiding the button is the point, not
  // removing access for staff who know the URL.
  ok('the /admin route is still registered', /path=["']\/admin/.test(app) || app.includes("'/admin"))
}

/* ============================================================ */
section('Provider registry covers every backend honestly')
{
  const P = await import(`${SRC}/auth/providers.js`)
  const { PROVIDERS, providersFor, oauthProvidersFor, supports, isFree, defaultEnabled } = P

  ok('the registry is populated', PROVIDERS.length >= 20, `${PROVIDERS.length} providers`)

  // Structural integrity: a malformed entry would render a broken button.
  const bad = PROVIDERS.filter(p => !p.id || !p.label || !p.kind || !Array.isArray(p.backends) || typeof p.free !== 'boolean')
  ok('every provider entry is well formed', bad.length === 0, bad.map(p => p.id).join(', '))

  const ids = PROVIDERS.map(p => p.id)
  ok('provider ids are unique', new Set(ids).size === ids.length)

  // Every provider must be performable by at least one real backend,
  // otherwise it is decoration.
  const orphan = PROVIDERS.filter(p => !p.backends.some(b => b !== 'local'))
  ok('no provider is local-only decoration', orphan.length === 0, orphan.map(p => p.id).join(', '))

  // The specific set the user asked for by name.
  for (const id of ['google', 'github', 'apple', 'facebook', 'twitter', 'discord', 'phone', 'anonymous', 'magic', 'password']) {
    ok(`"${id}" is in the registry`, ids.includes(id))
  }

  // The honesty requirement: paid things must not be advertised as free.
  ok('phone OTP is flagged as not free', !isFree('phone'))
  ok('phone explains why it costs money', /blaze|twilio|sms/i.test(P.PROVIDERS_BY_ID.phone.note || ''))
  ok('Apple sign-in is flagged as not free', !isFree('apple'))
  ok('custom OIDC/SAML is flagged as not free', !isFree('oidc'))
  ok('email/password is free', isFree('password'))
  ok('magic link is free', isFree('magic'))
  ok('anonymous is free', isFree('anonymous'))

  // Backend filtering must be real, not cosmetic.
  ok('Supabase advertises the widest provider list',
    providersFor('supabase').length > providersFor('firebase').length,
    `supabase=${providersFor('supabase').length} firebase=${providersFor('firebase').length}`)
  ok('Discord is not offered on Firebase', !supports('firebase', 'discord'))
  ok('Yahoo is not offered on Supabase', !supports('supabase', 'yahoo'))
  ok('Cloudflare does not claim anonymous sign-in', !supports('cloudflare', 'anonymous'))

  ok('oauthProvidersFor returns only oauth kinds',
    oauthProvidersFor('supabase').every(p => p.kind === 'oauth'))
  ok('the free-only filter excludes phone',
    !providersFor('supabase', { freeOnly: true }).some(p => p.id === 'phone'))
  ok('defaults are all free', defaultEnabled('supabase').every(id => isFree(id)))
  ok('defaults are all supported by that backend',
    defaultEnabled('firebase').every(id => supports('firebase', id)))
}

/* ============================================================ */
section('Enabled-provider persistence is backend aware')
{
  const P = await import(`${SRC}/auth/providers.js`)
  localStorage.clear()

  ok('an empty store falls back to the free defaults',
    P.readEnabled('supabase').length === P.defaultEnabled('supabase').length)

  // The scenario that would otherwise render a dead button: enable Discord on
  // Supabase, then switch the backend to Firebase, which cannot do Discord.
  P.writeEnabled(['google', 'discord'])
  const onFirebase = P.readEnabled('firebase')
  ok('a provider the new backend cannot perform is dropped', !onFirebase.includes('discord'))
  ok('a provider the new backend can perform is kept', onFirebase.includes('google'))

  // If filtering removes everything, fall back rather than show nothing.
  P.writeEnabled(['discord', 'gitlab'])
  ok('an empty result falls back to defaults instead of no buttons',
    P.readEnabled('firebase').length > 0)

  P.writeEnabled(['{{corrupt'])
  localStorage.setItem(P.ENABLED_KEY, 'not json at all')
  ok('corrupt storage does not throw', Array.isArray(P.readEnabled('supabase')))
  localStorage.clear()
}

/* ============================================================ */
section('Every adapter implements the auth contract it advertises')
{
  const backend = (await import(`${SRC}/backend/index.js`)).default
  const P = await import(`${SRC}/auth/providers.js`)

  ok('four backends are registered', backend.list.length === 4, backend.list.map(a => a.id).join(', '))

  for (const id of ['local', 'supabase', 'firebase', 'cloudflare']) {
    const a = backend.adapters[id]
    ok(`${id}: has an auth section`, !!a.auth)
    for (const method of ['signIn', 'signUp', 'signOut', 'getSession', 'getUser', 'signInWithOAuth']) {
      ok(`${id}: implements ${method}`, typeof a.auth[method] === 'function')
    }
    ok(`${id}: isConfigured is a function`, typeof a.isConfigured === 'function')
    ok(`${id}: implements the db contract`,
      ['list', 'get', 'insert', 'update', 'remove'].every(m => typeof a.db?.[m] === 'function'))
  }

  // Anonymous is claimed by three backends; each of those must implement it.
  for (const id of ['local', 'supabase', 'firebase']) {
    ok(`${id}: implements signInAnonymously as advertised`,
      P.supports(id, 'anonymous') === (typeof backend.adapters[id].auth.signInAnonymously === 'function'))
  }

  // Cloudflare does not claim anonymous, and its stub must fail clearly
  // rather than silently returning a fake session.
  const cfAnon = await backend.adapters.cloudflare.auth.signInAnonymously()
  ok('cloudflare anonymous fails with an explanation', !!cfAnon.error)
  ok('cloudflare anonymous names an alternative', /supabase|local|guest/i.test(cfAnon.error.message))

  const cfSignUp = await backend.adapters.cloudflare.auth.signUp({ email: 'a@b.c' })
  ok('cloudflare signUp explains that Access manages accounts', /access|policy/i.test(cfSignUp.error.message))
}

/* ============================================================ */
section('Local adapter can actually complete every flow it advertises')
{
  const local = (await import(`${SRC}/backend/adapters/local.js`)).default
  localStorage.clear()

  const email = `t${Date.now()}@bharatcart.in`
  const up = await local.auth.signUp({ email, password: 'secret123', name: 'Test' })
  ok('sign up succeeds', !up.error && !!up.data?.user, up.error?.message)
  ok('sign up returns a session', !!up.data?.session)

  await local.auth.signOut()
  const inBad = await local.auth.signIn({ email, password: 'wrong' })
  ok('a wrong password is rejected', !!inBad.error)
  const inGood = await local.auth.signIn({ email, password: 'secret123' })
  ok('the right password signs in', !inGood.error && !!inGood.data?.user)

  await local.auth.signOut()
  const anon = await local.auth.signInAnonymously()
  ok('guest sign-in works', !anon.error && !!anon.data?.user, anon.error?.message)
  ok('the guest is flagged anonymous', anon.data?.anonymous === true)
  ok('the guest still gets a usable session', !!anon.data?.session)

  await local.auth.signOut()
  const sent = await local.auth.signInWithOtp({ email })
  ok('an OTP can be requested', !sent.error && sent.data?.sent)
  const code = sent.data?.devToken
  ok('the demo surfaces the code so the flow is testable', !!code)
  const wrong = await local.auth.verifyOtp({ email, token: '000000' })
  ok('a wrong OTP is rejected', !!wrong.error)
  const right = await local.auth.verifyOtp({ email, token: code })
  ok('the right OTP signs in', !right.error && !!right.data?.user, right.error?.message)

  // Every social button in the UI must survive being pressed.
  const P = await import(`${SRC}/auth/providers.js`)
  for (const p of P.oauthProvidersFor('local')) {
    const r = await local.auth.signInWithOAuth({ provider: p.id })
    ok(`oauth "${p.id}" completes in demo mode`, !r.error && !!r.data?.user, r.error?.message)
  }
  localStorage.clear()
}

/* ============================================================ */
section('Integrity layer detects tampering')
{
  const I = await import(`${SRC}/core/security/integrity.js`)
  localStorage.clear()

  ok('hashing is deterministic', I.hash('abc') === I.hash('abc'))
  ok('different input hashes differently', I.hash('abc') !== I.hash('abd'))

  const sealed = I.seal({ role: 'customer', points: 10 })
  ok('a sealed value verifies', I.unseal(sealed).ok)
  ok('a sealed value round-trips', I.unseal(sealed).value.role === 'customer')

  // The attack: edit the value, keep the signature.
  const forged = { ...sealed, v: { role: 'owner', points: 999999 } }
  let caught = false
  const res = I.unseal(forged, { onTamper: () => { caught = true } })
  ok('an edited value fails verification', !res.ok)
  ok('the tamper callback fires', caught)
  ok('the forged value is not returned', res.value === null)

  // Price tampering, the realistic version.
  const catalogue = { P1: 1000, P2: 500 }
  const resolve = line => catalogue[line.productId]

  const honest = I.verifyCartPricing([{ productId: 'P1', qty: 2, price: 1000 }], resolve)
  ok('an honest cart passes', honest.ok)
  ok('an honest cart totals correctly', honest.trustedTotal === 2000, String(honest.trustedTotal))

  const hacked = I.verifyCartPricing([{ productId: 'P1', qty: 2, price: 1 }], resolve)
  ok('a discounted price is caught', !hacked.ok)
  ok('the mismatch names the product', hacked.issues[0].productId === 'P1')
  ok('the trusted total ignores the claimed price', hacked.trustedTotal === 2000, String(hacked.trustedTotal))
  ok('the claimed total is reported for the log', hacked.claimedTotal === 2, String(hacked.claimedTotal))

  const negQty = I.verifyCartPricing([{ productId: 'P1', qty: -5, price: 1000 }], resolve)
  ok('a negative quantity is caught', !negQty.ok)
  const fracQty = I.verifyCartPricing([{ productId: 'P2', qty: 1.5, price: 500 }], resolve)
  ok('a fractional quantity is caught', !fracQty.ok)

  // Amount bounds.
  ok('a negative payable is rejected', !I.verifyPayableAmount(-1).ok)
  ok('NaN is rejected', !I.verifyPayableAmount('abc').ok)
  ok('an absurd amount is rejected', !I.verifyPayableAmount(1e12).ok)
  ok('a normal amount passes', I.verifyPayableAmount(2499, { subtotal: 2999 }).ok)
  ok('a 99% discount is rejected', !I.verifyPayableAmount(10, { subtotal: 5000 }).ok)
  ok('the rejection says why', I.verifyPayableAmount(10, { subtotal: 5000 }).reason === 'discount_exceeds_limit')

  // Role claims.
  const localOwner = I.verifyRoleClaim({ role: 'owner' }, { backendId: 'local' })
  ok('a local owner claim is marked untrusted', localOwner.trusted === false)
  ok('the untrusted claim carries a warning', !!localOwner.warning)
  const serverOwner = I.verifyRoleClaim({ role: 'owner' }, { backendId: 'supabase', session: { access_token: 'x' } })
  ok('a server-backed owner claim is trusted', serverOwner.trusted === true)
  ok('a plain customer needs no verification', I.verifyRoleClaim({ role: 'customer' }, { backendId: 'local' }).trusted === true)

  // Logging.
  I.clearTamperLog()
  I.logTamper('test_event', { a: 1 })
  ok('a tamper event is logged', I.readTamperLog().length === 1)
  ok('the log records the kind', I.readTamperLog()[0].kind === 'test_event')
  ok('the log is timestamped', !!I.readTamperLog()[0].at)
  for (let i = 0; i < 60; i++) I.logTamper('flood', { i })
  ok('the log is capped', I.readTamperLog().length <= 50, String(I.readTamperLog().length))
  I.clearTamperLog()
  ok('the log can be cleared', I.readTamperLog().length === 0)

  // The posture summary must not overstate demo mode.
  const demo = I.securityPosture('local')
  ok('demo mode is not described as enforced', demo.enforced === false)
  ok('demo mode admits data is editable', /edit|browser/i.test(demo.headline))
  const real = I.securityPosture('supabase')
  ok('a real backend is described as enforced', real.enforced === true)
}

/* ============================================================ */
section('Checkout refuses a tampered cart')
{
  const shopState = await readFile(`${SRC}/shop/shopState.jsx`, 'utf8')
  ok('placeOrder imports the integrity layer', shopState.includes('verifyCartPricing'))
  ok('placeOrder re-derives prices from the catalogue', /resolvePrice\(product/.test(shopState))
  ok('a mismatch blocks the order', /integrity\.ok[\s\S]{0,400}return\s*\{\s*ok:\s*false/.test(shopState))
  ok('a mismatch is logged', shopState.includes("logTamper('cart_price_mismatch'"))
  ok('the final amount is bounds-checked', shopState.includes('verifyPayableAmount'))

  // The check must run before the order is built, not after.
  ok('the integrity gate precedes order construction',
    shopState.indexOf('verifyCartPricing') < shopState.indexOf("const id = 'BC'"))
}

/* ============================================================ */
section('Route transition cannot strand a page invisible')
{
  const wrap = stripComments(await readFile(`${SRC}/ui/RouteTransition.jsx`, 'utf8'))
  const app = stripComments(await readFile(`${SRC}/App.jsx`, 'utf8'))
  const css = await readFile(`${SRC}/index.css`, 'utf8')

  ok('admin routes use RouteTransition', app.includes('<RouteTransition'))
  ok('the old PageFade wrapper is gone from App', !app.includes('<PageFade'))
  ok('Suspense is the outer boundary', wrap.indexOf('<Suspense') < wrap.indexOf('<PageEnter'))
  ok('no AnimatePresence anywhere in the transition', !wrap.includes('AnimatePresence'))
  ok('opacity is not animated from JavaScript', !/initial=\{\{[^}]*opacity/.test(wrap))
  ok('the entrance is a CSS keyframe', css.includes('@keyframes route-enter'))
  ok('the keyframe ends fully opaque', /@keyframes route-enter\s*\{[\s\S]*?to\s*\{[^}]*opacity:\s*1/.test(css))
  ok('fill mode is both so it cannot rest transparent', /\.route-enter\s*\{[^}]*both/.test(css))
  ok('reduced motion disables it', css.includes('prefers-reduced-motion'))
}

/* ============================================================ */
section('Touch targets meet the 44px minimum')
{
  const auth = await readFile(`${SRC}/auth/AuthScreen.jsx`, 'utf8')
  ok('social buttons have a minimum height', auth.includes('min-h-[44px]'))
  ok('social buttons reflow to two columns on a phone', auth.includes('grid-cols-2'))
  ok('the provider list is not hardcoded', !/const OAUTH = \[/.test(auth))
  ok('the provider list comes from the registry', auth.includes('oauthProvidersFor'))
  ok('buttons are filtered by what the operator enabled', auth.includes('readEnabled'))
  ok('form buttons declare type to avoid stray submits', auth.includes('type="button"'))
}

console.log(`\n${pass} passed · ${fail} failed\n`)
if (fail) process.exitCode = 1
