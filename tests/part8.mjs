/**
 * Part 8 — admin route smoke tests.
 *
 * Every admin page is mounted through the real App shell, the real router and
 * the real auth guard, then navigated to the way an operator would. This suite
 * exists because a single crashing page (Localisation, which imported the wrong
 * Tabs) took the whole admin panel down, and no existing test caught it: the
 * older suites imported components directly and never exercised the router.
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
global.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 16)
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
global.AbortController = dom.window.AbortController
global.AbortSignal = dom.window.AbortSignal
global.FileReader = dom.window.FileReader
global.localStorage = dom.window.localStorage
// Empty-first: a fresh store is routed to the setup wizard. The route smoke
// test wants the real admin screens, so opt out of first-run mode.
dom.window.localStorage.setItem('bharatcart_setup_done', '1')
if (!global.structuredClone) global.structuredClone = (v) => JSON.parse(JSON.stringify(v))

const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { act } = await import('react')
const { HashRouter } = await import('react-router-dom')
global.IS_REACT_ACT_ENVIRONMENT = true

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass++
  else { fail++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`) }
}
const section = (s) => console.log(`\n── ${s}`)

const store = (await import(`${SRC_DIR}/core/store/index.js`)).default
store.dispatch('auth/signedIn', {
  user: { id: 'u1', name: 'Admin', email: 'admin@bharatcart.in', role: 'owner' },
  session: { token: 'test' },
})

const App = (await import(`${SRC_DIR}/App.jsx`)).default
const host = dom.window.document.getElementById('root')
const root = createRoot(host)

// framer-motion runs infinite animations; act() would otherwise never settle.
const guard = (p, ms) => Promise.race([p, new Promise(res => setTimeout(res, ms))])

dom.window.location.hash = '#/admin/dashboard'
await guard(act(async () => {
  root.render(React.createElement(HashRouter, null, React.createElement(App)))
}), 10000)

/**
 * Text the operator can actually SEE.
 *
 * This is the single most important helper in the file. The worst bug this
 * project shipped was a route that rendered its full content into the DOM and
 * then sat at opacity 0 behind a blur filter, invisible until a manual reload.
 * Every test passed, because every test asserted on textContent. Anything
 * faded out, collapsed, or explicitly hidden is excluded here.
 */
function visibleText(el) {
  if (!el) return ''
  const style = el.getAttribute?.('style') || ''
  const opacity = style.match(/opacity:\s*([\d.]+)/)
  if (opacity && parseFloat(opacity[1]) < 0.15) return ''
  if (/display:\s*none/.test(style) || /visibility:\s*hidden/.test(style)) return ''
  if (el.hidden) return ''
  if (!el.children?.length) return (el.textContent || '').trim()
  return [...el.children].map(visibleText).join(' ').trim()
}

/**
 * Navigate and wait for the new page to actually appear.
 *
 * Waiting only for "not the loading fallback" is not enough: immediately after
 * a hash change the previous page is still mounted and satisfies that check, so
 * the assertions would read stale content and every route would look identical
 * to the one before it. Wait for the text to differ from what was on screen
 * before navigating.
 */
async function goto(route) {
  const before = (host.querySelector('main')?.textContent || '').trim()
  dom.window.location.hash = '#/admin/' + route
  await guard(act(async () => {
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'))
  }), 4000)
  for (let i = 0; i < 60; i++) {
    const main = host.querySelector('main')
    const text = (main?.textContent || '').trim()
    if (text.length > 80 && !text.includes('Loading') && text !== before) {
      // Give any entrance animation a moment to finish before measuring what
      // is on screen, otherwise a mid-transition frame reads as invisible.
      await guard(act(async () => { await new Promise(res => setTimeout(res, 120)) }), 2000)
      return { main, text, visible: visibleText(main) }
    }
    await guard(act(async () => { await new Promise(res => setTimeout(res, 60)) }), 2000)
  }
  const main = host.querySelector('main')
  return { main, text: (main?.textContent || '').trim(), visible: visibleText(main) }
}

const ROUTES = [
  'dashboard', 'analytics', 'reports', 'customers', 'finance',
  'orders', 'catalogue', 'inventory', 'returns', 'shipping',
  'vendors', 'support', 'operations',
  'marketing', 'promotions', 'loyalty', 'content',
  'theme', 'localisation', 'integrations', 'people', 'settings',
]

section('Every admin route renders real content')
const captured = {}
for (const route of ROUTES) {
  const errors = []
  const origErr = console.error
  console.error = (...a) => {
    const line = String(a[0])
    if (!line.includes('Future Flag')) errors.push(line.split('\n')[0])
  }
  let result
  try {
    result = await goto(route)
  } catch (e) {
    result = { text: '', thrown: e.message }
  } finally {
    console.error = origErr
  }
  captured[route] = result.text

  ok(`${route} mounts without throwing`, !result.thrown, result.thrown)
  ok(`${route} renders content`, result.text.length > 80, `${result.text.length} chars`)
  // The blank-screen bug in full: content in the DOM, nothing on screen.
  ok(`${route} is actually VISIBLE, not just present in the DOM`,
    (result.visible || '').length > 60,
    `dom=${result.text.length} visible=${(result.visible || '').length}`)
  ok(`${route} is not stuck on the loading fallback`, !result.text.includes('Loading…'))
  ok(`${route} logs no React error`, errors.length === 0, errors[0]?.slice(0, 140))
}

section('Routes render distinct pages')
// A crashing page used to leave the previous page's DOM in place, so identical
// content across routes is the signature of that failure.
const texts = Object.entries(captured)
let duplicates = []
for (let i = 0; i < texts.length; i++) {
  for (let j = i + 1; j < texts.length; j++) {
    if (texts[i][1] && texts[i][1] === texts[j][1]) duplicates.push(`${texts[i][0]}=${texts[j][0]}`)
  }
}
ok('no two routes render byte-identical content', duplicates.length === 0, duplicates.join(', '))
ok('every route produced some text', Object.values(captured).every(t => t.length > 80))

