/**
 * Neon adapter — serverless Postgres over HTTP, no SDK install.
 *
 * Uses @neondatabase/serverless loaded lazily from the esm.sh CDN
 * (dynamic import — it is never a build dependency and only loads when Neon
 * is actually the selected backend). The driver talks to Neon over HTTPS,
 * so it works from a static host with no persistent connection.
 *
 * Config (from the Integrations hub → Database → Neon, or env):
 *   connectionString — VITE_NEON_CONNECTION_STRING
 *     (a SECRET: set it in your env / host dashboard, never in a browser
 *     form — the hub only shows Set/Missing for it)
 *
 * The SQL schema is the same DDL as supabase/schema.sql — Neon IS Postgres,
 * so the same file works. Vercel Postgres is wire-compatible too.
 *
 * SECURITY: every query is parameterized ($1, $2, …). Column names are
 * validated against a strict identifier pattern. The connection string never
 * appears in an error message or log.
 */
import {
  BackendError, notConfiguredError,
  normalizeListParams, parseFilterValue, safeColumn,
} from '../BackendAdapter.js'

const PROVIDER = 'neon'
const LABEL = 'Neon'
const CDN = 'https://esm.sh/@neondatabase/serverless@0.10.4'

const SQL_OPS = { eq: '=', ne: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }

/**
 * Pure helper: turns the shared filter format into a parameterized WHERE
 * clause. Exported so the test suite can verify it without a database.
 * Returns { text: 'WHERE "price" > $1 AND ...', params: [...] }.
 */
export function buildWhere(filter) {
  const clauses = []
  const params = []
  for (const [rawKey, rawVal] of Object.entries(filter || {})) {
    if (rawVal == null) continue
    const col = safeColumn(rawKey)
    const { op, value } = parseFilterValue(rawVal)
    if (op === 'like') {
      params.push(`%${value}%`)
      clauses.push(`"${col}" ILIKE $${params.length}`)
    } else if (op === 'in') {
      const vals = Array.isArray(value) ? value : [value]
      if (!vals.length) { clauses.push('FALSE'); continue }
      const slots = vals.map(v => { params.push(v); return `$${params.length}` })
      clauses.push(`"${col}" IN (${slots.join(', ')})`)
    } else {
      params.push(value)
      clauses.push(`"${col}" ${SQL_OPS[op]} $${params.length}`)
    }
  }
  return { text: clauses.length ? 'WHERE ' + clauses.join(' AND ') : '', params }
}

