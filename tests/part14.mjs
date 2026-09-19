/**
 * Part 14 — backend DATA adapter layer (src/engines/backend/).
 *
 * Covers the BackendAdapter interface contract, conformance of every data
 * adapter (local / supabase / firebase / neon / rest), local CRUD
 * round-trips, cloud adapters against a mocked fetch (NO real network in
 * tests), Neon's parameterized SQL building, getBackend() selection +
 * honest fallback, and the rule that secrets are never logged or persisted.
 * Run: npx vite-node tests/part14.mjs
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { BackendError, assertConforms, INTERFACE_METHODS } from '../src/engines/backend/BackendAdapter.js'
import { createLocalAdapter } from '../src/engines/backend/adapters/local.js'
import { createSupabaseAdapter } from '../src/engines/backend/adapters/supabase.js'
import {
  createFirebaseAdapter, encodeDoc, decodeDoc, decodeValue,
} from '../src/engines/backend/adapters/firebase.js'
import { createNeonAdapter, buildWhere } from '../src/engines/backend/adapters/neon.js'
import { createRestAdapter } from '../src/engines/backend/adapters/rest.js'
import {
  getBackend, resetBackend, backendInfo, isCloudBackend, resolveDatabaseConfig,
} from '../src/engines/backend/index.js'
import {
  setIntegrationConfig, clearIntegration, getIntegrationConfig,
} from '../src/engines/integrations/store.js'

const TESTS_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(TESTS_DIR, '..')

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++ } else { fail++; console.log('  ✗', name, extra) }
}
const throwsBackendError = async (name, fn, code) => {
  try {
    await fn()
    ok(name, false, 'did not throw')
  } catch (err) {
    ok(name, err instanceof BackendError && (!code || err.code === code),
      `got ${err?.constructor?.name}:${err?.code} ${String(err?.message).slice(0, 90)}`)
  }
}

/* ------------------------------------------------------------------ */
/* A. Interface conformance                                            */
/* ------------------------------------------------------------------ */
{
  ok('interface lists 15 methods', INTERFACE_METHODS.length === 15, INTERFACE_METHODS.length)

  const local = createLocalAdapter()
  ok('local conforms', assertConforms(local) === true)
  ok('local is dev-only', local.isDevOnly === true && local.id === 'local')
  ok('local warns honestly', /browser/i.test(local.warning || ''))

  // Cloud factories throw an HONEST error (synchronously) without config —
  // never a fake success.
  for (const [label, factory] of [
    ['supabase', createSupabaseAdapter],
    ['firebase', createFirebaseAdapter],
    ['neon', createNeonAdapter],
    ['rest', createRestAdapter],
  ]) {
    try {
      factory({})
      ok(`${label} unconfigured throws`, false, 'did not throw')
    } catch (err) {
      ok(`${label} unconfigured throws`, err instanceof BackendError && err.code === 'not_configured')
    }
  }

  // With dummy config they construct and conform (no network touched).
  ok('supabase conforms', assertConforms(createSupabaseAdapter({ url: 'https://x.supabase.co', anonKey: 'k' })))
  ok('firebase conforms', assertConforms(createFirebaseAdapter({ apiKey: 'k', projectId: 'p' })))
  ok('neon conforms', assertConforms(createNeonAdapter({ connectionString: 'postgresql://u:p@h/db' })))
  ok('rest conforms', assertConforms(createRestAdapter({ base: 'https://api.example.test' })))

  try {
    assertConforms({ id: 'fake', listProducts: async () => {} })
    ok('partial adapter rejected', false)
  } catch (err) {
    ok('partial adapter rejected', err instanceof BackendError && /missing methods/.test(err.message))
  }
}

