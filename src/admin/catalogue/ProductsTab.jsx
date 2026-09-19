import React, { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSlice } from '../../hooks/useStore.js'
import store from '../../core/store/index.js'
import useToast from '../../hooks/useToast.js'
import { selectProducts } from '../../core/store/slices/catalogueSlice.js'
import DataTable from '../../ui/patterns/DataTable.jsx'
import EmptyState from '../../ui/EmptyState.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select, Switch, Checkbox } from '../../ui/primitives/Input.jsx'
import { Badge, Card, Modal, Drawer, Pill, Progress, Empty, Tooltip } from '../../ui/primitives/Display.jsx'
import { applyFilters, sortProducts, search as runSearch } from '../../engines/search/searchEngine.js'
import { stockStatus, atp, STOCK_STATUS } from '../../engines/inventory/inventoryEngine.js'
import { marginAnalysis, previewBulkPrice, estimateCost } from '../../engines/pricing/priceEngine.js'
import { inr } from '../../lib/analytics.js'
import ProductEditor from './ProductEditor.jsx'
import BulkPriceModal from './BulkPriceModal.jsx'
import { VERTICALS, getVertical, verticalFor, variantAxesFor, variantLabel } from './verticals.js'

const STATUS_TONE = { active: 'success', draft: 'warning', archived: 'neutral' }
const STOCK_TONE = {
  [STOCK_STATUS.IN_STOCK]: 'success',
  [STOCK_STATUS.LOW]: 'warning',
  [STOCK_STATUS.CRITICAL]: 'danger',
  [STOCK_STATUS.OUT]: 'danger',
  [STOCK_STATUS.BACKORDER]: 'info',
  [STOCK_STATUS.DISCONTINUED]: 'neutral',
}
const STOCK_LABEL = {
  [STOCK_STATUS.IN_STOCK]: 'In stock', [STOCK_STATUS.LOW]: 'Low',
  [STOCK_STATUS.CRITICAL]: 'Critical', [STOCK_STATUS.OUT]: 'Out',
  [STOCK_STATUS.BACKORDER]: 'Backorder', [STOCK_STATUS.DISCONTINUED]: 'Archived',
}

