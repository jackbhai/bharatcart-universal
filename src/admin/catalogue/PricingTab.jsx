import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useSlice } from '../../hooks/useStore.js'
import store from '../../core/store/index.js'
import useToast from '../../hooks/useToast.js'
import { selectProducts } from '../../core/store/slices/catalogueSlice.js'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select, Switch, Label, Slider } from '../../ui/primitives/Input.jsx'
import { Card, CardHead, Badge, Modal, Divider, Tabs, Empty } from '../../ui/primitives/Display.jsx'
import { resolvePrice, PRICE_SOURCE } from '../../engines/pricing/priceEngine.js'

/** Read the single catalogue-wide % adjustment out of a price list's rule array. */
const listPct = (pl) => {
  const r = (pl.rules || [])[0]
  if (!r) return 0
  return r.type === 'percent_off' ? -Math.abs(r.value) : Math.abs(r.value)
}
/** Write a % adjustment back into engine rule shape. */
const pctToRules = (pct) => pct === 0 ? [] : [{
  match: { all: true },
  type: pct < 0 ? 'percent_off' : 'percent_up',
  value: Math.abs(pct),
}]
import { inr } from '../../lib/analytics.js'

const SUB = [
  { id: 'lists', label: 'Price lists' },
  { id: 'tiers', label: 'Quantity tiers' },
  { id: 'schedules', label: 'Scheduled sales' },
  { id: 'simulator', label: 'Simulator' },
]

export default function PricingTab() {
  const [sub, setSub] = useState('lists')
  return (
    <div className="space-y-3">
      <Tabs tabs={SUB} value={sub} onChange={setSub} size="sm" />
      {sub === 'lists' && <PriceLists />}
      {sub === 'tiers' && <QuantityTiers />}
      {sub === 'schedules' && <Schedules />}
      {sub === 'simulator' && <Simulator />}
    </div>
  )
}

