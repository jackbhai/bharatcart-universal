/**
 * Part 15 — split routing: clean storefront URLs, hash-routed admin.
 *
 * The storefront (user panel) runs on history-API URLs with zero `#`
 * (BrowserRouter + VITE_APP_BASENAME). The admin panel stays on hash
 * routing (#/admin/…) so its paths never appear in the server-visible URL.
 *
 * Covers: boot-mode detection, legacy hash → clean URL mapping (and that
 * admin hashes are never rewritten), basename-aware URL building, the
 * postbuild 404.html fallback, and render smoke tests for both trees.
 *
 * Run: npx vite-node tests/part15.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const TESTS_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(TESTS_DIR, '..')
const SRC = resolve(ROOT, 'src')

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass++
  else { fail++; console.log('  ✗', name, extra ? `— ${extra}` : '') }
}
const section = (s) => console.log(`\n── ${s}`)
const read = (p) => readFileSync(resolve(SRC, p), 'utf8')

/* ================= 1. boot-mode detection ================= */
section('boot-mode detection (src/lib/siteUrls.js)')
{
  const { detectBootMode } = await import('../src/lib/siteUrls.js')

  ok('#/admin/dashboard boots the admin tree', detectBootMode('#/admin/dashboard') === 'admin')
  ok('#/admin/setup boots the admin tree', detectBootMode('#/admin/setup') === 'admin')
  ok('#/admin/login boots the admin tree', detectBootMode('#/admin/login') === 'admin')
  ok('bare #/admin boots the admin tree', detectBootMode('#/admin') === 'admin')
  ok('empty hash boots the shop tree', detectBootMode('') === 'shop')
  ok('no hash boots the shop tree', detectBootMode(null) === 'shop')
  ok('a legacy #/shop hash boots the shop tree', detectBootMode('#/shop') === 'shop')
  ok('bare # boots the shop tree', detectBootMode('#') === 'shop')
  // Prefix trap: must not match /adminfoo, /administrator, …
  ok('#/adminfoo does NOT boot the admin tree', detectBootMode('#/adminfoo') === 'shop')
  ok('#/administrator does NOT boot the admin tree', detectBootMode('#/administrator') === 'shop')
}

/* ================= 2. legacy hash redirects ================= */
section('legacy storefront hashes redirect to clean URLs')
{
  const { resolveLegacyHash, LEGACY_STORE_HASHES } = await import('../src/lib/siteUrls.js')

  ok('#/shop → /shop', resolveLegacyHash('#/shop') === '/shop')
  ok('#/account/orders → /account/orders', resolveLegacyHash('#/account/orders') === '/account/orders')
  ok('#/help → /help', resolveLegacyHash('#/help') === '/help')
  ok('#/auth → /account/login', resolveLegacyHash('#/auth') === '/account/login')
  ok('#/product/BC10001 → /product/BC10001',
    resolveLegacyHash('#/product/BC10001') === '/product/BC10001')

  // Admin hashes are sacred: never rewritten, never redirected.
  ok('#/admin/dashboard is never redirected', resolveLegacyHash('#/admin/dashboard') === null)
  ok('#/admin/setup is never redirected', resolveLegacyHash('#/admin/setup') === null)
  ok('#/admin/login is never redirected', resolveLegacyHash('#/admin/login') === null)
  ok('#/admin/products/1/edit is never redirected',
    resolveLegacyHash('#/admin/products/1/edit') === null)

  ok('empty hash redirects nowhere', resolveLegacyHash('') === null)
  ok('bare # redirects nowhere', resolveLegacyHash('#') === null)
  ok('unknown hash redirects nowhere', resolveLegacyHash('#/nope') === null)
  ok('#/product/ with no id redirects nowhere', resolveLegacyHash('#/product/') === null)

  // The table itself must be storefront-only and hash-free on the way out.
  const entries = Object.entries(LEGACY_STORE_HASHES)
  ok('legacy table is non-empty', entries.length > 0)
  ok('no legacy key is an admin hash', entries.every(([k]) => !k.startsWith('#/admin')))
  ok('every legacy target is a clean path (no #)',
    entries.every(([, v]) => v.startsWith('/') && !v.includes('#')))
}

