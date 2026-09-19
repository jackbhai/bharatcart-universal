/**
 * Recommendation engine — content-based similarity, co-purchase affinity,
 * complete-the-look and personalised ranking. No ML dependency.
 */

/** Cosine-ish similarity over categorical product attributes. */
export function similarity(a, b) {
  if (!a || !b || a.id === b.id) return 0
  let score = 0
  if (a.category === b.category) score += 3
  if (a.subCategory === b.subCategory) score += 2.5
  if (a.brand === b.brand) score += 1.5
  if (a.fabric === b.fabric) score += 1.5
  if (a.craft === b.craft) score += 1.5
  if (a.origin === b.origin) score += 0.8
  if (a.gi && b.gi) score += 0.5
  if (a.handmade && b.handmade) score += 0.4

  const shared = (a.tags || []).filter(t => (b.tags || []).includes(t)).length
  score += shared * 0.7

  // price proximity (same band feels "similar")
  const hi = Math.max(a.price, b.price) || 1
  const ratio = Math.min(a.price, b.price) / hi
  score += ratio * 2

  return Math.round(score * 10) / 10
}

/** "You may also like" — similar products. */
export function similarProducts(product, catalogue = [], limit = 8) {
  if (!product) return []
  return catalogue
    .filter(p => p.id !== product.id && p.status === 'active')
    .map(p => ({ product: p, score: similarity(product, p) }))
    .filter(s => s.score > 2)
    .sort((a, b) => b.score - a.score || (b.product.rating ?? 0) - (a.product.rating ?? 0))
    .slice(0, limit)
    .map(s => s.product)
}

/** Frequently bought together — real co-purchase from order history. */
export function frequentlyBoughtTogether(productId, orders = [], catalogue = [], limit = 3) {
  const counts = new Map()
  let baskets = 0

  for (const o of orders) {
    const ids = (o.items || []).map(i => i.productId ?? i.product?.id).filter(Boolean)
    if (!ids.includes(productId)) continue
    baskets++
    for (const id of ids) {
      if (id === productId) continue
      counts.set(id, (counts.get(id) || 0) + 1)
    }
  }

  const byId = new Map(catalogue.map(p => [p.id, p]))
  const out = [...counts.entries()]
    .map(([id, count]) => ({ product: byId.get(id), count, confidence: baskets ? count / baskets : 0 }))
    .filter(x => x.product && x.product.status === 'active')
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)

  // fall back to similarity when history is thin
  if (out.length < limit) {
    const base = byId.get(productId)
    if (base) {
      const extra = similarProducts(base, catalogue, limit * 2)
        .filter(p => !out.some(o => o.product.id === p.id))
        .slice(0, limit - out.length)
        .map(p => ({ product: p, count: 0, confidence: 0, inferred: true }))
      out.push(...extra)
    }
  }
  return out
}