export default function ProductsTab() {
  const cat = useSlice('catalogue')
  const { success, info, error } = useToast()
  const loc = useLocation()
  const nav = useNavigate()

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({})
  const [verticalFilter, setVerticalFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [selected, setSelected] = useState([])
  const [editing, setEditing] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [bulkPrice, setBulkPrice] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const all = useMemo(() => selectProducts({ catalogue: cat }), [cat])

  const filtered = useMemo(() => {
    let list = all
    if (query.trim()) list = runSearch(list, query, { limit: 500 }).results
    list = applyFilters(list, filters)
    if (verticalFilter !== 'all') list = list.filter(p => verticalFor(p) === verticalFilter)
    if (sort !== 'relevance' || !query) list = sortProducts(list, sort)
    return list
  }, [all, query, filters, sort, verticalFilter])

  const stats = useMemo(() => {
    const active = all.filter(p => p.status === 'active').length
    const out = all.filter(p => stockStatus(p, cat.inventoryConfig) === STOCK_STATUS.OUT).length
    const low = all.filter(p => [STOCK_STATUS.LOW, STOCK_STATUS.CRITICAL].includes(stockStatus(p, cat.inventoryConfig))).length
    const value = all.reduce((s, p) => s + (p.stock ?? 0) * (p.cost ?? estimateCost(p)), 0)
    return { total: all.length, active, out, low, value }
  }, [all, cat.inventoryConfig])

  const d = store.dispatch

  const createProduct = () => {
    d('catalogue/createProduct', {})
    const created = store.get('catalogue').products[0]
    if (created) {
      setEditing(created.id)
      info('Draft product created')
    }
  }

  // Deep link from the setup wizard / dashboard zero state: open the product
  // editor immediately when arriving with { state: { newProduct: true } }.
  const autoOpened = useRef(false)
  useEffect(() => {
    if (loc.state?.newProduct && !autoOpened.current) {
      autoOpened.current = true
      createProduct()
      nav('/admin/catalogue', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.state])

  const bulk = (patch, label) => {
    d('catalogue/bulkUpdate', { ids: selected, patch })
    success(`${selected.length} products ${label}`)
    setSelected([])
  }

  const columns = [
    {
      key: 'name', label: 'Product', width: '30%', nowrap: false,
      render: (p) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-11 rounded shrink-0 overflow-hidden"
            style={{ background: `linear-gradient(135deg, var(--c-surface-alt), ${p.variants?.[0]?.hex || '#ddd'}44)` }} />
          <div className="min-w-0">
            <p className="font-medium leading-tight truncate" style={{ color: 'var(--c-text)' }}>{p.name}</p>
            <p className="text-[11px] truncate" style={{ color: 'var(--c-text-muted)' }}>
              {p.brand} · {p.subCategory}
            </p>
            <div className="flex gap-1 mt-0.5">
              {(p.gi || p.attributes?.gi) && <Badge tone="info" size="sm">GI</Badge>}
              {(p.handmade || p.attributes?.handmade) && <Badge tone="neutral" size="sm">Handmade</Badge>}
            </div>
          </div>
        </div>
      ),
    },
    { key: 'category', label: 'Category', render: (p) => <span style={{ color: 'var(--c-text-muted)' }}>{p.category}</span> },
    {
      key: 'vertical', label: 'Vertical',
      render: (p) => <Badge tone="neutral" size="sm">{getVertical(verticalFor(p)).label}</Badge>,
    },
    {
      key: 'price', label: 'Price', align: 'right',
      render: (p) => (
        <div>
          <p className="font-semibold tabular-nums">{inr(p.price)}</p>
          {p.mrp > p.price && (
            <p className="text-[10.5px] tabular-nums" style={{ color: 'var(--c-text-muted)' }}>
              <span className="line-through">{inr(p.mrp)}</span>
              <span style={{ color: 'var(--c-success)' }}> −{p.discountPct}%</span>
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'margin', label: 'Margin', align: 'right',
      sortValue: (p) => { const c = p.cost ?? estimateCost(p); return p.price > 0 ? ((p.price - c) / p.price) * 100 : 0 },
      render: (p) => {
        const m = marginAnalysis(p)
        return (
          <Tooltip content={`Net ₹${m.netMargin} after fees`}>
            <span className="tabular-nums font-medium"
              style={{ color: m.netMarginPct >= 20 ? 'var(--c-success)' : m.netMarginPct >= 8 ? 'var(--c-warning)' : 'var(--c-danger)' }}>
              {m.netMarginPct}%
            </span>
          </Tooltip>
        )
      },
    },
    {
      key: 'stock', label: 'Stock', align: 'right',
      render: (p) => {
        const st = stockStatus(p, cat.inventoryConfig)
        return (
          <div className="flex items-center justify-end gap-2">
            <span className="tabular-nums">{p.stock ?? 0}</span>
            <Badge tone={STOCK_TONE[st]} size="sm">{STOCK_LABEL[st]}</Badge>
          </div>
        )
      },
    },
    { key: 'variants', label: 'SKUs', align: 'center', sortValue: (p) => p.variants?.length ?? 0,
      render: (p) => <span className="tabular-nums" style={{ color: 'var(--c-text-muted)' }}>{p.variants?.length ?? 0}</span> },
    {
      key: 'rating', label: 'Rating', align: 'right',
      render: (p) => p.rating ? (
        <span className="tabular-nums">★ {p.rating} <span className="text-[10px]" style={{ color: 'var(--c-text-muted)' }}>({p.reviews})</span></span>
      ) : <span style={{ color: 'var(--c-text-muted)' }}>—</span>,
    },
    { key: 'status', label: 'Status', render: (p) => <Badge tone={STATUS_TONE[p.status]} size="sm" dot>{p.status}</Badge> },
    {
      key: 'actions', label: '', sortable: false, align: 'right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <IconBtn title="Duplicate" onClick={() => { d('catalogue/duplicateProduct', p.id); success('Product duplicated') }}>⧉</IconBtn>
          <IconBtn title="Edit" onClick={() => setEditing(p.id)}>✎</IconBtn>
          <IconBtn title="Delete" danger onClick={() => setConfirmDelete(p)}>×</IconBtn>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-3">
      {/* -------------------------------------------------------- stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        <StatCard label="Products" value={stats.total} />
        <StatCard label="Active" value={stats.active} tone="success" />
        <StatCard label="Low stock" value={stats.low} tone="warning" onClick={() => setFilters(f => ({ ...f, stockBand: 'low' }))} />
        <StatCard label="Out of stock" value={stats.out} tone="danger" />
        <StatCard label="Stock value" value={inr(stats.value)} raw />
      </div>

      {/* ------------------------------------------------------ toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search products, brands, crafts…" prefix="⌕" size="sm" />
        </div>
        <Select value={verticalFilter} onChange={e => setVerticalFilter(e.target.value)} className="!w-auto"
          options={[
            { value: 'all', label: 'All verticals' },
            ...Object.values(VERTICALS).map(v => ({ value: v.id, label: v.label })),
          ]} />
        <Select value={sort} onChange={e => setSort(e.target.value)} className="!w-auto"
          options={[
            { value: 'newest', label: 'Newest' },
            { value: 'name_asc', label: 'Name A–Z' },
            { value: 'price_desc', label: 'Price high→low' },
            { value: 'price_asc', label: 'Price low→high' },
            { value: 'stock_asc', label: 'Stock low→high' },
            { value: 'rating', label: 'Rating' },
            { value: 'popularity', label: 'Most viewed' },
            { value: 'discount', label: 'Biggest discount' },
          ]} />
        <Button size="sm" variant={Object.keys(filters).length ? 'primary' : 'outline'}
          onClick={() => setShowFilters(true)}>
          Filters{Object.keys(filters).length > 0 && ` (${Object.keys(filters).length})`}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setBulkPrice(true)}>Bulk price</Button>
        <Button size="sm" onClick={createProduct}>+ New product</Button>
      </div>

      {/* active filter chips */}
      {Object.keys(filters).length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {Object.entries(filters).map(([k, v]) => (
            <Badge key={k} tone="primary">
              {k}: {Array.isArray(v) ? v.join(', ') : String(v)}
              <button onClick={() => setFilters(f => { const n = { ...f }; delete n[k]; return n })}
                className="ml-1 opacity-60 hover:opacity-100">×</button>
            </Badge>
          ))}
          <button onClick={() => setFilters({})} className="text-[11px] hover:underline"
            style={{ color: 'var(--c-text-muted)' }}>Clear all</button>
        </div>
      )}

      {/* -------------------------------------------------------- table */}
      {all.length === 0 ? (
        <EmptyState
          icon="▦"
          title="No products yet"
          message="Your catalogue is empty. Add your first product with photos, variants and pricing — it goes live on the storefront the moment you publish it."
          actionLabel="Add your first product"
          onAction={createProduct}
        />
      ) : (
      <DataTable
        rows={filtered}
        columns={columns}
        selectable
        selected={selected}
        onSelect={setSelected}
        onRowClick={(p) => setEditing(p.id)}
        initialSort={null}
        bulkActions={
          <div className="flex flex-wrap gap-1.5">
            <Button size="xs" variant="outline" onClick={() => bulk({ status: 'active' }, 'published')}>Publish</Button>
            <Button size="xs" variant="outline" onClick={() => bulk({ status: 'draft' }, 'moved to draft')}>Draft</Button>
            <Button size="xs" variant="outline" onClick={() => bulk({ status: 'archived' }, 'archived')}>Archive</Button>
            <Button size="xs" variant="outline" onClick={() => { setBulkPrice(true) }}>Change price</Button>
            <Button size="xs" variant="danger" onClick={() => {
              d('catalogue/bulkDelete', selected)
              success(`${selected.length} products deleted`)
              setSelected([])
            }}>Delete</Button>
          </div>
        }
        expandable={(p) => <VariantStrip product={p} />}
      />
      )}

      {/* ------------------------------------------------------ drawers */}
      <Drawer open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit product" width={620}>
        {editing && <ProductEditor productId={editing} onClose={() => setEditing(null)} />}
      </Drawer>

      <FilterDrawer open={showFilters} onClose={() => setShowFilters(false)}
        products={all} filters={filters} setFilters={setFilters} />

      <BulkPriceModal open={bulkPrice} onClose={() => setBulkPrice(false)}
        products={selected.length ? all.filter(p => selected.includes(p.id)) : filtered} />

      <Modal open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} title="Delete product" size="sm"
        footer={<>
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={() => {
            d('catalogue/deleteProduct', confirmDelete.id)
            success('Product deleted')
            setConfirmDelete(null)
          }}>Delete</Button>
        </>}>
        <p className="text-[13px]" style={{ color: 'var(--c-text-muted)' }}>
          Delete <strong style={{ color: 'var(--c-text)' }}>{confirmDelete?.name}</strong>? It will be hidden
          from the storefront. You can restore it from the archive.
        </p>
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------- bits */

function StatCard({ label, value, tone, raw, onClick }) {
  const colour = { success: 'var(--c-success)', warning: 'var(--c-warning)', danger: 'var(--c-danger)' }[tone] || 'var(--c-text)'
  return (
    <motion.div whileHover={onClick ? { y: -2 } : undefined} onClick={onClick}
      className={cxs('t-card p-3', onClick && 'cursor-pointer')}>
      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>{label}</p>
      <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: colour }}>
        {raw ? value : Number(value).toLocaleString('en-IN')}
      </p>
    </motion.div>
  )
}
const cxs = (...a) => a.filter(Boolean).join(' ')

function IconBtn({ children, danger, title, ...p }) {
  return (
    <Tooltip content={title}>
      <button {...p} className="w-6 h-6 rounded grid place-items-center text-[13px] transition-colors hover:bg-black/5"
        style={{ color: danger ? 'var(--c-danger)' : 'var(--c-text-muted)' }}>
        {children}
      </button>
    </Tooltip>
  )
}

function VariantStrip({ product }) {
  const cat = useSlice('catalogue')
  const axes = variantAxesFor(product)
  if (!product.variants?.length) {
    return <p className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>No variants defined.</p>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {product.variants.map(v => {
        const a = atp(v, cat.inventoryConfig)
        return (
          <div key={v.sku} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[11px]"
            style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}>
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: v.hex }} />
            <span style={{ color: 'var(--c-text)' }}>{variantLabel(v, axes) || v.sku}</span>
            <span className="tabular-nums font-medium"
              style={{ color: a.available <= 0 ? 'var(--c-danger)' : a.available <= 5 ? 'var(--c-warning)' : 'var(--c-success)' }}>
              {a.available}
            </span>
            <span className="font-mono text-[9.5px] opacity-50">{v.sku.slice(-8)}</span>
          </div>
        )
      })}
    </div>
  )
}

function FilterDrawer({ open, onClose, products, filters, setFilters }) {
  const uniq = (key) => [...new Set(products.map(p => p[key]).filter(Boolean))].sort()
  const toggle = (key, value) => setFilters(f => {
    const cur = f[key] || []
    const next = cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value]
    const n = { ...f }
    next.length ? (n[key] = next) : delete n[key]
    return n
  })

  return (
    <Drawer open={open} onClose={onClose} title="Filters" width={360}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" full onClick={() => setFilters({})}>Clear all</Button>
          <Button size="sm" full onClick={onClose}>Show results</Button>
        </div>
      }>
      <div className="space-y-4">
        <FilterGroup label="Status">
          {['active', 'draft', 'archived'].map(s => (
            <Pill key={s} active={filters.status === s}
              onClick={() => setFilters(f => ({ ...f, status: f.status === s ? undefined : s }))}>{s}</Pill>
          ))}
        </FilterGroup>

        <FilterGroup label="Category">
          {uniq('category').map(c => (
            <Pill key={c} active={filters.category?.includes(c)} onClick={() => toggle('category', c)}>{c}</Pill>
          ))}
        </FilterGroup>

        <FilterGroup label="Brand">
          {uniq('brand').map(b => (
            <Pill key={b} active={filters.brand?.includes(b)} onClick={() => toggle('brand', b)}>{b}</Pill>
          ))}
        </FilterGroup>

        <FilterGroup label="Craft">
          {uniq('craft').slice(0, 12).map(c => (
            <Pill key={c} active={filters.craft?.includes(c)} onClick={() => toggle('craft', c)}>{c}</Pill>
          ))}
        </FilterGroup>

        <div className="space-y-2.5 pt-2 border-t" style={{ borderColor: 'var(--c-border)' }}>
          <Switch label="In stock only" checked={Boolean(filters.inStock)}
            onChange={v => setFilters(f => ({ ...f, inStock: v || undefined }))} />
          <Switch label="GI-tagged only" checked={Boolean(filters.gi)}
            onChange={v => setFilters(f => ({ ...f, gi: v || undefined }))} />
          <Switch label="Handmade only" checked={Boolean(filters.handmade)}
            onChange={v => setFilters(f => ({ ...f, handmade: v || undefined }))} />
          <Switch label="COD eligible" checked={Boolean(filters.codEligible)}
            onChange={v => setFilters(f => ({ ...f, codEligible: v || undefined }))} />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t" style={{ borderColor: 'var(--c-border)' }}>
          <Input label="Min price" type="number" size="sm" value={filters.minPrice ?? ''}
            onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value ? Number(e.target.value) : undefined }))} />
          <Input label="Max price" type="number" size="sm" value={filters.maxPrice ?? ''}
            onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value ? Number(e.target.value) : undefined }))} />
        </div>

        <Input label="Min discount %" type="number" size="sm" value={filters.minDiscount ?? ''}
          onChange={e => setFilters(f => ({ ...f, minDiscount: e.target.value ? Number(e.target.value) : undefined }))} />
      </div>
    </Drawer>
  )
}

function FilterGroup({ label, children }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--c-text-muted)' }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}