section('Shell survives navigation')
ok('the sidebar is still present after visiting every route',
  Boolean(host.querySelector('aside')))
ok('the main region is still present', Boolean(host.querySelector('main')))
const navButtons = host.querySelectorAll('aside button')
ok('the sidebar still renders its nav items', navButtons.length >= 10, String(navButtons.length))

section('Round trip back to the dashboard')
// goto() waits for a *change*; coming back to a page we already visited is a
// legitimate repeat, so navigate and settle without the change requirement.
async function gotoSettle(route) {
  dom.window.location.hash = '#/admin/' + route
  await guard(act(async () => {
    dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'))
  }), 4000)
  for (let i = 0; i < 40; i++) {
    const text = (host.querySelector('main')?.textContent || '').trim()
    if (text.length > 80 && !text.includes('Loading')) {
      await guard(act(async () => { await new Promise(res => setTimeout(res, 120)) }), 2000)
      return { text, visible: visibleText(host.querySelector('main')) }
    }
    await guard(act(async () => { await new Promise(res => setTimeout(res, 60)) }), 2000)
  }
  return { text: (host.querySelector('main')?.textContent || '').trim(), visible: visibleText(host.querySelector('main')) }
}
const back = await gotoSettle('dashboard')
ok('dashboard still renders after visiting everything', back.text.length > 80, `${back.text.length} chars`)
ok('dashboard is visible on return', (back.visible || '').length > 60, `visible=${(back.visible || '').length}`)

section('Unknown route redirects rather than blanking')
const unknown = await gotoSettle('does-not-exist')
ok('an unknown admin route still shows a page', unknown.text.length > 80, `${unknown.text.length} chars`)


/* ============================================================
   Part 8 engines
============================================================ */

section('Vendor engine')
{
  const { vendorKpis, vendorScorecard, poPipeline, overduePos, payablesAgeing,
    spendByVendor, concentrationRisk, vendorForProduct, draftPoFromSuggestions } =
    await import(`${SRC_DIR}/engines/vendors/vendorEngine.js`)
  const { VENDORS, PURCHASE_ORDERS, PO_STATUS } =
    await import(`${SRC_DIR}/data/vendorSeed.js`)

  // Empty first: a clean install has no vendor book at all.
  const empty = vendorKpis()
  ok('vendor book starts empty', VENDORS.length === 0 && empty.total === 0)
  ok('purchase orders start empty', PURCHASE_ORDERS.length === 0 && empty.openPos === 0)
  ok('vendor score is zero without vendors', empty.avgScore === 0)
  ok('scorecards are empty', vendorScorecard().length === 0)
  ok('pipeline is empty', poPipeline().length === 0)
  ok('nothing is overdue', overduePos().length === 0)
  ok('no payables to age', payablesAgeing().rows.length === 0)
  ok('no spend to attribute', spendByVendor().length === 0)
  const emptyRisk = concentrationRisk()
  ok('no concentration risk without spend', emptyRisk.level === 'low' && emptyRisk.top1 === 0)

  // Hermetic fixtures from here on.
  const now = Date.now()
  const FIX_VENDORS = [
    { id: 'V-1', name: 'Jaipur Textiles', status: 'Active', score: 82, qualityPct: 90, onTimePct: 80, leadDays: 7 },
    { id: 'V-2', name: 'Surat Polyhouse', status: 'Active', score: 64, qualityPct: 70, onTimePct: 60, leadDays: 5 },
    { id: 'V-3', name: 'Kanchipuram Looms', status: 'Onboarding', score: 0, qualityPct: 0, onTimePct: 0, leadDays: 10 },
  ]
  const FIX_POS = [
    { id: 'PO-1', vendorId: 'V-1', vendorName: 'Jaipur Textiles', status: 'Received', subtotal: 50000, tax: 2500, total: 52500, paid: true, raisedAt: now - 80 * 86400000, receivedAt: now - 69 * 86400000, expectedAt: now - 70 * 86400000, terms: 'Net 30', items: [{ productId: 'P-1', qty: 100, received: 100 }] },
    { id: 'PO-2', vendorId: 'V-1', vendorName: 'Jaipur Textiles', status: 'Sent', subtotal: 40000, tax: 2000, total: 42000, paid: false, raisedAt: now - 10 * 86400000, expectedAt: now - 2 * 86400000, items: [{ productId: 'P-2', qty: 50, received: 0 }] },
    { id: 'PO-3', vendorId: 'V-2', vendorName: 'Surat Polyhouse', status: 'Acknowledged', subtotal: 60000, tax: 3000, total: 63000, paid: false, raisedAt: now - 5 * 86400000, expectedAt: now + 5 * 86400000, items: [{ productId: 'P-3', qty: 200, received: 0 }] },
    { id: 'PO-4', vendorId: 'V-2', vendorName: 'Surat Polyhouse', status: 'Received', subtotal: 20000, tax: 1000, total: 21000, paid: false, raisedAt: now - 40 * 86400000, receivedAt: now - 35 * 86400000, expectedAt: now - 36 * 86400000, terms: 'Net 15', items: [{ productId: 'P-4', qty: 70, received: 70 }] },
  ]

  const k = vendorKpis(FIX_VENDORS, FIX_POS)
  ok('counts every vendor', k.total === FIX_VENDORS.length)
  ok('active + on hold + onboarding equals the total', k.active + k.onHold + k.onboarding === k.total)
  ok('average score is a percentage', k.avgScore > 0 && k.avgScore <= 100, String(k.avgScore))
  ok('open purchase orders carry value', k.openPos === 2 && k.openValue === 105000, `${k.openPos}/${k.openValue}`)

  const sc = vendorScorecard(FIX_VENDORS, FIX_POS)
  ok('scores every vendor', sc.length === FIX_VENDORS.length)
  ok('scorecard is sorted by blended score', sc.every((v, i) => i === 0 || sc[i - 1].blendedScore >= v.blendedScore))
  ok('blended score stays within 0-100', sc.every(v => v.blendedScore >= 0 && v.blendedScore <= 100))
  ok('fill rate stays within 0-100', sc.every(v => v.fillRate >= 0 && v.fillRate <= 100))

  const pipeline = poPipeline(FIX_POS)
  ok('pipeline groups purchase orders by status', pipeline.length === 3, `${pipeline.length} columns`)
  ok('pipeline counts add up to every purchase order',
    pipeline.reduce((n, c) => n + c.count, 0) === FIX_POS.length)
  ok('every pipeline status is a known status', pipeline.every(c => PO_STATUS.includes(c.status)))

  // A purchase order that was never sent cannot have received stock against it.
  const unsent = FIX_POS.filter(o => ['Draft', 'Sent', 'Acknowledged'].includes(o.status))
  ok('unsent purchase orders have no receipts',
    unsent.every(o => o.items.every(it => it.received === 0)))
  ok('purchase order totals equal subtotal plus tax',
    FIX_POS.every(o => o.total === o.subtotal + o.tax))

  const late = overduePos(FIX_POS, now)
  ok('the overdue purchase order is flagged', late.length === 1 && late[0].id === 'PO-2')
  ok('overdue orders are all genuinely past their date', late.every(o => o.daysLate > 0))
  ok('overdue orders are never already received', late.every(o => o.status !== 'Received'))
  ok('overdue list is sorted worst first', late.every((o, i) => i === 0 || late[i - 1].daysLate >= o.daysLate))

  const ageing = payablesAgeing(FIX_POS, now)
  ok('ageing buckets sum to the stated total',
    Math.abs(Object.values(ageing.buckets).reduce((a, b) => a + b, 0) - ageing.total) < 1)
  ok('only unpaid received orders are payable',
    ageing.rows.every(r => r.status === 'Received' && !r.paid))

  const spend = spendByVendor(FIX_POS)
  ok('spend shares never exceed 100', spend.every(r => r.share >= 0 && r.share <= 100))
  ok('spend is sorted high to low', spend.every((r, i) => i === 0 || spend[i - 1].spend >= r.spend))

  const risk = concentrationRisk(FIX_POS)
  ok('risk level is one of three values', ['low', 'medium', 'high'].includes(risk.level))
  ok('top three share is at least the top one share', risk.top3 >= risk.top1)

  ok('an unmapped product maps to nothing', vendorForProduct('P-1') === null)

  const draft = draftPoFromSuggestions([{ productId: 'P-1', name: 'X', qty: 10, unitCost: 500, gst: 5 }], { vendorId: 'V-1' })
  ok('a draft purchase order explains itself with no vendors configured',
    draft.ok === false && draft.vendorId === null && draft.items.length === 0, draft.reason)
}