/** Complete-the-look — different category, matching aesthetic. */
export function completeTheLook(product, catalogue = [], limit = 4) {
  if (!product) return []
  const complements = {
    'Ethnic Wear': ['Jewellery', 'Footwear', 'Accessories'],
    'Western Wear': ['Accessories', 'Footwear', 'Beauty'],
    'Jewellery': ['Ethnic Wear', 'Accessories'],
    'Footwear': ['Ethnic Wear', 'Accessories'],
    'Accessories': ['Ethnic Wear', 'Western Wear'],
    'Home & Decor': ['Home & Decor'],
    'Beauty': ['Accessories', 'Beauty'],
    'Kids': ['Kids', 'Accessories'],
  }
  const wanted = complements[product.category] || []

  return catalogue
    .filter(p => p.id !== product.id && p.status === 'active' && wanted.includes(p.category))
    .map(p => {
      let s = 0
      const shared = (p.tags || []).filter(t => (product.tags || []).includes(t)).length
      s += shared * 2
      if (p.origin === product.origin) s += 1
      const band = Math.min(p.price, product.price) / (Math.max(p.price, product.price) || 1)
      s += band * 1.5
      s += (p.rating ?? 0) * 0.3
      return { product: p, score: s }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.product)
}

/** Personalised feed from a customer's affinity profile and history. */
export function personalisedFeed(customer, catalogue = [], opts = {}) {
  const { limit = 12, recentlyViewed = [], exclude = [] } = opts
  const affinity = customer?.affinity || {}
  const excluded = new Set(exclude)

  const scored = catalogue
    .filter(p => p.status === 'active' && !excluded.has(p.id))
    .map(p => {
      let s = 0
      const aff = affinity[p.category]
      if (aff) s += (typeof aff === 'number' ? aff : aff.pct ?? 0) * 0.12

      if (customer?.priceBand) {
        const [lo, hi] = customer.priceBand
        if (p.price >= lo && p.price <= hi) s += 3
        else s -= 1
      }
      if (customer?.preferredBrands?.includes(p.brand)) s += 2.5

      for (const rv of recentlyViewed.slice(0, 5)) {
        const base = catalogue.find(c => c.id === rv)
        if (base) s += similarity(base, p) * 0.4
      }

      s += ((p.rating ?? 0) - 3.5) * 1.2
      s += Math.log10((p.reviews ?? 0) + 1) * 0.6
      if (p.tags?.includes('bestseller')) s += 1.5
      if (p.tags?.includes('new')) s += 0.8
      if ((p.stock ?? 0) <= 0) s -= 5

      return { product: p, score: Math.round(s * 10) / 10 }
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map(s => s.product)
}

/** Trending — velocity-weighted, not just raw volume. */
export function trending(catalogue = [], orders = [], { limit = 10, windowDays = 14, now = Date.now() } = {}) {
  const cutoff = now - windowDays * 86400000
  const recent = new Map()
  const prior = new Map()

  for (const o of orders) {
    const bucket = (o.placedAt ?? o.createdAt ?? o.date ?? 0) >= cutoff ? recent : prior
    for (const i of o.items || []) {
      const id = i.productId ?? i.product?.id
      if (id) bucket.set(id, (bucket.get(id) || 0) + (i.qty ?? 1))
    }
  }

  const byId = new Map(catalogue.map(p => [p.id, p]))
  return [...recent.entries()]
    .map(([id, count]) => {
      const before = prior.get(id) || 0
      const velocity = before > 0 ? (count - before) / before : count > 2 ? 1 : 0
      return { product: byId.get(id), count, velocity: Math.round(velocity * 100), score: count * (1 + Math.max(0, velocity)) }
    })
    .filter(x => x.product && x.product.status === 'active')
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** Cross-sell for the cart — what pairs with what's already in it. */
export function cartCrossSell(cartItems, catalogue = [], orders = [], limit = 4) {
  // Accept cart lines ({ product, qty }) or bare product objects. Callers on
  // the storefront naturally have both shapes to hand, and getting it wrong
  // used to throw deep inside completeTheLook rather than here.
  const products = (cartItems || []).map(i => i?.product ?? i).filter(Boolean)
  const inCart = new Set(products.map(p => p.id))
  const scores = new Map()

  for (const product of products) {
    const fbt = frequentlyBoughtTogether(product.id, orders, catalogue, 6)
    for (const f of fbt) {
      if (inCart.has(f.product.id)) continue
      scores.set(f.product.id, (scores.get(f.product.id) || 0) + f.count + 1)
    }
    for (const p of completeTheLook(product, catalogue, 4)) {
      if (inCart.has(p.id)) continue
      scores.set(p.id, (scores.get(p.id) || 0) + 1.5)
    }
  }

  const byId = new Map(catalogue.map(p => [p.id, p]))
  return [...scores.entries()]
    .map(([id, score]) => ({ product: byId.get(id), score }))
    .filter(x => x.product)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.product)
}

export default { similarity, similarProducts, frequentlyBoughtTogether, completeTheLook, personalisedFeed, trending, cartCrossSell }
