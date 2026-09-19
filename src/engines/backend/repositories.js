/**
 * Repositories — the app's data-access layer for the catalogue domain.
 *
 * This is the migrated "catalogue/products path": every read and write of
 * products, categories, orders, customers and settings goes through
 * getBackend(), so switching the database in Admin → Integrations → Database
 * changes where ALL of this data lives, with zero call-site changes.
 *
 *   import { catalogue, orders, customers } from 'src/engines/backend/repositories.js'
 *   const { rows, count } = await catalogue.listProducts({ filter: { status: 'active' }, limit: 24 })
 *   await orders.updateOrderStatus(orderId, 'shipped')
 *
 * All methods are async and throw BackendError on failure (never fake data).
 * get* methods return null when the record does not exist.
 *
 * MIGRATION PATTERN (for the remaining store slices — documented fully in
 * docs/16-BACKEND.md):
 *   before: read/write localStorage (or the in-memory store) directly
 *   after:  call these repositories; keep the in-memory store as a read
 *           cache and re-hydrate it with `await catalogue.listProducts()`.
 */
import { getBackend } from './index.js'

const db = () => getBackend()

export const catalogue = {
  /** ({ filter, sort, limit, offset, search }) → { rows, count } */
  listProducts: (params) => db().listProducts(params),
  getProduct: (id) => db().getProduct(id),
  createProduct: (data) => db().createProduct(data),
  updateProduct: (id, data) => db().updateProduct(id, data),
  /** Create when data has no id, update when it does. */
  saveProduct: (data) =>
    data?.id ? db().updateProduct(data.id, data) : db().createProduct(data),
  deleteProduct: (id) => db().deleteProduct(id),

  listCategories: () => db().listCategories(),

  getSetting: (key) => db().getSetting(key),
  setSetting: (key, value) => db().setSetting(key, value),
}

export const orders = {
  listOrders: (params) => db().listOrders(params),
  /** Returns the order with an `items` array. Null when missing. */
  getOrder: (id) => db().getOrder(id),
  /** data: { customerId?, items: [{ productId, name, qty, price, ... }], total, ... } */
  createOrder: (data) => db().createOrder(data),
  updateOrderStatus: (id, status) => db().updateOrderStatus(id, status),
}

export const customers = {
  listCustomers: (params) => db().listCustomers(params),
  getCustomer: (id) => db().getCustomer(id),
  upsertCustomer: (data) => db().upsertCustomer(data),
}

export default { catalogue, orders, customers }
