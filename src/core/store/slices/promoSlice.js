import { COUPONS } from '../../../data/seed.js'
import { DISCOUNT_TYPE } from '../../../engines/promo/promoEngine.js'

const uid = () => 'promo_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

/** Promotions & coupons — the admin builds rules, the cart obeys them. */
export const promoSlice = {
  initial: () => ({
    promos: [],
    usage: {},
    seedCoupons: COUPONS,
    lastSimulation: null,
  }),

  actions: {
    create: (s, promo) => ({
      promos: [{
        id: uid(), name: 'New promotion', code: null,
        type: DISCOUNT_TYPE.PERCENT, value: 10, maxDiscount: null,
        conditions: { all: [] }, active: false, stackable: true, exclusive: false,
        priority: 0, usageLimit: null, perCustomerLimit: null, usedCount: 0,
        marginGuard: true, appliesTo: 'cart', match: { all: true },
        createdAt: Date.now(), ...promo,
      }, ...s.promos],
    }),

    update: (s, { id, patch }) => ({ promos: s.promos.map(p => p.id === id ? { ...p, ...patch } : p) }),
    remove: (s, id) => ({ promos: s.promos.filter(p => p.id !== id) }),
    toggle: (s, id) => ({ promos: s.promos.map(p => p.id === id ? { ...p, active: !p.active } : p) }),

    duplicate: (s, id) => {
      const src = s.promos.find(p => p.id === id)
      if (!src) return
      return { promos: [{ ...src, id: uid(), name: src.name + ' (copy)', code: src.code ? src.code + '2' : null, active: false, usedCount: 0 }, ...s.promos] }
    },

    setConditions: (s, { id, conditions }) => ({
      promos: s.promos.map(p => p.id === id ? { ...p, conditions } : p),
    }),

    addCondition: (s, { id, condition }) => ({
      promos: s.promos.map(p => p.id === id
        ? { ...p, conditions: { ...p.conditions, all: [...(p.conditions?.all || []), condition] } }
        : p),
    }),

    removeCondition: (s, { id, index }) => ({
      promos: s.promos.map(p => p.id === id
        ? { ...p, conditions: { ...p.conditions, all: (p.conditions?.all || []).filter((_, i) => i !== index) } }
        : p),
    }),

    updateCondition: (s, { id, index, patch }) => ({
      promos: s.promos.map(p => p.id === id
        ? { ...p, conditions: { ...p.conditions, all: (p.conditions?.all || []).map((c, i) => i === index ? { ...c, ...patch } : c) } }
        : p),
    }),

    /** Generate N unique single-use codes from a prefix. */
    generateCodes: (s, { id, count, prefix }) => {
      const src = s.promos.find(p => p.id === id)
      if (!src) return
      const codes = Array.from({ length: count }, () =>
        `${prefix || 'BC'}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      )
      return { promos: s.promos.map(p => p.id === id ? { ...p, bulkCodes: codes, perCustomerLimit: 1 } : p) }
    },

    recordUsage: (s, { id, customerId }) => ({
      usage: {
        ...s.usage,
        [id]: {
          total: (s.usage[id]?.total ?? 0) + 1,
          customers: { ...(s.usage[id]?.customers || {}), [customerId]: ((s.usage[id]?.customers?.[customerId]) ?? 0) + 1 },
        },
      },
    }),

    setSimulation: (_s, result) => ({ lastSimulation: result }),
  },
}

export const selectPromos = (s) => s.promo.promos
export const selectActivePromos = (s) => s.promo.promos.filter(p => p.active)
export const selectPublicCoupons = (s) =>
  s.promo.promos.filter(p => p.active && p.code && p.showOnSite !== false)

export default promoSlice
