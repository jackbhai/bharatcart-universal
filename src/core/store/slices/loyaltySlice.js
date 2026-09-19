import { DEFAULT_CONFIG } from '../../../engines/loyalty/loyaltyEngine.js'

/** Loyalty programme configuration — admin owns it, storefront obeys it. */
export const loyaltySlice = {
  initial: () => ({
    config: { ...DEFAULT_CONFIG },
    ledger: [],        // { id, customerId, type, points, reason, at }
    referrals: [],
  }),

  actions: {
    setConfig: (s, patch) => ({ config: { ...s.config, ...patch } }),
    toggle: (s) => ({ config: { ...s.config, enabled: !s.config.enabled } }),

    setTier: (s, { id, patch }) => ({
      config: { ...s.config, tiers: s.config.tiers.map(t => t.id === id ? { ...t, ...patch } : t) },
    }),
    addTier: (s) => ({
      config: {
        ...s.config,
        tiers: [...s.config.tiers, {
          id: 'tier_' + Date.now(), name: 'New Tier',
          threshold: (s.config.tiers.at(-1)?.threshold ?? 0) + 50000,
          colour: '#8B5CF6', multiplier: 1, perks: [],
        }],
      },
    }),
    removeTier: (s, id) => ({ config: { ...s.config, tiers: s.config.tiers.filter(t => t.id !== id) } }),

    setCategoryMultiplier: (s, { category, value }) => ({
      config: {
        ...s.config,
        categoryMultipliers: value === 1 || value == null
          ? omit(s.config.categoryMultipliers, category)
          : { ...s.config.categoryMultipliers, [category]: value },
      },
    }),

    grantPoints: (s, { customerId, points, reason }) => ({
      ledger: [{ id: 'l' + Date.now() + Math.random().toString(36).slice(2,5), customerId, type: points >= 0 ? 'earn' : 'redeem', points: Math.abs(points), reason: reason || 'Manual adjustment', at: Date.now() }, ...s.ledger].slice(0, 1000),
    }),

    bulkGrant: (s, { customerIds, points, reason }) => ({
      ledger: [
        ...customerIds.map((cid, i) => ({
          id: 'l' + Date.now() + i, customerId: cid, type: 'earn',
          points, reason: reason || 'Bulk grant', at: Date.now(),
        })),
        ...s.ledger,
      ].slice(0, 1000),
    }),

    resetConfig: () => ({ config: { ...DEFAULT_CONFIG } }),
  },
}

const omit = (obj, key) => { const { [key]: _, ...rest } = obj; return rest }

export const selectLoyaltyConfig = (s) => s.loyalty.config
export const selectLedgerFor = (s, customerId) => s.loyalty.ledger.filter(l => l.customerId === customerId)
export default loyaltySlice
