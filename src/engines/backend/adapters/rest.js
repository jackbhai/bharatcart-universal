/**
 * REST adapter — points the store at any merchant-owned backend.
 *
 * Maps the BackendAdapter interface onto plain HTTP endpoints under a base
 * URL, with an optional Bearer token. The expected endpoint contract is
 * documented in docs/16-BACKEND.md ("REST endpoint contract") — any backend
 * implementing it (Express, Fastify, Django, Laravel, a Vercel serverless
 * function…) works, regardless of language.
 *
 * Config (from the Integrations hub → Database → Custom REST API, or env):
 *   base   — VITE_REST_API_BASE  (e.g. https://api.mystore.in)
 *   apiKey — VITE_REST_API_KEY   (optional; sent as `Authorization: Bearer`,
 *            never logged or persisted by this module)
 *
 * RESPONSE SHAPES (both accepted, so backends don't need a rewrite):
 *   list:  { data: [...], total: n }  or a bare [...]
 *   one:   { data: {...} }            or a bare {...}
 */
import {
  BackendError, notConfiguredError,
  normalizeListParams, parseFilterValue, safeColumn,
} from '../BackendAdapter.js'

const PROVIDER = 'rest'
const LABEL = 'Custom REST API'

function queryString(params) {
  const { filter, sortKey, sortDir, limit, offset, search } = normalizeListParams(params)
  const q = new URLSearchParams()
  for (const [rawKey, rawVal] of Object.entries(filter || {})) {
    if (rawVal == null) continue
    const key = safeColumn(rawKey)
    const { op, value } = parseFilterValue(rawVal)
    if (op === 'eq') q.append(key, String(value))
    else if (op === 'in') q.append(key, (Array.isArray(value) ? value : [value]).join(','))
    else q.append(`${key}[${op}]`, String(value))
  }
  if (sortKey) { q.append('sort', sortKey); q.append('order', sortDir) }
  if (limit != null) q.append('limit', String(limit))
  if (offset) q.append('offset', String(offset))
  if (search) q.append('search', search)
  const s = q.toString()
  return s ? `?${s}` : ''
}

export function createRestAdapter({ base, apiKey } = {}) {
  const root = String(base || '').trim().replace(/\/+$/, '')
  const token = String(apiKey || '').trim()
  if (!root) throw notConfiguredError(LABEL)

  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token

  async function req(path, { method = 'GET', body } = {}, what = 'talking to the API') {
    let res
    try {
      res = await fetch(`${root}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new BackendError(
        `Could not reach your API at ${root}. Check the base URL and that the server allows CORS from this origin.`,
        { code: 'network_error', provider: PROVIDER }
      )
    }
    if (res.status === 404 && method === 'GET') return { notFound: true }
    let data = null
    try { data = await res.json() } catch { /* empty */ }
    if (!res.ok) {
      const msg = data?.message || data?.error || `The API answered with HTTP ${res.status}.`
      throw new BackendError(
        `API error while ${what}: ${msg} — the endpoint contract is documented in docs/16-BACKEND.md.`,
        { code: 'api_error', provider: PROVIDER, status: res.status }
      )
    }
    return { data }
  }

  const one = (d) => {
    if (d && typeof d === 'object' && !Array.isArray(d) && 'data' in d) return d.data ?? null
    return d ?? null
  }

  async function list(path, params, what) {
    const { data } = await req(`${path}${queryString(params)}`, {}, what)
    if (Array.isArray(data)) return { rows: data, count: data.length }
    const rows = Array.isArray(data?.data) ? data.data : []
    const count = Number(data?.total ?? data?.count ?? rows.length)
    return { rows, count }
  }

  const id = (v) => encodeURIComponent(String(v))

  return {
    id: 'rest',
    label: LABEL,
    isDevOnly: false,

    async listProducts(params) { return list('/products', params, 'listing products') },
    async getProduct(pid) {
      const { data, notFound } = await req(`/products/${id(pid)}`, {}, 'reading product')
      return notFound ? null : one(data)
    },
    async createProduct(data) {
      const { data: res } = await req('/products', { method: 'POST', body: data }, 'creating product')
      return one(res)
    },
    async updateProduct(pid, data) {
      const { data: res } = await req(`/products/${id(pid)}`, { method: 'PATCH', body: data }, 'updating product')
      return one(res)
    },
    async deleteProduct(pid) {
      await req(`/products/${id(pid)}`, { method: 'DELETE' }, 'deleting product')
    },

    async listCategories() {
      const { rows } = await list('/categories', {}, 'listing categories')
      return rows
    },

    async listOrders(params) { return list('/orders', params, 'listing orders') },
    async getOrder(oid) {
      const { data, notFound } = await req(`/orders/${id(oid)}`, {}, 'reading order')
      return notFound ? null : one(data)
    },
    async createOrder(data) {
      const { data: res } = await req('/orders', { method: 'POST', body: data }, 'creating order')
      return one(res)
    },
    async updateOrderStatus(oid, status) {
      const { data: res } = await req(`/orders/${id(oid)}`, { method: 'PATCH', body: { status } }, 'updating order status')
      return one(res)
    },

    async listCustomers(params) { return list('/customers', params, 'listing customers') },
    async getCustomer(cid) {
      const { data, notFound } = await req(`/customers/${id(cid)}`, {}, 'reading customer')
      return notFound ? null : one(data)
    },
    async upsertCustomer(data) {
      // Prefer PUT /customers/:id when we have an id; fall back to POST.
      if (data?.id) {
        const { data: res } = await req(`/customers/${id(data.id)}`, { method: 'PUT', body: data }, 'saving customer')
        return one(res)
      }
      const { data: res } = await req('/customers', { method: 'POST', body: data }, 'creating customer')
      return one(res)
    },

    async getSetting(key) {
      const { data, notFound } = await req(`/settings/${id(key)}`, {}, 'reading setting')
      if (notFound) return null
      const v = one(data)
      return v && typeof v === 'object' && 'value' in v ? v.value : v
    },
    async setSetting(key, value) {
      await req(`/settings/${id(key)}`, { method: 'PUT', body: { value } }, 'saving setting')
    },
  }
}

export default { createRestAdapter }