section('Warehouse and inventory engine')
{
  const { stockPositions, inventoryKpis, abcAnalysis, abcSummary, reorderPlan,
    reorderByVendor, warehouseSummary, transferSuggestions, deadStock, movements, routeOrder } =
    await import(`${SRC_DIR}/engines/inventory/warehouseEngine.js`)
  const { PRODUCTS } = await import(`${SRC_DIR}/data/seed.js`)
  const { WAREHOUSES, STOCK_BY_WAREHOUSE } = await import(`${SRC_DIR}/data/vendorSeed.js`)

  // Empty first: no warehouses are configured on a clean install.
  ok('catalogue starts empty', PRODUCTS.length === 0)
  ok('no warehouses configured', WAREHOUSES.length === 0)
  ok('warehouse summary is empty', warehouseSummary().length === 0)
  ok('no stock movements recorded', movements().length === 0)
  const refused = routeOrder('West Bengal', 'P-1', 1)
  ok('routing explains itself with no warehouses',
    refused.ok === false && refused.reason === 'No warehouses configured', refused.reason)

  // Hermetic catalogue fixture from here on. The velocity layer still reads
  // the empty module datasets, so fixtures have zero sales velocity.
  const FIX_PRODUCTS = [
    { id: 'WP-1', name: 'Banarasi Silk Saree', category: 'Ethnic Wear', price: 2999, stock: 120, variants: [] },
    { id: 'WP-2', name: 'Cotton Kurti', category: 'Ethnic Wear', price: 849, stock: 300, variants: [] },
    { id: 'WP-3', name: 'Linen Shirt', category: 'Western Wear', price: 1499, stock: 45, variants: [] },
    { id: 'WP-4', name: 'Running Shoes', category: 'Footwear', price: 2499, stock: 0, variants: [] },
  ]
  const pos = stockPositions(FIX_PRODUCTS)
  ok('produces a position per product', pos.length === FIX_PRODUCTS.length)
  ok('every position has a known status',
    pos.every(p => ['Out of stock', 'Critical', 'Low', 'Healthy', 'Overstocked'].includes(p.status)))
  ok('out of stock means zero on hand',
    pos.filter(p => p.status === 'Out of stock').every(p => p.stock === 0))
  ok('reorder point is never below safety stock', pos.every(p => p.reorderPoint >= p.safetyStock))
  ok('only moving products are flagged for reorder', pos.filter(p => p.needsReorder).every(p => p.perDay > 0))
  ok('no warehouse split exists yet', pos.every(p => Object.keys(p.byWarehouse).length === 0))

  const k = inventoryKpis(pos)
  ok('unit count matches the catalogue',
    k.units === FIX_PRODUCTS.reduce((n, p) => n + p.stock, 0))
  ok('stock value is positive', k.stockValue > 0)
  ok('turnover is a sane ratio', k.turnover >= 0 && k.turnover < 100)

  const abc = abcAnalysis(pos)
  ok('classifies every product', abc.length === pos.length)
  ok('cumulative share never exceeds 100.5', abc.every(r => r.cumulativeShare <= 100.5))
  ok('cumulative share only increases', abc.every((r, i) => i === 0 || abc[i - 1].cumulativeShare <= r.cumulativeShare))
  ok('class A is the top of the list', abc[0].abc === 'A')
  const sum = abcSummary(abc)
  ok('every class is summarised', sum.length === 3)
  ok('class SKU counts add up to the catalogue', sum.reduce((n, s) => n + s.skus, 0) === pos.length)

  const plan = reorderPlan(pos)
  ok('reorder plan is sorted by urgency', plan.every((p, i) => i === 0 || plan[i - 1].coverDays <= p.coverDays))
  const grouped = reorderByVendor(plan)
  ok('grouping keeps every line', grouped.reduce((n, g) => n + g.lines.length, 0) === plan.length)
  ok('each group flags whether it meets the vendor minimum',
    grouped.every(g => typeof g.meetsMinimum === 'boolean'))

  const wh = warehouseSummary(pos)
  ok('summarises zero warehouses', wh.length === 0)
  ok('no warehouse is over capacity', wh.every(w => w.utilisation <= 100))

  const transfers = transferSuggestions(pos)
  ok('transfers never move stock to where it already is', transfers.every(t => t.fromId !== t.toId))
  ok('transfers move a positive quantity', transfers.every(t => t.qty > 0))

  ok('dead stock has stock but no sales', deadStock(pos).every(p => p.stock > 0 && p.unitsSold === 0))
  ok('movements come back newest first', movements().every((m, i, a) => i === 0 || a[i - 1].at >= m.at))

  const route = routeOrder('West Bengal', pos[0].productId, 1)
  ok('routing is honest with no warehouses', route.ok === false && route.reason === 'No warehouses configured')
  const impossible = routeOrder('Delhi', pos[0].productId, 999999)
  ok('refuses to route more stock than exists', impossible.ok === false)
}

