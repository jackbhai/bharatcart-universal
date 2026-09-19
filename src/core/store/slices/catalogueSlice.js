import { PRODUCTS, CATEGORIES } from '../../../data/seed.js'

/**
 * Catalogue slice — products, variants, categories, collections, price lists,
 * tiers, schedules and inventory adjustments. Admin edits here; the storefront
 * reads the same data, so changes appear instantly.
 */

// Legacy category → vertical mapping (mirrors seed.js so every category row
// carries the vertical its products were tagged with). Additive only.
const CATEGORY_VERTICAL = {
  'Ethnic Wear': 'fashion',
  'Western Wear': 'fashion',
  'Kids': 'fashion',
  'Footwear': 'footwear',
  'Jewellery': 'artificial-jewellery',
}

const now = () => Date.now()
const uid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export const catalogueSlice = {
  initial: () => ({
    products: PRODUCTS,
    overrides: {},            // productId -> patch (keeps the seed pristine)
    deleted: [],              // soft-deleted product ids

    categories: CATEGORIES.map((c, i) => ({
      id: 'cat_' + i,
      name: c.cat,
      parentId: null,
      vertical: CATEGORY_VERTICAL[c.cat] || 'general',
      hsn: c.hsn,
      gst: c.gst,
      subs: c.subs,
      image: '',
      description: '',
      sortOrder: i,
      visible: true,
      seoTitle: '', seoDescription: '',
    })),

    collections: [
      { id: 'col_new', name: 'New Arrivals', type: 'smart', rules: { tags: ['new'] }, visible: true, sortOrder: 0 },
      { id: 'col_best', name: 'Best Sellers', type: 'smart', rules: { tags: ['bestseller'] }, visible: true, sortOrder: 1 },
      { id: 'col_fest', name: 'Festive Edit', type: 'smart', rules: { tags: ['festive'] }, visible: true, sortOrder: 2 },
      { id: 'col_gi', name: 'GI Tagged', type: 'smart', rules: { gi: true }, visible: true, sortOrder: 3 },
      { id: 'col_sale', name: 'Sale', type: 'smart', rules: { minDiscount: 30 }, visible: true, sortOrder: 4 },
    ],

    // pricing config consumed by the pricing engine
    priceLists: [
      { id: 'pl_retail', name: 'Retail', group: 'retail', active: true, rules: [] },
      { id: 'pl_b2b', name: 'B2B Wholesale', group: 'b2b', active: true,
        rules: [{ match: { all: true }, type: 'percent_off', value: 18 }] },
      { id: 'pl_vip', name: 'VIP', group: 'vip', active: true,
        rules: [{ match: { all: true }, type: 'percent_off', value: 8 }] },
    ],
    tiers: [
      { id: 'tier_bulk', name: 'Bulk buy', all: true,
        breaks: [{ minQty: 3, discountPct: 5 }, { minQty: 6, discountPct: 10 }, { minQty: 12, discountPct: 15 }] },
    ],
    schedules: [],

    // inventory
    warehouses: [
      { id: 'wh_ncr', name: 'Gurugram Hub', city: 'Gurugram', state: 'Haryana', zone: 'North', active: true, priority: 1 },
      { id: 'wh_mum', name: 'Bhiwandi Hub', city: 'Bhiwandi', state: 'Maharashtra', zone: 'West', active: true, priority: 2 },
      { id: 'wh_blr', name: 'Bengaluru Hub', city: 'Bengaluru', state: 'Karnataka', zone: 'South', active: true, priority: 3 },
    ],
    adjustments: [],          // stock ledger
    inventoryConfig: {
      lowThreshold: 10,
      criticalThreshold: 3,
      safetyStock: 2,
      allowBackorder: false,
      backorderLimit: 0,
      countIncoming: false,
      leadTimeDays: 14,
      serviceLevel: 0.95,
    },

    // ui state
    savedViews: [],
    lastBulkPreview: null,
  }),

  actions: {
    /* ---------------------------------------------------------- products */
    updateProduct: (s, { id, patch }) => ({
      overrides: { ...s.overrides, [id]: { ...(s.overrides[id] || {}), ...patch, updatedAt: now() } },
    }),

    bulkUpdate: (s, { ids, patch }) => {
      const o = { ...s.overrides }
      for (const id of ids) o[id] = { ...(o[id] || {}), ...patch, updatedAt: now() }
      return { overrides: o }
    },

    createProduct: (s, product) => {
      const p = {
        id: uid('P'),
        name: 'New product',
        brand: '', category: s.categories[0]?.name || 'General', subCategory: '',
        hsn: '6204', gst: 12, price: 999, mrp: 1499, discountPct: 33,
        variants: [], stock: 0, rating: 0, reviews: 0, views: 0, wishlisted: 0,
        returnRate: 0, codEligible: true, weightG: 300,
        createdAt: now(), tags: [], status: 'draft',
        ...product,
      }
      return { products: [p, ...s.products] }
    },

    duplicateProduct: (s, id) => {
      const src = resolveOne(s, id)
      if (!src) return
      const copy = {
        ...src,
        id: uid('P'),
        name: src.name + ' (copy)',
        status: 'draft',
        createdAt: now(),
        reviews: 0, views: 0, wishlisted: 0,
        variants: (src.variants || []).map(v => ({ ...v, sku: v.sku + '-C' })),
      }
      return { products: [copy, ...s.products] }
    },

    deleteProduct: (s, id) => ({ deleted: [...s.deleted, id] }),
    restoreProduct: (s, id) => ({ deleted: s.deleted.filter(d => d !== id) }),
    bulkDelete: (s, ids) => ({ deleted: [...new Set([...s.deleted, ...ids])] }),

    /* ---------------------------------------------------------- variants */
    addVariant: (s, { productId, variant }) => {
      const p = resolveOne(s, productId)
      if (!p) return
      const variants = [...(p.variants || []), {
        sku: variant.sku || `${productId}-${(p.variants?.length ?? 0) + 1}`,
        size: 'Free Size', color: 'Default', hex: '#888888',
        stock: 0, reserved: 0, ...variant,
      }]
      return applyPatch(s, productId, { variants, stock: variants.reduce((x, v) => x + (v.stock || 0), 0) })
    },

    updateVariant: (s, { productId, sku, patch }) => {
      const p = resolveOne(s, productId)
      if (!p) return
      const variants = (p.variants || []).map(v => v.sku === sku ? { ...v, ...patch } : v)
      return applyPatch(s, productId, { variants, stock: variants.reduce((x, v) => x + (v.stock || 0), 0) })
    },

    removeVariant: (s, { productId, sku }) => {
      const p = resolveOne(s, productId)
      if (!p) return
      const variants = (p.variants || []).filter(v => v.sku !== sku)
      return applyPatch(s, productId, { variants, stock: variants.reduce((x, v) => x + (v.stock || 0), 0) })
    },

    /** Generate every size × colour combination. */
    generateMatrix: (s, { productId, sizes, colors }) => {
      const p = resolveOne(s, productId)
      if (!p) return
      const existing = new Map((p.variants || []).map(v => [`${v.size}|${v.color}`, v]))
      const variants = []
      for (const size of sizes) {
        for (const c of colors) {
          const key = `${size}|${c.name ?? c}`
          variants.push(existing.get(key) || {
            sku: `${productId}-${String(size).toUpperCase()}-${String(c.name ?? c).slice(0, 3).toUpperCase()}`,
            size, color: c.name ?? c, hex: c.hex ?? '#888888',
            stock: 0, reserved: 0,
          })
        }
      }
      return applyPatch(s, productId, { variants, stock: variants.reduce((x, v) => x + (v.stock || 0), 0) })
    },

    /* --------------------------------------------------------- inventory */
    adjustStock: (s, { productId, sku, delta, reason, note, warehouse }) => {
      const p = resolveOne(s, productId)
      if (!p) return
      const variants = (p.variants || []).map(v =>
        v.sku === sku ? { ...v, stock: Math.max(0, (v.stock || 0) + delta) } : v
      )
      const entry = {
        id: uid('adj'), productId, sku, delta,
        reason: reason || 'manual', note: note || '',
        warehouse: warehouse || 'wh_ncr',
        at: now(),
        balance: variants.find(v => v.sku === sku)?.stock ?? 0,
      }
      return {
        ...applyPatch(s, productId, { variants, stock: variants.reduce((x, v) => x + (v.stock || 0), 0) }),
        adjustments: [entry, ...s.adjustments].slice(0, 500),
      }
    },

    setInventoryConfig: (s, patch) => ({ inventoryConfig: { ...s.inventoryConfig, ...patch } }),

    addWarehouse: (s, w) => ({ warehouses: [...s.warehouses, { id: uid('wh'), active: true, priority: s.warehouses.length + 1, ...w }] }),
    updateWarehouse: (s, { id, patch }) => ({ warehouses: s.warehouses.map(w => w.id === id ? { ...w, ...patch } : w) }),
    removeWarehouse: (s, id) => ({ warehouses: s.warehouses.filter(w => w.id !== id) }),

    /* -------------------------------------------------------- categories */
    addCategory: (s, c) => ({
      categories: [...s.categories, { id: uid('cat'), name: 'New category', parentId: null, gst: 12, hsn: '', subs: [], visible: true, sortOrder: s.categories.length, ...c }],
    }),
    updateCategory: (s, { id, patch }) => ({ categories: s.categories.map(c => c.id === id ? { ...c, ...patch } : c) }),
    removeCategory: (s, id) => ({ categories: s.categories.filter(c => c.id !== id) }),
    reorderCategories: (s, { from, to }) => {
      const list = [...s.categories]
      const [m] = list.splice(from, 1)
      list.splice(to, 0, m)
      return { categories: list.map((c, i) => ({ ...c, sortOrder: i })) }
    },

    /* ------------------------------------------------------- collections */
    addCollection: (s, c) => ({
      collections: [...s.collections, { id: uid('col'), name: 'New collection', type: 'manual', productIds: [], rules: {}, visible: true, sortOrder: s.collections.length, ...c }],
    }),
    updateCollection: (s, { id, patch }) => ({ collections: s.collections.map(c => c.id === id ? { ...c, ...patch } : c) }),
    removeCollection: (s, id) => ({ collections: s.collections.filter(c => c.id !== id) }),

    /* ------------------------------------------------------------ pricing */
    addPriceList: (s, l) => ({ priceLists: [...s.priceLists, { id: uid('pl'), name: 'New price list', group: 'retail', active: true, rules: [], ...l }] }),
    updatePriceList: (s, { id, patch }) => ({ priceLists: s.priceLists.map(l => l.id === id ? { ...l, ...patch } : l) }),
    removePriceList: (s, id) => ({ priceLists: s.priceLists.filter(l => l.id !== id) }),

    addTier: (s, t) => ({ tiers: [...s.tiers, { id: uid('tier'), name: 'New tier', all: true, breaks: [], ...t }] }),
    updateTier: (s, { id, patch }) => ({ tiers: s.tiers.map(t => t.id === id ? { ...t, ...patch } : t) }),
    removeTier: (s, id) => ({ tiers: s.tiers.filter(t => t.id !== id) }),

    addSchedule: (s, sch) => ({ schedules: [...s.schedules, { id: uid('sch'), ...sch }] }),
    updateSchedule: (s, { id, patch }) => ({ schedules: s.schedules.map(x => x.id === id ? { ...x, ...patch } : x) }),
    removeSchedule: (s, id) => ({ schedules: s.schedules.filter(x => x.id !== id) }),

    /** Commit a previewed bulk price change. */
    applyBulkPrice: (s, changes) => {
      const o = { ...s.overrides }
      for (const c of changes) {
        const next = c.to ?? c.price
        if (next == null) continue
        o[c.id] = { ...(o[c.id] || {}), price: Math.round(next), updatedAt: now() }
      }
      return { overrides: o, lastBulkPreview: null }
    },
    setBulkPreview: (_s, preview) => ({ lastBulkPreview: preview }),

    /* --------------------------------------------------------- saved views */
    saveView: (s, view) => ({ savedViews: [...s.savedViews, { id: uid('view'), createdAt: now(), ...view }] }),
    removeView: (s, id) => ({ savedViews: s.savedViews.filter(v => v.id !== id) }),

    resetCatalogue: () => ({ overrides: {}, deleted: [], adjustments: [], schedules: [] }),
  },
}

