/**
 * Headless render + interaction test harness.
 * Run:  npx vite-node tests/render.mjs
 */
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true, url: 'http://localhost/',
})
global.window = dom.window
global.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true })
global.HTMLElement = dom.window.HTMLElement
global.Element = dom.window.Element
global.Node = dom.window.Node
global.requestAnimationFrame = cb => setTimeout(cb, 0)
global.cancelAnimationFrame = clearTimeout
global.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} })
global.window.matchMedia = global.matchMedia
global.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} }
global.window.ResizeObserver = global.ResizeObserver
global.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} }
global.window.IntersectionObserver = global.IntersectionObserver
for (const k of ['SVGElement','SVGSVGElement','SVGGraphicsElement','DOMRect','DOMRectReadOnly',
  'MutationObserver','CSS','getComputedStyle','Event','CustomEvent','KeyboardEvent','MouseEvent',
  'HTMLInputElement','HTMLSelectElement','HTMLButtonElement','HTMLCanvasElement','Image',
  'DocumentFragment','NodeList','XMLSerializer','Blob','URL','File']) {
  if (dom.window[k] !== undefined) global[k] = dom.window[k]
}
// jsdom needs its OWN AbortSignal for addEventListener({ signal })
global.AbortController = dom.window.AbortController
global.AbortSignal = dom.window.AbortSignal
global.FileReader = dom.window.FileReader
global.localStorage = dom.window.localStorage
// Fresh installs redirect /admin to the setup wizard; opt out so the App
// mounts below exercise the real screens instead of the first-run gate.
dom.window.localStorage.setItem('bharatcart_setup_done', '1')
if (!global.structuredClone) global.structuredClone = (v) => JSON.parse(JSON.stringify(v))

const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { act } = await import('react')
const { HashRouter } = await import('react-router-dom')

const Dashboard = (await import('../src/admin/Dashboard.jsx')).default
const Customers = (await import('../src/admin/Customers.jsx')).default
const M = await import('../src/admin/Modules.jsx')
const ThemeStudio = (await import('../src/admin/theme/ThemeStudio.jsx')).default
const BackendSettings = (await import('../src/admin/settings/BackendSettings.jsx')).default
const AuthScreen = (await import('../src/auth/AuthScreen.jsx')).default
const App = (await import('../src/App.jsx')).default
const store = (await import('../src/core/store/index.js')).default
const { TEMPLATES } = await import('../src/theme/templates/index.js')

const errs = []
const origErr = console.error
console.error = (...a) => { errs.push(a.join(' ')) }

const IGNORE = /not wrapped in act|ReactDOMTestUtils|testing environment is not configured|Future Flag|Not implemented: navigation/

let pass = 0, fail = 0

async function mount(name, el) {
  const before = errs.length
  const host = document.createElement('div'); document.body.appendChild(host)
  try {
    const root = createRoot(host)
    await act(async () => { root.render(React.createElement(HashRouter, null, el)) })
    const html = host.innerHTML || ''
    const txt = host.textContent || ''
    const newErrs = errs.slice(before).filter(e => !IGNORE.test(e))
    if (newErrs.length) { fail++; origErr('WARN · ' + name); newErrs.slice(0,2).forEach(e => origErr('      ↳ ' + e.slice(0,200))) }
    else { pass++; origErr('PASS · ' + name + ' · ' + html.length + ' chars DOM, ' + txt.length + ' text') }
    return { host, root }
  } catch (e) {
    fail++
    origErr('FAIL · ' + name + ' · ' + e.message)
    return null
  }
}

origErr('=== SCREENS ===')
await mount('Dashboard', React.createElement(Dashboard, { go: () => {} }))
// The customer seed ships empty: the list renders its zero-profile state,
// and opening a 360 for an unknown id must not crash.
await mount('Customers list (empty)', React.createElement(Customers, { focusId: null }))
await mount('Customer 360 (unknown id)', React.createElement(Customers, { focusId: 'no-such-customer' }))
await mount('Orders', React.createElement(M.Orders))
await mount('Catalogue', React.createElement(M.Catalogue))
await mount('Marketing', React.createElement(M.Marketing))
await mount('Operations', React.createElement(M.Operations))
await mount('Theme Studio', React.createElement(ThemeStudio))
await mount('Backend Settings', React.createElement(BackendSettings))
await mount('Auth screen', React.createElement(AuthScreen))
await mount('App shell', React.createElement(App))
window.location.hash = '#/shop'
await mount('Storefront (via route)', React.createElement(App))
window.location.hash = '#/admin/theme'
await mount('Theme Studio (via route)', React.createElement(App))
window.location.hash = '#/admin/dashboard'

