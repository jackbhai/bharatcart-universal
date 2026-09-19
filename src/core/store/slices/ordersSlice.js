import { ORDERS } from '../../../data/seed.js'
import { applyTransition, bulkTransition, buildTimeline } from '../../../engines/orders/orderEngine.js'

const now = () => Date.now()

/**
 * Orders slice. Seed orders stay immutable; every admin action is stored as a
 * sparse override keyed by order id, exactly like the catalogue slice. That
 * keeps the dataset reproducible while still feeling fully editable.
 */
export const ordersSlice = {
  initial: () => ({
    created: [],          // orders placed on the storefront this session
    overrides: {},        // { [orderId]: Partial<Order> }
    notes: {},            // { [orderId]: Note[] }
    tags: {},             // { [orderId]: string[] }
    shipments: {},        // { [orderId]: Shipment[] }
    savedViews: [
      { id: 'v_today', name: 'Needs packing', filters: { status: ['Confirmed'] } },
      { id: 'v_transit', name: 'In transit', filters: { status: ['In Transit', 'Out for Delivery'] } },
      { id: 'v_cod', name: 'High-risk COD', filters: { paymentMethod: ['COD'], minTotal: 5000 } },
      { id: 'v_problem', name: 'Problem orders', filters: { status: ['On Hold', 'RTO'] } },
    ],
    slaConfig: { packHours: 24, shipDays: 2, deliverDays: 7 },
    lastAction: null,
  }),

  actions: {
    /**
     * A storefront purchase. Created orders live alongside the seed book so the
     * admin Orders screen, SLA board and finance reports pick them up with no
     * extra wiring — a sale made in the user panel is a real order everywhere.
     */
    placeOrder: (s, { order }) => ({
      created: [{ ...order, timeline: [{ at: order.placedAt, to: order.status, by: 'storefront', note: 'Order placed' }] }, ...s.created],
      lastAction: { ok: true, type: 'placed', orderId: order.id },
    }),
    /** Guarded status change — refuses illegal moves and records the reason. */
    transition: (s, { order, to, role = 'admin', note, by = 'admin', patch = {} }) => {
      const merged = mergeOrder(s, order)
      const result = applyTransition(merged, to, { role, note, by, patch })
      if (!result.ok) {
        return { lastAction: { ok: false, orderId: order.id, reason: result.reason, at: now() } }
      }
      const { id, ...rest } = result.order
      return {
        overrides: { ...s.overrides, [order.id]: { ...(s.overrides[order.id] || {}), ...rest } },
        lastAction: { ok: true, orderId: order.id, to, at: now(), effects: result.effects },
      }
    },

    bulkTransition: (s, { orders, to, role = 'admin', by = 'admin' }) => {
      const merged = orders.map(o => mergeOrder(s, o))
      const { succeeded, failed } = bulkTransition(merged, to, { role, by })
      const overrides = { ...s.overrides }
      for (const o of succeeded) {
        const { id, ...rest } = o
        overrides[id] = { ...(overrides[id] || {}), ...rest }
      }
      return {
        overrides,
        lastAction: { ok: failed.length === 0, bulk: true, to, succeeded: succeeded.length, failed, at: now() },
      }
    },

    update: (s, { id, patch }) => ({
      overrides: { ...s.overrides, [id]: { ...(s.overrides[id] || {}), ...patch, updatedAt: now() } },
    }),

    addNote: (s, { orderId, text, by = 'admin', pinned = false }) => ({
      notes: {
        ...s.notes,
        [orderId]: [{ id: 'n' + now().toString(36), text, by, pinned, at: now() }, ...(s.notes[orderId] || [])],
      },
    }),

    removeNote: (s, { orderId, noteId }) => ({
      notes: { ...s.notes, [orderId]: (s.notes[orderId] || []).filter(n => n.id !== noteId) },
    }),

    setTags: (s, { orderId, tags }) => ({ tags: { ...s.tags, [orderId]: tags } }),

    toggleTag: (s, { orderId, tag }) => {
      const cur = s.tags[orderId] || []
      return {
        tags: {
          ...s.tags,
          [orderId]: cur.includes(tag) ? cur.filter(t => t !== tag) : [...cur, tag],
        },
      }
    },

    assignCourier: (s, { orderId, courier, awb }) => ({
      overrides: { ...s.overrides, [orderId]: { ...(s.overrides[orderId] || {}), courier, awb, updatedAt: now() } },
    }),

    recordShipment: (s, { orderId, shipment }) => ({
      shipments: { ...s.shipments, [orderId]: [...(s.shipments[orderId] || []), { id: 'shp' + now().toString(36), ...shipment }] },
    }),

    setSlaConfig: (s, patch) => ({ slaConfig: { ...s.slaConfig, ...patch } }),

    saveView: (s, view) => ({
      savedViews: [...s.savedViews.filter(v => v.id !== view.id), { id: 'v' + now().toString(36), ...view }],
    }),
    removeView: (s, id) => ({ savedViews: s.savedViews.filter(v => v.id !== id) }),

    clearAction: () => ({ lastAction: null }),
    reset: () => ({ overrides: {}, notes: {}, tags: {}, shipments: {} }),
  },
}

function mergeOrder(s, order) {
  const ov = s.overrides[order.id]
  return ov ? { ...order, ...ov } : order
}

/* ----------------------------------------------------------- selectors */

/** All orders with admin overrides applied. Use this everywhere. */
export function selectOrders(state) {
  const { overrides, created } = state.orders
  const base = created.length ? [...created, ...ORDERS] : ORDERS
  if (!Object.keys(overrides).length) return base
  return base.map(o => (overrides[o.id] ? { ...o, ...overrides[o.id] } : o))
}

export function selectOrder(state, id) {
  const base = state.orders.created.find(o => o.id === id) ?? ORDERS.find(o => o.id === id)
  if (!base) return null
  const ov = state.orders.overrides[id]
  const merged = ov ? { ...base, ...ov } : base
  return { ...merged, timeline: buildTimeline(merged) }
}

export function selectOrdersByCustomer(state, customerId) {
  return selectOrders(state).filter(o => o.customerId === customerId)
}

export function selectNotes(state, orderId) {
  return state.orders.notes[orderId] || []
}

export function selectTags(state, orderId) {
  return state.orders.tags[orderId] || []
}

export default ordersSlice