section('People and permissions engine')
{
  const { PERMISSION_KEYS, PERMISSIONS, ROLE_TEMPLATES, ROLE_IDS, can,
    permissionsByGroup, roleDiff, STAFF, staffKpis, securityReview, auditLog } =
    await import(`${SRC_DIR}/engines/people/peopleEngine.js`)

  ok('every permission declares a group and label',
    PERMISSION_KEYS.every(k => PERMISSIONS[k].group && PERMISSIONS[k].label))
  ok('owner can do everything', PERMISSION_KEYS.every(k => can('owner', k)))
  ok('the read-only role cannot write', PERMISSION_KEYS.filter(k => !k.endsWith('.view')).every(k => !can('viewer', k)))
  ok('support can refund but cannot change prices',
    can('support', 'orders.refund') && !can('support', 'catalogue.price'))
  ok('a manager cannot touch payment gateways or staff',
    !can('manager', 'settings.payments') && !can('manager', 'people.manage'))
  ok('an unknown role grants nothing', !can('nope', 'orders.view'))
  ok('every role id resolves to a template', ROLE_IDS.every(id => ROLE_TEMPLATES[id]))
  ok('only owner uses the wildcard',
    ROLE_IDS.filter(id => ROLE_TEMPLATES[id].permissions.includes('*')).length === 1)

  const groups = permissionsByGroup('support')
  ok('grouping covers every permission',
    Object.values(groups).reduce((n, g) => n + g.length, 0) === PERMISSION_KEYS.length)

  const diff = roleDiff('owner', 'viewer')
  ok('owner outranks the viewer', diff.onlyA.length > 0 && diff.onlyB.length === 0)

  // Empty first: no staff on a clean install, so there is no audit trail.
  ok('staff list starts empty', STAFF.length === 0)
  const emptyK = staffKpis()
  ok('staff KPIs are zero without staff', emptyK.total === 0 && emptyK.owners === 0)
  const emptyLog = auditLog({ limit: 50 })
  ok('audit log is empty with no staff', emptyLog.length === 0)

  // Hermetic staff fixture from here on.
  const DAY = 86400000
  const FIX_STAFF = [
    { id: 'ST-1', name: 'Owner One', role: 'owner', status: 'Active', twoFactor: true, lastActiveAt: Date.now() },
    { id: 'ST-2', name: 'Support Sam', role: 'support', status: 'Active', twoFactor: false, lastActiveAt: Date.now() - 70 * DAY },
    { id: 'ST-3', name: 'Merch Maya', role: 'merchandiser', status: 'Invited', twoFactor: false, lastActiveAt: Date.now() },
    { id: 'ST-4', name: 'Finance Fred', role: 'finance', status: 'Suspended', twoFactor: true, lastActiveAt: Date.now() - 90 * DAY },
  ]
  const k = staffKpis(FIX_STAFF)
  ok('staff statuses add up', k.active + k.invited + k.suspended === k.total)
  ok('there is at least one owner', k.owners >= 1)
  ok('role counts add up to the team', k.byRole.reduce((n, r) => n + r.count, 0) === FIX_STAFF.length)

  const notes = securityReview(FIX_STAFF)
  ok('the security review always says something', notes.length > 0)
  ok('every note carries a level', notes.every(n => ['high', 'warn', 'info', 'ok'].includes(n.level)))
  ok('flags the lone owner', notes.some(n => /Only one active owner/.test(n.text)))
  ok('flags missing two-factor auth', notes.some(n => /two-factor/.test(n.text)))
}