/* ------------------------------------------------------------------ */
/* B. Local adapter round-trips (memory storage in node)               */
/* ------------------------------------------------------------------ */
{
  const db = createLocalAdapter()

  const p = await db.createProduct({ id: 'TP1', name: 'Banarasi Saree', price: 2999, brand: 'Weaves', sku: 'BS-1', status: 'active' })
  ok('local createProduct', p.id === 'TP1' && p.name === 'Banarasi Saree')
  ok('local getProduct', (await db.getProduct('TP1'))?.price === 2999)
  ok('local getProduct missing → null', (await db.getProduct('nope')) === null)

  const upd = await db.updateProduct('TP1', { price: 2799 })
  ok('local updateProduct', upd.price === 2799)

  await db.createProduct({ id: 'TP2', name: 'Cotton Kurti', price: 849, brand: 'Weaves', status: 'active' })
  await db.createProduct({ id: 'TP3', name: 'Silk Shirt', price: 1499, brand: 'Loom', status: 'draft' })

  const all = await db.listProducts({})
  ok('local listProducts count', all.count === 3 && all.rows.length === 3, JSON.stringify(all.count))

  const filtered = await db.listProducts({ filter: { status: 'active' } })
  ok('local filter eq', filtered.count === 2)
  const gte = await db.listProducts({ filter: { price: { op: 'gte', value: 1000 } } })
  ok('local filter gte', gte.count === 2)
  const sorted = await db.listProducts({ sort: ['price', 'desc'], limit: 2 })
  ok('local sort+limit', sorted.rows[0].price === 2799 && sorted.rows.length === 2)
  const paged = await db.listProducts({ sort: ['price', 'asc'], limit: 1, offset: 1 })
  ok('local offset', paged.rows[0].id === 'TP3' && paged.count === 3)
  const searched = await db.listProducts({ search: 'kurti' })
  ok('local search', searched.count === 1 && searched.rows[0].id === 'TP2')

  await db.deleteProduct('TP3')
  ok('local deleteProduct', (await db.getProduct('TP3')) === null)

  // Categories (interface is list-only; seed rows through the raw table).
  const rawLocal = (await import('../src/backend/adapters/local.js')).default
  await rawLocal.db.insert('categories', { id: 'C1', name: 'Ethnic', sortOrder: 2 })
  await rawLocal.db.insert('categories', { id: 'C2', name: 'Western', sortOrder: 1 })
  const cats = await db.listCategories()
  ok('local listCategories sorted', cats.length === 2 && cats[0].name === 'Western')

  // Orders with items.
  const order = await db.createOrder({
    id: 'O1', customerId: 'CU1', total: 3798,
    items: [{ productId: 'TP1', name: 'Banarasi Saree', qty: 1, price: 2799 }],
  })
  ok('local createOrder', order.id === 'O1' && order.items.length === 1 && order.status === 'pending')
  const fetched = await db.getOrder('O1')
  ok('local getOrder embeds items', fetched?.items?.[0]?.productId === 'TP1')
  const shipped = await db.updateOrderStatus('O1', 'shipped')
  ok('local updateOrderStatus', shipped.status === 'shipped')
  ok('local getOrder missing → null', (await db.getOrder('nope')) === null)

  // Customers.
  const cu = await db.upsertCustomer({ id: 'CU1', name: 'Priya', email: 'priya@example.test' })
  ok('local upsertCustomer create', cu.id === 'CU1')
  const cu2 = await db.upsertCustomer({ id: 'CU1', name: 'Priya Menon' })
  ok('local upsertCustomer update', cu2.name === 'Priya Menon' && cu2.email === 'priya@example.test')
  ok('local getCustomer', (await db.getCustomer('CU1'))?.name === 'Priya Menon')

  // Settings.
  ok('local getSetting missing → null', (await db.getSetting('nope')) === null)
  await db.setSetting('storeName', 'Test Store')
  ok('local setSetting/getSetting', (await db.getSetting('storeName')) === 'Test Store')
  await db.setSetting('flags', { cod: true })
  ok('local setting object value', (await db.getSetting('flags'))?.cod === true)
}

