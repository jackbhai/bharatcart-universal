import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useSlice } from '../../hooks/useStore.js'
import store from '../../core/store/index.js'
import useToast from '../../hooks/useToast.js'
import { selectProducts } from '../../core/store/slices/catalogueSlice.js'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select, Switch } from '../../ui/primitives/Input.jsx'
import { Card, CardHead, Badge, Modal, Empty, Progress } from '../../ui/primitives/Display.jsx'
import { inr } from '../../lib/analytics.js'

export default function CategoriesTab() {
  const cat = useSlice('catalogue')
  const { success } = useToast()
  const [editing, setEditing] = useState(null)
  const products = useMemo(() => selectProducts({ catalogue: cat }), [cat])

  const rows = cat.categories.map(c => {
    const items = products.filter(p => p.category === c.name)
    const revenue = items.reduce((s, p) => s + p.price * (p.sold || 0), 0)
    return { ...c, count: items.length, revenue, stock: items.reduce((s, p) => s + (p.stock || 0), 0) }
  })
  const maxRev = Math.max(1, ...rows.map(r => r.revenue))

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          {rows.length} categories · HSN &amp; GST defaults cascade to new products
        </p>
        <Button size="sm" onClick={() => setEditing({ name: '', hsn: '', gst: 5, subs: [], isNew: true })}>
          + New category
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((c, i) => (
          <motion.div key={c.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}>
            <Card hover className="h-full flex flex-col">
              <CardHead title={c.name} subtitle={`HSN ${c.hsn} · ${c.gst}% GST`}
                action={
                  <button onClick={() => setEditing(c)} className="text-[12px] opacity-50 hover:opacity-100"
                    style={{ color: 'var(--c-text)' }}>✎</button>
                } />
              <div className="grid grid-cols-3 gap-2 mb-3">
                <Metric label="Products" value={c.count} />
                <Metric label="Units" value={c.stock} />
                <Metric label="Revenue" value={inr(c.revenue)} small />
              </div>
              <Progress value={c.revenue} max={maxRev} height={4} animated />
              <div className="flex flex-wrap gap-1 mt-3">
                {(c.subs || []).map(s => <Badge key={s} size="sm">{s}</Badge>)}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <CategoryModal editing={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function Metric({ label, value, small }) {
  return (
    <div>
      <p className="text-[9.5px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>{label}</p>
      <p className={small ? 'text-[12px] font-bold tabular-nums' : 'text-[15px] font-bold tabular-nums'}
        style={{ color: 'var(--c-text)' }}>{value}</p>
    </div>
  )
}

function CategoryModal({ editing, onClose }) {
  const { success } = useToast()
  const [draft, setDraft] = useState(null)
  const cur = draft ?? editing
  React.useEffect(() => setDraft(editing), [editing])
  if (!cur) return null
  const set = (patch) => setDraft(d => ({ ...(d ?? editing), ...patch }))

  return (
    <Modal open onClose={onClose} title={cur.isNew ? 'New category' : `Edit ${editing.name}`} size="sm"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => {
          if (cur.isNew) store.dispatch('catalogue/addCategory', { name: cur.name, hsn: cur.hsn, gst: cur.gst, subs: cur.subs })
          else store.dispatch('catalogue/updateCategory', { name: editing.name, patch: cur })
          success('Category saved'); onClose()
        }}>Save</Button>
      </>}>
      <div className="space-y-3">
        <Input label="Name" value={cur.name} onChange={e => set({ name: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="HSN code" value={cur.hsn} onChange={e => set({ hsn: e.target.value })} />
          <Select label="GST slab" value={cur.gst} onChange={e => set({ gst: Number(e.target.value) })}
            options={[0, 3, 5, 12, 18, 28].map(g => ({ value: g, label: `${g}%` }))} />
        </div>
        <Input label="Sub-categories (comma separated)" value={(cur.subs || []).join(', ')}
          onChange={e => set({ subs: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
      </div>
    </Modal>
  )
}