section('Support desk engine')
{
  const { enrichedTickets, supportKpis, ticketQueues, agentWorkload, breakdownBy,
    volumeTrend, MACROS, renderMacro, SLA_TARGETS, TICKET_PRIORITIES, SUBJECT_CATEGORY } =
    await import(`${SRC_DIR}/engines/support/supportEngine.js`)
  const { TICKETS } = await import(`${SRC_DIR}/data/seed.js`)

  // Empty first: no tickets on a clean install.
  ok('ticket book starts empty', TICKETS.length === 0)
  const emptyTickets = enrichedTickets()
  ok('enrichment of nothing is nothing', emptyTickets.length === 0)
  const emptyK = supportKpis(emptyTickets)
  ok('desk KPIs are zero without tickets', emptyK.total === 0 && emptyK.open === 0)

  // Hermetic ticket fixture. Open tickets are re-dated into a live window by
  // index, so breach outcomes below follow the engine's own deterministic
  // schedule: i=0 at-risk, i=6/i=7/i=12 healthy, the rest of the open ones
  // breached, and the two resolved ones clean.
  const FIX_TICKETS = [
    { id: 'T-1', customerId: 'C-1', subject: 'GST invoice needed', status: 'Open', priority: 'Urgent' },
    { id: 'T-2', customerId: 'C-2', subject: 'Damaged item received', status: 'Open', priority: 'High' },
    { id: 'T-3', customerId: 'C-3', subject: 'COD not available on pincode', status: 'Open', priority: 'Medium' },
    { id: 'T-4', customerId: 'C-4', subject: 'Size exchange request', status: 'Open', priority: 'Low' },
    { id: 'T-5', customerId: 'C-5', subject: 'Coupon not applying', status: 'Open', priority: 'Urgent' },
    { id: 'T-6', customerId: 'C-6', subject: 'Wrong colour shipped', status: 'Open', priority: 'High' },
    { id: 'T-7', customerId: 'C-7', subject: 'Refund not credited', status: 'Open', priority: 'Medium', firstResponseMins: 20 },
    { id: 'T-8', customerId: 'C-8', subject: 'Delivery delay', status: 'Open', priority: 'Low', firstResponseMins: 60 },
    { id: 'T-9', customerId: 'C-9', subject: 'GST invoice needed', status: 'Open', priority: 'Urgent' },
    { id: 'T-10', customerId: 'C-10', subject: 'Damaged item received', status: 'Resolved', priority: 'Medium', firstResponseMins: 45, csat: 4, createdAt: Date.now() - 3 * 86400000 },
    { id: 'T-11', customerId: 'C-11', subject: 'Coupon not applying', status: 'Resolved', priority: 'Low', firstResponseMins: 30, csat: 5, createdAt: Date.now() - 4 * 86400000 },
    { id: 'T-12', customerId: 'C-12', subject: 'Size exchange request', status: 'Pending customer', priority: 'Medium' },
    { id: 'T-13', customerId: 'C-13', subject: 'Delivery delay', status: 'Open', priority: 'Low', firstResponseMins: 30 },
    { id: 'T-14', customerId: 'C-14', subject: 'Refund not credited', status: 'Open', priority: 'High' },
  ]

  const tickets = enrichedTickets(FIX_TICKETS)
  ok('enriches every fixture ticket', tickets.length === FIX_TICKETS.length)
  // The seed uses 'Medium'; an engine inventing 'Normal' would silently send
  // every ticket to a default SLA.
  ok('every priority has an SLA target', TICKET_PRIORITIES.every(p => SLA_TARGETS[p]))
  ok('every ticket priority is known', tickets.every(t => SLA_TARGETS[t.priority]))
  ok('every subject maps to a real category', tickets.every(t => t.category !== 'Other'))
  ok('categories come from the subject map',
    tickets.every(t => Object.values(SUBJECT_CATEGORY).includes(t.category)))
  ok('resolved tickets are not open', tickets.filter(t => t.status === 'Resolved').every(t => !t.isOpen))
  ok('open tickets carry an SLA clock', tickets.filter(t => t.isOpen).every(t => t.hoursLeft != null))
  ok('closed tickets have no SLA clock', tickets.filter(t => !t.isOpen).every(t => t.hoursLeft === null))
  ok('csat comes straight from the ticket',
    tickets.every(t => t.satisfaction === (t.csat ?? null)))

  const k = supportKpis(tickets)
  ok('open count matches the tickets', k.open === tickets.filter(t => t.isOpen).length)
  // A desk showing 100% breach teaches an operator nothing; the fixture is
  // built so the queues show a real mix of breached, at-risk and healthy work.
  ok('SLA compliance is a believable percentage', k.slaCompliance > 40 && k.slaCompliance < 100, String(k.slaCompliance))
  ok('not every open ticket is breached', k.breached < k.open, `${k.breached}/${k.open}`)
  ok('some open work is still healthy',
    tickets.filter(t => t.isOpen && !t.breached).length > 0)
  ok('csat sits on the 1-5 scale', k.csat >= 1 && k.csat <= 5)

  const q = ticketQueues(tickets)
  ok('the queue holds only open tickets', q.all.every(t => t.isOpen))
  ok('breached work sorts to the front', q.all.every((t, i) => i === 0 || !(t.breached && !q.all[i - 1].breached)))
  ok('the breached queue really is breached', q.breached.every(t => t.breached))
  ok('at-risk tickets are not already breached', q.atRisk.every(t => !t.breached))

  const agents = agentWorkload(tickets)
  ok('every ticket is accounted to an agent',
    agents.reduce((n, a) => n + a.handled, 0) === tickets.length)
  ok('agent csat stays on scale', agents.every(a => a.csat === null || (a.csat >= 1 && a.csat <= 5)))

  for (const field of ['channel', 'category', 'priority', 'status']) {
    const rows = breakdownBy(field, tickets)
    ok(`breakdown by ${field} counts every ticket`,
      rows.reduce((n, r) => n + r.count, 0) === tickets.length)
  }

  ok('volume trend returns the requested window', volumeTrend(tickets).length === 30)

  const macro = renderMacro(MACROS[0], { name: 'Priya' })
  ok('an unfilled macro is not ready to send', macro.ready === false)
  ok('missing placeholders are named', macro.missing.length > 0)
  ok('unfilled placeholders stay visible rather than printing undefined',
    macro.text.includes('{{') && !macro.text.includes('undefined'))
  const full = renderMacro(MACROS[0], { name: 'P', order: 'O', date: 'D', tracking: 'T' })
  ok('a fully filled macro is ready', full.ready === true && !full.text.includes('{{'))
}