function PriceLists() {
  const cat = useSlice('catalogue')
  const { success } = useToast()
  const [editing, setEditing] = useState(null)

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          Assign a list to a customer group — the storefront resolves it automatically at checkout.
        </p>
        <Button size="sm" onClick={() => setEditing({ name: '', group: 'retail', rules: [], isNew: true })}>
          + New price list
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cat.priceLists.map((pl, i) => (
          <motion.div key={pl.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .05 }}>
            <Card hover>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-[13.5px]" style={{ color: 'var(--c-text)' }}>{pl.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>Group: {pl.group || 'default'}</p>
                </div>
                <Badge tone={listPct(pl) < 0 ? 'success' : listPct(pl) > 0 ? 'warning' : 'neutral'}>
                  {listPct(pl) > 0 ? '+' : ''}{listPct(pl)}%
                </Badge>
              </div>
              <p className="text-[11.5px] mb-3" style={{ color: 'var(--c-text-muted)' }}>
                {listPct(pl) < 0
                  ? `Members pay ${Math.abs(listPct(pl))}% less than list price.`
                  : listPct(pl) > 0 ? `Marked up ${listPct(pl)}% over list.` : 'Standard list price.'}
              </p>
              <div className="flex gap-1.5">
                <Button size="xs" variant="outline" onClick={() => setEditing(pl)}>Edit</Button>
                {pl.id !== 'pl_retail' && (
                  <Button size="xs" variant="ghost"
                    onClick={() => { store.dispatch('catalogue/removePriceList', pl.id); success('Price list removed') }}>
                    Delete
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {editing && <ListModal pl={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ListModal({ pl, onClose }) {
  const { success } = useToast()
  const [d, setD] = useState(pl)
  const pct = listPct(d)
  return (
    <Modal open onClose={onClose} title={d.isNew ? 'New price list' : d.name} size="sm"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => {
          const { isNew, ...rest } = d
          store.dispatch(isNew ? 'catalogue/addPriceList' : 'catalogue/updatePriceList',
            isNew ? rest : { id: d.id, patch: rest })
          success('Price list saved'); onClose()
        }}>Save</Button>
      </>}>
      <div className="space-y-3">
        <Input label="Name" value={d.name} onChange={e => setD({ ...d, name: e.target.value })} />
        <Select label="Customer group" value={d.group} onChange={e => setD({ ...d, group: e.target.value })}
          options={['', 'retail', 'b2b', 'vip', 'wholesale', 'employee', 'reseller'].map(g => ({ value: g, label: g || '— none —' }))} />
        <Slider label="Adjustment vs list price" value={pct}
          onChange={v => setD({ ...d, rules: pctToRules(v) })}
          min={-60} max={60} format={v => `${v > 0 ? '+' : ''}${v}%`} />
      </div>
    </Modal>
  )
}

function QuantityTiers() {
  const cat = useSlice('catalogue')
  const { success } = useToast()
  const tier = (cat.tiers || [])[0]
  const breaks = tier?.breaks || []

  const setBreaks = (next) =>
    store.dispatch('catalogue/updateTier', {
      id: tier.id,
      patch: { breaks: [...next].sort((a, b) => a.minQty - b.minQty) },
    })

  if (!tier) {
    return (
      <Card>
        <Empty icon="₹" title="No tier group yet"
          description="Create a bulk-buy tier group to start rewarding larger baskets."
          action={<Button size="sm" onClick={() => {
            store.dispatch('catalogue/addTier', { name: 'Bulk buy', all: true, breaks: [{ minQty: 3, discountPct: 5 }] })
            success('Tier group created')
          }}>Create tier group</Button>} />
      </Card>
    )
  }

  return (
    <Card>
      <CardHead title="Quantity break pricing"
        subtitle="Buy more, pay less. Evaluated before price lists — the engine always keeps the lowest result."
        action={
          <Button size="xs" onClick={() => {
            const last = breaks.at(-1)
            setBreaks([...breaks, { minQty: (last?.minQty ?? 1) + 3, discountPct: (last?.discountPct ?? 0) + 5 }])
            success('Break added')
          }}>+ Break</Button>
        } />
      <div className="space-y-2">
        {breaks.map((b, i) => (
          <motion.div key={i} layout className="flex items-center gap-3 p-2.5 rounded-lg border"
            style={{ borderColor: 'var(--c-border)' }}>
            <span className="text-[12px] w-10" style={{ color: 'var(--c-text-muted)' }}>Buy</span>
            <input type="number" value={b.minQty} className="t-input w-20 px-2 py-1 text-[12px] text-right"
              onChange={e => setBreaks(breaks.map((x, j) => j === i ? { ...x, minQty: Number(e.target.value) } : x))} />
            <span className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>+ units, get</span>
            <input type="number" value={b.discountPct ?? 0} className="t-input w-20 px-2 py-1 text-[12px] text-right"
              onChange={e => setBreaks(breaks.map((x, j) => j === i ? { ...x, discountPct: Number(e.target.value), price: undefined } : x))} />
            <span className="text-[12px] flex-1" style={{ color: 'var(--c-text-muted)' }}>% off</span>
            <button onClick={() => setBreaks(breaks.filter((_, j) => j !== i))}
              className="text-[16px] px-1" style={{ color: 'var(--c-danger)' }}>×</button>
          </motion.div>
        ))}
        {!breaks.length && <Empty icon="₹" title="No breaks yet" description="Add a break to reward bulk buyers." />}
      </div>
    </Card>
  )
}

function Schedules() {
  const cat = useSlice('catalogue')
  const { success } = useToast()
  const [draft, setDraft] = useState(null)
  const now = Date.now()

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          Time-boxed price overrides — perfect for Diwali, EOSS and flash drops.
        </p>
        <Button size="sm" onClick={() => setDraft({
          id: 'sch_' + Date.now(), name: '', scope: 'category', target: '', discountPct: 15,
          startAt: new Date().toISOString().slice(0, 10),
          endAt: new Date(now + 7 * 864e5).toISOString().slice(0, 10), isNew: true,
        })}>+ Schedule sale</Button>
      </div>

      <div className="space-y-2">
        {(cat.schedules || []).map(s => {
          const start = new Date(s.startAt).getTime()
          const end = new Date(s.endAt).getTime()
          const live = now >= start && now <= end
          const upcoming = now < start
          return (
            <motion.div key={s.id} layout className="t-card p-3 flex items-center gap-3 flex-wrap">
              <Badge tone={live ? 'success' : upcoming ? 'info' : 'neutral'} dot>
                {live ? 'Live' : upcoming ? 'Scheduled' : 'Ended'}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[13px]" style={{ color: 'var(--c-text)' }}>{s.name || 'Untitled sale'}</p>
                <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
                  {s.scope}: {s.target || 'all'} · {s.startAt} → {s.endAt}
                </p>
              </div>
              <Badge tone="primary">−{s.discountPct}%</Badge>
              <Button size="xs" variant="outline" onClick={() => setDraft(s)}>Edit</Button>
              <Button size="xs" variant="ghost"
                onClick={() => { store.dispatch('catalogue/removeSchedule', s.id); success('Schedule removed') }}>Delete</Button>
            </motion.div>
          )
        })}
        {!(cat.schedules || []).length && <Empty icon="◷" title="No scheduled sales" description="Plan your next festive drop in advance." />}
      </div>

      {draft && <ScheduleModal s={draft} onClose={() => setDraft(null)} categories={cat.categories} />}
    </div>
  )
}

function ScheduleModal({ s, onClose, categories }) {
  const { success } = useToast()
  const [d, setD] = useState(s)
  return (
    <Modal open onClose={onClose} title={d.isNew ? 'Schedule a sale' : d.name} size="md"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => {
          const { isNew, ...rest } = d
          store.dispatch(isNew ? 'catalogue/addSchedule' : 'catalogue/updateSchedule',
            isNew ? rest : { id: d.id, patch: rest })
          success('Sale scheduled'); onClose()
        }}>Save</Button>
      </>}>
      <div className="space-y-3">
        <Input label="Sale name" value={d.name} onChange={e => setD({ ...d, name: e.target.value })}
          placeholder="Diwali Dhamaka" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Scope" value={d.scope} onChange={e => setD({ ...d, scope: e.target.value, target: '' })}
            options={[
              { value: 'all', label: 'Entire catalogue' },
              { value: 'category', label: 'Category' },
              { value: 'brand', label: 'Brand' },
            ]} />
          {d.scope === 'category'
            ? <Select label="Category" value={d.target} onChange={e => setD({ ...d, target: e.target.value })}
                options={[{ value: '', label: '— select —' }, ...categories.map(c => c.name)]} />
            : <Input label="Target" value={d.target} onChange={e => setD({ ...d, target: e.target.value })}
                disabled={d.scope === 'all'} placeholder={d.scope === 'all' ? 'All products' : 'Brand name'} />}
        </div>
        <Slider label="Discount" value={d.discountPct} onChange={v => setD({ ...d, discountPct: v })}
          min={5} max={70} format={v => `${v}% off`} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Starts" type="date" value={d.startAt} onChange={e => setD({ ...d, startAt: e.target.value })} />
          <Input label="Ends" type="date" value={d.endAt} onChange={e => setD({ ...d, endAt: e.target.value })} />
        </div>
      </div>
    </Modal>
  )
}

function Simulator() {
  const cat = useSlice('catalogue')
  const products = useMemo(() => selectProducts({ catalogue: cat }), [cat])
  const [productId, setProductId] = useState(products[0]?.id)
  const [qty, setQty] = useState(1)
  const [group, setGroup] = useState('retail')

  const product = products.find(p => p.id === productId)
  const result = useMemo(() => product ? resolvePrice(product, {
    qty, customerGroup: group,
    priceLists: cat.priceLists, tiers: cat.tiers, schedules: cat.schedules,
  }) : null, [product, qty, group, cat])

  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Card>
        <CardHead title="Inputs" subtitle="Change the context and watch the engine resolve a final price." />
        <div className="space-y-3">
          <Select label="Product" value={productId} onChange={e => setProductId(e.target.value)}
            options={products.slice(0, 120).map(p => ({ value: p.id, label: p.name }))} />
          <Select label="Customer group" value={group} onChange={e => setGroup(e.target.value)}
            options={['retail', 'b2b', 'vip'].map(g => ({ value: g, label: g }))} />
          <Slider label="Quantity" value={qty} onChange={setQty} min={1} max={50} />
        </div>
      </Card>

      <Card>
        <CardHead title="Resolved price" subtitle="Full audit trail of every rule that fired." />
        {result && (
          <>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-2xl font-bold" style={{ color: 'var(--c-primary)' }}>{inr(result.price)}</span>
              {result.discount > 0 && (
                <>
                  <span className="text-[13px] line-through" style={{ color: 'var(--c-text-muted)' }}>{inr(product.price)}</span>
                  <Badge tone="success">save {inr(result.discount)}</Badge>
                </>
              )}
            </div>
            <p className="text-[11.5px] mb-3" style={{ color: 'var(--c-text-muted)' }}>
              Source: <strong style={{ color: 'var(--c-text)' }}>{result.source}</strong> ·
              line total {inr(result.price * qty)} · margin {result.marginPct}%
            </p>
            <Divider label="Trail" />
            <div className="space-y-1.5 mt-2">
              {result.trail.map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .06 }}
                  className="flex items-center gap-2 text-[11.5px] py-1.5 px-2 rounded"
                  style={{ background: 'var(--c-surface-alt)' }}>
                  <span className="w-4 h-4 rounded-full grid place-items-center text-[9px] font-bold shrink-0"
                    style={{ background: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}>{i + 1}</span>
                  <span className="flex-1" style={{ color: 'var(--c-text)' }}>{t.label}</span>
                  <span className="tabular-nums font-medium" style={{ color: 'var(--c-text)' }}>{inr(t.price)}</span>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
