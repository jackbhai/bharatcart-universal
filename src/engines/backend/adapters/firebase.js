/**
 * Firebase adapter — Firestore via its REST API, no SDK.
 *
 * Uses the Firestore v1 REST endpoints:
 *   https://firestore.googleapis.com/v1/projects/{projectId}/databases/(default)/documents/...
 * with the Web API key as ?key=. No SDK install, no CDN script, mockable.
 *
 * Config (from the Integrations hub → Database → Firebase, or env):
 *   apiKey    — VITE_FIREBASE_API_KEY
 *   projectId — VITE_FIREBASE_PROJECT_ID
 *
 * Firestore stores typed values ({stringValue, integerValue, ...}); the
 * encode/decode helpers below translate plain JS objects both ways.
 *
 * HONEST LIMITS
 *  - Text search: Firestore has no substring operator. A `like` filter throws
 *    a BackendError telling you so, instead of silently returning wrong rows.
 *  - Security rules still apply: the key alone does not bypass them. If your
 *    rules require auth, reads/writes will fail with PERMISSION_DENIED and the
 *    error says exactly that. See docs/16-BACKEND.md for starter rules.
 *  - Order documents embed their items array (no subcollection juggling).
 *
 * The API key travels in the query string, so every URL is redacted before it
 * can reach an error message or log.
 */
import {
  BackendError, notConfiguredError,
  normalizeListParams, parseFilterValue, safeColumn, redactUrl,
} from '../BackendAdapter.js'

const PROVIDER = 'firebase'
const LABEL = 'Firebase'

/* ------------------------------------------------ field encoding -------- */

export function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  }
  if (typeof v === 'string') return { stringValue: v }
  if (v instanceof Date) return { timestampValue: v.toISOString() }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } }
  if (typeof v === 'object') {
    const fields = {}
    for (const [k, val] of Object.entries(v)) fields[k] = encodeValue(val)
    return { mapValue: { fields } }
  }
  return { stringValue: String(v) }
}

export function encodeDoc(obj) {
  const fields = {}
  for (const [k, v] of Object.entries(obj || {})) {
    if (v !== undefined) fields[k] = encodeValue(v)
  }
  return { fields }
}

export function decodeValue(v) {
  if (!v || typeof v !== 'object') return null
  if ('nullValue' in v) return null
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('stringValue' in v) return v.stringValue
  if ('timestampValue' in v) return v.timestampValue
  if ('bytesValue' in v) return v.bytesValue
  if ('referenceValue' in v) return v.referenceValue
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue)
  if ('mapValue' in v) {
    const out = {}
    for (const [k, val] of Object.entries(v.mapValue.fields || {})) out[k] = decodeValue(val)
    return out
  }
  if ('geoPointValue' in v) return v.geoPointValue
  return null
}

export function decodeDoc(doc) {
  if (!doc) return null
  const id = doc.name ? doc.name.split('/').pop() : undefined
  const out = { ...(id ? { id } : {}), ...decodeDocFields(doc.fields) }
  return out
}

function decodeDocFields(fields) {
  const out = {}
  for (const [k, v] of Object.entries(fields || {})) out[k] = decodeValue(v)
  return out
}

/* ------------------------------------------------ structured query ----- */

const FS_OPS = { eq: 'EQUAL', ne: 'NOT_EQUAL', gt: 'GREATER_THAN', gte: 'GREATER_THAN_OR_EQUAL', lt: 'LESS_THAN', lte: 'LESS_THAN_OR_EQUAL' }

function buildStructuredQuery(collection, params) {
  const { filter, sortKey, sortDir, limit, offset, search } = normalizeListParams(params)
  const structuredQuery = {
    from: [{ collectionId: collection }],
  }
  const filters = []
  for (const [rawKey, rawVal] of Object.entries(filter || {})) {
    if (rawVal == null) continue
    const key = safeColumn(rawKey)
    const { op, value } = parseFilterValue(rawVal)
    if (op === 'like') {
      throw new BackendError(
        'Text search ("like" filter) is not supported by the Firestore adapter — Firestore has no substring operator. ' +
        'Fetch the rows and filter client-side, or use a search service.',
        { code: 'unsupported', provider: PROVIDER }
      )
    }
    if (op === 'in') {
      filters.push({
        fieldFilter: {
          field: { fieldPath: key },
          op: 'IN',
          value: { arrayValue: { values: (Array.isArray(value) ? value : [value]).map(encodeValue) } },
        },
      })
      continue
    }
    filters.push({
      fieldFilter: { field: { fieldPath: key }, op: FS_OPS[op], value: encodeValue(value) },
    })
  }
  if (filters.length === 1) structuredQuery.where = filters[0]
  else if (filters.length > 1) structuredQuery.where = { compositeFilter: { op: 'AND', filters } }
  if (sortKey) {
    structuredQuery.orderBy = [{
      field: { fieldPath: safeColumn(sortKey) },
      direction: sortDir === 'desc' ? 'DESCENDING' : 'ASCENDING',
    }]
  }
  if (limit != null) structuredQuery.limit = limit
  if (offset) structuredQuery.offset = offset
  return { structuredQuery, search }
}

