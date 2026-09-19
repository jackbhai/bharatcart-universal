import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSlice } from '../../hooks/useStore.js'
import store from '../../core/store/index.js'
import useToast from '../../hooks/useToast.js'
import { selectProduct } from '../../core/store/slices/catalogueSlice.js'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Textarea, Select, Label } from '../../ui/primitives/Input.jsx'
import { Badge, Tabs, Progress, Divider, Tooltip } from '../../ui/primitives/Display.jsx'
import AttributeField from './AttributeField.jsx'
import {
  VERTICALS, getVertical, verticalFor, variantAxesFor, attributeSchemaFor,
  usesVariantPricing, variantLabel,
} from './verticals.js'
import { marginAnalysis, estimateCost, priceForMargin, charmPrice } from '../../engines/pricing/priceEngine.js'
import { atp } from '../../engines/inventory/inventoryEngine.js'
import { productEarnPreview } from '../../engines/loyalty/loyaltyEngine.js'
import { taxLine } from '../../engines/tax/gst.js'
import { inr } from '../../lib/analytics.js'

// Default colour choices for 'color'-type variant axes that don't declare their own options.
const PALETTE = [
  { name: 'Haldi Yellow', hex: '#E8B430' }, { name: 'Sindoor Red', hex: '#C0392B' },
  { name: 'Indigo', hex: '#2C3E82' }, { name: 'Emerald', hex: '#1E8449' },
  { name: 'Ivory', hex: '#F3EAD9' }, { name: 'Rani Pink', hex: '#D6336C' },
  { name: 'Firozi', hex: '#1B9AAA' }, { name: 'Onyx', hex: '#22272E' },
]

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'variants', label: 'Variants' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'attributes', label: 'Attributes' },
  { id: 'seo', label: 'SEO' },
]