/* ---------------------------------------------------- store & theme logic */
origErr('')
origErr('=== STORE / THEME ENGINE ===')

function check(name, cond, detail = '') {
  if (cond) { pass++; origErr('PASS · ' + name + (detail ? ' · ' + detail : '')) }
  else { fail++; origErr('FAIL · ' + name + (detail ? ' · ' + detail : '')) }
}

// template application
for (const tpl of TEMPLATES) {
  store.dispatch('theme/applyTemplate', tpl.id)
  const t = store.get('theme')
  check(`template "${tpl.name}"`, t.templateId === tpl.id && t.tokens.primary === tpl.tokens.primary,
    t.tokens.primary)
}

// token override + reset
store.dispatch('theme/applyTemplate', 'glass-aurora')
store.dispatch('theme/setToken', { key: 'primary', value: '#FF0000' })
check('token override applies', store.get('theme').tokens.primary === '#FF0000')
check('override is tracked', 'primary' in store.get('theme').overrides)
store.dispatch('theme/resetToken', 'primary')
check('token reset restores template value', store.get('theme').tokens.primary === '#6366F1')
check('override cleared', !('primary' in store.get('theme').overrides))

// header/footer builders
const navBefore = store.get('theme').header.nav.length
store.dispatch('theme/addNavItem', { label: 'Test', href: '#/x' })
check('nav item added', store.get('theme').header.nav.length === navBefore + 1)
const added = store.get('theme').header.nav.at(-1)
store.dispatch('theme/updateNavItem', { id: added.id, patch: { label: 'Renamed' } })
check('nav item updated', store.get('theme').header.nav.at(-1).label === 'Renamed')
store.dispatch('theme/reorderNav', { from: navBefore, to: 0 })
check('nav reorder works', store.get('theme').header.nav[0].label === 'Renamed')
store.dispatch('theme/removeNavItem', store.get('theme').header.nav[0].id)
check('nav item removed', store.get('theme').header.nav.length === navBefore)

const colBefore = store.get('theme').footer.columns.length
store.dispatch('theme/addFooterColumn')
check('footer column added', store.get('theme').footer.columns.length === colBefore + 1)
const col = store.get('theme').footer.columns.at(-1)
store.dispatch('theme/addFooterLink', { columnId: col.id, link: { label: 'L' } })
check('footer link added', store.get('theme').footer.columns.at(-1).links.length === 1)
store.dispatch('theme/removeFooterColumn', col.id)
check('footer column removed', store.get('theme').footer.columns.length === colBefore)

// custom themes
store.dispatch('theme/setToken', { key: 'primary', value: '#123456' })
store.dispatch('theme/saveCustomTheme', 'Test Theme')
const saved = store.get('theme').customThemes.at(-1)
check('custom theme saved', saved?.name === 'Test Theme' && saved.tokens.primary === '#123456')
store.dispatch('theme/applyTemplate', 'minimal-muji')
store.dispatch('theme/applyCustomTheme', saved.id)
check('custom theme re-applied', store.get('theme').tokens.primary === '#123456')
store.dispatch('theme/deleteCustomTheme', saved.id)
check('custom theme deleted', !store.get('theme').customThemes.find(c => c.id === saved.id))

// settings slice drives behaviour
store.dispatch('settings/toggleFlag', 'cod')
const codOff = store.get('settings').featureFlags.cod
store.dispatch('settings/toggleFlag', 'cod')
check('feature flag toggles', codOff !== store.get('settings').featureFlags.cod)
store.dispatch('settings/setCheckout', { freeShippingAbove: 1499 })
check('checkout config persists', store.get('settings').checkout.freeShippingAbove === 1499)

// ui slice
store.dispatch('ui/toast', { message: 'hello', type: 'success' })
check('toast queued', store.get('ui').toasts.length === 1)
store.dispatch('ui/dismissToast', store.get('ui').toasts[0].id)
check('toast dismissed', store.get('ui').toasts.length === 0)

// persistence round-trip
store.flush()
const raw = localStorage.getItem('bharatcart:state:v1')
check('state persisted to localStorage', Boolean(raw) && raw.includes('theme'))
const parsed = JSON.parse(raw)
check('persist envelope versioned', parsed.__v === 1 && parsed.data?.theme)
check('auth slice NOT persisted', !parsed.data.auth)

/* ------------------------------------------------------------- backend */
origErr('')
origErr('=== BACKEND ADAPTERS ===')
const backend = (await import('../src/backend/index.js')).default

