/**
 * BackendAdapter — the documented data-layer interface for BharatCart.
 *
 * Every backend (local dev storage, Supabase, Firebase, Neon, a generic REST
 * API) implements exactly these methods, so the app never knows which
 * database is active. The active backend is chosen in Admin → Integrations →
 * Database; `src/engines/backend/index.js` resolves it via getBackend().
 *
 * CONTRACT
 *  - Every method is async.
 *  - Methods THROW on failure — always a BackendError with an honest,
 *    human-readable message (what is missing, where to fix it). There are no
 *    fake successes: a method that cannot work without configuration throws
 *    instead of pretending.
 *  - "Not found" is NOT an error: getProduct / getOrder / getCustomer /
 *    getSetting return null when the record does not exist.
 *  - Secrets (API keys, connection strings) are NEVER included in error
 *    messages, logs, or persisted state. They live in VITE_ env vars and are
 *    held in memory only for the duration of a request.
 *
 * LIST PARAMS (shared by listProducts / listOrders / listCustomers)
 *  {
 *    filter: { field: value | value[] | { op, value } },
 *            ops: eq (default), ne, gt, gte, lt, lte, in, like
 *            (like = case-insensitive substring; adapters that cannot do it
 *            server-side throw an honest BackendError),
 *    sort:   'name' | ['price', 'desc'],
 *    limit:  number, offset: number,
 *    search: string   // free-text hint; adapters map it honestly or ignore it
 *  }
 *  List methods resolve to { rows: [...], count: totalMatchingRows }.
 *
 * TABLES (Postgres-flavoured backends — see supabase/schema.sql)
 *  products, categories, orders, order_items, customers, settings
 */

/** Honest, typed error thrown by every adapter method on failure. */
export class BackendError extends Error {
  constructor(message, { code = 'backend_error', provider = null, status = null } = {}) {
    super(message)
    this.name = 'BackendError'
    this.code = code
    this.provider = provider
    this.status = status
  }
}

/** The 15 data methods every adapter must implement. */
export const INTERFACE_METHODS = [
  'listProducts', 'getProduct', 'createProduct', 'updateProduct', 'deleteProduct',
  'listCategories',
  'listOrders', 'getOrder', 'createOrder', 'updateOrderStatus',
  'listCustomers', 'getCustomer', 'upsertCustomer',
  'getSetting', 'setSetting',
]

/**
 * Throws if the object does not implement the full interface. Called by
 * getBackend() before an adapter is cached, and by the test suite for every
 * adapter. A partially-implemented adapter is a lie the app cannot afford.
 */
export function assertConforms(adapter) {
  if (!adapter || typeof adapter !== 'object') {
    throw new BackendError('Backend adapter is not an object.', { code: 'invalid_adapter' })
  }
  const missing = INTERFACE_METHODS.filter(m => typeof adapter[m] !== 'function')
  if (missing.length) {
    throw new BackendError(
      `Backend adapter "${adapter.id || 'unknown'}" is missing methods: ${missing.join(', ')}.`,
      { code: 'invalid_adapter', provider: adapter.id }
    )
  }
  return true
}

/** Standard "you have not connected this yet" error. Never a fake success. */
export function notConfiguredError(providerLabel) {
  return new BackendError(
    `"${providerLabel}" is not configured. Connect it in Admin → Integrations → Database, ` +
    'or set the matching VITE_ variables from .env.example. Nothing was read or written.',
    { code: 'not_configured', provider: providerLabel }
  )
}

/** Normalise the shared list params every list* method accepts. */
export function normalizeListParams(params = {}) {
  const { filter = {}, sort = null, limit = null, offset = 0, search = '' } = params
  let sortKey = null
  let sortDir = 'asc'
  if (Array.isArray(sort)) {
    sortKey = sort[0] || null
    sortDir = String(sort[1] || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc'
  } else if (typeof sort === 'string' && sort) {
    sortKey = sort
  }
  return {
    filter: filter && typeof filter === 'object' ? filter : {},
    sortKey, sortDir,
    limit: limit == null ? null : Math.max(0, Number(limit) | 0),
    offset: Math.max(0, Number(offset) | 0),
    search: String(search || ''),
  }
}

/**
 * Split a filter value into { op, value }. Accepts:
 *   'Shirts'            → { op: 'eq', value: 'Shirts' }
 *   ['a','b']           → { op: 'in', value: ['a','b'] }
 *   { op: 'gt', value } → as-is (validated)
 */
export function parseFilterValue(v) {
  if (v != null && typeof v === 'object' && !Array.isArray(v) && v.op) {
    const op = String(v.op).toLowerCase()
    if (!['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'like'].includes(op)) {
      throw new BackendError(`Unsupported filter operator "${v.op}".`, { code: 'bad_filter' })
    }
    return { op, value: v.value }
  }
  if (Array.isArray(v)) return { op: 'in', value: v }
  return { op: 'eq', value: v }
}

/** Column names coming from app code — reject anything that is not a plain identifier. */
export function safeColumn(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(name))) {
    throw new BackendError(`Refusing to use unsafe column name "${name}".`, { code: 'bad_column' })
  }
  return String(name)
}

/**
 * Redact secrets from a URL before it ever reaches an error message or log.
 * (Firebase puts the API key in ?key= — this is the one place that must be
 * scrubbed.)
 */
export function redactUrl(url) {
  return String(url).replace(/([?&])(key|api_key|apikey|token|secret)=[^&]*/gi, '$1$2=<redacted>')
}

export default {
  BackendError, INTERFACE_METHODS, assertConforms, notConfiguredError,
  normalizeListParams, parseFilterValue, safeColumn, redactUrl,
}
