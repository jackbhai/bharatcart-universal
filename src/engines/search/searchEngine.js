/**
 * Search engine — tokenised scoring, typo tolerance, synonyms, facets.
 * Pure client-side, no dependencies.
 */

export const SYNONYMS = {
  saree: ['sari', 'sadi', 'seere'],
  kurta: ['kurti', 'kurtha'],
  lehenga: ['lehanga', 'lehnga', 'ghagra'],
  dupatta: ['chunni', 'odhni'],
  salwar: ['shalwar', 'churidar'],
  jhumka: ['jhumki', 'earring', 'earrings'],
  payal: ['anklet'],
  bangle: ['bangles', 'kada', 'chudi'],
  sherwani: ['shervani'],
  silk: ['resham'],
  cotton: ['sooti'],
  wedding: ['shaadi', 'bridal', 'marriage'],
  festive: ['festival', 'diwali', 'puja', 'pooja'],
}

const STOP_WORDS = new Set(['a','an','the','for','of','in','on','with','and','or','to','my','buy'])

export function tokenise(q) {
  return String(q || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t))
}

export function expandSynonyms(tokens) {
  const out = new Set(tokens)
  for (const t of tokens) {
    for (const [key, alts] of Object.entries(SYNONYMS)) {
      if (t === key) alts.forEach(a => out.add(a))
      else if (alts.includes(t)) { out.add(key); alts.forEach(a => out.add(a)) }
    }
  }
  return [...out]
}

/** Damerau-Levenshtein, capped for speed. */
export function editDistance(a, b, max = 2) {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  const m = a.length, n = b.length
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      best = Math.min(best, cur[j])
    }
    if (best > max) return max + 1
    prev = cur
  }
  return prev[n]
}

function fieldScore(token, text, weight) {
  if (!text) return 0
  const lower = String(text).toLowerCase()
  if (lower === token) return weight * 3
  if (lower.startsWith(token)) return weight * 2
  if (lower.includes(token)) return weight
  // typo tolerance on individual words
  for (const word of lower.split(/\s+/)) {
    if (word.length >= 4 && editDistance(token, word, token.length > 5 ? 2 : 1) <= (token.length > 5 ? 2 : 1)) {
      return weight * 0.6
    }
  }
  return 0
}

const WEIGHTS = { name: 10, category: 6, subCategory: 5, brand: 6, craft: 4, fabric: 4, origin: 2, tags: 3 }

/** Score and rank products for a query. */
export function search(products = [], query, opts = {}) {
  const { limit = 60, minScore = 1, boostPopular = true } = opts
  const raw = tokenise(query)
  if (!raw.length) return { results: products.slice(0, limit), tokens: [], corrected: null, total: products.length }

  const tokens = expandSynonyms(raw)

  const scored = []
  for (const p of products) {
    let score = 0
    let matchedTokens = 0

    for (const token of raw) {
      let best = 0
      for (const [field, weight] of Object.entries(WEIGHTS)) {
        const val = field === 'tags' ? (p.tags || []).join(' ') : p[field]
        best = Math.max(best, fieldScore(token, val, weight))
      }
      // synonym pass at reduced weight
      if (best === 0) {
        for (const syn of tokens) {
          if (syn === token) continue
          for (const [field, weight] of Object.entries(WEIGHTS)) {
            const val = field === 'tags' ? (p.tags || []).join(' ') : p[field]
            best = Math.max(best, fieldScore(syn, val, weight * 0.7))
          }
        }
      }
      if (best > 0) matchedTokens++
      score += best
    }

    if (matchedTokens === 0) continue
    // require most tokens to match on multi-word queries
    if (raw.length > 1 && matchedTokens < Math.ceil(raw.length / 2)) continue

    score *= 1 + (matchedTokens - 1) * 0.3

    if (boostPopular) {
      score += Math.log10((p.reviews || 0) + 1) * 0.8
      score += ((p.rating || 0) - 3) * 0.5
      if (p.tags?.includes('bestseller')) score += 2
    }
    if (p.status !== 'active') score *= 0.3

    scored.push({ product: p, score: Math.round(score * 10) / 10, matchedTokens })
  }

  scored.sort((a, b) => b.score - a.score)
  const results = scored.filter(s => s.score >= minScore)

  return {
    results: results.slice(0, limit).map(s => s.product),
    scored: results.slice(0, limit),
    tokens: raw,
    expanded: tokens,
    total: results.length,
    corrected: results.length === 0 ? suggestCorrection(raw, products) : null,
  }
}

function suggestCorrection(tokens, products) {
  const vocab = new Set()
  for (const p of products.slice(0, 300)) {
    tokenise(`${p.name} ${p.category} ${p.brand} ${p.craft} ${p.fabric}`).forEach(t => vocab.add(t))
  }
  const fixed = tokens.map(t => {
    if (vocab.has(t)) return t
    let best = t, bestD = 3
    for (const v of vocab) {
      const d = editDistance(t, v, 2)
      if (d < bestD) { bestD = d; best = v }
    }
    return best
  })
  const joined = fixed.join(' ')
  return joined !== tokens.join(' ') ? joined : null
}