export function createFirebaseAdapter({ apiKey, projectId } = {}) {
  const key = String(apiKey || '').trim()
  const pid = String(projectId || '').trim()
  if (!key || !pid) throw notConfiguredError(LABEL)

  const docsBase = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(pid)}/databases/(default)/documents`
  const withKey = (url) => `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(key)}`

  function failMessage(res, data, what) {
    const msg = data?.error?.message || `Firestore answered with HTTP ${res.status}.`
    return new BackendError(
      `Firestore error while ${what}: ${msg}` +
      (/PERMISSION_DENIED|permission/i.test(msg)
        ? ' Your Firestore security rules rejected this request — see docs/16-BACKEND.md for starter rules.'
        : ''),
      { code: data?.error?.status || 'firestore_error', provider: PROVIDER, status: res.status }
    )
  }

  async function req(url, { method = 'GET', body } = {}, what = 'talking to Firestore') {
    let res
    try {
      res = await fetch(withKey(url), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new BackendError(
        'Could not reach Firestore. Check your network connection and the Project ID.',
        { code: 'network_error', provider: PROVIDER }
      )
    }
    let data = null
    try { data = await res.json() } catch { /* empty */ }
    if (!res.ok) {
      // The API key travels in the query string — scrub it before the message
      // can carry it anywhere.
      const err = failMessage(res, data, what)
      err.message = err.message.split(key).join('<redacted>')
      throw err
    }
    return data
  }

  async function list(collection, params) {
    const { structuredQuery, search } = buildStructuredQuery(collection, params)
    // Firestore has no server-side substring search: fetch a page and filter.
    const needsClientSearch = Boolean(search && collection === 'products')
    const q = { ...structuredQuery }
    if (needsClientSearch) q.limit = 500
    const data = await req(`${docsBase}:runQuery`, { method: 'POST', body: { structuredQuery: q } }, `listing ${collection}`)
    let rows = (Array.isArray(data) ? data : [])
      .filter(r => r.document)
      .map(r => decodeDoc(r.document))
    if (needsClientSearch) {
      const s = search.toLowerCase()
      rows = rows.filter(r =>
        String(r.name || '').toLowerCase().includes(s) ||
        String(r.sku || '').toLowerCase().includes(s) ||
        String(r.brand || '').toLowerCase().includes(s))
    }
    const { limit, offset } = normalizeListParams(params)
    const count = rows.length
    const page = limit == null ? rows.slice(offset) : rows.slice(offset, offset + limit)
    return { rows: page, count }
  }

  async function getDocById(collection, id) {
    const data = await req(
      `${docsBase}/${encodeURIComponent(collection)}/${encodeURIComponent(String(id))}`,
      {}, `reading ${collection}/${id}`
    ).catch(err => {
      if (err.status === 404) return null
      throw err
    })
    return decodeDoc(data)
  }

  return {
    id: 'firebase',
    label: LABEL,
    isDevOnly: false,

    async listProducts(params) { return list('products', params) },
    async getProduct(id) { return getDocById('products', id) },

    async createProduct(data) {
      const payload = encodeDoc({ ...data, createdAt: data.createdAt || new Date().toISOString() })
      const url = data.id
        ? `${docsBase}/products/${encodeURIComponent(String(data.id))}`
        : `${docsBase}/products`
      const res = await req(url, { method: data.id ? 'PUT' : 'POST', body: payload }, 'creating product')
      return decodeDoc(res)
    },

    async updateProduct(id, patch) {
      const mask = Object.keys(patch || {}).filter(k => k !== 'id')
      const params = mask.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
      const res = await req(
        `${docsBase}/products/${encodeURIComponent(String(id))}${params ? '?' + params : ''}`,
        { method: 'PATCH', body: encodeDoc({ ...patch, updatedAt: new Date().toISOString() }) },
        'updating product'
      )
      return decodeDoc(res)
    },

    async deleteProduct(id) {
      await req(`${docsBase}/products/${encodeURIComponent(String(id))}`, { method: 'DELETE' }, 'deleting product')
    },

    async listCategories() {
      const { rows } = await list('categories', { sort: ['sortOrder', 'asc'] })
      return rows
    },

    async listOrders(params) { return list('orders', params) },

    async getOrder(id) {
      // Items are embedded in the order document by createOrder.
      return getDocById('orders', id)
    },

    async createOrder(data) {
      const { items = [], ...head } = data || {}
      const payload = encodeDoc({
        ...head,
        items,
        status: head.status || 'pending',
        createdAt: head.createdAt || new Date().toISOString(),
      })
      const res = await req(`${docsBase}/orders`, { method: 'POST', body: payload }, 'creating order')
      return decodeDoc(res)
    },

    async updateOrderStatus(id, status) {
      const res = await req(
        `${docsBase}/orders/${encodeURIComponent(String(id))}?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`,
        { method: 'PATCH', body: encodeDoc({ status, updatedAt: new Date().toISOString() }) },
        'updating order status'
      )
      return decodeDoc(res)
    },

    async listCustomers(params) { return list('customers', params) },
    async getCustomer(id) { return getDocById('customers', id) },

    async upsertCustomer(data) {
      const id = data.id || `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
      const res = await req(
        `${docsBase}/customers/${encodeURIComponent(String(id))}`,
        { method: 'PUT', body: encodeDoc({ ...data, id }) },
        'saving customer'
      )
      return decodeDoc(res)
    },

    async getSetting(key) {
      const doc = await getDocById('settings', String(key))
      return doc ? doc.value ?? null : null
    },

    async setSetting(key, value) {
      await req(
        `${docsBase}/settings/${encodeURIComponent(String(key))}`,
        { method: 'PUT', body: encodeDoc({ value, updatedAt: new Date().toISOString() }) },
        'saving setting'
      )
    },
  }
}

export default { createFirebaseAdapter, encodeValue, decodeValue, encodeDoc, decodeDoc }
