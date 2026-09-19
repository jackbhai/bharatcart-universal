import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useSlice } from '../../hooks/useStore.js'
import store from '../../core/store/index.js'
import useToast from '../../hooks/useToast.js'
import { selectProducts, selectCollectionProducts } from '../../core/store/slices/catalogueSlice.js'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select, Switch, Label } from '../../ui/primitives/Input.jsx'
import { Card, Badge, Modal, Divider, Empty } from '../../ui/primitives/Display.jsx'
import { FIELDS, OPERATORS, operatorsFor } from '../../engines/promo/conditions.js'
import { inr } from '../../lib/analytics.js'

export default function CollectionsTab() {
  const cat = useSlice('catalogue')
  const { success } = useToast()
  const [editing, setEditing] = useState(null)
  const state = { catalogue: cat }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          Smart collections auto-populate from rules. They power storefront rows &amp; promo targeting.
        </p>
        <Button size="sm" onClick={() => setEditing({
          id: 'col_' + Date.now(), title: '', handle: '', type: 'smart', active: true,
          rules: [{ field: 'category', op: 'eq', value: '' }], match: 'all', isNew: true,
        })}>+ New collection</Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cat.collections.map((col, i) => {
          const items = selectCollectionProducts(state, col.id)
          return (
            <motion.div key={col.id} initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}>
              <Card hover className="h-full">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[13.5px]" style={{ color: 'var(--c-text)' }}>{col.title}</p>
                    <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>/{col.handle}</p>
                  </div>
                  <Badge tone={col.active ? 'success' : 'neutral'} size="sm" dot>
                    {col.active ? 'Live' : 'Off'}
                  </Badge>
                </div>

                <div className="flex -space-x-2 mb-3">
                  {items.slice(0, 5).map(p => (
                    <span key={p.id} className="w-8 h-10 rounded border-2 shrink-0"
                      style={{ borderColor: 'var(--c-surface)',
                        background: `linear-gradient(135deg, var(--c-surface-alt), ${p.variants?.[0]?.hex || '#ccc'}55)` }} />
                  ))}
                  {items.length > 5 && (
                    <span className="w-8 h-10 rounded border-2 grid place-items-center text-[10px] font-semibold"
                      style={{ borderColor: 'var(--c-surface)', background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}>
                      +{items.length - 5}
                    </span>
                  )}
                </div>

                <p className="text-[11.5px] mb-2" style={{ color: 'var(--c-text-muted)' }}>
                  <strong style={{ color: 'var(--c-text)' }}>{items.length}</strong> products ·
                  {' '}{inr(items.reduce((s, p) => s + p.price, 0))} catalogue value
                </p>

                <div className="flex flex-wrap gap-1 mb-3">
                  {(col.rules || []).slice(0, 3).map((r, j) => (
                    <Badge key={j} size="sm" tone="primary">{r.field} {r.op} {String(r.value).slice(0, 14)}</Badge>
                  ))}
                </div>

                <div className="flex gap-1.5">
                  <Button size="xs" variant="outline" onClick={() => setEditing(col)}>Edit rules</Button>
                  <Button size="xs" variant="ghost"
                    onClick={() => { store.dispatch('catalogue/updateCollection', { id: col.id, patch: { active: !col.active } }); success(col.active ? 'Hidden' : 'Published') }}>
                    {col.active ? 'Unpublish' : 'Publish'}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {editing && <CollectionModal col={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function CollectionModal({ col, onClose }) {
  const cat = useSlice('catalogue')
  const { success } = useToast()
  const [draft, setDraft] = useState(col)
  const preview = useMemo(() => {
    const all = selectProducts({ catalogue: cat })
    return all.filter(p => matchRules(p, draft.rules, draft.match))
  }, [cat, draft])

  const set = (patch) => setDraft(d => ({ ...d, ...patch }))
  const setRule = (i, patch) => setDraft(d => ({
    ...d, rules: d.rules.map((r, j) => j === i ? { ...r, ...patch } : r),
  }))

  return (
    <Modal open onClose={onClose} title={draft.isNew ? 'New collection' : draft.title} size="lg"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => {
          const { isNew, ...rest } = draft
          if (isNew) store.dispatch('catalogue/addCollection', rest)
          else store.dispatch('catalogue/updateCollection', { id: draft.id, patch: rest })
          success(`Collection saved — ${preview.length} products`)
          onClose()
        }}>Save ({preview.length})</Button>
      </>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Title" value={draft.title}
            onChange={e => set({ title: e.target.value, handle: draft.handle || slug(e.target.value) })} />
          <Input label="Handle" value={draft.handle} prefix="/c/" onChange={e => set({ handle: e.target.value })} />
        </div>

        <Divider label="Rules" />

        <Select label="Match" value={draft.match} onChange={e => set({ match: e.target.value })}
          options={[{ value: 'all', label: 'ALL conditions (AND)' }, { value: 'any', label: 'ANY condition (OR)' }]} />

        <div className="space-y-2">
          {(draft.rules || []).map((r, i) => (
            <motion.div key={i} layout className="flex gap-2 items-start">
              <select value={r.field} onChange={e => setRule(i, { field: e.target.value, value: '' })}
                className="t-input px-2 py-1.5 text-[12px] flex-1">
                {PRODUCT_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              <select value={r.op} onChange={e => setRule(i, { op: e.target.value })}
                className="t-input px-2 py-1.5 text-[12px] w-32">
                {['eq','neq','gt','gte','lt','lte','contains','in'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <input value={r.value} onChange={e => setRule(i, { value: e.target.value })}
                className="t-input px-2 py-1.5 text-[12px] flex-1" placeholder="value" />
              <button onClick={() => set({ rules: draft.rules.filter((_, j) => j !== i) })}
                className="px-1 text-[15px]" style={{ color: 'var(--c-danger)' }}>×</button>
            </motion.div>
          ))}
          <Button size="xs" variant="outline"
            onClick={() => set({ rules: [...(draft.rules || []), { field: 'category', op: 'eq', value: '' }] })}>
            + Add rule
          </Button>
        </div>

        <Divider label={`Preview · ${preview.length} products`} />
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
          {preview.slice(0, 40).map(p => (
            <span key={p.id} className="px-2 py-1 rounded-lg text-[11px] border"
              style={{ borderColor: 'var(--c-border)', color: 'var(--c-text)' }}>
              {p.name.slice(0, 26)}
            </span>
          ))}
          {!preview.length && <p className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>No products match yet.</p>}
        </div>
      </div>
    </Modal>
  )
}

const PRODUCT_FIELDS = [
  { key: 'category', label: 'Category' }, { key: 'subCategory', label: 'Sub-category' },
  { key: 'brand', label: 'Brand' }, { key: 'craft', label: 'Craft' },
  { key: 'fabric', label: 'Fabric' }, { key: 'origin', label: 'Origin' },
  { key: 'price', label: 'Price' }, { key: 'mrp', label: 'MRP' },
  { key: 'discountPct', label: 'Discount %' }, { key: 'stock', label: 'Stock' },
  { key: 'rating', label: 'Rating' }, { key: 'reviews', label: 'Review count' },
  { key: 'sold', label: 'Units sold' }, { key: 'status', label: 'Status' },
  { key: 'gi', label: 'GI tagged' }, { key: 'handmade', label: 'Handmade' },
  { key: 'tags', label: 'Tags' },
]

function matchRules(p, rules = [], match = 'all') {
  if (!rules.length) return false
  const test = (r) => {
    const actual = p[r.field]
    const v = r.value
    if (v === '' || v == null) return false
    const num = Number(v)
    switch (r.op) {
      case 'eq': return String(actual).toLowerCase() === String(v).toLowerCase()
      case 'neq': return String(actual).toLowerCase() !== String(v).toLowerCase()
      case 'gt': return Number(actual) > num
      case 'gte': return Number(actual) >= num
      case 'lt': return Number(actual) < num
      case 'lte': return Number(actual) <= num
      case 'contains': return Array.isArray(actual)
        ? actual.some(x => String(x).toLowerCase().includes(String(v).toLowerCase()))
        : String(actual ?? '').toLowerCase().includes(String(v).toLowerCase())
      case 'in': return String(v).split(',').map(s => s.trim().toLowerCase()).includes(String(actual).toLowerCase())
      default: return false
    }
  }
  return match === 'any' ? rules.some(test) : rules.every(test)
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
