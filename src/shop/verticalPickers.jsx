/**
 * verticalPickers — PDP option pickers dispatched by product vertical.
 *
 * The storefront owns no business logic: every price, slot list and schedule
 * comes from the engines via ./verticalEngines.js (which degrades gracefully
 * until the parallel engine chunks land). Pickers only collect the shopper's
 * choices and always report them as `onChange({ variant, extras })`.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { useShop } from './shopState.jsx'
import {
  verticalFor, getVertical, variantAxesFor, attributeSchemaFor, attributeValue,
  pricingVariant, resolveVerticalPrice, formatUom, snapshotRate, getSizeChart,
  frequencies, nextDeliverySlots, deliverySlots, useEngineVersion,
  goldRateStatus,
} from './verticalEngines.js'
import { Modal, Badge } from '../ui/primitives/Display.jsx'
import { Select, Switch, Textarea } from '../ui/primitives/Input.jsx'
import { inr } from '../lib/analytics.js'

/* Pretty-print a schema field value for display. */
function prettyValue(key, value) {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  if (Array.isArray(value)) return value.join(', ')
  if (key === 'weightG') return `${value} g`
  if (key === 'makingPct') return `${value}%`
  if (key === 'bestBeforeDays' || key === 'shelfLifeDays') return `${value} days`
  if (key === 'expiryDate') {
    try {
      return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch { return String(value) }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  }
  return String(value ?? '')
}

/**
 * Derive the pre-discount strike price and offer badge from an engine
 * pricing result. The engine exposes near-expiry markdowns via
 * `source: 'near-expiry'` + `meta.nearExpiryPct`, with the pre-markdown
 * price visible in the pricing trail.
 */
export function priceStrikeInfo(pricing, product) {
  if (!pricing) return { strikePrice: null, badge: null }
  let strikePrice = pricing.meta?.wasPrice ?? null
  const nearPct = pricing.meta?.nearExpiryPct ?? 0
  if (strikePrice == null && pricing.source === 'near-expiry') {
    const trail = pricing.trail ?? []
    const idx = trail.findIndex(t => t.step === 'near-expiry' || t.step === 'near_expiry')
    for (let i = idx - 1; i >= 0 && strikePrice == null; i--) {
      if (trail[i]?.price != null) strikePrice = trail[i].price
    }
  }
  if (strikePrice == null && (product?.mrp ?? 0) > pricing.price) strikePrice = product.mrp
  const badge = pricing.meta?.offerBadge
    ?? (nearPct > 0 ? `${nearPct}% near-expiry off` : null)
    ?? ((product?.mrp ?? 0) > pricing.price && product?.discountPct ? `${product.discountPct}% off` : null)
  return { strikePrice, badge }
}

/* ---------------------------------------------------------- primitives */

function Pill({ selected, disabled, onClick, children, wide }) {
  return (
    <button disabled={disabled} onClick={onClick}
      className={`pressable px-2.5 py-1.5 text-[11.5px] rounded-lg border transition-all disabled:opacity-40 disabled:line-through focus-ring ${wide ? 'min-w-[86px]' : ''}`}
      style={selected
        ? {
            background: 'var(--c-primary)', color: 'var(--c-primary-fg)', borderColor: 'var(--c-primary)',
            boxShadow: '0 8px 22px -8px color-mix(in srgb, var(--c-primary) 65%, transparent)',
          }
        : { color: 'var(--c-text)', borderColor: 'var(--c-border)', background: 'color-mix(in srgb, var(--c-surface) 70%, transparent)' }}>
      {children}
    </button>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-[10.5px] uppercase tracking-[0.14em] font-bold mb-1.5"
      style={{ color: 'var(--c-primary)' }}>{children}</p>
  )
}

/** "Size chart" link + modal table, rendered only when the engine has a chart. */
function SizeChart({ verticalId }) {
  const [open, setOpen] = useState(false)
  const chart = useMemo(() => {
    const key = getVertical(verticalId)?.sizeChart
    return key ? getSizeChart(key) : null
  }, [verticalId])
  if (!chart) return null
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-[11.5px] underline underline-offset-2"
        style={{ color: 'var(--c-primary)' }}>
        Size chart
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={chart.label ?? 'Size chart'} size="md">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr>
                {(chart.columns ?? []).map((c, i) => (
                  <th key={i} className="text-left font-semibold py-1.5 pr-3 border-b"
                    style={{ color: 'var(--c-text)', borderColor: 'var(--c-border)' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(chart.rows ?? []).map((r, i) => (
                <tr key={i}>
                  {(Array.isArray(r) ? r : Object.values(r ?? {})).map((cell, j) => (
                    <td key={j} className="py-1.5 pr-3 border-b" style={{ color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  )
}

/** Shared pack pills for grocery / dairy / confectionery. */
function PackPills({ product, value, onChange }) {
  const variants = product.variants ?? []
  if (variants.length <= 1) return null
  return (
    <div>
      <SectionLabel>Pack size</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {variants.map(v => {
          const on = value.variant?.sku === v.sku
          const out = v.stock === 0
          const pack = v.pack ?? v.packWeight ?? v.size ?? v.sku
          const pricing = resolveVerticalPrice(product, v, { qty: 1 })
          const uom = formatUom(product, v)
          return (
            <Pill key={v.sku} selected={on} disabled={out} wide
              onClick={() => onChange({ variant: v, extras: value.extras ?? {} })}>
              <span className="block font-semibold leading-tight">{pack}</span>
              <span className="block text-[10.5px] leading-tight opacity-80 tabular-nums">
                {inr(pricing.price)}{uom ? ` (${uom})` : ''}
              </span>
            </Pill>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------- apparel */

function ApparelPicker({ product, value, onChange }) {
  const vertical = verticalFor(product)
  const variants = product.variants ?? []
  if (variants.length <= 1 && !getVertical(vertical)?.sizeChart) return null
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <SectionLabel>Choose an option</SectionLabel>
        <SizeChart verticalId={vertical} />
      </div>
      {variants.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {variants.map(v => {
            const on = value.variant?.sku === v.sku
            const out = v.stock === 0
            return (
              <Pill key={v.sku} selected={on} disabled={out}
                onClick={() => onChange({ variant: v, extras: value.extras ?? {} })}>
                {[v.size, v.color].filter(Boolean).join(' · ') || v.sku}
              </Pill>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------- footwear */

function FootwearPicker({ product, value, onChange }) {
  const variants = product.variants ?? []
  const width = product.attributes?.widthNote ?? product.attributes?.width
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <SectionLabel>Size (UK)</SectionLabel>
        <SizeChart verticalId="footwear" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {variants.map(v => {
          const on = value.variant?.sku === v.sku
          const out = v.stock === 0
          return (
            <Pill key={v.sku} selected={on} disabled={out}
              onClick={() => onChange({ variant: v, extras: value.extras ?? {} })}>
              {v.size ?? v.sku}
            </Pill>
          )
        })}
      </div>
      <p className="text-[11px] mt-1.5" style={{ color: 'var(--c-text-muted)' }}>
        {width ? `Width: ${width}` : 'Fits true to size'}
        {value.variant?.color ? ` · ${value.variant.color}` : ''}
      </p>
    </div>
  )
}

/* ------------------------------------------- artificial jewellery */

function ArtificialJewelleryPicker({ product, value, onChange }) {
  const variants = product.variants ?? []
  const attrs = product.attributes ?? {}
  const platingBits = [
    attrs.plating ? `Plating: ${attrs.plating}` : null,
    attrs.material ? `Material: ${attrs.material}` : null,
  ].filter(Boolean)
  return (
    <div>
      {variants.length > 1 && (
        <>
          <SectionLabel>Design</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {variants.map(v => {
              const on = value.variant?.sku === v.sku
              const out = v.stock === 0
              return (
                <Pill key={v.sku} selected={on} disabled={out}
                  onClick={() => onChange({ variant: v, extras: value.extras ?? {} })}>
                  {[v.design, v.color, v.size].filter(Boolean).join(' · ') || v.sku}
                </Pill>
              )
            })}
          </div>
        </>
      )}
      {platingBits.length > 0 && (
        <p className="text-[11.5px] mt-1.5" style={{ color: 'var(--c-text-muted)' }}>
          ✦ {platingBits.join(' · ')}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------- fine jewellery */

function FineJewelleryPicker({ product, value, onChange }) {
  const shop = useShop()
  const engineVersion = useEngineVersion() // re-render when live gold rates land
  const variants = product.variants ?? []
  const attrs = product.attributes ?? {}
  const purities = attrs.purities ?? ['22K', '18K', '14K']
  const weights = useMemo(
    () => [...new Set(variants.map(v => v.weightG).filter(w => w != null))].sort((a, b) => a - b),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product.id]
  )

  const purity = value.extras?.purity ?? attrs.purity ?? purities[0]
  const weightG = value.extras?.weightG ?? value.variant?.weightG ?? weights[0]
  const matched = variants.find(v => v.weightG === weightG)
    ?? value.variant ?? variants[0] ?? null
  // The shopper's purity choice overrides the catalogue variant's default so
  // the gold-rate engine prices the configured piece everywhere (PDP, cart,
  // order gate). The sku is preserved, so inventory resolution is unaffected.
  const pricedVariant = pricingVariant(matched, { purity })

  const rateSnapshot = useMemo(
    () => snapshotRate(purity, shop?.settings?.gold) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [purity, product.id, engineVersion]
  )
  const pricing = useMemo(
    () => resolveVerticalPrice(product, pricedVariant, { qty: 1, purity, weightG }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product.id, pricedVariant?.sku, purity, weightG, engineVersion]
  )

  // Establish picker defaults once per product so `extras` is never half-empty.
  useEffect(() => {
    if (!value.extras?.purity || !value.extras?.weightG) {
      onChange({
        variant: pricedVariant,
        extras: { ...(value.extras ?? {}), purity, weightG, rateSnapshot },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id])

  const pick = (nextPurity, nextWeight) => {
    const v = variants.find(x => x.weightG === nextWeight) ?? matched
    onChange({
      variant: pricingVariant(v, { purity: nextPurity }),
      extras: {
        ...(value.extras ?? {}),
        purity: nextPurity,
        weightG: nextWeight,
        rateSnapshot: snapshotRate(nextPurity, shop?.settings?.gold) ?? null,
      },
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <SectionLabel>Purity</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {purities.map(pu => (
            <Pill key={pu} selected={purity === pu} onClick={() => pick(pu, weightG)}>{pu}</Pill>
          ))}
        </div>
      </div>
      {weights.length > 1 && (
        <div>
          <SectionLabel>Weight</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {weights.map(w => (
              <Pill key={w} selected={weightG === w} onClick={() => pick(purity, w)}>
                {w} g
              </Pill>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xl font-bold tabular-nums" style={{ color: 'var(--c-text)' }}>
          {inr(pricing.price)}
        </span>
        {pricing.unitLabel && (
          <span className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>{pricing.unitLabel}</span>
        )}
        {attrs.bisHallmark !== false && <Badge size="sm" tone="success">✓ BIS Hallmark</Badge>}
      </div>
      <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
        {(() => {
          const st = goldRateStatus()
          if (!st.stale) return `${purity} live rate · refreshed ${st.fetchedAt ? new Date(st.fetchedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'today'} · rate locked at checkout`
          return `Indicative ${purity} rate · rate locked at checkout`
        })()}
      </p>
    </div>
  )
}

/* ---------------------------------------------------------- grocery */

function GroceryPicker({ product, value, onChange }) {
  return <PackPills product={product} value={value} onChange={onChange} />
}

/* ------------------------------------------------------------ dairy */

function DairyPicker({ product, value, onChange }) {
  const shop = useShop()
  const sub = value.extras?.subscription
  const slots = useMemo(
    () => nextDeliverySlots(product, shop.pincode, Date.now(), 3),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [product.id, shop.pincode]
  )
  const freqs = frequencies()

  const toggle = (on) => {
    if (on) {
      onChange({
        variant: value.variant,
        extras: {
          ...(value.extras ?? {}),
          subscription: {
            frequency: freqs[0]?.id ?? 'daily',
            startDateISO: slots[0]?.dateISO ?? slots[0]?.date ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          },
        },
      })
    } else {
      const { subscription: _drop, ...rest } = value.extras ?? {}
      onChange({ variant: value.variant, extras: rest })
    }
  }

  return (
    <div className="space-y-3">
      <PackPills product={product} value={value} onChange={onChange} />
      <div className="p-2.5 rounded-xl glass">
        <Switch checked={Boolean(sub)} onChange={toggle} label="Subscribe & Save" />
        <p className="text-[11px] mt-1 ml-0" style={{ color: 'var(--c-text-muted)' }}>
          Never run out — pause or skip anytime from your account.
        </p>
        {sub && (
          <div className="mt-2 space-y-2">
            <Select label="Delivery frequency" value={sub.frequency}
              onChange={e => onChange({
                variant: value.variant,
                extras: { ...(value.extras ?? {}), subscription: { ...sub, frequency: e.target.value } },
              })}
              options={freqs} />
            <div>
              <SectionLabel>Upcoming deliveries</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {slots.map((s, i) => (
                  <Badge key={i} size="sm" tone={i === 0 ? 'primary' : 'neutral'}>{s.label}</Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ----------------------------------------------------- confectionery */

function ConfectioneryPicker({ product, value, onChange }) {
  const shop = useShop()
  const attrs = product.attributes ?? {}
  const slots = useMemo(
    () => deliverySlots(shop.pincode || '110001', Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shop.pincode]
  )
  const slotId = value.extras?.slot?.id ?? ''

  return (
    <div className="space-y-3">
      <PackPills product={product} value={value} onChange={onChange} />
      <Select label="Delivery date & time" value={slotId}
        onChange={e => {
          const s = slots.find(x => x.id === e.target.value) ?? null
          onChange({ variant: value.variant, extras: { ...(value.extras ?? {}), slot: s } })
        }}
        options={[{ value: '', label: 'Choose a slot…' }, ...slots.map(s => ({ value: s.id, label: s.label }))]}
        hint="Baked fresh — we deliver in a chilled box" />
      {attrs.customMessage !== false && (
        <Textarea label="Gift message (optional)" rows={2}
          value={value.extras?.message ?? ''}
          onChange={e => onChange({
            variant: value.variant,
            extras: { ...(value.extras ?? {}), message: e.target.value },
          })}
          placeholder="Write a note for the recipient…" />
      )}
    </div>
  )
}

/* ------------------------------------------------------------ dispatch */

export function VerticalPicker({ product, value, onChange }) {
  // Re-renders with the real engines once they arrive, so pill prices and
  // slot lists upgrade without any caller doing anything.
  useEngineVersion()
  if (!product) return null
  const v = value ?? { variant: (product.variants ?? [])[0] ?? null, extras: {} }
  const props = { product, value: v, onChange }

  switch (verticalFor(product)) {
    case 'footwear': return <FootwearPicker {...props} />
    case 'artificial-jewellery': return <ArtificialJewelleryPicker {...props} />
    case 'fine-jewellery': return <FineJewelleryPicker {...props} />
    case 'grocery': return <GroceryPicker {...props} />
    case 'dairy': return <DairyPicker {...props} />
    case 'confectionery': return <ConfectioneryPicker {...props} />
    case 'fashion':
    case 'innerwear':
    default: return <ApparelPicker {...props} />
  }
}

/** Attribute schema grouped by section, for the PDP Details tab.
 *  The catalogue engine supplies field defs [{ key, label, type, section }];
 *  values are read off the product (attributes[key] ?? product[key]). */
export function AttributeSections({ product }) {
  useEngineVersion()
  const schema = attributeSchemaFor(product) ?? []
  const groups = useMemo(() => {
    const out = []
    const bySection = new Map()
    for (const def of schema) {
      const value = attributeValue(product, def.key)
      if (value === undefined || value === null || value === '') continue
      const section = def.section ?? 'Details'
      if (!bySection.has(section)) {
        bySection.set(section, [])
        out.push([section, bySection.get(section)])
      }
      const unit = def.unit ? ` ${def.unit}` : ''
      bySection.get(section).push([def.label ?? def.key, prettyValue(def.key, value) + unit])
    }
    return out
  }, [schema, product])
  if (!groups.length) {
    return (
      <p className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
        No details available for this product.
      </p>
    )
  }
  return (
    <div className="space-y-3">
      {groups.map(([section, rows]) => (
        <div key={section}>
          {groups.length > 1 && (
            <p className="text-[11px] uppercase tracking-wider font-semibold mb-1"
              style={{ color: 'var(--c-text-muted)' }}>{section}</p>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px]">
            {rows.map(([k, val], j) => (
              <div key={j} className="flex justify-between py-0.5 border-b"
                style={{ borderColor: 'var(--c-border)' }}>
                <span style={{ color: 'var(--c-text-muted)' }}>{k}</span>
                <span className="text-right" style={{ color: 'var(--c-text)' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default VerticalPicker
