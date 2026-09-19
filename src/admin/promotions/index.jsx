import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSlice } from '../../hooks/useStore.js'
import store from '../../core/store/index.js'
import useToast from '../../hooks/useToast.js'
import { selectProducts, selectCategories } from '../../core/store/slices/catalogueSlice.js'
import { selectOrders } from '../../core/store/slices/ordersSlice.js'
import DataTable from '../../ui/patterns/DataTable.jsx'
import EmptyState from '../../ui/EmptyState.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select, Switch, Slider, Textarea, Label, Checkbox } from '../../ui/primitives/Input.jsx'
import { Badge, Card, CardHead, Tabs, Divider, Progress, Empty, Tooltip, Modal, Drawer, Pill } from '../../ui/primitives/Display.jsx'
import {
  applyPromotions, simulate, detectConflicts, DISCOUNT_TYPE, APPLIES_TO,
} from '../../engines/promo/promoEngine.js'
import { FIELDS, OPERATORS, operatorsFor, describe, deriveFacts } from '../../engines/promo/conditions.js'
import { discountAnalysis } from '../../engines/finance/financeEngine.js'
import { inr } from '../../lib/analytics.js'

const TABS = [
  { id: 'list', label: 'All promotions', icon: '％' },
  { id: 'builder', label: 'Rule builder', icon: '⚙' },
  { id: 'simulator', label: 'Cart simulator', icon: '⚗' },
  { id: 'performance', label: 'Performance', icon: '◲' },
]

const TYPE_LABEL = {
  [DISCOUNT_TYPE.PERCENT]: '% off',
  [DISCOUNT_TYPE.AMOUNT]: '₹ off',
  [DISCOUNT_TYPE.FREE_SHIPPING]: 'Free shipping',
  [DISCOUNT_TYPE.BOGO]: 'BOGO',
  [DISCOUNT_TYPE.BUY_X_GET_Y]: 'Buy X get Y',
  [DISCOUNT_TYPE.TIERED]: 'Spend more save more',
  [DISCOUNT_TYPE.FREE_GIFT]: 'Free gift',
  [DISCOUNT_TYPE.BUNDLE]: 'Bundle',
}

export default function Promotions() {
  const [tab, setTab] = useState('list')
  const [editing, setEditing] = useState(null)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Promotions</h1>
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          Build discount rules, test them against a real cart before going live, and see what they actually cost.
        </p>
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'list' && <PromoList onEdit={setEditing} />}
          {tab === 'builder' && <ConflictView onEdit={setEditing} />}
          {tab === 'simulator' && <CartSimulator />}
          {tab === 'performance' && <Performance />}
        </motion.div>
      </AnimatePresence>

      <Drawer open={Boolean(editing)} onClose={() => setEditing(null)} title="Edit promotion" width={620}>
        {editing && <PromoEditor promoId={editing} onClose={() => setEditing(null)} />}
      </Drawer>
    </div>
  )
}

/* ------------------------------------------------------------- list */

