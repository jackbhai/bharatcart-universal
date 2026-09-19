/**
 * Local adapter — wraps the existing browser-localStorage backend
 * (src/backend/adapters/local.js) in the BackendAdapter interface.
 *
 * This is the zero-setup fallback every other adapter degrades to. It is
 * explicitly DEVELOPMENT ONLY: data lives in this browser's localStorage,
 * so it does not sync across devices and is wiped with site data. The
 * admin UI labels it honestly as such.
 *
 * Behaviour is identical to the wrapped module — this file only translates
 * the { data, error } result shape into the throwing BackendAdapter contract.
 */
import localDb from '../../../backend/adapters/local.js'
import { BackendError, normalizeListParams } from '../BackendAdapter.js'

const T = {
  products: 'products',
  categories: 'categories',
  orders: 'orders',
  orderItems: 'order_items',
  customers: 'customers',
  settings: 'settings',
}

function unwrap(result, what, provider = 'local') {
  if (result?.error) {
    throw new BackendError(
      typeof result.error === 'string' ? result.error : result.error.message || `Local ${what} failed.`,
      { code: result.error.code || 'local_error', provider }
    )
  }
  return result?.data
}

async function list(table, params) {
  const { filter, sortKey, sortDir, limit, offset, search } = normalizeListParams(params)
  let f = filter
  if (search && table === T.products) {
    // local mode can afford honesty: do the substring match in the adapter.
    f = { ...filter }
    const rows = unwrap(await localDb.db.list(table, {
      filter: f,
      sort: sortKey ? [sortKey, sortDir] : undefined,
      limit: null, offset: 0,
    }), 'list')
    const q = search.toLowerCase()
    const matched = rows.filter(r =>
      String(r.name || '').toLowerCase().includes(q) ||
      String(r.sku || '').toLowerCase().includes(q) ||
      String(r.brand || '').toLowerCase().includes(q))
    const total = matched.length
    const page = limit == null ? matched.slice(offset) : matched.slice(offset, offset + limit)
    return { rows: page, count: total }
  }
  const sort = sortKey ? [sortKey, sortDir] : undefined
  const res = await localDb.db.list(table, { filter: f, sort, limit, offset })
  const rows = unwrap(res, 'list')
  return { rows, count: res.count ?? rows.length }
}

async function get(table, id) {
  const res = await localDb.db.get(table, id)
  if (res?.error) {
    const code = typeof res.error === 'object' ? res.error.code : ''
    if (code === 'not_found') return null
    return unwrap(res, 'get')
  }
  return res.data ?? null
}

export function createLocalAdapter() {
  const provider = 'local'
  const api = {
    id: 'local',
    label: 'Local development',
    isDevOnly: true,
    warning:
      'Development only — products, orders and customers live in this browser\u2019s ' +
      'localStorage. They do not sync across devices. Connect a cloud database in ' +
      'Admin \u2192 Integrations \u2192 Database before taking real orders.',

    async listProducts(params) { return list(T.products, params) },
    async getProduct(id) { return get(T.products, id) },
    async createProduct(data) { return unwrap(await localDb.db.insert(T.products, data), 'create', provider) },
    async updateProduct(id, data) { return unwrap(await localDb.db.update(T.products, id, data), 'update', provider) },
    async deleteProduct(id) {
      unwrap(await localDb.db.remove(T.products, id), 'delete', provider)
    },

    async listCategories() {
      const { rows } = await list(T.categories, { sort: ['sortOrder', 'asc'] })
      return rows
    },

    async listOrders(params) { return list(T.orders, params) },

    async getOrder(id) {
      const order = await get(T.orders, id)
      if (!order) return null
      const items = unwrap(await localDb.db.list(T.orderItems, { filter: { orderId: id } }), 'list items', provider)
      return { ...order, items }
    },

    async createOrder(data) {
      const { items = [], ...head } = data || {}
      const order = unwrap(await localDb.db.insert(T.orders, {
        ...head,
        status: head.status || 'pending',
        createdAt: head.createdAt || new Date().toISOString(),
      }), 'create order', provider)
      const savedItems = []
      for (const it of items) {
        savedItems.push(unwrap(
          await localDb.db.insert(T.orderItems, { ...it, orderId: order.id }),
          'create order item', provider
        ))
      }
      return { ...order, items: savedItems }
    },

    async updateOrderStatus(id, status) {
      return unwrap(
        await localDb.db.update(T.orders, id, { status, updatedAt: new Date().toISOString() }),
        'update order status', provider
      )
    },

    async listCustomers(params) { return list(T.customers, params) },
    async getCustomer(id) { return get(T.customers, id) },

    async upsertCustomer(data) {
      const rows = unwrap(await localDb.db.upsert(T.customers, data), 'upsert customer', provider)
      return Array.isArray(rows) ? rows[0] : rows
    },

    async getSetting(key) {
      const row = await get(T.settings, String(key))
      return row ? row.value ?? null : null
    },

    async setSetting(key, value) {
      unwrap(
        await localDb.db.upsert(T.settings, {
          id: String(key), key: String(key), value,
          updatedAt: new Date().toISOString(),
        }),
        'save setting', provider
      )
    },
  }
  return api
}

export default { createLocalAdapter }
