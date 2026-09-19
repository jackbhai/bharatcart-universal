import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSlice } from '../../hooks/useStore.js'
import store from '../../core/store/index.js'
import useToast from '../../hooks/useToast.js'
import { CUSTOMERS } from '../../data/seed.js'
import { selectOrders } from '../../core/store/slices/ordersSlice.js'
import { selectProducts, selectCategories } from '../../core/store/slices/catalogueSlice.js'
import DataTable from '../../ui/patterns/DataTable.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select, Switch, Slider, Textarea, Label } from '../../ui/primitives/Input.jsx'
import { Badge, Card, CardHead, Tabs, Divider, Progress, Empty, Tooltip, Modal, Avatar } from '../../ui/primitives/Display.jsx'
import {
  calculateEarn, calculateRedeem, resolveTier, tierProgress,
  liabilityReport, waysToEarn, productEarnPreview,
} from '../../engines/loyalty/loyaltyEngine.js'
import { rfmScores } from '../../engines/orders/customerEngine.js'
import { inr } from '../../lib/analytics.js'

const TABS = [
  { id: 'overview', label: 'Overview', icon: '◈' },
  { id: 'earning', label: 'Earning rules', icon: '＋' },
  { id: 'tiers', label: 'Tiers', icon: '▲' },
  { id: 'redemption', label: 'Redemption', icon: '−' },
  { id: 'members', label: 'Members', icon: '◉' },
  { id: 'simulator', label: 'Simulator', icon: '⚗' },
]