function PromoList({ onEdit }) {
  const { promos } = useSlice('promo')
  const { success } = useToast()
  const now = Date.now()

  const conflicts = useMemo(() => detectConflicts(promos), [promos])
  const conflictIds = new Set(conflicts.flatMap(c => [c.a?.id, c.b?.id].filter(Boolean)))

  const active = promos.filter(p => p.active && (!p.endsAt || p.endsAt > now))
  const totalUsed = promos.reduce((s, p) => s + (p.usedCount ?? 0), 0)

  const createPromo = () => {
    store.dispatch('promo/create', {})
    const created = store.get('promo').promos[0]
    if (created) {
      onEdit(created.id)
      success('Draft promotion created')
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Stat label="Total promotions" value={promos.length} />
        <Stat label="Live now" value={active.length} tone="success" />
        <Stat label="Times redeemed" value={totalUsed} />
        <Stat label="Conflicts" value={conflicts.length} tone={conflicts.length ? 'warning' : undefined} />
      </div>

      {conflicts.length > 0 && (
        <Card style={{ borderColor: 'var(--c-warning)' }}>
          <CardHead title="Overlapping promotions"
            subtitle="These can stack in the same cart — check that is intentional." />
          <div className="space-y-1.5">
            {conflicts.slice(0, 5).map((c, i) => (
              <p key={i} className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>
                <strong style={{ color: 'var(--c-text)' }}>{c.a?.name}</strong> and{' '}
                <strong style={{ color: 'var(--c-text)' }}>{c.b?.name}</strong> — {c.reason}
              </p>
            ))}
          </div>
        </Card>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={createPromo}>+ New promotion</Button>
      </div>

      {promos.length === 0 ? (
        <EmptyState
          icon="％"
          title="No promotions yet"
          message="Discount rules you create will live here. Build one, test it against a real cart, then take it live."
          actionLabel="Create your first promotion"
          onAction={createPromo}
        />
      ) : (
      <DataTable
        rows={promos}
        rowKey={(p) => p.id}
        onRowClick={(p) => onEdit(p.id)}
        columns={[
          {
            key: 'name', label: 'Promotion', width: '26%', nowrap: false,
            render: p => (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium truncate" style={{ color: 'var(--c-text)' }}>{p.name}</span>
                  {conflictIds.has(p.id) && <Tooltip content="Overlaps another promotion"><span style={{ color: 'var(--c-warning)' }}>⚠</span></Tooltip>}
                </div>
                {p.code && <p className="text-[10.5px] font-mono" style={{ color: 'var(--c-text-muted)' }}>{p.code}</p>}
              </div>
            ),
          },
          { key: 'type', label: 'Type', render: p => <Badge size="sm">{TYPE_LABEL[p.type] ?? p.type}</Badge> },
          {
            key: 'value', label: 'Value', align: 'right',
            render: p => p.type === DISCOUNT_TYPE.PERCENT ? `${p.value}%`
              : p.type === DISCOUNT_TYPE.AMOUNT ? inr(p.value)
              : p.type === DISCOUNT_TYPE.FREE_SHIPPING ? '—' : (p.value ?? '—'),
          },
          {
            key: 'conditions', label: 'Conditions', width: '20%', nowrap: false, sortable: false,
            render: p => {
              const n = (p.conditions?.all?.length ?? 0) + (p.conditions?.any?.length ?? 0)
              return n
                ? <Tooltip content={(p.conditions.all || []).map(c => describe(c, {})).join(' · ')}>
                    <span className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>{n} rule{n > 1 ? 's' : ''}</span>
                  </Tooltip>
                : <span className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>Always</span>
            },
          },
          { key: 'usedCount', label: 'Used', align: 'right',
            render: p => (
              <div>
                <span className="tabular-nums">{p.usedCount ?? 0}</span>
                {p.usageLimit && (
                  <div className="w-12 mt-0.5 ml-auto">
                    <Progress value={p.usedCount ?? 0} max={p.usageLimit} height={3} animated={false}
                      tone={(p.usedCount ?? 0) / p.usageLimit > 0.85 ? 'danger' : 'primary'} />
                  </div>
                )}
              </div>
            ) },
          {
            key: 'window', label: 'Window', sortValue: p => p.endsAt ?? Infinity,
            render: p => {
              if (!p.endsAt) return <span style={{ color: 'var(--c-text-muted)' }}>No end</span>
              const days = Math.ceil((p.endsAt - now) / 86400000)
              return <span className="tabular-nums" style={{ color: days < 0 ? 'var(--c-danger)' : days < 7 ? 'var(--c-warning)' : 'var(--c-text-muted)' }}>
                {days < 0 ? 'Expired' : `${days}d left`}
              </span>
            },
          },
          {
            key: 'active', label: 'Status',
            render: p => (
              <div onClick={e => e.stopPropagation()}>
                <Switch size="sm" checked={p.active}
                  onChange={() => { store.dispatch('promo/toggle', p.id); success(p.active ? 'Paused' : 'Activated') }} />
              </div>
            ),
          },
        ]}
        initialSort={['usedCount', 'desc']}
      />
      )}
    </div>
  )
}

/* ------------------------------------------------------------ editor */

function PromoEditor({ promoId, onClose }) {
  const { promos } = useSlice('promo')
  const catalogueState = useSlice('catalogue')
  const { success } = useToast()
  const promo = promos.find(p => p.id === promoId)
  const categories = useMemo(() => selectCategories({ catalogue: catalogueState }), [catalogueState])
  if (!promo) return <Empty icon="?" title="Promotion not found" />

  const set = (patch) => store.dispatch('promo/update', { id: promoId, patch })
  const conditions = promo.conditions?.all || []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge tone={promo.active ? 'success' : 'neutral'} dot>{promo.active ? 'Live' : 'Paused'}</Badge>
        <Switch size="sm" checked={promo.active} onChange={() => store.dispatch('promo/toggle', promoId)} />
      </div>

      <Input label="Name" value={promo.name} onChange={e => set({ name: e.target.value })} />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Coupon code" value={promo.code ?? ''} placeholder="Leave blank for automatic"
          onChange={e => set({ code: e.target.value.toUpperCase() || null })}
          hint={promo.code ? 'Customer must enter this' : 'Applies automatically'} />
        <Input label="Priority" type="number" value={promo.priority ?? 0}
          onChange={e => set({ priority: Number(e.target.value) })}
          hint="Higher runs first" />
      </div>

      <Divider label="Discount" />

      <Select label="Type" value={promo.type} onChange={e => set({ type: e.target.value })}
        options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} />

      {![DISCOUNT_TYPE.FREE_SHIPPING].includes(promo.type) && (
        <div className="grid grid-cols-2 gap-3">
          <Input label="Value" type="number" value={promo.value ?? 0}
            prefix={promo.type === DISCOUNT_TYPE.AMOUNT ? '₹' : ''}
            suffix={promo.type === DISCOUNT_TYPE.PERCENT ? '%' : ''}
            onChange={e => set({ value: Number(e.target.value) })} />
          <Input label="Max discount cap" type="number" prefix="₹" value={promo.maxDiscount ?? ''}
            placeholder="No cap" onChange={e => set({ maxDiscount: e.target.value ? Number(e.target.value) : null })}
            hint="Protects margin on large carts" />
        </div>
      )}

      <Select label="Applies to" value={promo.appliesTo ?? APPLIES_TO.CART}
        onChange={e => set({ appliesTo: e.target.value })}
        options={[
          { value: APPLIES_TO.CART, label: 'Whole cart' },
          { value: APPLIES_TO.ITEMS, label: 'Matching items only' },
          { value: APPLIES_TO.CHEAPEST, label: 'Cheapest item' },
          { value: APPLIES_TO.MOST_EXPENSIVE, label: 'Most expensive item' },
          { value: APPLIES_TO.SHIPPING, label: 'Shipping' },
        ]} />

      <Divider label="Conditions" />

      <div className="space-y-2">
        {conditions.map((c, i) => (
          <motion.div key={i} layout className="flex gap-1.5 items-start">
            <select value={c.field}
              onChange={e => store.dispatch('promo/updateCondition', { id: promoId, index: i, patch: { field: e.target.value, value: '' } })}
              className="t-input px-2 py-1.5 text-[11.5px] flex-1">
              {Object.entries(FIELDS).map(([key, f]) => (
                <option key={key} value={key}>{f.label ?? key}</option>
              ))}
            </select>
            <select value={c.op}
              onChange={e => store.dispatch('promo/updateCondition', { id: promoId, index: i, patch: { op: e.target.value } })}
              className="t-input px-2 py-1.5 text-[11.5px] w-28">
              {operatorsFor(c.field).map(o => (
                <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
              ))}
            </select>
            <input value={c.value ?? ''}
              onChange={e => store.dispatch('promo/updateCondition', { id: promoId, index: i, patch: { value: e.target.value } })}
              className="t-input px-2 py-1.5 text-[11.5px] flex-1" placeholder="value" />
            <button onClick={() => store.dispatch('promo/removeCondition', { id: promoId, index: i })}
              className="px-1 text-[15px]" style={{ color: 'var(--c-danger)' }}>×</button>
          </motion.div>
        ))}
        <Button size="xs" variant="outline"
          onClick={() => store.dispatch('promo/addCondition', { id: promoId, condition: { field: 'cart_subtotal', op: 'gte', value: 999 } })}>
          + Add condition
        </Button>
      </div>

      <Divider label="Limits" />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Total usage limit" type="number" value={promo.usageLimit ?? ''}
          placeholder="Unlimited" onChange={e => set({ usageLimit: e.target.value ? Number(e.target.value) : null })} />
        <Input label="Per customer" type="number" value={promo.perCustomerLimit ?? ''}
          placeholder="Unlimited" onChange={e => set({ perCustomerLimit: e.target.value ? Number(e.target.value) : null })} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Starts" type="date"
          value={promo.startsAt ? new Date(promo.startsAt).toISOString().slice(0, 10) : ''}
          onChange={e => set({ startsAt: e.target.value ? new Date(e.target.value).getTime() : null })} />
        <Input label="Ends" type="date"
          value={promo.endsAt ? new Date(promo.endsAt).toISOString().slice(0, 10) : ''}
          onChange={e => set({ endsAt: e.target.value ? new Date(e.target.value + 'T23:59:59').getTime() : null })} />
      </div>

      <div className="space-y-2.5">
        <Switch label="Can stack with other promotions" checked={promo.stackable !== false}
          onChange={v => set({ stackable: v })} />
        <Switch label="Exclusive — blocks all others" checked={Boolean(promo.exclusive)}
          onChange={v => set({ exclusive: v })} />
        <Switch label="Margin guard (skip if it makes the order unprofitable)" checked={Boolean(promo.marginGuard)}
          onChange={v => set({ marginGuard: v })} />
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="sm" full
          onClick={() => { store.dispatch('promo/duplicate', promoId); success('Duplicated'); onClose() }}>
          Duplicate
        </Button>
        <Button variant="danger" size="sm" full
          onClick={() => { store.dispatch('promo/remove', promoId); success('Deleted'); onClose() }}>
          Delete
        </Button>
        <Button size="sm" full onClick={() => { success('Saved'); onClose() }}>Done</Button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- conflicts */

function ConflictView({ onEdit }) {
  const { promos } = useSlice('promo')
  const conflicts = useMemo(() => detectConflicts(promos), [promos])

  const stackable = promos.filter(p => p.active && p.stackable !== false)
  const exclusive = promos.filter(p => p.active && p.exclusive)

  return (
    <div className="space-y-3">
      <Card>
        <CardHead title="Stacking rules"
          subtitle="When several promotions match one cart, the engine runs them in priority order. Exclusive offers stop everything else." />
        <div className="grid sm:grid-cols-3 gap-2.5">
          <Stat label="Stackable" value={stackable.length} tone="success" />
          <Stat label="Exclusive" value={exclusive.length} tone="warning" />
          <Stat label="Detected conflicts" value={conflicts.length} tone={conflicts.length ? 'danger' : undefined} />
        </div>
      </Card>

      <Card>
        <CardHead title="Evaluation order" subtitle="Highest priority first — this is the exact order the cart sees." />
        <div className="space-y-1.5">
          {[...promos].filter(p => p.active).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)).map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * .04 }}
              onClick={() => onEdit(p.id)}
              className="flex items-center gap-2.5 p-2 rounded-lg cursor-pointer"
              style={{ background: 'var(--c-surface-alt)' }}>
              <span className="w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold shrink-0"
                style={{ background: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}>{i + 1}</span>
              <span className="text-[12.5px] flex-1 truncate" style={{ color: 'var(--c-text)' }}>{p.name}</span>
              {p.exclusive && <Badge size="sm" tone="warning">Exclusive</Badge>}
              {p.stackable === false && <Badge size="sm" tone="neutral">No stack</Badge>}
              <Badge size="sm">Priority {p.priority ?? 0}</Badge>
            </motion.div>
          ))}
        </div>
      </Card>

      {conflicts.length > 0 && (
        <Card>
          <CardHead title="Conflict detail" />
          <div className="space-y-2">
            {conflicts.map((c, i) => (
              <div key={i} className="p-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--c-warning) 9%, transparent)' }}>
                <p className="text-[12.5px] font-medium" style={{ color: 'var(--c-text)' }}>
                  {c.a?.name} ↔ {c.b?.name}
                </p>
                <p className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>{c.reason}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

/* ---------------------------------------------------------- simulator */

function CartSimulator() {
  const { promos } = useSlice('promo')
  const catalogueState = useSlice('catalogue')
  const products = useMemo(() => selectProducts({ catalogue: catalogueState }), [catalogueState])

  const [cartItems, setCartItems] = useState(() =>
    products.slice(0, 2).map(p => ({ product: p, qty: 1, price: p.price }))
  )
  const [code, setCode] = useState('')
  const [isNew, setIsNew] = useState(false)
  const [payment, setPayment] = useState('UPI')

  const cart = { items: cartItems }
  const result = useMemo(
    () => applyPromotions(cart, promos, {
      code: code || undefined,
      customer: { isNew, orders: isNew ? 0 : 5 },
      payment,
    }),
    [cart, promos, code, isNew, payment]
  )

  const addItem = (id) => {
    const p = products.find(x => x.id === id)
    if (p) setCartItems(items => [...items, { product: p, qty: 1, price: p.price }])
  }

  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Card>
        <CardHead title="Build a test cart" subtitle="Exactly the shape the storefront sends to the engine." />
        <div className="space-y-2 mb-3">
          {cartItems.map((it, i) => (
            <motion.div key={i} layout className="flex items-center gap-2 p-2 rounded-lg"
              style={{ background: 'var(--c-surface-alt)' }}>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] truncate" style={{ color: 'var(--c-text)' }}>{it.product.name}</p>
                <p className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>{it.product.category}</p>
              </div>
              <input type="number" value={it.qty} min={1}
                onChange={e => setCartItems(items => items.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))}
                className="t-input w-14 px-2 py-1 text-[11px] text-right" />
              <span className="tabular-nums text-[12px] w-16 text-right" style={{ color: 'var(--c-text)' }}>
                {inr(it.price * it.qty)}
              </span>
              <button onClick={() => setCartItems(items => items.filter((_, j) => j !== i))}
                className="text-[15px] px-1" style={{ color: 'var(--c-danger)' }}>×</button>
            </motion.div>
          ))}
        </div>

        <Select label="Add a product" value="" onChange={e => e.target.value && addItem(e.target.value)}
          options={[{ value: '', label: '— choose —' }, ...products.slice(0, 80).map(p => ({ value: p.id, label: `${p.name} · ${inr(p.price)}` }))]} />

        <div className="mt-3 space-y-3">
          <Input label="Coupon code" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="Try FESTIVE15" />
          <Select label="Payment method" value={payment} onChange={e => setPayment(e.target.value)}
            options={['UPI', 'Card', 'COD', 'Netbanking', 'Wallet']} />
          <Switch label="First-time customer" checked={isNew} onChange={setIsNew} />
        </div>
      </Card>

      <Card>
        <CardHead title="What the customer sees" subtitle="Every promotion that fired, and every one that did not." />
        <div className="space-y-1">
          <Row label="Subtotal" value={inr(result.subtotal)} />
          {result.applied.map((a, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              className="flex justify-between text-[12px] py-0.5">
              <span style={{ color: 'var(--c-success)' }}>
                {a.promo?.name ?? a.name} {a.promo?.code && <span className="font-mono">({a.promo.code})</span>}
              </span>
              <span className="tabular-nums" style={{ color: 'var(--c-success)' }}>− {inr(a.amount ?? 0)}</span>
            </motion.div>
          ))}
          {result.freeShipping && (
            <div className="flex justify-between text-[12px] py-0.5">
              <span style={{ color: 'var(--c-success)' }}>Free shipping</span>
              <span style={{ color: 'var(--c-success)' }}>Applied</span>
            </div>
          )}
          <Divider />
          <Row label="Total discount" value={`− ${inr(result.totalDiscount)}`} />
          <Row label="Payable" value={inr(result.payable)} strong />
          <p className="text-[11px] mt-1" style={{ color: 'var(--c-success)' }}>
            Customer saves {result.savingsPct}%
          </p>
        </div>

        {result.rejected.length > 0 && (
          <>
            <Divider label="Not applied" />
            <div className="space-y-1.5">
              {result.rejected.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-[11.5px]">
                  <span style={{ color: 'var(--c-text-muted)' }}>✗</span>
                  <div className="min-w-0">
                    <span style={{ color: 'var(--c-text)' }}>{r.promo?.name}</span>
                    <span style={{ color: 'var(--c-text-muted)' }}> — {r.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {result.gifts?.length > 0 && (
          <>
            <Divider label="Free gifts" />
            {result.gifts.map((g, i) => (
              <p key={i} className="text-[12px]" style={{ color: 'var(--c-success)' }}>🎁 {g.name ?? g.productId}</p>
            ))}
          </>
        )}
      </Card>
    </div>
  )
}

/* -------------------------------------------------------- performance */

function Performance() {
  const ordersState = useSlice('orders')
  const orders = useMemo(() => selectOrders({ orders: ordersState }), [ordersState])
  const analysis = useMemo(() => discountAnalysis(orders), [orders])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Stat label="Discount penetration" value={`${analysis.discountPenetration}%`} raw />
        <Stat label="Total discounted" value={inr(analysis.totalDiscount)} raw tone="warning" />
        <Stat label="AOV with discount" value={inr(analysis.aovDiscounted)} raw />
        <Stat label="AOV full price" value={inr(analysis.aovFullPrice)} raw />
      </div>

      {analysis.aovDiscounted < analysis.aovFullPrice && (
        <Card style={{ borderColor: 'var(--c-warning)' }}>
          <p className="text-[12.5px]" style={{ color: 'var(--c-text)' }}>
            ⚠ Discounted orders have a <strong>lower</strong> average value than full-price ones
            ({inr(analysis.aovDiscounted)} vs {inr(analysis.aovFullPrice)}).
          </p>
          <p className="text-[11.5px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
            That usually means coupons are being used by people who would have bought anyway, rather than
            lifting basket size. Consider minimum-spend conditions.
          </p>
        </Card>
      )}

      <Card>
        <CardHead title="Coupon performance"
          subtitle="ROI is margin returned per rupee discounted. Below 1.0 means the coupon destroys value." />
        <DataTable
          rows={analysis.byCoupon}
          rowKey={(c) => c.code}
          showColumnChooser={false}
          columns={[
            { key: 'code', label: 'Code', render: c => <span className="font-mono font-semibold text-[12px]">{c.code}</span> },
            { key: 'orders', label: 'Orders', align: 'right' },
            { key: 'revenue', label: 'Revenue', align: 'right', render: c => inr(c.revenue) },
            { key: 'discount', label: 'Discounted', align: 'right',
              render: c => <span style={{ color: 'var(--c-warning)' }}>{inr(c.discount)}</span> },
            { key: 'avgDiscount', label: 'Avg/order', align: 'right', render: c => inr(c.avgDiscount) },
            { key: 'profit', label: 'Gross profit', align: 'right',
              render: c => <span style={{ color: c.profit > 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>{inr(c.profit)}</span> },
            { key: 'marginPct', label: 'Margin', align: 'right',
              render: c => <Badge size="sm" tone={c.marginPct >= 25 ? 'success' : c.marginPct >= 10 ? 'warning' : 'danger'}>
                {c.marginPct}%
              </Badge> },
            { key: 'roi', label: 'ROI', align: 'right',
              render: c => <span className="font-semibold tabular-nums"
                style={{ color: c.roi >= 2 ? 'var(--c-success)' : c.roi >= 1 ? 'var(--c-warning)' : 'var(--c-danger)' }}>
                {c.roi}×
              </span> },
          ]}
          initialSort={['discount', 'desc']}
          empty={<Empty icon="％" title="No discounted orders yet" />}
        />
      </Card>
    </div>
  )
}

function Stat({ label, value, tone, raw }) {
  const colour = { success: 'var(--c-success)', warning: 'var(--c-warning)', danger: 'var(--c-danger)' }[tone] || 'var(--c-text)'
  return (
    <div className="t-card p-3">
      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>{label}</p>
      <p className="text-base font-bold tabular-nums mt-0.5" style={{ color: colour }}>
        {raw ? value : Number(value).toLocaleString('en-IN')}
      </p>
    </div>
  )
}

function Row({ label, value, strong }) {
  return (
    <div className="flex justify-between items-baseline gap-3 text-[12px] py-0.5">
      <span style={{ color: 'var(--c-text-muted)' }}>{label}</span>
      <span className={strong ? 'font-semibold tabular-nums text-[14px]' : 'tabular-nums'} style={{ color: 'var(--c-text)' }}>{value}</span>
    </div>
  )
}