/** Typeahead suggestions across products, categories and brands. */
export function suggest(products = [], query, limit = 8) {
  const q = String(query || '').toLowerCase().trim()
  if (q.length < 2) return []

  const out = []
  const seen = new Set()

  const add = (type, label, meta) => {
    const key = type + ':' + label
    if (seen.has(key)) return
    seen.add(key)
    out.push({ type, label, ...meta })
  }

  for (const p of products) {
    if (out.length >= limit * 3) break
    if (p.category?.toLowerCase().includes(q)) add('category', p.category, { icon: '▦' })
    if (p.brand?.toLowerCase().includes(q)) add('brand', p.brand, { icon: '◈' })
    if (p.subCategory?.toLowerCase().includes(q)) add('category', p.subCategory, { icon: '▦' })
  }
  for (const p of products) {
    if (p.name?.toLowerCase().includes(q)) {
      add('product', p.name, { icon: '◉', id: p.id, price: p.price, image: p.image })
    }
    if (out.length >= limit) break
  }

  const order = { category: 0, brand: 1, product: 2 }
  return out.sort((a, b) => order[a.type] - order[b.type]).slice(0, limit)
}

/** Build facet counts for the current result set. */
export function buildFacets(products = [], active = {}) {
  const facets = {
    category: new Map(), brand: new Map(), fabric: new Map(),
    craft: new Map(), origin: new Map(), size: new Map(), color: new Map(), tags: new Map(),
  }

  for (const p of products) {
    inc(facets.category, p.category)
    inc(facets.brand, p.brand)
    inc(facets.fabric, p.fabric)
    inc(facets.craft, p.craft)
    inc(facets.origin, p.origin)
    for (const t of p.tags || []) inc(facets.tags, t)
    for (const v of p.variants || []) { inc(facets.size, v.size); inc(facets.color, v.color) }
  }

  const prices = products.map(p => p.price).filter(Boolean)
  const priceRange = prices.length
    ? { min: Math.min(...prices), max: Math.max(...prices) }
    : { min: 0, max: 0 }
  return {
    ...Object.fromEntries(Object.entries(facets).map(([k, m]) => [
      k, [...m.entries()]
        .map(([value, count]) => ({ value, count, active: (active[k] || []).includes(value) }))
        .sort((a, b) => b.count - a.count),
    ])),
    price: priceRange,
    ratings: [4, 3, 2].map(r => ({ value: r, count: products.filter(p => (p.rating || 0) >= r).length })),
    discounts: [10, 25, 40, 60].map(d => ({ value: d, count: products.filter(p => (p.discountPct || 0) >= d).length })),
  }
}

function inc(map, key) { if (key) map.set(key, (map.get(key) || 0) + 1) }

/** Apply facet filters to a product list. */
export function applyFilters(products = [], f = {}) {
  return products.filter(p => {
    if (f.category?.length && !f.category.includes(p.category)) return false
    if (f.brand?.length && !f.brand.includes(p.brand)) return false
    if (f.fabric?.length && !f.fabric.includes(p.fabric)) return false
    if (f.craft?.length && !f.craft.includes(p.craft)) return false
    if (f.origin?.length && !f.origin.includes(p.origin)) return false
    if (f.tags?.length && !(p.tags || []).some(t => f.tags.includes(t))) return false
    if (f.minPrice != null && p.price < f.minPrice) return false
    if (f.maxPrice != null && p.price > f.maxPrice) return false
    if (f.minRating != null && (p.rating || 0) < f.minRating) return false
    if (f.minDiscount != null && (p.discountPct || 0) < f.minDiscount) return false
    if (f.inStock && (p.stock ?? 0) <= 0) return false
    if (f.gi && !p.gi) return false
    if (f.handmade && !p.handmade) return false
    if (f.codEligible && !p.codEligible) return false
    if (f.size?.length && !(p.variants || []).some(v => f.size.includes(v.size))) return false
    if (f.color?.length && !(p.variants || []).some(v => f.color.includes(v.color))) return false
    if (f.status && p.status !== f.status) return false
    return true
  })
}

export const SORTS = {
  relevance: null,
  newest: (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
  price_asc: (a, b) => a.price - b.price,
  price_desc: (a, b) => b.price - a.price,
  rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
  popularity: (a, b) => (b.views ?? 0) - (a.views ?? 0),
  discount: (a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0),
  name_asc: (a, b) => String(a.name).localeCompare(String(b.name)),
  stock_asc: (a, b) => (a.stock ?? 0) - (b.stock ?? 0),
}

export function sortProducts(products = [], sortKey) {
  const fn = SORTS[sortKey]
  return fn ? [...products].sort(fn) : products
}

export default { search, suggest, buildFacets, applyFilters, sortProducts, tokenise, editDistance, SORTS }