/* ------------------------------------------------------------ helpers */
function applyPatch(s, id, patch) {
  return { overrides: { ...s.overrides, [id]: { ...(s.overrides[id] || {}), ...patch, updatedAt: now() } } }
}

function resolveOne(s, id) {
  const base = s.products.find(p => p.id === id)
  if (!base) return null
  return { ...base, ...(s.overrides[id] || {}) }
}

/* ---------------------------------------------------------- selectors */

/** Products with overrides merged and deletions removed — use this everywhere. */
export function selectProducts(state) {
  const c = state.catalogue
  const deleted = new Set(c.deleted)
  return c.products
    .filter(p => !deleted.has(p.id))
    .map(p => (c.overrides[p.id] ? { ...p, ...c.overrides[p.id] } : p))
}

export function selectProduct(state, id) {
  const c = state.catalogue
  if (c.deleted.includes(id)) return null
  const base = c.products.find(p => p.id === id)
  return base ? { ...base, ...(c.overrides[id] || {}) } : null
}

export function selectActiveProducts(state) {
  return selectProducts(state).filter(p => p.status === 'active')
}

/** Resolve a smart collection's members. */
export function selectCollectionProducts(state, collectionId) {
  const col = state.catalogue.collections.find(c => c.id === collectionId)
  if (!col) return []
  const all = selectActiveProducts(state)
  if (col.type === 'manual') return all.filter(p => (col.productIds || []).includes(p.id))

  const r = col.rules || {}
  return all.filter(p => {
    if (r.tags?.length && !(p.tags || []).some(t => r.tags.includes(t))) return false
    if (r.categories?.length && !r.categories.includes(p.category)) return false
    if (r.brands?.length && !r.brands.includes(p.brand)) return false
    if (r.gi && !p.gi) return false
    if (r.handmade && !p.handmade) return false
    if (r.minDiscount != null && (p.discountPct || 0) < r.minDiscount) return false
    if (r.minPrice != null && p.price < r.minPrice) return false
    if (r.maxPrice != null && p.price > r.maxPrice) return false
    if (r.minRating != null && (p.rating || 0) < r.minRating) return false
    return true
  })
}

export const selectCategories = (s) => s.catalogue.categories
export const selectWarehouses = (s) => s.catalogue.warehouses
export const selectPricingConfig = (s) => ({
  priceLists: s.catalogue.priceLists,
  tiers: s.catalogue.tiers,
  schedules: s.catalogue.schedules,
})

export default catalogueSlice
