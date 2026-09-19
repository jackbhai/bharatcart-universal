/**
 * Part 10 — enterprise hardening: crash isolation, permission enforcement,
 * accessibility, and idle session timeout.
 *
 * The theme of this suite is that the project already *described* several of
 * these things without *doing* them. 38 permissions existed and nothing
 * checked them; a Modal looked like a dialog without behaving like one. These
 * assertions exist to keep that gap from reopening.
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
global.HTMLElement = dom.window.HTMLElement
global.Element = dom.window.Element
global.Node = dom.window.Node
global.localStorage = dom.window.localStorage
global.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 16)
global.cancelAnimationFrame = clearTimeout
global.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} })
global.window.matchMedia = global.matchMedia
global.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} }
global.window.ResizeObserver = global.ResizeObserver
global.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} }
global.window.IntersectionObserver = global.IntersectionObserver
for (const k of ['SVGElement','DOMRect','MutationObserver','CSS','getComputedStyle','Event',
  'CustomEvent','KeyboardEvent','MouseEvent','HTMLInputElement','HTMLButtonElement',
  'DocumentFragment','NodeList','Blob','URL','File']) {
  if (dom.window[k] !== undefined) global[k] = dom.window[k]
}
if (!global.structuredClone) global.structuredClone = v => JSON.parse(JSON.stringify(v))

const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { act } = await import('react')

let pass = 0, fail = 0
const ok = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ' · ' + detail : ''}`) }
}
const section = t => console.log(`\n── ${t}`)
const SRC = SRC_DIR
const guard = (p, ms = 3000) => Promise.race([p, new Promise(r => setTimeout(r, ms))])

const stripComments = s => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

/* ============================================================ */
section('Error boundaries isolate a crash instead of blanking the app')
{
  const ErrorBoundary = (await import(`${SRC}/core/errors/ErrorBoundary.jsx`)).default

  const Boom = () => { throw new Error('widget exploded') }
  const Fine = () => React.createElement('p', null, 'this content still works')

  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)

  // Suppress React's expected error logging for this deliberate crash.
  const origError = console.error
  console.error = () => {}

  await guard(act(async () => {
    root.render(React.createElement('div', null,
      React.createElement(ErrorBoundary, { level: 'widget', label: 'Revenue card' },
        React.createElement(Boom)),
      React.createElement(Fine),
    ))
  }))
  console.error = origError

  const text = host.textContent || ''
  ok('a crashing widget does not unmount its siblings', text.includes('this content still works'))
  ok('the boundary renders a message instead of nothing', text.length > 30)
  ok('the failing section is named', text.includes('Revenue card'))
  ok('the error message is surfaced for a bug report', text.includes('widget exploded'))
  ok('the fallback offers recovery', text.includes('Try again'))
  ok('the fallback is announced as an alert', !!host.querySelector('[role="alert"]'))

  await guard(act(async () => { root.unmount() }))
}

/* ============================================================ */
section('Boundaries are wired at every level')
{
  const main = await readFile(`${SRC}/main.jsx`, 'utf8')
  const rt = stripComments(await readFile(`${SRC}/ui/RouteTransition.jsx`, 'utf8'))

  ok('the app is wrapped in a top-level boundary', main.includes('ErrorBoundary') && main.includes('level="app"'))
  ok('every route is wrapped in a route-level boundary', rt.includes('level="route"'))
  ok('the route boundary resets when the route changes', rt.includes('resetKey={routeKey}'))
  ok('the boundary sits inside Suspense', rt.indexOf('<Suspense') < rt.indexOf('<ErrorBoundary'))
  ok('the boundary sits outside the animation', rt.indexOf('<ErrorBoundary') < rt.indexOf('<PageEnter'))
}

