/**
 * Vertical price engine — the composition point the storefront integrity gate calls.
 *
 * Resolution order:
 *   1. 'fine-jewellery' → priced live from the gold rate (source 'gold-rate')
 *   2. variant with its own `price` on pack verticals (grocery/dairy/confectionery)
 *      → pack price (source 'pack-price') with a per-kg/per-L unit label
 *   3. perishable near-expiry → near-expiry discount on top of the base
 *      (source 'near-expiry', recorded in the trail)
 *   4. everything else → delegates to the existing `resolvePrice(product, ctx)`
 *      and returns its result shape unchanged
 *
 * `ctx.vertical` may carry an explicit vertical id (handy for overrides and
 * tests); otherwise it comes from `verticalFor(product)` in the catalogue
 * vertical registry (../catalogue/verticals.js).
 */

import { resolvePrice } from './priceEngine.js'
import { verticalFor } from '../catalogue/verticals.js'
import { fineJewelleryPrice, snapshotRate } from './goldEngine.js'
import { nearExpiryDiscount, expiryStatus } from '../perishables/expiryEngine.js'
import { uomLabel, formatUom } from './uomEngine.js'

/** Verticals where a variant-level pack price is the unit of sale. */
const PACK_VERTICALS = new Set(['grocery', 'dairy', 'confectionery'])

const r2 = (n) => Math.round(n * 100) / 100

function goldParams(product, variant, ctx) {
  const a = { ...(product.attributes || {}), ...(variant?.attributes || {}) }
  return {
    purity: variant?.purity ?? a.purity ?? ctx.purity,
    weightG: variant?.weightG ?? a.weightG ?? ctx.weightG,
    makingPct: variant?.makingPct ?? a.makingPct ?? ctx.makingPct ?? 12,
    stoneValue: variant?.stoneValue ?? a.stoneValue ?? ctx.stoneValue ?? 0,
    wastagePct: variant?.wastagePct ?? a.wastagePct ?? ctx.wastagePct ?? 2,
  }
}

/**
 * Resolve the selling price for a product (optionally a specific variant).
 *
 * @param {object} product
 * @param {object|null} variant
 * @param {object} [ctx]  resolvePrice ctx + { vertical, now, expiry:{nearDays,pct}, gold:{rates} }
 * @returns {{ price, source, trail, unitLabel?, unitLabelText?, meta?, mrp?, discountPct? }}
 */
export function resolveVerticalPrice(product, variant = null, ctx = {}) {
  const now = ctx.now ?? Date.now()
  const vertical = ctx.vertical ?? verticalFor(product)
  const trail = []

  // ---- 1. fine jewellery — priced from the gold rate
  if (vertical === 'fine-jewellery') {
    const params = goldParams(product, variant, ctx)
    const priced = fineJewelleryPrice(params, ctx.gold)
    const snapshot = snapshotRate(params.purity, ctx.gold, now)
    trail.push({
      step: 'gold-rate',
      price: priced.total,
      note: `${params.purity} @ ₹${snapshot.ratePerGram}/g × ${params.weightG}g`,
    })
    return {
      price: priced.total,
      mrp: priced.total,
      unitPrice: priced.total,
      lineTotal: r2(priced.total * (ctx.qty ?? 1)),
      source: 'gold-rate',
      discount: 0,
      discountPct: 0,
      trail,
      unitLabel: null,
      unitLabelText: null,
      meta: { snapshot, breakdown: priced.breakdown, ratePerGram: priced.ratePerGram },
    }
  }

  // ---- 2. pack price on pack verticals
  let base
  let unitLabel = uomLabel(product, variant)
  let unitLabelText = formatUom(product, variant)

  if (variant?.price != null && PACK_VERTICALS.has(vertical)) {
    base = {
      price: variant.price,
      mrp: variant.mrp ?? variant.price,
      unitPrice: variant.price,
      lineTotal: r2(variant.price * (ctx.qty ?? 1)),
      source: 'pack-price',
      discount: Math.max(0, (variant.mrp ?? variant.price) - variant.price),
      discountPct: 0,
      trail: [{ step: 'pack-price', price: variant.price, note: `variant ${variant.sku} pack price` }],
    }
    if (base.mrp > 0) base.discountPct = Math.round((base.discount / base.mrp) * 100)
  } else {
    // ---- 4 (delegate first; near-expiry discount in step 3 sits on top)
    const delegated = resolvePrice(product, ctx)
    base = { ...delegated, trail: [{ step: 'delegate', note: `delegated to resolvePrice (source: ${delegated.source})` }, ...delegated.trail] }
  }

  // ---- 3. near-expiry markdown on top of the base
  const pct = nearExpiryDiscount(product, now, ctx.expiry)
  if (pct > 0) {
    const before = base.price
    const price = r2(before * (1 - pct / 100))
    trail.push({ step: 'near-expiry', price, note: `${pct}% near-expiry markdown (${expiryStatus(product, now, ctx.expiry).label})` })
    return {
      ...base,
      price,
      unitPrice: price,
      lineTotal: r2(price * (ctx.qty ?? 1)),
      source: 'near-expiry',
      discount: Math.max(0, base.mrp - price),
      discountPct: base.mrp > 0 ? Math.round(((base.mrp - price) / base.mrp) * 100) : 0,
      trail: [...base.trail, ...trail],
      unitLabel,
      unitLabelText,
      meta: { ...(base.meta || {}), nearExpiryPct: pct },
    }
  }

  return { ...base, unitLabel, unitLabelText, meta: base.meta ?? null }
}

/**
 * Freeze a priced order line.
 * @returns {{ unitPrice, qty, lineTotal, source, meta, unitLabel, unitLabelText, trail }}
 */
export function linePriceSnapshot(product, variant, qty, ctx = {}) {
  const resolved = resolveVerticalPrice(product, variant, { ...ctx, qty })
  return {
    unitPrice: resolved.price,
    qty,
    lineTotal: r2(resolved.price * qty),
    source: resolved.source,
    meta: resolved.meta ?? null,
    unitLabel: resolved.unitLabel ?? null,
    unitLabelText: resolved.unitLabelText ?? null,
    trail: resolved.trail ?? [],
  }
}

export default { resolveVerticalPrice, linePriceSnapshot }