section('Content engine')
{
  const { PAGES, BANNERS, BLOG_POSTS, NAVIGATION, contentKpis,
    bannerPerformance, seoAudit, sitemap } =
    await import(`${SRC_DIR}/engines/content/contentEngine.js`)

  // Empty first: a clean install ships no pages, banners or posts.
  ok('pages start empty', PAGES.length === 0)
  ok('banners start empty', BANNERS.length === 0)
  ok('blog posts start empty', BLOG_POSTS.length === 0)
  const emptyK = contentKpis()
  ok('content KPIs are zero without content', emptyK.pages === 0 && emptyK.bannerCtr === 0)
  ok('banner performance is empty', bannerPerformance().length === 0)
  const emptyAudit = seoAudit()
  ok('SEO audit of nothing is clean', emptyAudit.issues.length === 0 && emptyAudit.score === 100)

  // Hermetic fixtures from here on.
  const DAY = 86400000
  const FIX_PAGES = [
    { id: 'PG-1', title: 'About us', slug: 'about', status: 'Published', type: 'Page', seoTitle: 'About our store', seoDescription: 'We sell beautiful ethnic wear across India.', words: 450, views: 1200 },
    { id: 'PG-2', title: 'Shipping info', slug: 'shipping', status: 'Published', type: 'Page', seoTitle: null, seoDescription: 'Our shipping policy covers every pincode in India with free returns within seven days of delivery, no questions asked ever.', words: 200, views: 300 },
    { id: 'PG-3', title: 'Old policy', slug: 'policy', status: 'Archived', type: 'Page', seoTitle: null, seoDescription: null, words: 100, views: 10 },
  ]
  const FIX_BANNERS = [
    { id: 'BN-1', title: 'Diwali sale', status: 'Published', impressions: 10000, clicks: 320, startsAt: Date.now() - DAY, endsAt: Date.now() + DAY },
    { id: 'BN-2', title: 'New arrivals', status: 'Published', impressions: 0, clicks: 0, startsAt: Date.now() - DAY, endsAt: Date.now() + DAY },
  ]
  const FIX_POSTS = [
    { id: 'BP-1', title: 'Style guide', slug: 'style-guide', status: 'Published', views: 500 },
  ]

  const k = contentKpis(FIX_PAGES, FIX_BANNERS, FIX_POSTS)
  ok('counts every page', k.pages === FIX_PAGES.length)
  ok('banner click-through is a sane percentage', k.bannerCtr >= 0 && k.bannerCtr <= 100, String(k.bannerCtr))

  const perf = bannerPerformance(FIX_BANNERS)
  ok('banner performance is sorted by CTR', perf.every((b, i) => i === 0 || perf[i - 1].ctr >= b.ctr))
  ok('a banner with no impressions has no CTR', perf.filter(b => b.impressions === 0).every(b => b.ctr === 0))

  const audit = seoAudit(FIX_PAGES)
  ok('the SEO score is a percentage', audit.score >= 0 && audit.score <= 100)
  ok('every issue names a page and a field', audit.issues.every(i => i.title && i.field))
  ok('archived pages are not audited',
    audit.issues.every(i => FIX_PAGES.find(p => p.id === i.id)?.status !== 'Archived'))

  const map = sitemap(FIX_PAGES, FIX_POSTS, [], [])
  // Categories are { cat, subs } — reading `.name` produced "[object Object]"
  // in every category URL.
  ok('no sitemap URL contains a stringified object', map.entries.every(e => !e.loc.includes('object')))
  ok('sitemap URLs are all rooted', map.entries.every(e => e.loc.startsWith('/')))
  ok('sitemap counts match the entries',
    Object.values(map.byType).reduce((a, b) => a + b, 0) === map.total)
  ok('only published pages are in the sitemap',
    map.entries.filter(e => e.type === 'Page').length === FIX_PAGES.filter(p => p.status === 'Published').length)
  ok('navigation has a header and a footer',
    NAVIGATION.header.length > 0 && NAVIGATION.footer.length > 0)
}