/* ================= 3. basename-aware URL building ================= */
section('basename-aware URL building')
{
  const { appBasename, shopUrl } = await import('../src/lib/siteUrls.js')

  // Default env (no VITE_APP_BASENAME in this process): root.
  ok('default basename is /', appBasename() === '/')
  ok('shopUrl joins cleanly', shopUrl('/shop') === '/shop')
  ok('shopUrl handles a missing leading slash', shopUrl('shop') === '/shop')
  ok('shopUrl keeps the root path', shopUrl('/') === '/')

  // The GitHub Pages project-site build. import.meta.env is inlined by
  // vite-node, so a child process with the env var exercises it.
  const probe = '/tmp/bharatcart-basename-probe.mjs'
  const { writeFileSync } = await import('node:fs')
  writeFileSync(probe, `
    import { appBasename, shopUrl } from '${SRC}/lib/siteUrls.js'
    console.log(JSON.stringify({ base: appBasename(), shop: shopUrl('/shop'), product: shopUrl('/product/1') }))
  `)
  const out = execFileSync('npx', ['vite-node', probe], {
    cwd: ROOT,
    env: { ...process.env, VITE_APP_BASENAME: '/bharatcart-universal' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim().split('\n').pop()
  const r = JSON.parse(out)
  ok('Pages basename is honoured', r.base === '/bharatcart-universal', r.base)
  ok('shop URL carries the Pages basename', r.shop === '/bharatcart-universal/shop', r.shop)
  ok('product URL carries the Pages basename',
    r.product === '/bharatcart-universal/product/1', r.product)

  // goShop performs a full navigation to the basename-aware URL.
  const main = read('main.jsx')
  ok('admin boots in a HashRouter', main.includes('<HashRouter>'))
  ok('shop boots in a BrowserRouter', main.includes('<BrowserRouter'))
  ok('BrowserRouter gets the configured basename',
    main.includes('basename={appBasename()}'))
  const urls = read('lib/siteUrls.js')
  ok('goShop navigates to the basename-aware storefront URL',
    /export function goShop\(path = '\/'\) \{\s*window\.location\.assign\(shopUrl\(path\)\)/.test(urls))
}

/* ================= 4. no storefront hashes left ================= */
section('no storefront `#` URLs remain in the source')
{
  const hashAssign = (read('auth/RequireAuth.jsx') + read('shop/Cart.jsx'))
  ok('no window.location.hash assignment to a shop path in auth/shop',
    !/window\.location\.hash\s*=\s*'#\/(?!admin)/.test(hashAssign))

  const theme = read('core/store/slices/themeSlice.js')
  ok('theme nav/footer defaults use clean URLs', !/'#\//.test(theme))

  const idle = read('auth/IdleGuard.jsx')
  ok('idle timeout lands on the admin login hash',
    idle.includes("window.location.hash = '#/admin/login?reason=timeout'"))

  const authScreen = read('auth/AuthScreen.jsx')
  ok('timeout sign-outs get an explanation on the login screen',
    authScreen.includes("reason') === 'timeout'"))

  // Admin hashes are intentionally kept.
  const rbac = read('auth/rbac.jsx')
  ok('admin recovery links keep their hashes', rbac.includes('#/admin/dashboard'))

  // No visible path from the storefront to the admin panel.
  const layout = read('shop/ShopLayout.jsx')
  ok('storefront chrome links no admin route',
    !/admin/i.test(layout.replace(/administration/gi, '')) || !layout.includes('#/admin'))
  const shopApp = read('shop/ShopApp.jsx')
  ok('shop route tree defines no admin route',
    !/<Route[^>]*path="[^"]*admin/.test(shopApp))
  ok('unknown shop URLs render a real 404 page',
    shopApp.includes('<Route path="*" element={<ShopNotFound />} />'))
}

/* ================= 5. App mode split ================= */
section('App renders the right tree per mode')
{
  const app = read('App.jsx')
  ok('App takes a mode prop', /export default function App\(\{ mode \} = \{\}\)/.test(app))
  ok('admin mode keeps setup public', app.includes('<Route path="/admin/setup"'))
  ok('admin mode has a staff login route', app.includes('<Route path="/admin/login"'))
  ok('admin tree is staff-guarded', app.includes('role={ROLES.STAFF}'))
  ok('guard redirects to the admin login', app.includes('redirect="/admin/login"'))
  ok('shop mode lazy-loads the whole storefront', app.includes("import('./shop/ShopApp.jsx')"))
  ok('unknown admin paths fall back to the dashboard',
    app.includes('<Route path="*" element={<Navigate to="/admin/dashboard" replace />} />'))
  ok('legacy /auth redirects to /account/login in shop mode',
    app.includes('<Route path="/auth" element={<Navigate to="/account/login" replace />} />'))
  ok('the setup gate never traps shoppers in admin mode only paths',
    app.includes("if (p !== '/account/login') goAdminSetup()"))
}

/* ================= 6. GitHub Pages fallback ================= */
section('GitHub Pages SPA fallback')
{
  ok('postbuild copies index.html → 404.html',
    existsSync(resolve(ROOT, 'scripts/copy-spa-fallback.mjs')))
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
  ok('postbuild runs after every build',
    pkg.scripts.postbuild === 'node scripts/copy-spa-fallback.mjs')
  ok('dist/404.html exists', existsSync(resolve(ROOT, 'dist/404.html')))
  ok('dist/404.html is byte-identical to dist/index.html',
    readFileSync(resolve(ROOT, 'dist/404.html')).equals(
      readFileSync(resolve(ROOT, 'dist/index.html'))))
  const vite = readFileSync(resolve(ROOT, 'vite.config.js'), 'utf8')
  ok('asset base follows VITE_APP_BASENAME',
    vite.includes('VITE_APP_BASENAME') && vite.includes('loadEnv'))
  const envExample = readFileSync(resolve(ROOT, '.env.example'), 'utf8')
  ok('.env.example documents VITE_APP_BASENAME',
    envExample.includes('VITE_APP_BASENAME=/'))
}

/* ================= 7. render smoke tests ================= */
section('render smoke: both router trees mount')
{
  const { JSDOM } = await import('jsdom')
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
  })
  global.window = dom.window
  global.document = dom.window.document
  Object.defineProperty(globalThis, 'navigator', {
    value: dom.window.navigator, configurable: true, writable: true,
  })
  global.HTMLElement = dom.window.HTMLElement
  global.SVGElement = dom.window.SVGElement
  global.Element = dom.window.Element
  global.AbortController = dom.window.AbortController
  global.AbortSignal = dom.window.AbortSignal
  global.localStorage = dom.window.localStorage
  if (!global.structuredClone) global.structuredClone = (v) => JSON.parse(JSON.stringify(v))
  // matchMedia / scrollTo are used by the chrome; jsdom lacks them.
  if (!global.window.matchMedia) {
    global.window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} })
  }
  if (!global.window.scrollTo) global.window.scrollTo = () => {}
  if (!global.window.requestAnimationFrame) {
    global.window.requestAnimationFrame = (cb) => setTimeout(cb, 0)
  }

  const React = (await import('react')).default
  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react')
  const { MemoryRouter, HashRouter } = await import('react-router-dom')
  global.IS_REACT_ACT_ENVIRONMENT = true
  const guard = (p, ms) => Promise.race([p, new Promise(res => setTimeout(res, ms))])

  const mount = async (ui) => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    await guard(act(async () => { root.render(ui) }), 15000)
    const html = el.innerHTML
    await guard(act(async () => { root.unmount() }), 5000)
    el.remove()
    return html
  }

  // Opt out of first-run mode so the setup gate stays quiet.
  window.localStorage.setItem('bharatcart_setup_done', '1')
  window.location.hash = ''

  const ShopApp = (await import('../src/shop/ShopApp.jsx')).default
  const shopAt = (path) =>
    React.createElement(MemoryRouter, { initialEntries: [path] },
      React.createElement(ShopApp))

  let html = await mount(shopAt('/'))
  ok('shop / renders the home page', html.includes('Shop by category') || html.length > 2000, html.length)

  html = await mount(shopAt('/shop'))
  ok('shop /shop renders the catalogue', html.includes('The catalogue'), html.length)

  html = await mount(shopAt('/definitely-not-a-page'))
  ok('shop unknown path renders the 404 page', html.includes('Page not found'))

  html = await mount(shopAt('/account/login'))
  ok('shop /account/login renders the sign-in screen', html.includes('Welcome back'))

  // Legacy hash → clean URL, exactly once. The redirect target is injected
  // so the test observes it without a real navigation (jsdom cannot stub
  // Location#replace).
  const { LegacyHashRedirect } = await import('../src/shop/ShopApp.jsx')
  let replaced = null
  const spy = (url) => { replaced = url }
  window.location.hash = '#/shop'
  await mount(React.createElement(LegacyHashRedirect, { redirect: spy }))
  window.location.hash = ''
  ok('legacy #/shop hash redirects to the clean URL', replaced === '/shop', replaced)

  // Admin hashes are never rewritten by the shop tree.
  replaced = null
  window.location.hash = '#/admin/dashboard'
  await mount(React.createElement(LegacyHashRedirect, { redirect: spy }))
  window.location.hash = ''
  ok('admin hashes are never rewritten by the shop tree', replaced === null, replaced)

  // And the redirect is actually mounted in the shop tree.
  const shopAppSrc = read('shop/ShopApp.jsx')
  ok('LegacyHashRedirect is mounted in the shop tree',
    shopAppSrc.includes('<LegacyHashRedirect />'))

  // Admin tree: public setup wizard, no auth needed.
  const App = (await import('../src/App.jsx')).default
  window.location.hash = '#/admin/setup'
  html = await mount(React.createElement(HashRouter, null,
    React.createElement(App, { mode: 'admin' })))
  window.location.hash = ''
  ok('admin #/admin/setup renders the setup wizard',
    /setup/i.test(html) && html.length > 1000, html.length)
}

console.log(`\npart15: ${pass} passed, ${fail} failed`)
if (fail) process.exitCode = 1