check('all four adapters registered', backend.list.length === 4, backend.list.map(a => a.id).join(', '))
for (const id of ['local', 'supabase', 'firebase', 'cloudflare']) {
  check(`${id} adapter is registered`, backend.list.some(a => a.id === id))
}
check('local is configured by default', backend.list.find(a => a.id === 'local').configured)
check('active defaults to local', backend.id === 'local')

// No seeded users: the first account created becomes the owner.
const up = await backend.auth.signUp({ email: 'test@x.com', password: 'secret123', name: 'Test' })
check('signUp succeeds', !up.error && up.data.user.email === 'test@x.com')
check('first signup becomes the owner', up.data.user.role === 'owner')
check('session created', Boolean(up.data.session?.access_token))

const second = await backend.auth.signUp({ email: 'second@x.com', password: 'secret123', name: 'Second' })
check('second signup is a customer', !second.error && second.data.user.role === 'customer')

const dup = await backend.auth.signUp({ email: 'test@x.com', password: 'secret123' })
check('duplicate signup rejected', dup.error?.code === 'user_exists')

const weak = await backend.auth.signUp({ email: 'a@b.com', password: '123' })
check('weak password rejected', weak.error?.code === 'weak_password')

await backend.auth.signOut()
const sess = await backend.auth.getSession()
check('signOut clears session', !sess.data.session)

const bad = await backend.auth.signIn({ email: 'test@x.com', password: 'wrong' })
check('wrong password rejected', bad.error?.code === 'invalid_credentials')

const good = await backend.auth.signIn({ email: 'test@x.com', password: 'secret123' })
check('signIn with correct password', !good.error && good.data.user.email === 'test@x.com')
check('owner keeps the owner role on sign-in', good.data.user.role === 'owner')

const oauth = await backend.auth.signInWithOAuth({ provider: 'google' })
check('OAuth simulation', !oauth.error && oauth.data.user.email.includes('google'))

const otpReq = await backend.auth.signInWithOtp({ email: 'otp@x.com' })
check('OTP requested', !otpReq.error && otpReq.data.devToken)
const otpBad = await backend.auth.verifyOtp({ email: 'otp@x.com', token: '000000' })
check('wrong OTP rejected', otpBad.error?.code === 'otp_invalid')
const otpOk = await backend.auth.verifyOtp({ email: 'otp@x.com', token: otpReq.data.devToken })
check('correct OTP accepted', !otpOk.error && otpOk.data.user.email === 'otp@x.com')

// db CRUD
await backend.db.insert('widgets', { id: 'w1', name: 'Alpha', qty: 5 })
await backend.db.insert('widgets', { id: 'w2', name: 'Beta', qty: 12 })
const all = await backend.db.list('widgets')
check('db insert + list', all.data.length === 2 && all.count === 2)
const filtered = await backend.db.list('widgets', { filter: { qty: { op: 'gt', value: 6 } } })
check('db filter (gt)', filtered.data.length === 1 && filtered.data[0].name === 'Beta')
const sorted = await backend.db.list('widgets', { sort: ['qty', 'desc'] })
check('db sort', sorted.data[0].name === 'Beta')
const liked = await backend.db.list('widgets', { filter: { name: { op: 'like', value: 'alp' } } })
check('db filter (like, case-insensitive)', liked.data.length === 1)
await backend.db.update('widgets', 'w1', { qty: 99 })
const got = await backend.db.get('widgets', 'w1')
check('db update + get', got.data.qty === 99)
await backend.db.remove('widgets', 'w1')
const afterDel = await backend.db.list('widgets')
check('db remove', afterDel.data.length === 1)
await backend.db.upsert('widgets', [{ id: 'w2', qty: 1 }, { id: 'w3', name: 'Gamma' }])
const afterUpsert = await backend.db.list('widgets')
check('db upsert (update + insert)', afterUpsert.data.length === 2)

// adapter contract parity
const REQUIRED = ['signUp','signIn','signInWithOAuth','signInWithOtp','verifyOtp','signOut',
  'getSession','getUser','onAuthStateChange','resetPassword','updateUser']
for (const [id, a] of Object.entries(backend.adapters)) {
  const missing = REQUIRED.filter(m => typeof a.auth[m] !== 'function')
  check(`${id} implements full auth contract`, missing.length === 0, missing.join(',') || 'all 11 methods')
  const dbMissing = ['list','get','insert','update','remove','upsert','count'].filter(m => typeof a.db[m] !== 'function')
  check(`${id} implements full db contract`, dbMissing.length === 0, dbMissing.join(',') || 'all 7 methods')
}

/* ---------------------------------------------------------- summary */
console.error = origErr
origErr('')
origErr('─'.repeat(52))
origErr(`  ${pass} passed · ${fail} failed`)
origErr('─'.repeat(52))
process.exit(fail > 0 ? 1 : 0)