section('Report engine')
{
  const { runReport, SAVED_REPORTS, SCHEDULES, reportKpis, exportHistory, toCsv,
    DIMENSIONS, MEASURES, DIMENSION_KEYS, MEASURE_KEYS } =
    await import(`${SRC_DIR}/engines/reports/reportEngine.js`)

  // Empty first: no saved reports, schedules or export history on a clean install.
  ok('no saved reports yet', SAVED_REPORTS.length === 0)
  ok('no schedules yet', SCHEDULES.length === 0)
  ok('export history starts empty', exportHistory().length === 0)
  ok('every saved report actually runs', SAVED_REPORTS.every(r => runReport(r).ok))
  ok('every saved report returns rows', SAVED_REPORTS.every(r => runReport(r).rows.length > 0))
  ok('every saved report references a real dimension and measure',
    SAVED_REPORTS.every(r => DIMENSIONS[r.dimension] && MEASURES[r.measure]))

  // runReport reads the module's order book, which is empty — an honest empty
  // report beats invented demo rows.
  const report = runReport({ dimension: 'state', measure: 'revenue', days: 90 })
  ok('an empty report still succeeds', report.ok === true)
  ok('an empty report has no rows', report.rows.length === 0)
  ok('an empty report totals zero', report.total === 0)
  ok('rows are sorted high to low', report.rows.every((r, i) => i === 0 || report.rows[i - 1].value >= r.value))
  ok('shares never exceed 100', report.rows.every(r => r.share <= 100))

  // Orders and customers are different record sets; pairing them would return
  // a number that looks real and means nothing.
  const mismatch = runReport({ dimension: 'state', measure: 'customers' })
  ok('refuses to mix incompatible sources', mismatch.ok === false)
  ok('and explains why', /same source/i.test(mismatch.reason))
  ok('rejects an unknown dimension', runReport({ dimension: 'nope', measure: 'revenue' }).ok === false)

  const csv = toCsv(report)
  ok('CSV has a header plus one line per row', csv.split('\n').length === report.rows.length + 1)
  ok('CSV header names the dimension and measure',
    csv.split('\n')[0].includes('State') && csv.split('\n')[0].includes('Revenue'))
  ok('CSV of a failed report is empty', toCsv(mismatch) === '')

  const history = exportHistory()
  ok('export history is empty without saved reports', history.length === 0)
  ok('failed exports explain themselves', history.filter(h => h.status === 'Failed').every(h => h.error))
  ok('completed exports carry no error', history.filter(h => h.status === 'Complete').every(h => h.error === null))

  const k = reportKpis()
  ok('report KPIs are zero without saved reports', k.saved === 0 && k.schedules === 0)
  ok('schedule counts add up', k.activeSchedules <= k.schedules)
  ok('success rate is a percentage', k.successRate >= 0 && k.successRate <= 100)
}

