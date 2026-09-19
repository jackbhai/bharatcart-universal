/**
 * Supabase adapter — PostgREST over fetch, no SDK.
 *
 * Talks directly to `${url}/rest/v1/{table}` with the anon (publishable) key
 * in the `apikey` / `Authorization` headers. No dependency to install, no CDN
 * script to load, and every request is mockable in tests.
 *
 * Config (from the Integrations hub → Database → Supabase, or env):
 *   url     — VITE_SUPABASE_URL
 *   anonKey — VITE_SUPABASE_ANON_KEY (publishable key; never the service_role key)
 *
 * Expected tables (see supabase/schema.sql): products, categories, orders,
 * order_items, customers, settings.
 *
 * The anon key is sent in headers only and is never written to logs, error
 * messages, or storage by this module.
 */
import {
  BackendError, notConfiguredError,
  normalizeListParams, parseFilterValue, safeColumn,
} from '../BackendAdapter.js'

const PROVIDER = 'supabase'
const LABEL = 'Supabase'

const OP_MAP = { eq: 'eq', ne: 'neq', gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte' }

function toPostgrest(filter) {
  const parts = []
  for (const [rawKey, rawVal] of Object.entries(filter || {})) {
    if (rawVal == null) continue
    const key = safeColumn(rawKey)
    const { op, value } = parseFilterValue(rawVal)
    if (op === 'like') {
      parts.push(`${key}=ilike.*${encodeURIComponent(String(value))}*`)
    } else if (op === 'in') {
      const vals = (Array.isArray(value) ? value : [value]).map(v => encodeURIComponent(String(v))).join(',')
      parts.push(`${key}=in.(${vals})`)
    } else {
      parts.push(`${key}=${OP_MAP[op]}.${encodeURIComponent(String(value))}`)
    }
  }
  return parts
}

export function createSupabaseAdapter({ url, anonKey } = {}) {
  const base = String(url || '').trim().replace(/\/+$/, '')
  const key = String(anonKey || '').trim()
  if (!base || !key) throw notConfiguredError(LABEL)

  async function req(path, { method = 'GET', body, prefer = [], single = false } = {}) {
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    }
    if (prefer.length) headers.Prefer = prefer.join(',')
    if (single) headers.Accept = 'application/vnd.pgrst.object+json'
    let res
    try {
      res = await fetch(`${base}/rest/v1/${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (err) {
      throw new BackendError(
        `Could not reach your Supabase project (${base}). Check the Project URL and your network connection.`,
        { code: 'network_error', provider: PROVIDER }
      )
    }
    let data = null
    try { data = await res.json() } catch { /* empty body (DELETE) */ }
    if (!res.ok) {
      const msg = data?.message || data?.error || `Supabase answered with HTTP ${res.status}.`
      throw new BackendError(
        `Supabase error: ${msg} — check that the tables in supabase/schema.sql exist and the anon key has access.`,
        { code: data?.code || 'supabase_error', provider: PROVIDER, status: res.status }
      )
    }
    // Exact counts come back in the Content-Range header: "0-19/123".
    let count = null
    const cr = res.headers?.get?.('content-range')
    if (cr) {
      const m = /\/(\d+)\s*$/.exec(cr)
      if (m) count = Number(m[1])
    }
    return { data, count }
  }

  function listQuery(table, params) {
    const { filter, sortKey, sortDir, limit, offset, search } = normalizeListParams(params)
    const q = ['select=*', ...toPostgrest(filter)]
    if (search && table === 'products') {
      q.push(`or=(name.ilike.*${encodeURIComponent(search)}*,sku.ilike.*${encodeURIComponent(search)}*,brand.ilike.*${encodeURIComponent(search)}*)`)
    }
    if (sortKey) q.push(`order=${safeColumn(sortKey)}.${sortDir}`)
    if (limit != null) q.push(`limit=${limit}`)
    if (offset) q.push(`offset=${offset}`)
    return q.join('&')
  }

  async function list(table, params) {
    const { data, count } = await req(`${table}?${listQuery(table, params)}`, { prefer: ['count=exact'] })
    const rows = Array.isArray(data) ? data : []
    return { rows, count: count ?? rows.length }
  }

  async function getOne(table, id, idCol = 'id') {
    const { data } = await req(
      `${table}?${safeColumn(idCol)}=eq.${encodeURIComponent(String(id))}`,
      { single: true }
    ).catch(err => {
      // PostgREST returns 406 when the object Accept header matches nothing.
      if (err.status === 406) return { data: null }
      throw err
    })
    return data ?? null
  }

  return {
    id: 'supabase',
    label: LABEL,
    isDevOnly: false,

    async listProducts(params) { return list('products', params) },
    async getProduct(id) { return getOne('products', id) },

    async createProduct(data) {
      const { data: row } = await req('products', {
        method: 'POST', body: data, prefer: ['return=representation'],
      })
      return Array.isArray(row) ? row[0] : row
    },

    async updateProduct(id, data) {
      const { data: row } = await req(`products?id=eq.${encodeURIComponent(String(id))}`, {
        method: 'PATCH', body: data, prefer: ['return=representation'], single: true,
      })
      return row
    },

    async deleteProduct(id) {
      await req(`products?id=eq.${encodeURIComponent(String(id))}`, { method: 'DELETE' })
    },

    async listCategories() {
      const { rows } = await list('categories', { sort: ['sortOrder', 'asc'] })
      return rows
    },

    async listOrders(params) { return list('orders', params) },

    async getOrder(id) {
      const order = await getOne('orders', id)
      if (!order) return null
      const { rows } = await list('order_items', { filter: { order_id: id } })
      return { ...order, items: rows }
    },

    async createOrder(data) {
      const { items = [], ...head } = data || {}
      const { data: order } = await req('orders', {
        method: 'POST',
        body: { ...head, status: head.status || 'pending' },
        prefer: ['return=representation'],
      })
      const saved = Array.isArray(order) ? order[0] : order
      let savedItems = []
      if (items.length) {
        const { data: rows } = await req('order_items', {
          method: 'POST',
          body: items.map(it => ({ ...it, order_id: saved.id })),
          prefer: ['return=representation'],
        })
        savedItems = Array.isArray(rows) ? rows : []
      }
      return { ...saved, items: savedItems }
    },

    async updateOrderStatus(id, status) {
      const { data: row } = await req(`orders?id=eq.${encodeURIComponent(String(id))}`, {
        method: 'PATCH', body: { status }, prefer: ['return=representation'], single: true,
      })
      return row
    },

    async listCustomers(params) { return list('customers', params) },
    async getCustomer(id) { return getOne('customers', id) },

    async upsertCustomer(data) {
      const { data: row } = await req('customers?on_conflict=id', {
        method: 'POST', body: data,
        prefer: ['return=representation', 'resolution=merge-duplicates'],
      })
      const out = Array.isArray(row) ? row[0] : row
      return out
    },

    async getSetting(key) {
      const row = await getOne('settings', String(key), 'key')
      return row ? row.value ?? null : null
    },

    async setSetting(key, value) {
      await req('settings?on_conflict=key', {
        method: 'POST',
        body: { key: String(key), value },
        prefer: ['return=representation', 'resolution=merge-duplicates'],
      })
    },
  }
}

export default { createSupabaseAdapter }