/* ============================================================ */
section('Permissions are actually enforced, not just defined')
{
  const rbac = await import(`${SRC}/auth/rbac.jsx`)
  const { PERMISSIONS, ROLE_TEMPLATES } = await import(`${SRC}/engines/people/peopleEngine.js`)
  const { checkPermission, SCREEN_PERMISSIONS, visibleNav } = rbac

  ok('the permission catalogue is intact', Object.keys(PERMISSIONS).length === 38, String(Object.keys(PERMISSIONS).length))

  // Every screen must map to a real permission key. A typo here would fail
  // closed and lock everyone out of a screen, which is why it is asserted.
  const keys = Object.keys(PERMISSIONS)
  const badMappings = Object.entries(SCREEN_PERMISSIONS)
    .filter(([, p]) => p !== null && !keys.includes(p))
  ok('every screen maps to a real permission key', badMappings.length === 0,
    badMappings.map(([s, p]) => `${s}→${p}`).join(', '))

  // The whole sidebar must be covered, so a new screen cannot be added
  // without someone deciding who may see it.
  const appSrc = await readFile(`${SRC}/App.jsx`, 'utf8')
  const navIds = [...appSrc.matchAll(/\{ id: '([a-z]+)', label:/g)].map(m => m[1])
  ok('the NAV list was parsed', navIds.length >= 20, `${navIds.length} ids`)
  const uncovered = navIds.filter(id => !(id in SCREEN_PERMISSIONS))
  ok('every nav screen has a permission decision', uncovered.length === 0, uncovered.join(', '))

  // Owner sees everything.
  const owner = { role: 'owner' }
  ok('owner passes every permission', keys.every(k => checkPermission(owner, k)))
  ok('owner sees the whole sidebar', visibleNav(navIds.map(id => ({ id })), owner).length === navIds.length)

  // A support agent must NOT reach finance or staff management.
  const support = { role: 'support' }
  ok('support can view orders', checkPermission(support, 'orders.view'))
  ok('support can refund', checkPermission(support, 'orders.refund'))
  ok('support CANNOT change prices', !checkPermission(support, 'catalogue.price'))
  ok('support CANNOT manage staff', !checkPermission(support, 'people.manage'))
  ok('support CANNOT issue payouts', !checkPermission(support, 'finance.payouts'))
  ok('support does not see the finance screen',
    !visibleNav([{ id: 'finance' }], support).length)
  ok('support does not see the people screen',
    !visibleNav([{ id: 'people' }], support).length)
  ok('support DOES see the support screen',
    visibleNav([{ id: 'support' }], support).length === 1)

  // Merchandiser is the mirror image.
  const merch = { role: 'merchandiser' }
  ok('merchandiser can price the catalogue', checkPermission(merch, 'catalogue.price'))
  ok('merchandiser cannot refund', !checkPermission(merch, 'orders.refund'))

  // Fail-closed behaviour is the important security property.
  ok('an unknown role gets customer access, not owner',
    !checkPermission({ role: 'superadmin' }, 'people.manage'))
  ok('a missing role is not privileged', !checkPermission({}, 'finance.payouts'))
  ok('null user is not privileged', !checkPermission(null, 'orders.refund'))
  const origErr = console.error; console.error = () => {}
  ok('an unknown permission key is DENIED, not granted',
    !checkPermission({ role: 'owner' }, 'nonexistent.permission'))
  console.error = origErr

  // Array modes.
  ok('mode "all" requires every permission',
    !checkPermission(support, ['orders.view', 'finance.payouts']))
  ok('mode "any" requires only one',
    checkPermission(support, ['orders.view', 'finance.payouts'], { mode: 'any' }))
  ok('an empty permission is permissive by design', checkPermission(support, null))

  // Every role template must be usable — a role granting nothing is a bug.
  for (const [id, tpl] of Object.entries(ROLE_TEMPLATES)) {
    const granted = tpl.permissions.includes('*')
      ? keys
      : keys.filter(k => checkPermission({ role: id }, k))
    ok(`role "${id}" grants at least one permission`, granted.length > 0)
    ok(`role "${id}" can open at least one screen`,
      visibleNav(navIds.map(x => ({ id: x })), { role: id }).length > 0)
  }
}

/* ============================================================ */
section('The admin shell applies the guard')
{
  const app = stripComments(await readFile(`${SRC}/App.jsx`, 'utf8'))
  // Assert on the CALL, not the import. An earlier version of this check
  // matched the import line, so removing the actual filtering still passed.
  ok('the sidebar is filtered by permission', /visibleNav\(NAV,\s*auth\.user\)/.test(app))
  ok('the rendered nav uses the filtered list, not the raw one',
    /allowedNav\.filter\(n => n\.group === group\)/.test(app))
  ok('routes are wrapped in RequirePermission', app.includes('<RequirePermission'))
  ok('the guard reads the screen map', app.includes('SCREEN_PERMISSIONS[page]'))
  ok('empty nav groups are hidden rather than left as stray headings',
    app.includes('GROUPS.filter'))
  ok('the active nav item is exposed to assistive tech', app.includes("aria-current"))

  const rbacSrc = await readFile(`${SRC}/auth/rbac.jsx`, 'utf8')
  ok('a denied screen is logged as a security event', rbacSrc.includes("logTamper('permission_denied'"))
  ok('the denial explains which permission is missing', rbacSrc.includes('missing.map'))
}

/* ============================================================ */
section('Dialogs behave like dialogs')
{
  const { Modal, Drawer } = await import(`${SRC}/ui/primitives/Display.jsx`)

  const host = document.createElement('div')
  host.id = 'root-test'
  document.body.appendChild(host)
  const root = createRoot(host)

  let closed = 0
  await guard(act(async () => {
    root.render(React.createElement(Modal, {
      open: true, onClose: () => { closed++ }, title: 'Edit product',
    },
      React.createElement('input', { 'aria-label': 'Name' }),
      React.createElement('button', null, 'Save'),
    ))
  }))

  const dialog = host.querySelector('[role="dialog"]')
  ok('the modal has role="dialog"', !!dialog)
  ok('the modal is marked aria-modal', dialog?.getAttribute('aria-modal') === 'true')
  ok('the modal is labelled by its title', !!dialog?.getAttribute('aria-labelledby'))
  const labelId = dialog?.getAttribute('aria-labelledby')
  const labelEl = labelId ? document.getElementById(labelId) : null
  ok('the label target exists', !!labelEl)
  ok('the title element carries that id', labelEl?.textContent === 'Edit product')
  ok('the backdrop is hidden from assistive tech',
    !!host.querySelector('[aria-hidden="true"]'))

  const closeBtn = [...host.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Close dialog')
  ok('the close button has an accessible name', !!closeBtn)
  ok('the close button meets the 44px touch target', /min-w-\[44px\]/.test(closeBtn?.className || ''))

  // Focus should have moved into the dialog.
  ok('focus moves into the dialog on open', dialog?.contains(document.activeElement),
    document.activeElement?.tagName)

  // Escape closes.
  await guard(act(async () => {
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  }))
  ok('Escape closes the dialog', closed > 0)

  await guard(act(async () => { root.unmount() }))

  const src = await readFile(`${SRC}/ui/primitives/Display.jsx`, 'utf8')
  ok('the Drawer is also a dialog', /Drawer[\s\S]{0,1200}role="dialog"/.test(src))
  ok('both overlays use the shared focus trap',
    (src.match(/useFocusTrap\(open/g) || []).length >= 2)
  ok('both overlays lock body scroll', (src.match(/useScrollLock/g) || []).length >= 2)
}

/* ============================================================ */
section('Focus trap logic')
{
  const { getFocusable } = await import(`${SRC}/ui/a11y/useFocusTrap.js`)

  const box = document.createElement('div')
  box.innerHTML = `
    <button>one</button>
    <button disabled>skip me</button>
    <input type="hidden" value="skip me too">
    <a href="#x">link</a>
    <div tabindex="-1">not tabbable</div>
    <div tabindex="0">custom</div>
    <button aria-hidden="true">hidden</button>
  `
  document.body.appendChild(box)
  const items = getFocusable(box)
  const labels = items.map(el => el.textContent || el.tagName)

  ok('enabled buttons are focusable', labels.some(l => l.includes('one')))
  ok('disabled buttons are excluded', !labels.some(l => l.includes('skip me')))
  ok('hidden inputs are excluded', !items.some(el => el.type === 'hidden'))
  ok('links are focusable', items.some(el => el.tagName === 'A'))
  ok('tabindex="-1" is excluded', !labels.some(l => l.includes('not tabbable')))
  ok('tabindex="0" is included', labels.some(l => l.includes('custom')))
  ok('aria-hidden elements are excluded', !labels.some(l => l.includes('hidden')))
  box.remove()
}

/* ============================================================ */
section('Tabs follow the ARIA tabs pattern')
{
  const src = await readFile(`${SRC}/ui/primitives/Display.jsx`, 'utf8')
  const tabsSrc = src.slice(src.indexOf('export function Tabs'), src.indexOf('export function Modal'))

  ok('the container is a tablist', tabsSrc.includes('role="tablist"'))
  ok('each control is a tab', tabsSrc.includes('role="tab"'))
  ok('selection state is exposed', tabsSrc.includes('aria-selected'))
  ok('tabs use a roving tabindex', tabsSrc.includes('tabIndex={active ? 0 : -1}'))
  ok('arrow keys move between tabs', tabsSrc.includes('ArrowRight') && tabsSrc.includes('ArrowLeft'))
  ok('Home and End jump to the ends', tabsSrc.includes('Home') && tabsSrc.includes('End'))
  ok('tabs meet the touch target minimum', tabsSrc.includes('min-h-[40px]'))
  ok('counts are announced, not just shown', tabsSrc.includes('sr-only'))
}

/* ============================================================ */
section('Global accessibility affordances')
{
  const css = await readFile(`${SRC}/index.css`, 'utf8')
  const app = await readFile(`${SRC}/App.jsx`, 'utf8')
  const toast = await readFile(`${SRC}/ui/feedback/ToastHost.jsx`, 'utf8')

  ok('a skip link exists', app.includes('skip-link') && app.includes('#main-content'))
  ok('the skip target exists', app.includes('id="main-content"'))
  ok('the skip target is programmatically focusable', app.includes('tabIndex={-1}'))
  ok('the skip link is styled and reveals on focus', css.includes('.skip-link:focus'))
  ok('sr-only is defined', css.includes('.sr-only'))

  ok('a visible focus ring is applied globally', css.includes(':focus-visible'))
  // The global ring must be :focus-visible specifically, so it never appears
  // on a mouse click. Component-level :focus styles (inputs, the skip link)
  // are intentional and are not what this is checking.
  ok('the global focus ring uses focus-visible, so mouse users are unaffected',
    /:where\(a, button, input, select, textarea, \[tabindex\]\):focus-visible/.test(css))

  ok('reduced motion is honoured app-wide', css.includes('prefers-reduced-motion'))
  ok('high contrast is honoured', css.includes('prefers-contrast'))

  ok('the sidebar is a labelled landmark', app.includes('aria-label="Admin sections"'))
  ok('the sidebar region is labelled', app.includes('aria-label="Sidebar"'))

  ok('toasts live in a labelled region', toast.includes('aria-label="Notifications"'))
  ok('toasts are announced politely by default', toast.includes('aria-live="polite"'))
  ok('errors interrupt with an assertive announcement', toast.includes("'assertive'"))
  ok('error toasts use role=alert', toast.includes("'alert'"))
}

/* ============================================================ */
section('Idle session timeout')
{
  const mod = await import(`${SRC}/auth/useIdleTimeout.js`)
  const { formatRemaining, ACTIVITY_KEY, DEFAULT_IDLE_MS, DEFAULT_WARN_MS } = mod

  ok('the default idle window is 30 minutes', DEFAULT_IDLE_MS === 30 * 60 * 1000)
  ok('the warning window is 2 minutes', DEFAULT_WARN_MS === 2 * 60 * 1000)
  ok('the warning leaves useful time', DEFAULT_WARN_MS < DEFAULT_IDLE_MS)

  ok('formats minutes and seconds', formatRemaining(125_000) === '2m 05s', formatRemaining(125_000))
  ok('formats seconds alone', formatRemaining(9_000) === '9s', formatRemaining(9_000))
  ok('never shows a negative countdown', formatRemaining(-5000) === '0s', formatRemaining(-5000))
  ok('rounds up so it never shows 0s while time remains', formatRemaining(1) === '1s')

  const src = await readFile(`${SRC}/auth/useIdleTimeout.js`, 'utf8')
  ok('activity is shared across tabs', src.includes(ACTIVITY_KEY))
  ok('the deadline is wall-clock based, not a decrementing counter',
    src.includes('Date.now()') && src.includes('readLastActivity'))
  ok('listeners are passive so scrolling is unaffected', src.includes('passive: true'))
  ok('activity during the warning does not silently extend the session',
    src.includes('if (warnedRef.current) return'))
  ok('listeners are cleaned up', src.includes('removeEventListener'))

  const guardSrc = await readFile(`${SRC}/auth/IdleGuard.jsx`, 'utf8')
  ok('the warning is an alertdialog', guardSrc.includes('role="alertdialog"'))
  ok('the warning traps focus', guardSrc.includes('useFocusTrap'))
  ok('the operator can stay signed in', guardSrc.includes('Stay signed in'))
  ok('the operator can sign out immediately', guardSrc.includes('Sign out now'))
  ok('the timeout only applies to a signed-in session', guardSrc.includes('auth.isAuthed'))
  ok('the sign-in screen is told why', guardSrc.includes('reason=timeout'))
  ok('the buttons meet the touch target minimum', guardSrc.includes('min-h-[44px]'))

  const appSrc = await readFile(`${SRC}/App.jsx`, 'utf8')
  ok('the guard is mounted in the admin shell', appSrc.includes('<IdleGuard'))
}

/* ============================================================ */
section('Enforcement does not lock legitimate users out')
{
  // Adding access control is exactly the kind of change that locks everyone
  // out, so prove the real sign-in paths still land somewhere usable.
  const { visibleNav, SCREEN_PERMISSIONS } = await import(`${SRC}/auth/rbac.jsx`)
  const local = (await import(`${SRC}/backend/adapters/local.js`)).default
  const screens = Object.keys(SCREEN_PERMISSIONS).map(id => ({ id }))

  // Start from a blank auth store: no seeded users, no lingering sessions.
  for (const k of ['bharatcart:auth:users', 'bharatcart:auth:session', 'bharatcart:auth:otp']) {
    localStorage.removeItem(k)
  }

  // The very first account ever created becomes the owner — that is how a
  // fresh install gets its administrator.
  const first = await local.auth.signUp({
    email: `owner${Date.now()}@x.com`, password: 'abc12345', name: 'Owner',
  })
  ok('the first signup becomes the owner', first.data?.user?.role === 'owner',
    first.error?.message || first.data?.user?.role)
  ok('the owner reaches every screen',
    visibleNav(screens, first.data?.user).length === screens.length,
    `${visibleNav(screens, first.data?.user).length}/${screens.length}`)

  // Everyone after that is a shopper and must NOT gain admin screens.
  const fresh = await local.auth.signUp({
    email: `shopper${Date.now()}@x.com`, password: 'abc12345', name: 'Shopper',
  })
  ok('a later signup is a customer', fresh.data?.user?.role === 'customer')
  ok('a customer gets no admin screens beyond the dashboard',
    visibleNav(screens, fresh.data?.user).length <= 1,
    String(visibleNav(screens, fresh.data?.user).length))

  const guest = await local.auth.signInAnonymously()
  ok('a guest gets no admin screens beyond the dashboard',
    visibleNav(screens, guest.data?.user).length <= 1)
}

/* ============================================================ */
section('The two role systems agree with each other')
{
  /*
   * A real bug, and a nasty one: the app has a coarse ROLE_RANK ladder that
   * decides "may you open the back office" and a separate set of permission
   * templates that decide "which screens". They were written at different
   * times and had drifted — ROLE_RANK listed owner/admin/manager/staff/
   * customer while the templates defined ops, support, merchandiser, finance
   * and viewer. Those five scored 0, ranking them BELOW a customer.
   *
   * The symptom was the admin panel showing nothing but the dashboard, which
   * looks like a rendering bug and is actually an access-control mismatch.
   */
  const { ROLES, ROLE_RANK } = await import(`${SRC}/backend/types.js`)
  const { ROLE_TEMPLATES } = await import(`${SRC}/engines/people/peopleEngine.js`)
  const { visibleNav, SCREEN_PERMISSIONS } = await import(`${SRC}/auth/rbac.jsx`)
  const screens = Object.keys(SCREEN_PERMISSIONS).map(id => ({ id }))

  const missing = Object.keys(ROLE_TEMPLATES).filter(r => ROLE_RANK[r] === undefined)
  ok('every permission-template role has a rank', missing.length === 0, missing.join(', '))

  const staffRank = ROLE_RANK[ROLES.STAFF]
  const customerRank = ROLE_RANK[ROLES.CUSTOMER]
  for (const role of Object.keys(ROLE_TEMPLATES)) {
    ok(`"${role}" outranks a customer`, (ROLE_RANK[role] ?? 0) > customerRank,
      `rank=${ROLE_RANK[role]}`)
    ok(`"${role}" may open the admin area`, (ROLE_RANK[role] ?? 0) >= staffRank,
      `rank=${ROLE_RANK[role]} needs ${staffRank}`)
    // A role that can enter but sees nothing is the bug we are preventing.
    ok(`"${role}" sees more than just the dashboard`,
      visibleNav(screens, { role }).length > 1,
      `${visibleNav(screens, { role }).length} screens`)
  }

  ok('a customer still cannot open the admin area', customerRank < staffRank)
}

/* ============================================================ */
section('The admin area is guarded at the route, not just per screen')
{
  const app = await readFile(`${SRC}/App.jsx`, 'utf8')
  // Per-screen permissions alone left a shopper inside the shell staring at 21
  // refusals. The whole area needs a staff check so they are sent to sign in.
  ok('/admin requires a staff role', /<Route path="\/admin\/\*" element=\{\s*<RequireAuth role=\{ROLES\.STAFF\}/.test(app))
  ok('an unauthorised visitor is redirected to sign in', app.includes('redirect="/admin/login"'))
  // Unknown URLs: the shop tree ends in a real 404 page (ShopNotFound), the
  // admin tree falls back to the dashboard — neither reveals the other panel.
  const shopApp = await readFile(`${SRC}/shop/ShopApp.jsx`, 'utf8')
  ok('an unknown URL lands on the shop, not the back office',
    shopApp.includes('<Route path="*" element={<ShopNotFound />} />'))
  ok('an unknown admin path falls back to the dashboard, not the shop',
    app.includes('<Route path="*" element={<Navigate to="/admin/dashboard" replace />} />'))

  const auth = await readFile(`${SRC}/auth/AuthScreen.jsx`, 'utf8')
  ok('sign-in remembers the visitor was heading for the admin panel',
    auth.includes("cameFrom.startsWith('/admin')"))
}

console.log(`\n${pass} passed · ${fail} failed\n`)
if (fail) process.exitCode = 1