section('Integration engine — real provider registry (no fake data)')
{
  const { PROVIDER_CATEGORIES, PROVIDERS, getProviders, getProvider } =
    await import(`${SRC_DIR}/engines/integrations/providers.js`)
  const store =
    await import(`${SRC_DIR}/engines/integrations/store.js`)
  const { WEBHOOK_EVENTS, samplePayload } =
    await import(`${SRC_DIR}/engines/integrations/integrationEngine.js`)

  // Registry shape
  ok('eight provider categories exist', PROVIDER_CATEGORIES.length === 8)
  ok('every category has at least one provider',
    PROVIDER_CATEGORIES.every(c => getProviders(c.id).length >= 1))
  ok('every provider has id, name, tagline, docsUrl and fields',
    PROVIDERS.every(p => p.id && p.name && p.tagline && /^https:\/\//.test(p.docsUrl) && Array.isArray(p.fields)))
  ok('every field has key, label, type, envVar and required flag',
    PROVIDERS.every(p => p.fields.every(f => f.key && f.label && ['text', 'password', 'url'].includes(f.type) && f.envVar && typeof f.required === 'boolean')))
  ok('provider ids are unique within a category',
    PROVIDER_CATEGORIES.every(c => {
      const ids = getProviders(c.id).map(p => p.id)
      return new Set(ids).size === ids.length
    }))
  ok('getProvider returns null for unknown ids', getProvider('database', 'nope') === null)
  ok('every provider exposes an async testConnection',
    PROVIDERS.every(p => typeof p.testConnection === 'function'))

  // The exact categories the task requires
  for (const cat of ['database', 'auth', 'payments', 'storage', 'sms', 'email', 'analytics', 'shipping']) {
    ok(`category ${cat} exists`, getProviders(cat).length > 0)
  }
  ok('supabase is a database provider', getProvider('database', 'supabase')?.name === 'Supabase')
  ok('local-dev is clearly labelled development-only',
    /development only/i.test(getProvider('database', 'local-dev')?.tagline ?? ''))

  // Store contract
  for (const fn of ['getProviders', 'getProvider', 'getIntegrationConfig', 'setIntegrationConfig',
    'clearIntegration', 'isConfigured', 'getEnvStatus', 'getEffectiveValue']) {
    ok(`store exports ${fn}`, typeof store[fn] === 'function')
  }

  // Nothing configured out of the box — no fake "Connected" anywhere
  store.clearIntegration('database')
  ok('fresh category has no provider', store.getIntegrationConfig('database').providerId === null)
  ok('fresh category is not configured', store.isConfigured('database') === false)

  // Secrets are NEVER persisted
  store.setIntegrationConfig('database', 'supabase', { url: 'https://x.supabase.co', anonKey: 'SECRET-ABC' })
  const saved = store.getIntegrationConfig('database')
  ok('provider choice is persisted', saved.providerId === 'supabase')
  ok('non-secret values are persisted', saved.config.url === 'https://x.supabase.co')
  ok('secret values are stripped before persistence', !('anonKey' in saved.config))

  // isConfigured honours required fields
  store.setIntegrationConfig('analytics', 'ga4', {})
  ok('missing required field means not configured', store.isConfigured('analytics') === false)
  store.setIntegrationConfig('analytics', 'ga4', { measurementId: 'G-TEST1234' })
  ok('all required fields means configured', store.isConfigured('analytics') === true)

  // Env helpers never reveal values
  ok('getEnvStatus reports only set|missing',
    ['set', 'missing'].includes(store.getEnvStatus('VITE_SUPABASE_URL')))
  ok('missing env var reports missing', store.getEnvStatus('VITE_DEFINITELY_NOT_SET_BC') === 'missing')
  const gaField = getProvider('analytics', 'ga4').fields[0]
  ok('getEffectiveValue prefers saved config when env is absent',
    store.getEffectiveValue(gaField, { measurementId: 'G-XYZ' }) === 'G-XYZ')

  // Real testConnection behaviour — honest failures, no fake successes
  const ga4 = getProvider('analytics', 'ga4')
  const badGa = await ga4.testConnection({ measurementId: 'not-a-ga-id' })
  ok('ga4 rejects a malformed measurement id', badGa.ok === false && /G-/.test(badGa.message))
  const goodGa = await ga4.testConnection({ measurementId: 'G-ABCDEF1234' })
  ok('ga4 accepts a well-formed measurement id', goodGa.ok === true)

  const neon = getProvider('database', 'neon')
  const neonRes = await neon.testConnection({ connectionString: 'postgresql://u:p@host/db' })
  ok('neon is honest about browser limits',
    neonRes.ok === false && /could not verify/i.test(neonRes.message))

  const badSupabase = await getProvider('database', 'supabase')
    .testConnection({ url: 'https://127.0.0.1:9', anonKey: 'x' })
  ok('unreachable supabase reports could-not-verify, not success',
    badSupabase.ok === false && /could not verify/i.test(badSupabase.message))

  const localDev = await getProvider('database', 'local-dev').testConnection({})
  ok('local-dev test is honest about being local', localDev.ok === true && /localstorage/i.test(localDev.message))

  // Webhooks: start empty, add/remove round-trips, no fake stats
  ok('webhook list starts empty', store.getWebhooks().length === 0)
  const hook = store.addWebhook({ url: 'https://example.com/hook', events: ['order.created'] })
  ok('added webhook keeps its url and events',
    hook.url === 'https://example.com/hook' && hook.events.includes('order.created'))
  ok('added webhook gets a signing secret', typeof hook.secret === 'string' && hook.secret.length >= 32)
  ok('new webhook has no fake delivery history', hook.lastTestAt === null && hook.lastTest === null)
  store.recordWebhookTest(hook.id, { ok: true, httpStatus: 200, error: null })
  const [after] = store.getWebhooks()
  ok('test results record the real outcome', after.lastTest?.ok === true && after.lastTest?.httpStatus === 200)
  store.removeWebhook(hook.id)
  ok('webhook removal works', store.getWebhooks().length === 0)

  // Webhook events + payload builder (used for real test deliveries)
  ok('webhook events are a non-empty list', WEBHOOK_EVENTS.length > 0)
  ok('every event produces a payload', WEBHOOK_EVENTS.every(e => Boolean(samplePayload(e).data)))
  ok('payloads name their event', samplePayload('order.paid').event === 'order.paid')
  ok('payloads are marked as test deliveries', samplePayload('order.paid').test === true)

  // Clean up so no test residue leaks into other suites
  store.clearIntegration('database')
  store.clearIntegration('analytics')
}

section('Device profile — the mobile smoothness gate')
{
  const mod = `${SRC_DIR}/ui/useDeviceProfile.js`
  const { getDeviceProfile, loop } = await import(mod)
  const profile = getDeviceProfile()
  ok('reports a tier', ['low', 'medium', 'high'].includes(profile.tier))
  ok('loops are never enabled below the top tier',
    profile.tier === 'high' ? true : profile.loops === false)
  ok('blur is never enabled on a narrow viewport', profile.narrow ? profile.blur === false : true)
  const t = loop({ duration: 2 })
  ok('loop() returns a valid transition either way',
    t.repeat === Infinity || t.duration === 0)
}

section('Route transition can never strand a page invisible')
{
  // Guard the actual fix. If someone reintroduces a JS-animated opacity around
  // the Suspense boundary, these fail.
  // Strip comments before grepping: both files explain the old bug in prose,
  // and matching that prose would report the bug as still present.
  const stripComments = src => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  const appSrc = stripComments(await readFile(`${SRC_DIR}/App.jsx`, 'utf8'))
  const wrapSrc = stripComments(await readFile(`${SRC_DIR}/ui/RouteTransition.jsx`, 'utf8'))

  ok('the admin routes are wrapped in RouteTransition', appSrc.includes('<RouteTransition'))
  ok('PageFade no longer wraps the admin routes', !appSrc.includes('<PageFade'))
  ok('Suspense sits outside the transition, not inside',
    wrapSrc.indexOf('<Suspense') < wrapSrc.indexOf('<PageEnter'))
  ok('the transition uses no AnimatePresence', !wrapSrc.includes('AnimatePresence'))
  ok('the transition does not animate opacity from JavaScript',
    !/initial=\{\{[^}]*opacity/.test(wrapSrc))

  const css = await readFile(`${SRC_DIR}/index.css`, 'utf8')
  ok('a CSS keyframe provides the entrance instead', css.includes('@keyframes route-enter'))
  ok('the entrance animation uses fill mode both so it cannot end transparent',
    /\.route-enter\s*\{[^}]*both/.test(css))
  ok('reduced motion disables the entrance', /prefers-reduced-motion[^}]*\}[\s\S]{0,120}route-enter/.test(css)
    || css.includes('.route-enter { animation: none; }'))
}

section('Sidebar reaches the 20-tab target')
{
  const src = await readFile(`${SRC_DIR}/App.jsx`, 'utf8')
  const navBlock = src.slice(src.indexOf('const NAV = ['), src.indexOf('const GROUPS = ['))
  const ids = [...navBlock.matchAll(/\{ id: '([a-z]+)'/g)].map(m => m[1])
  ok('the sidebar has at least 20 tabs', ids.length >= 20, `${ids.length} tabs`)
  ok('every sidebar tab is unique', new Set(ids).size === ids.length)
  ok('every sidebar tab has a route', ids.every(id => src.includes(`path="${id}"`) || id === 'dashboard'))
  ok('every tested route is in the sidebar', ROUTES.every(r => ids.includes(r)))
  ok('every sidebar tab is covered by the route smoke test', ids.every(id => ROUTES.includes(id)))
}


console.log(`\n${pass} passed · ${fail} failed`)
process.exit(fail ? 1 : 0)