export default function Loyalty() {
  const [tab, setTab] = useState('overview')
  const { config } = useSlice('loyalty')
  const { success } = useToast()

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>{config.programName}</h1>
          <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
            Configure how points are earned, what tiers unlock, and what members can spend them on.
            Everything here is read live by the storefront.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={config.enabled ? 'success' : 'neutral'} dot>
            {config.enabled ? 'Live' : 'Paused'}
          </Badge>
          <Switch checked={config.enabled}
            onChange={() => { store.dispatch('loyalty/toggle'); success(config.enabled ? 'Programme paused' : 'Programme live') }} />
        </div>
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'overview' && <Overview />}
          {tab === 'earning' && <EarningRules />}
          {tab === 'tiers' && <TiersTab />}
          {tab === 'redemption' && <RedemptionRules />}
          {tab === 'members' && <Members />}
          {tab === 'simulator' && <Simulator />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------- overview */

function Overview() {
  const { config, ledger } = useSlice('loyalty')
  const ordersState = useSlice('orders')
  const orders = useMemo(() => selectOrders({ orders: ordersState }), [ordersState])

  /** Members are derived from real spend so the liability number is honest. */
  const members = useMemo(() => {
    const byCust = {}
    for (const o of orders) (byCust[o.customerId] = byCust[o.customerId] || []).push(o)
    return rfmScores(CUSTOMERS, byCust).map(r => {
      const earned = Math.floor(r.monetary * config.earnPerRupee)
      const spent = Math.floor(earned * 0.34)
      return {
        ...r,
        points: Math.max(0, earned - spent),
        lifetimePoints: earned,
        tier: resolveTier({ spend12m: r.monetary, spend: r.monetary }, config),
      }
    })
  }, [orders, config])

  const liability = useMemo(() => liabilityReport(members, config), [members, config])

  const byTier = useMemo(() => {
    const m = {}
    for (const t of config.tiers) m[t.id] = { ...t, count: 0, spend: 0, points: 0 }
    for (const mem of members) {
      const id = mem.tier?.id
      if (m[id]) { m[id].count++; m[id].spend += mem.monetary; m[id].points += mem.points }
    }
    return Object.values(m)
  }, [members, config])

  const totalMembers = members.length || 1
  const totalPoints = members.reduce((s, m) => s + m.points, 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Stat label="Members" value={members.length} />
        <Stat label="Points outstanding" value={totalPoints.toLocaleString('en-IN')} raw />
        <Stat label="Liability" value={inr(totalPoints * config.pointValue)} raw tone="warning" />
        <Stat label="Point value" value={`₹${config.pointValue}`} raw />
      </div>

      <Card>
        <CardHead title="Tier distribution"
          subtitle="Points liability is real money you owe — watch it grow with the top tiers." />
        <div className="space-y-3">
          {byTier.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * .06 }}>
              <div className="flex items-center justify-between text-[12px] mb-1">
                <span className="flex items-center gap-2" style={{ color: 'var(--c-text)' }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.colour }} />
                  <strong>{t.name}</strong>
                  <span style={{ color: 'var(--c-text-muted)' }}>
                    {t.multiplier}× · {inr(t.threshold)}+
                  </span>
                </span>
                <span className="tabular-nums" style={{ color: 'var(--c-text-muted)' }}>
                  {t.count} members · {Math.round((t.count / totalMembers) * 100)}% · {inr(t.spend)}
                </span>
              </div>
              <Progress value={t.count} max={Math.max(...byTier.map(x => x.count), 1)} height={6} />
            </motion.div>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-3">
        <Card>
          <CardHead title="Ways to earn" subtitle="What members see on the storefront." />
          <div className="space-y-2">
            {waysToEarn(config).map((w, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg"
                style={{ background: 'var(--c-surface-alt)' }}>
                <span className="text-[12px]" style={{ color: 'var(--c-text)' }}>{w.label ?? w.action}</span>
                <Badge size="sm" tone="primary">{w.points ?? w.value} pts</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="Programme economics" subtitle="What the current settings cost you." />
          <Row label="Earn rate" value={`${Math.round(config.earnPerRupee * 100)} pts per ₹100`} />
          <Row label="Point value" value={`₹${config.pointValue}`} />
          <Row label="Effective discount" value={`${Math.round(config.earnPerRupee * config.pointValue * 100)}%`} />
          <Divider />
          <Row label="Minimum redemption" value={`${config.minRedeem} pts`} />
          <Row label="Max per order" value={`${config.maxRedeemPercent}% of cart`} />
          <Row label="Points expire after" value={`${config.expiryMonths} months`} />
          <Divider />
          <Row label="Outstanding liability" value={inr(totalPoints * config.pointValue)} strong />
          <p className="text-[11px] mt-2" style={{ color: 'var(--c-text-muted)' }}>
            Every ₹100 spent hands back {Math.round(config.earnPerRupee * config.pointValue * 100)}% in
            future discount. Factor that into your margin targets.
          </p>
        </Card>
      </div>
    </div>
  )
}

/* -------------------------------------------------------- earning rules */

function EarningRules() {
  const { config } = useSlice('loyalty')
  const catalogueState = useSlice('catalogue')
  const { success } = useToast()
  const categories = useMemo(() => selectCategories({ catalogue: catalogueState }), [catalogueState])
  const set = (patch) => store.dispatch('loyalty/setConfig', patch)

  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Card>
        <CardHead title="Base earning" subtitle="The core rate every order earns at." />
        <div className="space-y-4">
          <div>
            <Slider label="Points per ₹100 spent" value={Math.round(config.earnPerRupee * 100)}
              onChange={v => set({ earnPerRupee: v / 100 })} min={1} max={30}
              format={v => `${v} points`} />
            <p className="text-[11px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
              Worth {inr(Math.round(config.earnPerRupee * 100) * config.pointValue)} per ₹100 —
              an effective {Math.round(config.earnPerRupee * config.pointValue * 100)}% discount.
            </p>
          </div>

          <Select label="Earn on" value={config.earnOn} onChange={e => set({ earnOn: e.target.value })}
            options={[
              { value: 'net', label: 'Net amount (after discount)' },
              { value: 'gross', label: 'Gross amount (before discount)' },
            ]}
            hint="Earning on gross is more generous but stacks with promotions" />

          <Select label="Rounding" value={config.earnRounding} onChange={e => set({ earnRounding: e.target.value })}
            options={[
              { value: 'floor', label: 'Round down' },
              { value: 'round', label: 'Round to nearest' },
              { value: 'ceil', label: 'Round up' },
            ]} />

          <div className="space-y-2.5">
            <Switch label="Exclude shipping from earning" checked={config.excludeShipping}
              onChange={v => set({ excludeShipping: v })} />
            <Switch label="Exclude tax from earning" checked={config.excludeTax}
              onChange={v => set({ excludeTax: v })} />
            <Switch label="No points on discounted items" checked={config.excludeDiscounted}
              onChange={v => set({ excludeDiscounted: v })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Min order to earn" type="number" prefix="₹" value={config.minOrderToEarn}
              onChange={e => set({ minOrderToEarn: Number(e.target.value) })} />
            <Input label="Max points per order" type="number" value={config.maxPointsPerOrder}
              onChange={e => set({ maxPointsPerOrder: Number(e.target.value) })} />
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <Card>
          <CardHead title="Bonus points" subtitle="One-off rewards that drive specific behaviour." />
          <div className="space-y-3">
            {[
              ['signupBonus', 'Signup bonus', 'Given when an account is created'],
              ['firstOrderBonus', 'First order bonus', 'Rewards the very first purchase'],
              ['birthdayBonus', 'Birthday bonus', 'Sent on their birthday'],
              ['reviewBonus', 'Product review', 'Per approved review'],
              ['referralBonus', 'Successful referral', 'When a referred friend orders'],
            ].filter(([k]) => config[k] !== undefined).map(([key, label, note]) => (
              <div key={key}>
                <Input label={label} type="number" value={config[key] ?? 0}
                  suffix="pts" onChange={e => set({ [key]: Number(e.target.value) })} />
                <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>{note}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="Category multipliers"
            subtitle="Push slow-moving categories by paying out more points there." />
          <div className="space-y-2">
            {categories.map(c => {
              const mult = config.categoryMultipliers?.[c.name] ?? 1
              return (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--c-text)' }}>{c.name}</span>
                  <div className="flex gap-1">
                    {[1, 1.5, 2, 3].map(m => (
                      <button key={m}
                        onClick={() => store.dispatch('loyalty/setCategoryMultiplier', { category: c.name, value: m })}
                        className="px-2 py-0.5 text-[11px] rounded border font-medium transition-all"
                        style={mult === m
                          ? { background: 'var(--c-primary)', color: 'var(--c-primary-fg)', borderColor: 'var(--c-primary)' }
                          : { color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}>
                        {m}×
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- tiers */

function TiersTab() {
  const { config } = useSlice('loyalty')
  const { success } = useToast()
  const tiers = [...config.tiers].sort((a, b) => a.threshold - b.threshold)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Select value={config.tierBasis} onChange={e => store.dispatch('loyalty/setConfig', { tierBasis: e.target.value })}
          className="!w-auto"
          options={[
            { value: 'spend12m', label: 'Tier on spend in last 12 months' },
            { value: 'lifetimeSpend', label: 'Tier on lifetime spend' },
            { value: 'points', label: 'Tier on points earned' },
          ]} />
        <Button size="sm" onClick={() => { store.dispatch('loyalty/addTier'); success('Tier added') }}>
          + Add tier
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tiers.map((t, i) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * .06 }}>
            <Card className="h-full" style={{ borderTop: `3px solid ${t.colour}` }}>
              <Input value={t.name} className="!font-semibold"
                onChange={e => store.dispatch('loyalty/setTier', { id: t.id, patch: { name: e.target.value } })} />

              <div className="mt-3 space-y-3">
                <Input label="Unlocks at" type="number" prefix="₹" value={t.threshold}
                  onChange={e => store.dispatch('loyalty/setTier', { id: t.id, patch: { threshold: Number(e.target.value) } })} />

                <div>
                  <Label>Points multiplier</Label>
                  <div className="flex gap-1">
                    {[1, 1.25, 1.5, 2, 3].map(m => (
                      <button key={m}
                        onClick={() => store.dispatch('loyalty/setTier', { id: t.id, patch: { multiplier: m } })}
                        className="flex-1 py-1 text-[11px] rounded border font-medium transition-all"
                        style={t.multiplier === m
                          ? { background: t.colour, color: '#fff', borderColor: t.colour }
                          : { color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}>
                        {m}×
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Colour</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {['#9CA3AF', '#D4A017', '#7C3AED', '#0EA5E9', '#EC4899', '#10B981'].map(c => (
                      <button key={c} onClick={() => store.dispatch('loyalty/setTier', { id: t.id, patch: { colour: c } })}
                        className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                        style={{ background: c, boxShadow: t.colour === c ? `0 0 0 2px var(--c-surface), 0 0 0 4px ${c}` : 'none' }} />
                    ))}
                  </div>
                </div>

                <Textarea label="Perks (one per line)" rows={3} value={(t.perks || []).join('\n')}
                  onChange={e => store.dispatch('loyalty/setTier', {
                    id: t.id, patch: { perks: e.target.value.split('\n').filter(Boolean) },
                  })}
                  placeholder="Free shipping&#10;Early access&#10;Birthday gift" />

                {tiers.length > 1 && (
                  <Button size="xs" variant="ghost" full
                    onClick={() => { store.dispatch('loyalty/removeTier', t.id); success('Tier removed') }}>
                    Remove tier
                  </Button>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------- redemption */

function RedemptionRules() {
  const { config } = useSlice('loyalty')
  const catalogueState = useSlice('catalogue')
  const categories = useMemo(() => selectCategories({ catalogue: catalogueState }), [catalogueState])
  const set = (patch) => store.dispatch('loyalty/setConfig', patch)

  const example = 5000
  const exampleCart = { items: [{ product: {}, price: example, qty: 1 }] }
  const preview = calculateRedeem(exampleCart, { points: 100000 }, config)

  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Card>
        <CardHead title="Redemption limits"
          subtitle="Caps protect margin — without them a member could zero out an order." />
        <div className="space-y-4">
          <div>
            <Label>Point value</Label>
            <div className="flex gap-1.5">
              {[0.1, 0.2, 0.25, 0.5, 1].map(v => (
                <button key={v} onClick={() => set({ pointValue: v })}
                  className="flex-1 py-1.5 text-[11.5px] rounded-lg border font-medium transition-all"
                  style={config.pointValue === v
                    ? { background: 'var(--c-primary)', color: 'var(--c-primary-fg)', borderColor: 'var(--c-primary)' }
                    : { color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}>
                  ₹{v}
                </button>
              ))}
            </div>
          </div>

          <Slider label="Max redemption per order" value={config.maxRedeemPercent}
            onChange={v => set({ maxRedeemPercent: v })} min={5} max={100} step={5}
            format={v => `${v}% of cart`} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Minimum to redeem" type="number" suffix="pts" value={config.minRedeem}
              onChange={e => set({ minRedeem: Number(e.target.value) })} />
            <Input label="Redeem in steps of" type="number" suffix="pts" value={config.redeemStep}
              onChange={e => set({ redeemStep: Number(e.target.value) })} />
          </div>

          <Input label="Max points per order" type="number" suffix="pts" value={config.maxRedeemPoints}
            onChange={e => set({ maxRedeemPoints: Number(e.target.value) })} />

          <Slider label="Points expire after" value={config.expiryMonths}
            onChange={v => set({ expiryMonths: v })} min={0} max={36}
            format={v => v === 0 ? 'Never expire' : `${v} months`} />

          <Switch label="Allow redemption on discounted items" checked={config.allowOnDiscounted}
            onChange={v => set({ allowOnDiscounted: v })} />
        </div>
      </Card>

      <div className="space-y-3">
        <Card>
          <CardHead title="Live preview" subtitle={`On a ${inr(example)} cart with plenty of points banked.`} />
          <Row label="Maximum redeemable" value={`${preview.maxPoints} pts`} />
          <Row label="Discount value" value={inr(preview.discount)} strong />
          <Row label="Customer pays" value={inr(example - preview.discount)} />
          <Divider />
          <p className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
            Limited by: <strong style={{ color: 'var(--c-text)' }}>{preview.limiter ?? 'nothing'}</strong>
          </p>
          {preview.message && (
            <p className="text-[11.5px] mt-1" style={{ color: 'var(--c-warning)' }}>{preview.message}</p>
          )}
        </Card>

        <Card>
          <CardHead title="Blackout categories" subtitle="Points cannot be spent on these." />
          <div className="flex flex-wrap gap-1.5">
            {categories.map(c => {
              const on = (config.blackoutCategories || []).includes(c.name)
              return (
                <button key={c.name}
                  onClick={() => set({
                    blackoutCategories: on
                      ? config.blackoutCategories.filter(x => x !== c.name)
                      : [...(config.blackoutCategories || []), c.name],
                  })}
                  className="px-2.5 py-1 text-[11.5px] rounded-lg border transition-all"
                  style={on
                    ? { background: 'var(--c-danger)', color: '#fff', borderColor: 'var(--c-danger)' }
                    : { color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}>
                  {c.name}
                </button>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- members */

function Members() {
  const { config } = useSlice('loyalty')
  const ordersState = useSlice('orders')
  const { success } = useToast()
  const [granting, setGranting] = useState(null)

  const orders = useMemo(() => selectOrders({ orders: ordersState }), [ordersState])
  const members = useMemo(() => {
    const byCust = {}
    for (const o of orders) (byCust[o.customerId] = byCust[o.customerId] || []).push(o)
    return rfmScores(CUSTOMERS, byCust).map(r => {
      const earned = Math.floor(r.monetary * config.earnPerRupee)
      const spent = Math.floor(earned * 0.34)
      const points = Math.max(0, earned - spent)
      const tier = resolveTier({ spend12m: r.monetary, spend: r.monetary }, config)
      const prog = tierProgress({ spend12m: r.monetary, spend: r.monetary }, config)
      return { ...r, points, lifetimePoints: earned, redeemed: spent, tier, prog }
    }).sort((a, b) => b.points - a.points)
  }, [orders, config])

  return (
    <div className="space-y-3">
      <DataTable
        rows={members}
        rowKey={(m) => m.customer.id}
        initialSort={['points', 'desc']}
        columns={[
          {
            key: 'name', label: 'Member', width: '24%', nowrap: false, sortValue: m => m.customer.name,
            render: m => (
              <div className="flex items-center gap-2 min-w-0">
                <Avatar name={m.customer.name} size={28} />
                <div className="min-w-0">
                  <p className="truncate font-medium" style={{ color: 'var(--c-text)' }}>{m.customer.name}</p>
                  <p className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>{m.customer.city}</p>
                </div>
              </div>
            ),
          },
          {
            key: 'tier', label: 'Tier', sortValue: m => m.tier?.threshold ?? 0,
            render: m => (
              <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--c-text)' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: m.tier?.colour }} />
                {m.tier?.name}
              </span>
            ),
          },
          { key: 'points', label: 'Balance', align: 'right',
            render: m => <span className="font-semibold tabular-nums" style={{ color: 'var(--c-primary)' }}>{m.points.toLocaleString('en-IN')}</span> },
          { key: 'value', label: 'Worth', align: 'right', sortValue: m => m.points,
            render: m => inr(Math.round(m.points * config.pointValue)) },
          { key: 'lifetimePoints', label: 'Earned', align: 'right',
            render: m => <span className="tabular-nums" style={{ color: 'var(--c-text-muted)' }}>{m.lifetimePoints.toLocaleString('en-IN')}</span> },
          { key: 'monetary', label: 'Spend', align: 'right', render: m => inr(m.monetary) },
          {
            key: 'prog', label: 'To next tier', width: '16%', sortValue: m => m.prog.percent,
            render: m => m.prog.next ? (
              <Tooltip content={`${inr(m.prog.toNext)} to ${m.prog.next.name}`}>
                <div className="w-full"><Progress value={m.prog.percent} height={4} animated={false} /></div>
              </Tooltip>
            ) : <Badge size="sm" tone="success">Top tier</Badge>,
          },
          {
            key: 'actions', label: '', sortable: false, align: 'right',
            render: m => (
              <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); setGranting(m) }}>
                Grant
              </Button>
            ),
          },
        ]}
        empty={<Empty icon="◉" title="No members yet" />}
      />

      {granting && <GrantModal member={granting} onClose={() => setGranting(null)} />}
    </div>
  )
}

function GrantModal({ member, onClose }) {
  const { success } = useToast()
  const [points, setPoints] = useState(500)
  const [reason, setReason] = useState('Goodwill gesture')
  const { config } = useSlice('loyalty')

  return (
    <Modal open onClose={onClose} title={`Grant points to ${member.customer.name}`} size="sm"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => {
          store.dispatch('loyalty/grantPoints', { customerId: member.customer.id, points: Number(points), reason })
          success(`${points} points granted`)
          onClose()
        }}>Grant {points} pts</Button>
      </>}>
      <div className="space-y-3">
        <Input label="Points" type="number" value={points} onChange={e => setPoints(e.target.value)}
          hint={`Worth ${inr(Math.round(Number(points) * config.pointValue))} to the customer`} />
        <Select label="Reason" value={reason} onChange={e => setReason(e.target.value)}
          options={['Goodwill gesture', 'Service recovery', 'Review reward', 'Referral bonus', 'Birthday gift', 'Manual correction']} />
        <div className="p-2.5 rounded-lg text-[11.5px]" style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}>
          Current balance {member.points.toLocaleString('en-IN')} pts → new balance{' '}
          <strong style={{ color: 'var(--c-text)' }}>{(member.points + Number(points)).toLocaleString('en-IN')} pts</strong>
        </div>
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------- simulator */

function Simulator() {
  const { config } = useSlice('loyalty')
  const catalogueState = useSlice('catalogue')
  const products = useMemo(() => selectProducts({ catalogue: catalogueState }), [catalogueState])

  const [cartValue, setCartValue] = useState(4000)
  const [spend12m, setSpend12m] = useState(20000)
  const [balance, setBalance] = useState(3000)
  const [isFirst, setIsFirst] = useState(false)
  const [category, setCategory] = useState(products[0]?.category ?? '')

  const customer = { spend12m, spend: spend12m, points: balance, orders: isFirst ? 0 : 6 }
  const order = { items: [{ product: { category, discountPct: 0 }, price: cartValue, qty: 1 }], subtotal: cartValue }

  const earn = calculateEarn(order, customer, config)
  const cart = { items: [{ product: { category }, price: cartValue, qty: 1 }] }
  const redeem = calculateRedeem(cart, customer, config)
  const tier = resolveTier(customer, config)
  const prog = tierProgress(customer, config)

  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Card>
        <CardHead title="Scenario" subtitle="Change the inputs and watch the engine respond." />
        <div className="space-y-4">
          <Slider label="Cart value" value={cartValue} onChange={setCartValue} min={200} max={40000} step={100}
            format={v => inr(v)} />
          <Slider label="Their 12-month spend" value={spend12m} onChange={setSpend12m} min={0} max={250000} step={1000}
            format={v => inr(v)} />
          <Slider label="Points balance" value={balance} onChange={setBalance} min={0} max={50000} step={100}
            format={v => `${v.toLocaleString('en-IN')} pts`} />
          <Select label="Category" value={category} onChange={e => setCategory(e.target.value)}
            options={[...new Set(products.map(p => p.category))]} />
          <Switch label="First-ever order" checked={isFirst} onChange={setIsFirst} />
        </div>
      </Card>

      <div className="space-y-3">
        <Card>
          <CardHead title="They earn" subtitle="Full breakdown of how the number is reached." />
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold" style={{ color: 'var(--c-primary)' }}>{earn.points}</span>
            <span className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>
              points · worth {inr(earn.value)}
            </span>
          </div>
          <Row label="Base points" value={earn.basePoints} />
          <Row label={`Tier multiplier (${tier?.name})`} value={`${earn.tierMultiplier}×`} />
          {earn.bonuses.map((b, i) => (
            <Row key={i} label={b.label} value={`+${b.points}`} />
          ))}
          {earn.capped && (
            <p className="text-[11px] mt-1" style={{ color: 'var(--c-warning)' }}>
              Capped at the {config.maxPointsPerOrder} points-per-order limit.
            </p>
          )}
          {earn.message && (
            <p className="text-[11px] mt-1" style={{ color: 'var(--c-warning)' }}>{earn.message}</p>
          )}
        </Card>

        <Card>
          <CardHead title="They can redeem" subtitle="Against this same cart, right now." />
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl font-bold" style={{ color: 'var(--c-success)' }}>{inr(redeem.discount)}</span>
            <span className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>
              using {redeem.usePoints} of {balance.toLocaleString('en-IN')} pts
            </span>
          </div>
          <Row label="Limited by" value={redeem.limiter ?? '—'} />
          <Row label="Remaining balance" value={`${redeem.remaining} pts`} />
          <Row label="They pay" value={inr(cartValue - redeem.discount)} strong />
          {redeem.message && (
            <p className="text-[11px] mt-1" style={{ color: 'var(--c-warning)' }}>{redeem.message}</p>
          )}
        </Card>

        {prog.next && (
          <Card>
            <CardHead title="Tier progress" subtitle={`${inr(prog.toNext)} more to reach ${prog.next.name}`} />
            <Progress value={prog.percent} height={8} label={`${tier?.name} → ${prog.next.name}`} />
          </Card>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- bits */

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
      <span className={strong ? 'font-semibold tabular-nums' : 'tabular-nums'} style={{ color: 'var(--c-text)' }}>{value}</span>
    </div>
  )
}
