/**
 * Vertical registry adapter for the admin catalogue (Chunk C).
 *
 * The canonical registry lives in src/engines/catalogue/verticals.js and is
 * resolved with import.meta.glob: when that engine file is momentarily absent
 * the glob simply matches nothing (no build/runtime error) and we fall back
 * to the bundled minimal registry in ./verticalsFallback.js. When present,
 * the engine module is the single source of truth — the fallback is never used.
 *
 * Re-exported contract (mirrors the engine):
 *   VERTICALS, VERTICAL_IDS, getVertical(id), verticalFor(product),
 *   variantAxesFor(product), attributeSchemaFor(product)
 * Plus admin helpers:
 *   usesVariantPricing(verticalId), variantLabel(variant, axes)
 */
import { VERTICALS as FALLBACK_VERTICALS } from './verticalsFallback.js'

const matches = import.meta.glob('../../engines/catalogue/verticals.js', { eager: true })
const engine = Object.values(matches)[0] || null
const pick = (name, fallback) => (engine && engine[name] != null ? engine[name] : fallback)

export const VERTICALS = pick('VERTICALS', FALLBACK_VERTICALS)
export const VERTICAL_IDS = pick('VERTICAL_IDS', Object.keys(VERTICALS))
export const getVertical = pick('getVertical', (id) => VERTICALS[id] || VERTICALS.general)
export const verticalFor = pick(
  'verticalFor',
  (p = {}) => (p && p.vertical && VERTICALS[p.vertical] ? p.vertical : 'general'),
)
export const variantAxesFor = pick(
  'variantAxesFor',
  (p) => getVertical(verticalFor(p)).variantAxes || [],
)
export const attributeSchemaFor = pick(
  'attributeSchemaFor',
  (p) => getVertical(verticalFor(p)).attributeSchema || [],
)

/** Verticals where each variant normally carries its own price. */
export const VARIANT_PRICE_VERTICALS = ['grocery', 'dairy', 'confectionery', 'fine-jewellery']
export const usesVariantPricing = (verticalId) => VARIANT_PRICE_VERTICALS.includes(verticalId)

/**
 * Human label for a variant row, derived from the product's variant axes.
 * Falls back to the legacy size/color fields for pre-vertical products.
 */
export function variantLabel(variant = {}, axes = []) {
  const parts = (axes || [])
    .map((ax) => variant[ax.key])
    .filter((x) => x !== undefined && x !== null && x !== '')
  if (parts.length) return parts.join(' · ')
  return [variant.size, variant.color].filter(Boolean).join(' · ')
}