/* ------------------------------------------------------------------ */
/* C. Supabase adapter (mocked fetch — no network)                     */
/* ------------------------------------------------------------------ */
const realFetch = globalThis.fetch
const mockFetch = (handler) => { globalThis.fetch = handler }
const jsonResponse = (data, { status = 200, contentRange = null } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => (String(k).toLowerCase() === 'content-range' ? contentRange : null) },
  json: async () => data,
})
{
  const SECRET = 'sb_anon_SECRET_12345'
  const seen = []
  mockFetch(async (url, init = {}) => {
    seen.push({ url, init })
    return jsonResponse([{ id: 'P1', name: 'Saree' }], { contentRange: '0-0/42' })
  })
  const db = createSupabaseAdapter({ url: 'https://demo.supabase.co', anonKey: SECRET })

  const { rows, count } = await db.listProducts({
    filter: { status: 'active', price: { op: 'gte', value: 100 }, tags: { op: 'like', value: 'silk' } },
    sort: ['price', 'desc'], limit: 5,
  })
  ok('supabase list rows+count', rows.length === 1 && count === 42, JSON.stringify({ rows, count }))
  const call = seen[0]
  ok('supabase hits PostgREST', call.url.startsWith('https://demo.supabase.co/rest/v1/products?'))
  ok('supabase filter mapping',
    /status=eq\.active/.test(call.url) && /price=gte\.100/.test(call.url) && /tags=ilike\.\*silk\*/.test(call.url), call.url)
  ok('supabase sort/limit', /order=price\.desc/.test(call.url) && /limit=5/.test(call.url))
  ok('supabase count=exact', (call.init.headers.Prefer || '').includes('count=exact'))
  ok('supabase auth headers', call.init.headers.apikey === SECRET && call.init.headers.Authorization === `Bearer ${SECRET}`)

  // getSetting must query the `key` column, not `id`.
  seen.length = 0
  mockFetch(async (url, init = {}) => {
    seen.push({ url, init })
    return { ok: false, status: 406, headers: { get: () => null }, json: async () => ({}) }
  })
  ok('supabase getSetting missing → null', (await db.getSetting('theme')) === null)
  ok('supabase setting uses key column', /settings\?key=eq\.theme/.test(seen[0].url), seen[0].url)
  ok('supabase object Accept header', seen[0].init.headers.Accept === 'application/vnd.pgrst.object+json')

  seen.length = 0
  mockFetch(async (url, init = {}) => {
    seen.push({ url, init })
    return jsonResponse([{ id: 'P9', name: 'New' }])
  })
  const created = await db.createProduct({ name: 'New' })
  ok('supabase createProduct', created.id === 'P9' && seen[0].init.method === 'POST')

  // Honest errors: name the fix, never the secret.
  mockFetch(async () => jsonResponse({ message: 'Invalid API key', code: '401' }, { status: 401 }))
  try {
    await db.listProducts({})
    ok('supabase 401 throws', false)
  } catch (err) {
    ok('supabase 401 throws', err instanceof BackendError)
    ok('supabase error hides secret', !String(err.message).includes(SECRET), err.message.slice(0, 60))
    ok('supabase error is honest', /anon key|tables|schema/i.test(err.message))
  }

  mockFetch(async () => { throw new TypeError('fetch failed') })
  await throwsBackendError('supabase network failure', () => db.listProducts({}), 'network_error')
  mockFetch(realFetch)
}