export default function ProductEditor({ productId, onClose }) {
  const cat = useSlice('catalogue')
  const loyalty = useSlice('loyalty')
  const { success, info } = useToast()
  const [tab, setTab] = useState('general')

  const product = useMemo(() => selectProduct({ catalogue: cat }, productId), [cat, productId])
  if (!product) return <p className="text-[13px]" style={{ color: 'var(--c-text-muted)' }}>Product not found.</p>

  const set = (patch) => store.dispatch('catalogue/updateProduct', { id: productId, patch })
  const margin = marginAnalysis(product)
  const earn = productEarnPreview(product, {}, loyalty.config)

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-start gap-3">
        <div className="w-14 h-18 rounded-lg shrink-0"
          style={{ background: `linear-gradient(135deg, var(--c-surface-alt), ${product.variants?.[0]?.hex || '#ddd'}55)`, aspectRatio: '3/4' }} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[14px] leading-tight" style={{ color: 'var(--c-text)' }}>{product.name}</p>
          <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
            {product.id} · {getVertical(verticalFor(product)).label} · {product.variants?.length ?? 0} variants · {product.stock ?? 0} in stock
          </p>
          <div className="flex gap-1.5 mt-1.5">
            {['active','draft','archived'].map(s => (
              <button key={s} onClick={() => { set({ status: s }); success(`Moved to ${s}`) }}
                className="px-2 py-0.5 text-[10.5px] font-semibold rounded border capitalize transition-all"
                style={product.status === s
                  ? { background: 'var(--c-primary)', color: 'var(--c-primary-fg)', borderColor: 'var(--c-primary)' }
                  : { color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} size="sm" />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}
          transition={{ duration: .16 }} className="space-y-3">

          {tab === 'general' && (
            <>
              <Select label="Business vertical" value={verticalFor(product)}
                hint={getVertical(verticalFor(product)).description}
                options={Object.values(VERTICALS).map(v => ({ value: v.id, label: v.label }))}
                onChange={(e) => {
                  const next = e.target.value
                  // Pre-fill empty defaults for the new vertical's schema —
                  // existing attribute values are never wiped.
                  const attrs = { ...(product.attributes || {}) }
                  for (const f of getVertical(next).attributeSchema || []) {
                    if (attrs[f.key] === undefined) {
                      attrs[f.key] = f.type === 'switch' ? false : f.type === 'multiselect' ? [] : ''
                    }
                  }
                  set({ vertical: next, attributes: attrs })
                  info(`Business vertical set to ${getVertical(next).label}`)
                }} />
              <Input label="Product name" value={product.name} onChange={e => set({ name: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Brand" value={product.brand || ''} onChange={e => set({ brand: e.target.value })} />
                <Select label="Category" value={product.category}
                  onChange={e => {
                    const c = cat.categories.find(x => x.name === e.target.value)
                    set({ category: e.target.value, hsn: c?.hsn ?? product.hsn, gst: c?.gst ?? product.gst })
                  }}
                  options={cat.categories.map(c => c.name)} />
              </div>
              <Input label="Sub-category" value={product.subCategory || ''} onChange={e => set({ subCategory: e.target.value })} />
              <Textarea label="Description" rows={4} value={product.description || ''}
                onChange={e => set({ description: e.target.value })}
                placeholder="Tell the story of this piece — the craft, the artisan, the origin…" />
              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {['new','bestseller','festive','wedding','daily','gifting','sustainable','limited'].map(t => {
                    const on = (product.tags || []).includes(t)
                    return (
                      <button key={t} onClick={() => set({ tags: on ? product.tags.filter(x => x !== t) : [...(product.tags||[]), t] })}
                        className="px-2 py-1 text-[11px] rounded-lg border capitalize transition-all"
                        style={on
                          ? { background: 'var(--c-primary)', color: 'var(--c-primary-fg)', borderColor: 'var(--c-primary)' }
                          : { color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}>
                        {t}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {tab === 'pricing' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Selling price" type="number" prefix="₹" value={product.price}
                  onChange={e => {
                    const price = Number(e.target.value)
                    set({ price, discountPct: product.mrp > 0 ? Math.round((1 - price / product.mrp) * 100) : 0 })
                  }} />
                <Input label="MRP" type="number" prefix="₹" value={product.mrp}
                  onChange={e => {
                    const mrp = Number(e.target.value)
                    set({ mrp, discountPct: mrp > 0 ? Math.round((1 - product.price / mrp) * 100) : 0 })
                  }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Cost price" type="number" prefix="₹" value={product.cost ?? estimateCost(product)}
                  hint="Used for margin analysis" onChange={e => set({ cost: Number(e.target.value) })} />
                <Input label="GST %" type="number" suffix="%" value={product.gst}
                  onChange={e => set({ gst: Number(e.target.value) })} />
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {['99','95','round'].map(style => (
                  <Button key={style} size="xs" variant="outline"
                    onClick={() => { set({ price: charmPrice(product.price, style) }); info(`Rounded to …${style}`) }}>
                    End in {style}
                  </Button>
                ))}
                {[25, 35, 45].map(t => (
                  <Button key={t} size="xs" variant="soft"
                    onClick={() => { set({ price: priceForMargin(product, t) }); info(`Priced for ${t}% net margin`) }}>
                    Target {t}%
                  </Button>
                ))}
              </div>

              {/* margin waterfall */}
              <div className="t-card p-3" style={{ background: 'var(--c-surface-alt)' }}>
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-[12px] font-semibold" style={{ color: 'var(--c-text)' }}>Margin breakdown</p>
                  <Badge tone={margin.healthy ? 'success' : margin.netMarginPct > 0 ? 'warning' : 'danger'}>
                    {margin.netMarginPct}% net
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  {margin.breakdown.map(b => (
                    <div key={b.label} className="flex items-center gap-2">
                      <span className="text-[11px] w-28 shrink-0" style={{ color: 'var(--c-text-muted)' }}>{b.label}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--c-border)' }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${(b.value / product.price) * 100}%` }}
                          className="h-full rounded-full" style={{ background: 'var(--c-warning)' }} />
                      </div>
                      <span className="text-[11px] tabular-nums w-14 text-right" style={{ color: 'var(--c-text)' }}>
                        {inr(b.value)}
                      </span>
                    </div>
                  ))}
                  <Divider />
                  <div className="flex justify-between text-[12px] font-semibold" style={{ color: 'var(--c-text)' }}>
                    <span>Net margin</span>
                    <span className="tabular-nums" style={{ color: margin.healthy ? 'var(--c-success)' : 'var(--c-danger)' }}>
                      {inr(margin.netMargin)}
                    </span>
                  </div>
                  <p className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>
                    Break-even at {inr(margin.breakEvenPrice)}
                  </p>
                </div>
              </div>

              {/* tax + loyalty preview */}
              <div className="grid grid-cols-2 gap-2">
                <MiniCard label="GST component" value={inr(taxLine({ amount: product.price, rate: product.gst }).tax)}
                  hint={`${product.gst}% inclusive`} />
                <MiniCard label="Points earned" value={earn.points} hint={`worth ${inr(earn.value)}`} />
              </div>
            </>
          )}

          {tab === 'variants' && <VariantsPanel key={verticalFor(product)} product={product} productId={productId} />}
          {tab === 'inventory' && <InventoryPanel product={product} productId={productId} />}

          {tab === 'attributes' && <AttributesPanel product={product} productId={productId} />}

          {tab === 'seo' && (
            <>
              <Input label="URL slug" value={product.slug || slugify(product.name)}
                onChange={e => set({ slug: e.target.value })} prefix="/p/" />
              <Input label="SEO title" value={product.seoTitle || ''} onChange={e => set({ seoTitle: e.target.value })}
                hint={`${(product.seoTitle || '').length}/60 characters`} />
              <Textarea label="Meta description" rows={3} value={product.seoDescription || ''}
                onChange={e => set({ seoDescription: e.target.value })}
                hint={`${(product.seoDescription || '').length}/160 characters`} />
              <div className="t-card p-3" style={{ background: 'var(--c-surface-alt)' }}>
                <p className="text-[10px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: 'var(--c-text-muted)' }}>
                  Search preview
                </p>
                <p className="text-[13px] leading-tight" style={{ color: '#1a0dab' }}>
                  {product.seoTitle || product.name}
                </p>
                <p className="text-[11px]" style={{ color: '#006621' }}>
                  bharatcart.in/p/{product.slug || slugify(product.name)}
                </p>
                <p className="text-[11.5px] mt-0.5 line-clamp-2" style={{ color: 'var(--c-text-muted)' }}>
                  {product.seoDescription || product.description || 'No description yet.'}
                </p>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-2 pt-3 border-t sticky bottom-0" style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}>
        <Button variant="outline" size="sm" full onClick={onClose}>Close</Button>
        <Button size="sm" full onClick={() => { success('Changes saved'); onClose?.() }}>Save & close</Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ panels */

/* ------------------------------------------------ axis-driven variants */

const normOptions = (options) => (options || []).map(o => {
  if (o && typeof o === 'object') {
    return { value: o.value ?? o.name ?? o.id ?? '', label: o.label ?? o.name ?? String(o.value ?? '') }
  }
  return { value: o, label: String(o) }
})

/** Colour choices for a 'color' axis: its own options, else the shared palette. */
const colorChoices = (ax) => {
  if (ax.options?.length) {
    return normOptions(ax.options).map(o => {
      const s = String(o.value)
      return s.startsWith('#') ? { name: s, hex: s } : { name: o.label, hex: '#888888' }
    })
  }
  return PALETTE
}

/** Concrete values for one axis given the current selection state. */
const selectedAxisValues = (ax, s) => {
  if (ax.type === 'number') {
    const min = Number(s?.min), max = Number(s?.max)
    let step = Number(s?.step)
    if (!Number.isFinite(min) || !Number.isFinite(max)) return []
    if (!Number.isFinite(step) || step <= 0) step = 1
    const out = []
    for (let v = min; v <= max + 1e-9; v += step) out.push(Math.round(v * 10000) / 10000)
    return out
  }
  return s || []
}

const cartesian = (lists) => lists.reduce((acc, l) => acc.flatMap(a => l.map(v => [...a, v])), [[]])

const makeSku = (productId, combo) =>
  `${productId}-${combo.map(v => String(v).toUpperCase().replace(/[^A-Z0-9]+/g, '')).join('-')}`
    .replace(/-+/g, '-').slice(0, 48)

/** Initial axis selection: distinct values already on the product's variants, else axis defaults. */
const initialAxisSelection = (product, axes) => {
  const sel = {}
  for (const ax of axes) {
    if (ax.type === 'number') {
      const nums = (product.variants || [])
        .map(v => v[ax.key])
        .filter(x => x !== '' && x !== undefined && x !== null)
        .map(Number).filter(Number.isFinite)
      sel[ax.key] = nums.length
        ? { min: Math.min(...nums), max: Math.max(...nums), step: ax.step ?? 1 }
        : { min: ax.min ?? 1, max: ax.max ?? 3, step: ax.step ?? 1 }
    } else {
      const existing = [...new Set(
        (product.variants || []).map(v => v[ax.key]).filter(v => v !== undefined && v !== ''),
      )]
      if (existing.length) sel[ax.key] = existing
      else if (ax.type === 'color') sel[ax.key] = colorChoices(ax).slice(0, 2).map(c => c.name)
      else sel[ax.key] = normOptions(ax.options).slice(0, 2).map(o => o.value)
    }
  }
  return sel
}

const MiniFieldLabel = ({ children }) => (
  <p className="text-[9.5px] uppercase tracking-wider font-semibold mb-0.5" style={{ color: 'var(--c-text-muted)' }}>
    {children}
  </p>
)

function VariantsPanel({ product, productId }) {
  const { success } = useToast()
  const d = store.dispatch
  const verticalId = verticalFor(product)
  const axes = variantAxesFor(product) || []
  const perishable = Boolean(getVertical(verticalId).perishable)
  const showPrice = useMemo(
    () => (product.variants || []).some(v => v.price !== undefined && v.price !== null && v.price !== '')
      || usesVariantPricing(verticalId),
    [product.variants, verticalId],
  )

  const [sel, setSel] = useState(() => initialAxisSelection(product, axes))
  const [bulkStock, setBulkStock] = useState('')

  const axisOpts = useMemo(
    () => Object.fromEntries(axes.map(ax => [ax.key, normOptions(ax.options)])),
    [axes],
  )
  const valuesPerAxis = axes.map(ax => selectedAxisValues(ax, sel[ax.key]))
  const combos = useMemo(() => cartesian(valuesPerAxis), [valuesPerAxis])
  const blocked = valuesPerAxis.some(c => c.length === 0)

  const toggleSel = (key, val) => setSel(s => {
    const cur = s[key] || []
    return { ...s, [key]: cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val] }
  })
  const setNum = (key, k, raw) => setSel(s => ({
    ...s, [key]: { ...(s[key] || {}), [k]: raw === '' ? '' : Number(raw) },
  }))

  const generate = () => {
    // Match existing rows by axis values so stock/price/expiry survive regeneration.
    const byKey = new Map((product.variants || [])
      .map(v => [axes.map(ax => String(v[ax.key] ?? '')).join('|'), v]))
    const variants = combos.map(combo => {
      const key = combo.map(v => String(v)).join('|')
      const prev = byKey.get(key)
      if (prev) return prev
      const v = { sku: makeSku(productId, combo), stock: 0, reserved: 0 }
      combo.forEach((val, i) => {
        const ax = axes[i]
        v[ax.key] = val
        if (ax.type === 'color') v.hex = (colorChoices(ax).find(c => c.name === val) || {}).hex || '#888888'
      })
      return v
    })
    d('catalogue/updateProduct', {
      id: productId,
      patch: { variants, stock: variants.reduce((s, v) => s + (Number(v.stock) || 0), 0) },
    })
    success(`${variants.length} variants generated`)
  }

  const applyBulkStock = () => {
    const n = Number(bulkStock)
    if (!Number.isFinite(n)) return
    const variants = (product.variants || []).map(v => ({ ...v, stock: n }))
    d('catalogue/updateProduct', {
      id: productId,
      patch: { variants, stock: variants.reduce((s, v) => s + (Number(v.stock) || 0), 0) },
    })
    setBulkStock('')
    success(`Stock set to ${n} on ${variants.length} variants`)
  }

  const addBlank = () => {
    const variants = [
      ...(product.variants || []),
      { sku: `${productId}-V${(product.variants || []).length + 1}`, stock: 0, reserved: 0 },
    ]
    d('catalogue/updateProduct', {
      id: productId,
      patch: { variants, stock: variants.reduce((s, v) => s + (Number(v.stock) || 0), 0) },
    })
  }

  return (
    <div className="space-y-3">
      {axes.length > 0 ? (
        <div className="t-card p-3" style={{ background: 'var(--c-surface-alt)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-semibold" style={{ color: 'var(--c-text)' }}>Matrix generator</p>
            <Badge tone="info" size="sm">{getVertical(verticalId).label}</Badge>
          </div>
          {axes.map((ax, ai) => (
            <div key={ax.key} className="mb-2.5">
              <Label>{ax.label}{ax.required ? ' *' : ''}{ax.unit ? ` (${ax.unit})` : ''}</Label>
              {ax.type === 'select' && (
                <div className="flex flex-wrap gap-1.5">
                  {(axisOpts[ax.key] || []).map(o => {
                    const on = (sel[ax.key] || []).includes(o.value)
                    return (
                      <button key={String(o.value)} onClick={() => toggleSel(ax.key, o.value)}
                        className="px-2.5 py-1 text-[11px] rounded-lg border font-medium transition-all"
                        style={on
                          ? { background: 'var(--c-primary)', color: 'var(--c-primary-fg)', borderColor: 'var(--c-primary)' }
                          : { color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}>
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              )}
              {ax.type === 'color' && (
                <div className="flex flex-wrap gap-1.5">
                  {colorChoices(ax).map(c => {
                    const on = (sel[ax.key] || []).includes(c.name)
                    return (
                      <button key={c.name} onClick={() => toggleSel(ax.key, c.name)}
                        className="flex items-center gap-1.5 px-2 py-1 text-[11px] rounded-lg border transition-all"
                        style={{
                          borderColor: on ? 'var(--c-primary)' : 'var(--c-border)', borderWidth: on ? 2 : 1,
                          color: 'var(--c-text)',
                        }}>
                        <span className="w-3 h-3 rounded-full" style={{ background: c.hex }} />
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              )}
              {ax.type === 'number' && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {['min', 'max', 'step'].map(k => (
                      <Input key={k} label={k[0].toUpperCase() + k.slice(1)} type="number" size="sm"
                        value={sel[ax.key]?.[k] ?? ''} onChange={e => setNum(ax.key, k, e.target.value)} />
                    ))}
                  </div>
                  <p className="text-[10.5px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
                    {valuesPerAxis[ai].length} value{valuesPerAxis[ai].length === 1 ? '' : 's'}
                    {valuesPerAxis[ai].length <= 12 && valuesPerAxis[ai].length > 0
                      ? `: ${valuesPerAxis[ai].join(', ')}` : ''}
                  </p>
                </>
              )}
              {ax.hint && (
                <p className="text-[10.5px] mt-1" style={{ color: 'var(--c-text-muted)' }}>{ax.hint}</p>
              )}
            </div>
          ))}
          <Button size="sm" full disabled={blocked || combos.length > 500} onClick={generate}>
            Generate {combos.length} variants
          </Button>
          {combos.length > 500 && (
            <p className="text-[10.5px] mt-1" style={{ color: 'var(--c-danger)' }}>
              Too many combinations — narrow the axes to 500 or fewer.
            </p>
          )}
        </div>
      ) : (
        <div className="t-card p-3 space-y-2" style={{ background: 'var(--c-surface-alt)' }}>
          <p className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>
            The {getVertical(verticalId).label} vertical has no variant axes — variants are managed as a flat list.
          </p>
          <Button size="sm" variant="outline" full onClick={addBlank}>+ Add variant</Button>
        </div>
      )}

      {(product.variants || []).length > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg border" style={{ borderColor: 'var(--c-border)' }}>
          <span className="text-[11px] flex-1" style={{ color: 'var(--c-text-muted)' }}>
            {product.variants.length} variant{product.variants.length === 1 ? '' : 's'}
          </span>
          <input type="number" value={bulkStock} onChange={e => setBulkStock(e.target.value)}
            placeholder="Set all stock" className="t-input w-28 px-2 py-1 text-[11px]" />
          <Button size="xs" variant="outline" disabled={bulkStock === ''} onClick={applyBulkStock}>Apply</Button>
        </div>
      )}

      <div className="space-y-1.5">
        {(product.variants || []).map(v => (
          <VariantRow key={v.sku} v={v} productId={productId}
            axes={axes} showPrice={showPrice} perishable={perishable} />
        ))}
        {!product.variants?.length && (
          <p className="text-[12px] text-center py-4" style={{ color: 'var(--c-text-muted)' }}>
            No variants yet — generate a matrix above.
          </p>
        )}
      </div>
    </div>
  )
}

function VariantRow({ v, productId, axes, showPrice, perishable }) {
  const d = store.dispatch
  const patch = (p) => d('catalogue/updateVariant', { productId, sku: v.sku, patch: p })
  const label = variantLabel(v, axes) || v.sku

  return (
    <motion.div layout className="p-2 rounded-lg border" style={{ borderColor: 'var(--c-border)' }}>
      <div className="flex items-center gap-2">
        <span className="w-4 h-4 rounded-full shrink-0 border"
          style={{ background: v.hex || '#ddd', borderColor: 'var(--c-border)' }} />
        <p className="text-[12px] font-medium flex-1 truncate" style={{ color: 'var(--c-text)' }}>{label}</p>
        <button onClick={() => d('catalogue/removeVariant', { productId, sku: v.sku })}
          className="text-[15px] px-1 leading-none" style={{ color: 'var(--c-danger)' }}
          title="Remove variant">×</button>
      </div>
      <div className="flex flex-wrap items-end gap-2 mt-1.5">
        <div className="flex-1 min-w-[130px]">
          <MiniFieldLabel>SKU</MiniFieldLabel>
          <input value={v.sku} onChange={e => patch({ sku: e.target.value })}
            className="t-input w-full px-2 py-1 text-[11px] font-mono" />
        </div>
        {showPrice && (
          <div className="w-[86px]">
            <MiniFieldLabel>Price ₹</MiniFieldLabel>
            <input type="number" value={v.price ?? ''} onChange={e => patch({ price: e.target.value === '' ? undefined : Number(e.target.value) })}
              className="t-input w-full px-2 py-1 text-[11px] text-right tabular-nums" />
          </div>
        )}
        {perishable && (
          <div>
            <MiniFieldLabel>Expiry</MiniFieldLabel>
            <input type="date" value={v.expiryDate || ''} onChange={e => patch({ expiryDate: e.target.value })}
              className="t-input px-2 py-1 text-[11px]" />
          </div>
        )}
        <div className="w-[70px]">
          <MiniFieldLabel>Stock</MiniFieldLabel>
          <input type="number" value={v.stock ?? 0} onChange={e => patch({ stock: Number(e.target.value) })}
            className="t-input w-full px-2 py-1 text-[11px] text-right tabular-nums" />
        </div>
        <div className="w-[70px]">
          <MiniFieldLabel>Reserved</MiniFieldLabel>
          <input type="number" value={v.reserved ?? 0} onChange={e => patch({ reserved: Number(e.target.value) })}
            className="t-input w-full px-2 py-1 text-[11px] text-right tabular-nums" />
        </div>
      </div>
    </motion.div>
  )
}

/* ------------------------------------------- schema-driven attributes */

function AttributesPanel({ product, productId }) {
  const d = store.dispatch
  const verticalId = verticalFor(product)
  const schema = attributeSchemaFor(product) || []
  const attrs = product.attributes || {}

  // One-time backfill: legacy top-level fields (fabric, care, …) move under
  // product.attributes so pre-vertical products keep their data visible.
  useEffect(() => {
    if (product.attributes) return
    const legacy = {}
    for (const f of schema) {
      const v = product[f.key]
      if (v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) legacy[f.key] = v
    }
    if (Object.keys(legacy).length) {
      d('catalogue/updateProduct', { id: productId, patch: { attributes: legacy } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  const setAttr = (key, value) => d('catalogue/updateProduct', {
    id: productId,
    patch: { attributes: { ...(product.attributes || {}), [key]: value } },
  })

  const groups = useMemo(() => {
    const out = []
    const bySection = new Map()
    for (const f of schema) {
      const s = f.section || 'General'
      if (!bySection.has(s)) { bySection.set(s, []); out.push([s, bySection.get(s)]) }
      bySection.get(s).push(f)
    }
    return out
  }, [schema])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold" style={{ color: 'var(--c-text)' }}>Attributes</p>
        <Badge tone="info" size="sm">{getVertical(verticalId).label}</Badge>
      </div>
      {!schema.length && (
        <p className="text-[12px] text-center py-4" style={{ color: 'var(--c-text-muted)' }}>
          No attributes defined for this vertical.
        </p>
      )}
      {groups.map(([section, fields]) => (
        <div key={section}>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--c-text-muted)' }}>
            {section}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {fields.map(f => (
              <div key={f.key} className={f.type === 'textarea' || f.type === 'multiselect' ? 'col-span-2' : ''}>
                <AttributeField field={f} value={attrs[f.key]} onChange={v => setAttr(f.key, v)} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function InventoryPanel({ product, productId }) {  const cat = useSlice('catalogue')
  const { success } = useToast()
  const [sku, setSku] = useState(product.variants?.[0]?.sku || '')
  const [delta, setDelta] = useState(10)
  const [reason, setReason] = useState('restock')
  const d = store.dispatch

  const ledger = cat.adjustments.filter(a => a.productId === productId).slice(0, 8)
  const totalATP = (product.variants || []).reduce((s, v) => s + atp(v, cat.inventoryConfig).available, 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <MiniCard label="On hand" value={product.stock ?? 0} />
        <MiniCard label="Reserved" value={(product.variants || []).reduce((s, v) => s + (v.reserved || 0), 0)} />
        <MiniCard label="Available" value={totalATP} tone="success" />
      </div>

      <div className="t-card p-3" style={{ background: 'var(--c-surface-alt)' }}>
        <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--c-text)' }}>Stock adjustment</p>
        <div className="space-y-2">
          <Select value={sku} onChange={e => setSku(e.target.value)} size="sm"
            options={(product.variants || []).map(v => ({ value: v.sku, label: `${variantLabel(v, variantAxesFor(product)) || v.sku} (${v.stock})` }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" value={delta} onChange={e => setDelta(Number(e.target.value))} size="sm"
              prefix={delta >= 0 ? '+' : ''} />
            <Select value={reason} onChange={e => setReason(e.target.value)} size="sm"
              options={[
                { value: 'restock', label: 'Restock' },
                { value: 'damage', label: 'Damaged' },
                { value: 'theft', label: 'Shrinkage' },
                { value: 'correction', label: 'Count correction' },
                { value: 'return', label: 'Customer return' },
                { value: 'transfer', label: 'Warehouse transfer' },
              ]} />
          </div>
          <Button size="sm" full disabled={!sku}
            onClick={() => { d('catalogue/adjustStock', { productId, sku, delta, reason }); success('Stock adjusted') }}>
            Apply adjustment
          </Button>
        </div>
      </div>

      {ledger.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--c-text-muted)' }}>
            Recent movements
          </p>
          <div className="space-y-1">
            {ledger.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-[11.5px] py-1.5 px-2 rounded"
                style={{ background: 'var(--c-surface-alt)' }}>
                <span className="font-semibold tabular-nums w-10"
                  style={{ color: a.delta >= 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
                  {a.delta >= 0 ? '+' : ''}{a.delta}
                </span>
                <span className="capitalize flex-1" style={{ color: 'var(--c-text)' }}>{a.reason}</span>
                <span className="tabular-nums" style={{ color: 'var(--c-text-muted)' }}>→ {a.balance}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MiniCard({ label, value, hint, tone }) {
  return (
    <div className="t-card p-2.5" style={{ background: 'var(--c-surface-alt)' }}>
      <p className="text-[9.5px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>{label}</p>
      <p className="text-[15px] font-bold tabular-nums" style={{ color: tone === 'success' ? 'var(--c-success)' : 'var(--c-text)' }}>
        {value}
      </p>
      {hint && <p className="text-[10px]" style={{ color: 'var(--c-text-muted)' }}>{hint}</p>}
    </div>
  )
}

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