export function createNeonAdapter({ connectionString } = {}) {
  const cs = String(connectionString || '').trim()
  if (!cs) throw notConfiguredError(LABEL)

  let sqlPromise = null
  async function getSql() {
    if (!sqlPromise) {
      sqlPromise = (async () => {
        let mod
        try {
          mod = await import(/* @vite-ignore */ CDN)
        } catch {
          throw new BackendError(
            'Could not load the Neon driver from the CDN. Check your network connection and try again.',
            { code: 'driver_error', provider: PROVIDER }
          )
        }
        if (typeof mod.neon !== 'function') {
          throw new BackendError('The Neon driver loaded but did not export a client.', { code: 'driver_error', provider: PROVIDER })
        }
        return mod.neon(cs)
      })()
    }
    return sqlPromise
  }

  /** Run a parameterized query. `text` may contain $1-style placeholders. */
  async function q(text, params, what) {
    const sql = await getSql()
    try {
      return await sql.query(text, params)
    } catch (err) {
      // Never leak the connection string, whatever Postgres complained about.
      const msg = String(err?.message || 'Query failed.').split(cs).join('<redacted>')
      throw new BackendError(
        `Neon error while ${what}: ${msg} — check that supabase/schema.sql has been run on this database.`,
        { code: err?.code || 'neon_error', provider: PROVIDER }
      )
    }
  }

  function listQuery(table, params) {
    const { filter, sortKey, sortDir, limit, offset, search } = normalizeListParams(params)
    const { text: where, params: wParams } = buildWhere(filter)
    const parts = [`SELECT * FROM "${table}"`]
    const allParams = [...wParams]
    const clauses = where ? [where.slice(6)] : []
    if (search && table === 'products') {
      allParams.push(`%${search}%`, `%${search}%`, `%${search}%`)
      const n = allParams.length
      clauses.push(`("name" ILIKE $${n - 2} OR "sku" ILIKE $${n - 1} OR "brand" ILIKE $${n})`)
    }
    if (clauses.length) parts.push('WHERE ' + clauses.join(' AND '))
    if (sortKey) parts.push(`ORDER BY "${safeColumn(sortKey)}" ${sortDir === 'desc' ? 'DESC' : 'ASC'}`)
    if (limit != null) { allParams.push(limit); parts.push(`LIMIT $${allParams.length}`) }
    if (offset) { allParams.push(offset); parts.push(`OFFSET $${allParams.length}`) }
    return { text: parts.join(' '), params: allParams }
  }

  async function list(table, params) {
    const { text, params: p } = listQuery(table, params)
    const rows = await q(text, p, `listing ${table}`)
    // Exact total for pagination: a second COUNT with the same filters.
    const { filter, search } = normalizeListParams(params)
    const f = { ...filter }
    const { text: where, params: wParams } = buildWhere(f)
    const clauses = where ? [where.slice(6)] : []
    const cp = [...wParams]
    if (search && table === 'products') {
      cp.push(`%${search}%`, `%${search}%`, `%${search}%`)
      const n = cp.length
      clauses.push(`("name" ILIKE $${n - 2} OR "sku" ILIKE $${n - 1} OR "brand" ILIKE $${n})`)
    }
    const countRows = await q(
      `SELECT COUNT(*)::int AS c FROM "${table}"${clauses.length ? ' WHERE ' + clauses.join(' AND ') : ''}`,
      cp, `counting ${table}`
    )
    return { rows, count: countRows[0]?.c ?? rows.length }
  }

  async function getOne(table, id, idCol = 'id') {
    const rows = await q(
      `SELECT * FROM "${table}" WHERE "${safeColumn(idCol)}" = $1 LIMIT 1`, [String(id)],
      `reading ${table}`
    )
    return rows[0] ?? null
  }

  function insertCols(data) {
    const cols = Object.keys(data || {}).filter(k => k !== 'id' || data[k] != null).map(safeColumn)
    return cols
  }

  async function insertRow(table, data) {
    const cols = insertCols(data)
    if (!cols.length) throw new BackendError('Nothing to insert.', { code: 'bad_input', provider: PROVIDER })
    const vals = cols.map(c => data[c])
    const slots = vals.map((_, i) => `$${i + 1}`)
    const rows = await q(
      `INSERT INTO "${table}" ("${cols.join('", "')}") VALUES (${slots.join(', ')}) RETURNING *`,
      vals, `creating ${table}`
    )
    return rows[0]
  }

  async function updateRow(table, id, patch, idCol = 'id') {
    const cols = Object.keys(patch || {}).filter(k => k !== 'id' && k !== idCol).map(safeColumn)
    if (!cols.length) return getOne(table, id, idCol)
    const vals = cols.map(c => patch[c])
    const sets = cols.map((c, i) => `"${c}" = $${i + 1}`)
    const rows = await q(
      `UPDATE "${table}" SET ${sets.join(', ')} WHERE "${safeColumn(idCol)}" = $${vals.length + 1} RETURNING *`,
      [...vals, String(id)], `updating ${table}`
    )
    return rows[0] ?? null
  }

  return {
    id: 'neon',
    label: LABEL,
    isDevOnly: false,

    async listProducts(params) { return list('products', params) },
    async getProduct(id) { return getOne('products', id) },

    async createProduct(data) {
      return insertRow('products', {
        id: data.id || `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
        ...data,
      })
    },

    async updateProduct(id, data) {
      return updateRow('products', id, { ...data, updatedAt: new Date().toISOString() })
    },

    async deleteProduct(id) {
      await q(`DELETE FROM "products" WHERE "id" = $1`, [String(id)], 'deleting product')
    },

    async listCategories() {
      const { rows } = await list('categories', { sort: ['sortOrder', 'asc'] })
      return rows
    },

    async listOrders(params) { return list('orders', params) },

    async getOrder(id) {
      const order = await getOne('orders', id)
      if (!order) return null
      const items = await q(`SELECT * FROM "order_items" WHERE "orderId" = $1`, [String(id)], 'reading order items')
      return { ...order, items }
    },

    async createOrder(data) {
      const { items = [], ...head } = data || {}
      const order = await insertRow('orders', {
        id: head.id || `o_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        ...head,
      })
      const savedItems = []
      for (const it of items) {
        savedItems.push(await insertRow('order_items', {
          id: it.id || `oi_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
          orderId: order.id,
          ...it,
        }))
      }
      return { ...order, items: savedItems }
    },

    async updateOrderStatus(id, status) {
      return updateRow('orders', id, { status, updatedAt: new Date().toISOString() })
    },

    async listCustomers(params) { return list('customers', params) },
    async getCustomer(id) { return getOne('customers', id) },

    async upsertCustomer(data) {
      const id = data.id || `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
      const cols = insertCols({ ...data, id })
      const vals = cols.map(c => ({ ...data, id })[c])
      const slots = vals.map((_, i) => `$${i + 1}`)
      const sets = cols.filter(c => c !== 'id').map(c => `"${c}" = EXCLUDED."${c}"`)
      const rows = await q(
        `INSERT INTO "customers" ("${cols.join('", "')}") VALUES (${slots.join(', ')}) ` +
        `ON CONFLICT ("id") DO UPDATE SET ${sets.join(', ')} RETURNING *`,
        vals, 'saving customer'
      )
      return rows[0]
    },

    async getSetting(key) {
      const row = await getOne('settings', String(key), 'key')
      return row ? row.value ?? null : null
    },

    async setSetting(key, value) {
      const val = typeof value === 'string' ? value : JSON.stringify(value)
      await q(
        `INSERT INTO "settings" ("key", "value", "updatedAt") VALUES ($1, $2::jsonb, NOW()) ` +
        `ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW()`,
        [String(key), val], 'saving setting'
      )
    },
  }
}

export default { createNeonAdapter, buildWhere }