/* ------------------------------------------------------------------ */
/* D. Firebase adapter                                                 */
/* ------------------------------------------------------------------ */
{
  const original = {
    name: 'Saree', price: 999, rating: 4.5, inStock: true, sku: null,
    tags: ['silk', 'handloom'], dims: { w: 10, h: 20 },
    createdAt: new Date('2026-01-02T03:04:05Z'),
  }
  const decoded = decodeDoc(encodeDoc(original))
  ok('firestore codec round-trip',
    decoded.name === 'Saree' && decoded.price === 999 && decoded.rating === 4.5 &&
    decoded.inStock === true && decoded.sku === null &&
    decoded.tags.join(',') === 'silk,handloom' && decoded.dims.w === 10 &&
    typeof decoded.createdAt === 'string')
  ok('firestore decodeValue primitives',
    decodeValue({ integerValue: '7' }) === 7 && decodeValue({ nullValue: null }) === null)

  const SECRET = 'AIza_FIREBASE_SECRET_999'
  const db = createFirebaseAdapter({ apiKey: SECRET, projectId: 'demo-proj' })

  // Firestore has no substring operator — the adapter says so honestly.
  await throwsBackendError('firestore like → honest error',
    () => db.listProducts({ filter: { name: { op: 'like', value: 'saree' } } }), 'unsupported')

  const seen = []
  mockFetch(async (url, init = {}) => {
    seen.push({ url, init })
    return jsonResponse([{
      document: {
        name: 'projects/demo-proj/databases/(default)/documents/products/abc',
        fields: { name: { stringValue: 'Saree' }, price: { integerValue: '999' } },
      },
    }])
  })
  const { rows } = await db.listProducts({ filter: { status: 'active' }, limit: 10 })
  ok('firestore runQuery decodes', rows.length === 1 && rows[0].id === 'abc' && rows[0].price === 999)
  const body = JSON.parse(seen[0].init.body)
  ok('firestore structured query',
    body.structuredQuery.from[0].collectionId === 'products' && body.structuredQuery.limit === 10)
  ok('firestore uses POST :runQuery', seen[0].init.method === 'POST' && /:runQuery\?key=/.test(seen[0].url))

  mockFetch(async () => ({ ok: false, status: 404, headers: { get: () => null }, json: async () => ({ error: { message: 'Not found', status: 'NOT_FOUND' } }) }))
  ok('firestore getSetting missing → null', (await db.getSetting('nope')) === null)

  mockFetch(async () => jsonResponse({ error: { message: `PERMISSION_DENIED: bad key ${SECRET}`, status: 'PERMISSION_DENIED' } }, { status: 403 }))
  try {
    await db.listProducts({})
    ok('firestore 403 throws', false)
  } catch (err) {
    ok('firestore 403 throws', err instanceof BackendError)
    ok('firestore error redacts key', !String(err.message).includes(SECRET), err.message.slice(0, 80))
    ok('firestore 403 mentions rules', /rules/i.test(err.message))
  }
  mockFetch(realFetch)
}

/* ------------------------------------------------------------------ */
/* E. Neon adapter — SQL building is pure and parameterized            */
/* ------------------------------------------------------------------ */
{
  const w = buildWhere({
    status: 'active', price: { op: 'gte', value: 100 },
    name: { op: 'like', value: 'saree' }, id: { op: 'in', value: ['a', 'b'] },
  })
  ok('neon buildWhere text',
    w.text === 'WHERE "status" = $1 AND "price" >= $2 AND "name" ILIKE $3 AND "id" IN ($4, $5)', w.text)
  ok('neon buildWhere params', JSON.stringify(w.params) === JSON.stringify(['active', 100, '%saree%', 'a', 'b']))
  ok('neon values never interpolated', !w.text.includes('active') && !w.text.includes('saree'))
  const empty = buildWhere({})
  ok('neon empty filter', empty.text === '' && empty.params.length === 0)
  try {
    buildWhere({ 'price; DROP TABLE x': 'v' })
    ok('neon rejects unsafe column', false)
  } catch (err) {
    ok('neon rejects unsafe column', err instanceof BackendError && err.code === 'bad_column')
  }
  // The driver itself only loads on first query — construction is offline-safe.
  ok('neon factory offline-safe',
    typeof createNeonAdapter({ connectionString: 'postgresql://u:p@h/db' }).listProducts === 'function')
}

/* ------------------------------------------------------------------ */
/* F. REST adapter (mocked fetch)                                      */
/* ------------------------------------------------------------------ */
{
  const SECRET = 'rest_api_SECRET_token'
  const seen = []
  const db = createRestAdapter({ base: 'https://api.example.test', apiKey: SECRET })

  mockFetch(async (url, init = {}) => {
    seen.push({ url, init })
    return jsonResponse({ data: [{ id: 'P1' }], total: 7 })
  })
  const r1 = await db.listProducts({ filter: { price: { op: 'gte', value: 100 } }, sort: ['price', 'desc'], limit: 5 })
  ok('rest normalizes {data,total}', r1.rows.length === 1 && r1.count === 7)
  ok('rest bearer header', seen[0].init.headers.Authorization === `Bearer ${SECRET}`)
  ok('rest filter encoding', /price%5Bgte%5D=100|price\[gte\]=100/.test(seen[0].url), seen[0].url)
  ok('rest sort/limit', /sort=price/.test(seen[0].url) && /limit=5/.test(seen[0].url))

  mockFetch(async (url) => {
    seen.push({ url })
    return jsonResponse([{ id: 'P2' }]) // bare array also accepted
  })
  const r2 = await db.listProducts({})
  ok('rest accepts bare array', r2.rows.length === 1 && r2.count === 1)

  mockFetch(async () => ({ ok: false, status: 404, headers: { get: () => null }, json: async () => ({}) }))
  ok('rest 404 → null', (await db.getProduct('nope')) === null)

  const noAuth = createRestAdapter({ base: 'https://api.example.test' })
  const seen2 = []
  mockFetch(async (url, init = {}) => { seen2.push(init); return jsonResponse([]) })
  await noAuth.listProducts({})
  ok('rest no auth header without key', !('Authorization' in seen2[0].headers))

  mockFetch(async () => jsonResponse({ message: 'boom' }, { status: 500 }))
  try {
    await db.listProducts({})
    ok('rest 500 throws', false)
  } catch (err) {
    ok('rest 500 throws', err instanceof BackendError)
    ok('rest error hides token', !String(err.message).includes(SECRET))
    ok('rest error points at contract', /docs\/16-BACKEND/.test(err.message))
  }
  mockFetch(realFetch)
}

/* ------------------------------------------------------------------ */
/* G. getBackend() selection, fallback, honesty                        */
/* ------------------------------------------------------------------ */
{
  clearIntegration('database')
  resetBackend()
  ok('no config → local fallback', getBackend().id === 'local')
  const info0 = backendInfo()
  ok('backendInfo honest when empty', info0.isDevOnly && info0.configured && !info0.misconfigured)
  ok('isCloudBackend false when local', isCloudBackend() === false)

  setIntegrationConfig('database', 'local-dev', {})
  resetBackend()
  ok('local-dev → local', getBackend().id === 'local')

  // Selected but incomplete → local fallback + misconfigured flag (no fake success).
  // Spy here: this is the first misconfigured selection in the process, so the
  // loud warn-once fires now.
  const warnCapture = []
  const origWarn = console.warn
  console.warn = (...a) => warnCapture.push(a.join(' '))
  setIntegrationConfig('database', 'supabase', { url: 'https://demo.supabase.co' })
  resetBackend()
  ok('incomplete supabase → local', getBackend().id === 'local')
  console.warn = origWarn
  ok('fallback warns loudly', warnCapture.some(l => /\[backend\]/.test(l) && /Integrations/.test(l)),
    warnCapture.join(' | ').slice(0, 160))
  const info1 = backendInfo()
  ok('misconfigured flagged', info1.misconfigured === true && info1.selectedProvider === 'supabase')
  ok('misconfigured detail names fix', /Integrations/.test(info1.detail))

  // Fully configured via env. vite-node snapshots import.meta.env per module
  // at process start, so in-process assignment is invisible across modules —
  // the honest way to test env-based selection is a child process launched
  // WITH the variables set.
  {
    const childPath = join(tmpdir(), `bc-backend-env-child-${process.pid}.mjs`)
    writeFileSync(childPath, `
import { getBackend, resetBackend, isCloudBackend, backendInfo, resolveDatabaseConfig }
  from ${JSON.stringify(resolve(ROOT, 'src/engines/backend/index.js'))}
import { setIntegrationConfig }
  from ${JSON.stringify(resolve(ROOT, 'src/engines/integrations/store.js'))}
setIntegrationConfig('database', 'supabase', {})
resetBackend()
const cfg = resolveDatabaseConfig()
console.log(JSON.stringify({
  selected: getBackend().id,
  cloud: isCloudBackend(),
  infoId: backendInfo().id,
  providerId: cfg.providerId,
  url: cfg.values.url,
  anonKey: cfg.values.anonKey,
}))
`)
    let res = null
    try {
      const out = execFileSync('npx', ['vite-node', childPath], {
        cwd: ROOT,
        env: {
          ...process.env,
          VITE_SUPABASE_URL: 'https://demo.supabase.co',
          VITE_SUPABASE_ANON_KEY: 'child_anon_key',
        },
        encoding: 'utf8',
        timeout: 90000,
      })
      res = JSON.parse(out.trim().split('\n').pop())
    } catch (e) {
      ok('env child process ran', false, String(e.message).slice(0, 200))
    }
    ok('env: resolveDatabaseConfig reads env',
      res?.providerId === 'supabase' && res?.url === 'https://demo.supabase.co' && res?.anonKey === 'child_anon_key',
      JSON.stringify(res))
    ok('env: configured supabase selected', res?.selected === 'supabase')
    ok('env: backendInfo cloud', res?.infoId === 'supabase')
    ok('env: isCloudBackend true', res?.cloud === true)
  }

  // Secrets are stripped from persisted config even when passed in.
  setIntegrationConfig('database', 'supabase', { url: 'https://demo.supabase.co', anonKey: 'SHOULD_BE_STRIPPED' })
  const persisted = getIntegrationConfig('database')
  ok('secret stripped from storage', !('anonKey' in persisted.config) && persisted.config.url === 'https://demo.supabase.co')

  clearIntegration('database')
  resetBackend()
  ok('cleared → local again', getBackend().id === 'local')
}

/* ------------------------------------------------------------------ */
/* H. Secrets are never logged                                         */
/* ------------------------------------------------------------------ */
{
  const SECRET = 'TOP_SECRET_VALUE_abcdef'
  const captured = []
  const orig = { log: console.log, warn: console.warn, error: console.error }
  console.log = (...a) => captured.push(a.join(' '))
  console.warn = (...a) => captured.push(a.join(' '))
  console.error = (...a) => captured.push(a.join(' '))

  try {
    // Misconfigured selection → loud fallback warning.
    setIntegrationConfig('database', 'supabase', { url: 'https://x.example.test' })
    resetBackend()
    getBackend()

    // Failing supabase call with the secret as the key.
    const db = createSupabaseAdapter({ url: 'https://demo.supabase.co', anonKey: SECRET })
    mockFetch(async () => { throw new TypeError('fetch failed') })
    await db.listProducts({}).catch(() => {})

    // Failing firebase call where the server echoes the key back.
    const fb = createFirebaseAdapter({ apiKey: SECRET, projectId: 'p' })
    mockFetch(async () => jsonResponse({ error: { message: `bad key ${SECRET}`, status: 'INVALID' } }, { status: 400 }))
    await fb.listProducts({}).catch(() => {})

    // Neon: connection string in an error path.
    const neon = createNeonAdapter({ connectionString: `postgresql://u:${SECRET}@host/db` })
    void neon
    try { buildWhere({ 'a"b': 1 }) } catch { /* expected */ }
  } finally {
    clearIntegration('database')
    resetBackend()
    mockFetch(realFetch)
    console.log = orig.log
    console.warn = orig.warn
    console.error = orig.error
  }

  const leaked = captured.filter(line => line.includes(SECRET))
  ok('no secret in console output', leaked.length === 0, leaked.slice(0, 2).join(' | ').slice(0, 200))
}

console.log(`\npart14: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
