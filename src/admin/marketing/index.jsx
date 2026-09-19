import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSlice } from '../../hooks/useStore.js'
import store from '../../core/store/index.js'
import useToast from '../../hooks/useToast.js'
import { CUSTOMERS, CARTS, STATES } from '../../data/seed.js'
import { selectOrders } from '../../core/store/slices/ordersSlice.js'
import { selectReturns } from '../../core/store/slices/returnsSlice.js'
import { selectCategories } from '../../core/store/slices/catalogueSlice.js'
import { selectAudiences, selectCampaigns, selectFlows } from '../../core/store/slices/marketingSlice.js'
import DataTable from '../../ui/patterns/DataTable.jsx'
import EmptyState from '../../ui/EmptyState.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select, Switch, Slider, Textarea, Label } from '../../ui/primitives/Input.jsx'
import { Badge, Card, CardHead, Tabs, Divider, Progress, Empty, Tooltip, Modal, Drawer, Avatar } from '../../ui/primitives/Display.jsx'
import {
  AUDIENCE_FIELDS, operatorsForField, resolveAudience, describeAudience, customerFacts,
  CHANNELS, estimateCampaign, compareChannels, attribution, cartRecovery,
} from '../../engines/marketing/campaignEngine.js'
import { rfmScores, predictCLV } from '../../engines/orders/customerEngine.js'
import { inr } from '../../lib/analytics.js'

const TABS = [
  { id: 'campaigns', label: 'Campaigns', icon: '◐' },
  { id: 'audiences', label: 'Audiences', icon: '◉' },
  { id: 'flows', label: 'Automations', icon: '⇉' },
  { id: 'attribution', label: 'Attribution', icon: '◲' },
]

export default function Marketing() {
  const [tab, setTab] = useState('campaigns')
  const ordersState = useSlice('orders')
  const returnsState = useSlice('returns')

  const orders = useMemo(() => selectOrders({ orders: ordersState }), [ordersState])
  const returns = useMemo(() => selectReturns({ returns: returnsState }), [returnsState])

  /** One shared enriched customer set — audiences and estimates both read it. */
  const rows = useMemo(() => {
    const byCust = {}
    for (const o of orders) (byCust[o.customerId] = byCust[o.customerId] || []).push(o)
    const returnedIds = new Set(returns.map(r => r.customerId))
    return rfmScores(CUSTOMERS, byCust).map(r => {
      const clv = predictCLV(r)
      const cats = [...new Set((byCust[r.customer.id] || []).flatMap(o => (o.items || []).map(i => i.category)))]
      return { ...r, _extra: { clv: clv.totalValue, churnRisk: clv.risk, hasReturned: returnedIds.has(r.customer.id), categories: cats } }
    })
  }, [orders, returns])

  const factsFor = (row) => customerFacts(row, row._extra ?? {})
  const aov = useMemo(() => {
    const live = orders.filter(o => o.status !== 'Cancelled')
    return live.length ? Math.round(live.reduce((s, o) => s + o.total, 0) / live.length) : 2400
  }, [orders])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Growth</h1>
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          Build live audiences, forecast a campaign before you spend, and see which channel actually earns.
        </p>
      </div>

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'campaigns' && <Campaigns rows={rows} factsFor={factsFor} aov={aov} />}
          {tab === 'audiences' && <Audiences rows={rows} factsFor={factsFor} />}
          {tab === 'flows' && <Flows />}
          {tab === 'attribution' && <Attribution orders={orders} aov={aov} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ---------------------------------------------------------- campaigns */

function Campaigns({ rows, factsFor, aov }) {
  const marketing = useSlice('marketing')
  const { success, error } = useToast()
  const [editing, setEditing] = useState(null)

  const campaigns = marketing.campaigns
  const audiences = marketing.audiences

  const sizeOf = (audienceId) => {
    const aud = audiences.find(a => a.id === audienceId)
    return aud ? resolveAudience(aud, rows, factsFor).length : 0
  }

  const sent = campaigns.filter(c => c.status === 'sent')
  const totalRevenue = sent.reduce((s, c) => s + (c.stats?.revenue ?? 0), 0)
  const totalConverted = sent.reduce((s, c) => s + (c.stats?.converted ?? 0), 0)

  const createCampaign = () => {
    store.dispatch('marketing/createCampaign', { audienceId: audiences[0]?.id })
    const created = store.get('marketing').campaigns[0]
    if (created) setEditing(created.id)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Stat label="Campaigns" value={campaigns.length} />
        <Stat label="Sent" value={sent.length} />
        <Stat label="Orders driven" value={totalConverted} tone="success" />
        <Stat label="Revenue attributed" value={inr(totalRevenue)} raw tone="success" />
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={createCampaign}>+ New campaign</Button>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          icon="◐"
          title="No campaigns yet"
          message="Email, SMS and push campaigns you create will appear here with live audience sizes and revenue attribution."
          actionLabel="Create your first campaign"
          onAction={createCampaign}
        />
      ) : (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {campaigns.map((c, i) => {
          const ch = CHANNELS[c.channel] ?? CHANNELS.email
          const aud = audiences.find(a => a.id === c.audienceId)
          const size = sizeOf(c.audienceId)
          const est = estimateCampaign(c, size, { aov })
          const s = c.stats

          return (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * .05 }}>
              <Card hover className="h-full cursor-pointer" onClick={() => setEditing(c.id)}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[13.5px] truncate" style={{ color: 'var(--c-text)' }}>{c.name}</p>
                    <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
                      {ch.icon} {ch.label} · {aud?.name ?? 'No audience'}
                    </p>
                  </div>
                  <Badge size="sm" tone={c.status === 'sent' ? 'success' : 'neutral'} dot>{c.status}</Badge>
                </div>

                {s ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <Mini label="Delivered" value={s.delivered} />
                      <Mini label="Converted" value={s.converted} />
                      <Mini label="Revenue" value={inr(s.revenue)} small />
                    </div>
                    <Progress value={s.converted} max={Math.max(s.delivered, 1)} height={4} tone="success" />
                    <p className="text-[10.5px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
                      {Math.round((s.converted / Math.max(s.delivered, 1)) * 1000) / 10}% conversion
                      {c.forecast && ` · forecast said ${c.forecast.conversions}`}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <Mini label="Audience" value={size} />
                      <Mini label="Est. orders" value={est.conversions} />
                      <Mini label="Est. ROI" value={`${est.roi}×`} small />
                    </div>
                    <Badge size="sm" tone={est.worthSending ? 'success' : 'danger'}>
                      {est.worthSending ? `+${inr(est.netReturn)} expected` : 'Not worth sending'}
                    </Badge>
                  </>
                )}

                {c.discountPct > 0 && (
                  <Badge size="sm" tone="warning" className="mt-2">{c.discountPct}% off</Badge>
                )}
              </Card>
            </motion.div>
          )
        })}
      </div>
      )}

      <Drawer open={Boolean(editing)} onClose={() => setEditing(null)} title="Campaign" width={620}>
        {editing && <CampaignEditor campaignId={editing} rows={rows} factsFor={factsFor} aov={aov}
          onClose={() => setEditing(null)} />}
      </Drawer>
    </div>
  )
}

function CampaignEditor({ campaignId, rows, factsFor, aov, onClose }) {
  const marketing = useSlice('marketing')
  const { success, error } = useToast()
  const campaign = marketing.campaigns.find(c => c.id === campaignId)
  if (!campaign) return <Empty icon="?" title="Campaign not found" />

  const set = (patch) => store.dispatch('marketing/updateCampaign', { id: campaignId, patch })
  const aud = marketing.audiences.find(a => a.id === campaign.audienceId)
  const size = aud ? resolveAudience(aud, rows, factsFor).length : 0
  const est = estimateCampaign(campaign, size, { aov })
  const comparison = compareChannels(campaign, size, { aov })

  return (
    <div className="space-y-4">
      <Input label="Campaign name" value={campaign.name} onChange={e => set({ name: e.target.value })} />

      <div className="grid grid-cols-2 gap-3">
        <Select label="Audience" value={campaign.audienceId ?? ''}
          onChange={e => set({ audienceId: e.target.value })}
          options={marketing.audiences.map(a => ({ value: a.id, label: a.name }))}
          hint={`${size} customers match right now`} />
        <Select label="Channel" value={campaign.channel} onChange={e => set({ channel: e.target.value })}
          options={Object.values(CHANNELS).map(c => ({ value: c.id, label: c.label }))}
          hint={CHANNELS[campaign.channel]?.note} />
      </div>

      <Slider label="Discount offered" value={campaign.discountPct ?? 0}
        onChange={v => set({ discountPct: v })} min={0} max={50} step={5}
        format={v => v === 0 ? 'No discount' : `${v}% off`} />

      <Input label="Subject / headline" value={campaign.subject ?? ''} onChange={e => set({ subject: e.target.value })} />
      <Textarea label="Message" rows={4} value={campaign.body ?? ''} onChange={e => set({ body: e.target.value })}
        hint="Use {{name}} to personalise" />

      <Divider label="Forecast" />

      <Card style={{ borderColor: est.worthSending ? 'var(--c-success)' : 'var(--c-danger)' }}>
        <p className="text-[12.5px] font-semibold mb-2"
          style={{ color: est.worthSending ? 'var(--c-success)' : 'var(--c-danger)' }}>
          {est.verdict}
        </p>
        <div className="grid grid-cols-2 gap-x-4">
          <Row label="Audience" value={est.audienceSize} />
          <Row label="Will reach" value={est.reach} />
          <Row label="Est. opens" value={est.opens} />
          <Row label="Est. clicks" value={est.clicks} />
          <Row label="Est. orders" value={est.conversions} />
          <Row label="Est. revenue" value={inr(est.revenue)} />
          <Row label="Gross margin" value={inr(est.grossMargin)} />
          <Row label="Send cost" value={inr(est.cost)} />
          <Row label="Cost per order" value={inr(est.costPerAcquisition)} />
          <Row label="Net return" strong
            value={<span style={{ color: est.netReturn > 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
              {inr(est.netReturn)} ({est.roi}×)
            </span>} />
        </div>
      </Card>

      <div>
        <Label>Channel comparison — same audience, same offer</Label>
        <div className="space-y-1.5">
          {comparison.map(c => (
            <button key={c.id} onClick={() => set({ channel: c.id })}
              className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors"
              style={{
                background: c.id === campaign.channel ? 'var(--c-primary-soft)' : 'var(--c-surface-alt)',
              }}>
              <span className="text-[12px] w-20 shrink-0" style={{ color: 'var(--c-text)' }}>
                {c.channel.icon} {c.channel.label}
              </span>
              <span className="text-[11px] flex-1" style={{ color: 'var(--c-text-muted)' }}>
                {c.conversions} orders · {inr(c.cost)} cost
              </span>
              <span className="tabular-nums text-[12px] font-semibold"
                style={{ color: c.netReturn > 0 ? 'var(--c-success)' : 'var(--c-danger)' }}>
                {inr(c.netReturn)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="sm" full
          onClick={() => { store.dispatch('marketing/duplicateCampaign', campaignId); success('Duplicated'); onClose() }}>
          Duplicate
        </Button>
        {campaign.status !== 'sent' && (
          <Button size="sm" full disabled={!est.worthSending && est.audienceSize > 0}
            onClick={() => {
              if (!est.worthSending) { error('This campaign would lose money'); return }
              store.dispatch('marketing/sendCampaign', { id: campaignId, estimate: est })
              success(`Campaign sent to ${est.audienceSize} customers`)
              onClose()
            }}>
            {est.worthSending ? `Send to ${size}` : 'Would lose money'}
          </Button>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- audiences */

function Audiences({ rows, factsFor }) {
  const marketing = useSlice('marketing')
  const { success } = useToast()
  const [editing, setEditing] = useState(null)

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          Audiences are rules, not lists — they re-resolve every time you use them.
        </p>
        <Button size="sm" onClick={() => {
          store.dispatch('marketing/createAudience', {})
          setEditing(store.get('marketing').audiences[0].id)
        }}>+ New audience</Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {marketing.audiences.map((a, i) => {
          const members = resolveAudience(a, rows, factsFor)
          const value = members.reduce((s, m) => s + m.monetary, 0)
          return (
            <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * .05 }}>
              <Card hover className="h-full">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-semibold text-[13.5px]" style={{ color: 'var(--c-text)' }}>{a.name}</p>
                  {a.system && <Badge size="sm">System</Badge>}
                </div>
                <p className="text-[11px] mb-2" style={{ color: 'var(--c-text-muted)' }}>
                  {a.description || describeAudience(a)}
                </p>

                <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--c-primary)' }}>
                  {members.length.toLocaleString('en-IN')}
                </p>
                <p className="text-[11px] mb-2" style={{ color: 'var(--c-text-muted)' }}>
                  customers · {inr(value)} lifetime value
                </p>

                <div className="flex -space-x-1.5 mb-3">
                  {members.slice(0, 5).map(m => <Avatar key={m.customer.id} name={m.customer.name} size={22} ring />)}
                  {members.length > 5 && (
                    <span className="w-[22px] h-[22px] rounded-full grid place-items-center text-[8px] font-semibold"
                      style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}>
                      +{members.length - 5}
                    </span>
                  )}
                </div>

                <div className="flex gap-1.5">
                  <Button size="xs" variant="outline" onClick={() => setEditing(a.id)}>Edit rules</Button>
                  <Button size="xs" variant="ghost"
                    onClick={() => { store.dispatch('marketing/duplicateAudience', a.id); success('Duplicated') }}>
                    Duplicate
                  </Button>
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {editing && <AudienceModal audienceId={editing} rows={rows} factsFor={factsFor} onClose={() => setEditing(null)} />}
    </div>
  )
}

function AudienceModal({ audienceId, rows, factsFor, onClose }) {
  const marketing = useSlice('marketing')
  const catalogueState = useSlice('catalogue')
  const { success } = useToast()
  const aud = marketing.audiences.find(a => a.id === audienceId)
  const categories = useMemo(() => selectCategories({ catalogue: catalogueState }), [catalogueState])
  if (!aud) return null

  const set = (patch) => store.dispatch('marketing/updateAudience', { id: audienceId, patch })
  const members = resolveAudience(aud, rows, factsFor)

  const sourceOptions = {
    segments: [...new Set(rows.map(r => r.segment))],
    states: STATES.map(s => s.state),
    tiers: [1, 2, 3],
    channels: [...new Set(CUSTOMERS.map(c => c.channel))],
    categories: categories.map(c => c.name),
    payments: ['UPI', 'Card', 'COD', 'Netbanking', 'Wallet'],
    risk: ['low', 'medium', 'high'],
    tiers_loyalty: ['Silver', 'Gold', 'Platinum', 'Diamond'],
  }

  const setRule = (i, patch) => set({ rules: aud.rules.map((r, j) => j === i ? { ...r, ...patch } : r) })

  return (
    <Modal open onClose={onClose} title={aud.name} size="lg"
      footer={<>
        {!aud.system && (
          <Button variant="danger" size="sm"
            onClick={() => { store.dispatch('marketing/removeAudience', audienceId); success('Deleted'); onClose() }}>
            Delete
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={() => { success(`${members.length} customers match`); onClose() }}>
          Save ({members.length})
        </Button>
      </>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Name" value={aud.name} onChange={e => set({ name: e.target.value })} />
          <Select label="Match" value={aud.match} onChange={e => set({ match: e.target.value })}
            options={[{ value: 'all', label: 'ALL rules (AND)' }, { value: 'any', label: 'ANY rule (OR)' }]} />
        </div>

        <Input label="Description" value={aud.description ?? ''} onChange={e => set({ description: e.target.value })} />

        <Divider label="Rules" />

        <div className="space-y-2">
          {(aud.rules || []).map((r, i) => {
            const field = AUDIENCE_FIELDS[r.field]
            const opts = field?.source ? sourceOptions[field.source] : null
            return (
              <motion.div key={i} layout className="flex gap-1.5 items-start">
                <select value={r.field} onChange={e => setRule(i, { field: e.target.value, value: '' })}
                  className="t-input px-2 py-1.5 text-[11.5px] flex-1">
                  {Object.entries(AUDIENCE_FIELDS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
                </select>
                <select value={r.op} onChange={e => setRule(i, { op: e.target.value })}
                  className="t-input px-2 py-1.5 text-[11.5px] w-28">
                  {operatorsForField(r.field).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {opts ? (
                  <select value={r.value} onChange={e => setRule(i, { value: e.target.value })}
                    className="t-input px-2 py-1.5 text-[11.5px] flex-1">
                    <option value="">— any —</option>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input value={r.value ?? ''} onChange={e => setRule(i, { value: e.target.value })}
                    type={field?.type === 'number' ? 'number' : 'text'}
                    className="t-input px-2 py-1.5 text-[11.5px] flex-1" placeholder="value" />
                )}
                <button onClick={() => set({ rules: aud.rules.filter((_, j) => j !== i) })}
                  className="px-1 text-[15px]" style={{ color: 'var(--c-danger)' }}>×</button>
              </motion.div>
            )
          })}
          <Button size="xs" variant="outline"
            onClick={() => set({ rules: [...(aud.rules || []), { field: 'total_spend', op: 'gte', value: 5000 }] })}>
            + Add rule
          </Button>
        </div>

        <Divider label={`Preview · ${members.length} customers`} />
        <div className="max-h-48 overflow-y-auto space-y-1">
          {members.slice(0, 30).map(m => (
            <div key={m.customer.id} className="flex items-center gap-2 text-[11.5px] p-1.5 rounded"
              style={{ background: 'var(--c-surface-alt)' }}>
              <Avatar name={m.customer.name} size={20} />
              <span className="flex-1 truncate" style={{ color: 'var(--c-text)' }}>{m.customer.name}</span>
              <Badge size="sm">{m.segment}</Badge>
              <span className="tabular-nums" style={{ color: 'var(--c-text-muted)' }}>{inr(m.monetary)}</span>
            </div>
          ))}
          {!members.length && (
            <p className="text-[12px] text-center py-4" style={{ color: 'var(--c-text-muted)' }}>
              No customers match these rules.
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------- flows */

function Flows() {
  const marketing = useSlice('marketing')
  const { success } = useToast()

  const TRIGGER_LABEL = {
    signup: 'Customer signs up',
    cart_abandoned: 'Cart abandoned',
    order_delivered: 'Order delivered',
    inactive_90d: 'No order for 90 days',
  }

  const totalRevenue = marketing.flows.filter(f => f.active).reduce((s, f) => s + (f.stats?.revenue ?? 0), 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Stat label="Automations" value={marketing.flows.length} />
        <Stat label="Active" value={marketing.flows.filter(f => f.active).length} tone="success" />
        <Stat label="Revenue (active)" value={inr(totalRevenue)} raw tone="success" />
        <Stat label="In flight" value={marketing.flows.filter(f => f.active).reduce((s, f) => s + (f.stats?.entered ?? 0) - (f.stats?.completed ?? 0), 0)} />
      </div>

      <div className="space-y-3">
        {marketing.flows.map((f, i) => (
          <motion.div key={f.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * .05 }}>
            <Card>
              <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[14px]" style={{ color: 'var(--c-text)' }}>{f.name}</p>
                    <Badge size="sm" tone={f.active ? 'success' : 'neutral'} dot>{f.active ? 'Running' : 'Paused'}</Badge>
                  </div>
                  <p className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
                    Trigger: {TRIGGER_LABEL[f.trigger] ?? f.trigger}
                  </p>
                </div>
                <Switch checked={f.active}
                  onChange={() => { store.dispatch('marketing/toggleFlow', f.id); success(f.active ? 'Paused' : 'Activated') }} />
              </div>

              {/* step chain */}
              <div className="flex items-stretch gap-1 overflow-x-auto pb-2">
                {f.steps.map((s, j) => {
                  const ch = CHANNELS[s.channel] ?? CHANNELS.email
                  return (
                    <React.Fragment key={j}>
                      <div className="p-2.5 rounded-lg min-w-[150px] shrink-0"
                        style={{ background: 'var(--c-surface-alt)', opacity: f.active ? 1 : 0.55 }}>
                        <p className="text-[10px] uppercase tracking-wider font-semibold"
                          style={{ color: 'var(--c-text-muted)' }}>
                          {s.delayHours === 0 ? 'Immediately' : s.delayHours < 24 ? `After ${s.delayHours}h` : `After ${Math.round(s.delayHours / 24)}d`}
                        </p>
                        <p className="text-[12px] font-medium mt-0.5" style={{ color: 'var(--c-text)' }}>{s.label}</p>
                        <Badge size="sm" className="mt-1">{ch.icon} {ch.label}</Badge>
                      </div>
                      {j < f.steps.length - 1 && (
                        <div className="flex items-center px-0.5" style={{ color: 'var(--c-text-muted)' }}>→</div>
                      )}
                    </React.Fragment>
                  )
                })}
              </div>

              {f.stats && (
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <Mini label="Entered" value={f.stats.entered.toLocaleString('en-IN')} />
                  <Mini label="Completed" value={f.stats.completed.toLocaleString('en-IN')} />
                  <Mini label="Converted" value={f.stats.converted.toLocaleString('en-IN')} />
                  <Mini label="Revenue" value={inr(f.stats.revenue)} small />
                </div>
              )}
              {f.stats && (
                <p className="text-[11px] mt-2" style={{ color: 'var(--c-text-muted)' }}>
                  {Math.round((f.stats.converted / Math.max(f.stats.entered, 1)) * 1000) / 10}% of entrants convert ·{' '}
                  {inr(Math.round(f.stats.revenue / Math.max(f.stats.entered, 1)))} revenue per entrant
                </p>
              )}
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------- attribution */

function Attribution({ orders, aov }) {
  const marketing = useSlice('marketing')
  const model = marketing.attributionModel
  const data = useMemo(() => attribution(orders, model), [orders, model])
  const recovery = useMemo(() => cartRecovery(CARTS, { aov }), [aov])

  return (
    <div className="space-y-3">
      <Card>
        <CardHead title="Channel attribution"
          subtitle="Which acquisition channel gets credit for revenue. Switch the model to stress-test the story."
          action={
            <Select value={model} onChange={e => store.dispatch('marketing/setAttributionModel', e.target.value)}
              className="!w-auto"
              options={[
                { value: 'last_touch', label: 'Last touch' },
                { value: 'first_touch', label: 'First touch' },
                { value: 'linear', label: 'Linear' },
              ]} />
          } />
        <div className="space-y-2.5">
          {data.map((d, i) => (
            <motion.div key={d.channel} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * .05 }}>
              <div className="flex justify-between text-[12px] mb-1">
                <span style={{ color: 'var(--c-text)' }}>{d.channel}</span>
                <span className="tabular-nums" style={{ color: 'var(--c-text-muted)' }}>
                  {inr(d.revenue)} · {d.sharePct}% · AOV {inr(d.aov)}
                </span>
              </div>
              <Progress value={d.revenue} max={data[0].revenue} height={6} />
            </motion.div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title="Abandoned cart opportunity"
          subtitle="Money already in a cart is the cheapest revenue available." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
          <Stat label="Abandoned carts" value={recovery.abandonedCarts} />
          <Stat label="Cart value" value={inr(recovery.cartValue)} raw />
          <Stat label="Recoverable" value={inr(recovery.recoverableRevenue)} raw tone="success" />
          <Stat label="Expected orders" value={recovery.expectedOrders} tone="success" />
        </div>
        <div className="space-y-1.5">
          {recovery.stages.map((s, i) => {
            const ch = CHANNELS[s.channel]
            return (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--c-surface-alt)' }}>
                <Badge size="sm">{s.at}</Badge>
                <span className="text-[12px]" style={{ color: 'var(--c-text)' }}>{ch?.icon} {ch?.label}</span>
                <span className="text-[11.5px] flex-1" style={{ color: 'var(--c-text-muted)' }}>{s.note}</span>
                <span className="tabular-nums text-[11.5px]" style={{ color: 'var(--c-success)' }}>
                  +{Math.round(s.lift * 100)}%
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <CardHead title="Channel benchmarks" subtitle="What each channel costs and returns in the Indian market." />
        <DataTable
          rows={Object.values(CHANNELS)}
          rowKey={(c) => c.id}
          showColumnChooser={false}
          columns={[
            { key: 'label', label: 'Channel', render: c => <span className="font-medium">{c.icon} {c.label}</span> },
            { key: 'costPerMessage', label: 'Cost/msg', align: 'right', render: c => `₹${c.costPerMessage}` },
            { key: 'deliveryRate', label: 'Delivered', align: 'right', render: c => `${Math.round(c.deliveryRate * 100)}%` },
            { key: 'openRate', label: 'Opened', align: 'right', render: c => `${Math.round(c.openRate * 100)}%` },
            { key: 'conversionRate', label: 'Converts', align: 'right',
              render: c => <span style={{ color: 'var(--c-success)' }}>{(c.conversionRate * 100).toFixed(1)}%</span> },
            { key: 'note', label: 'Note', width: '32%', nowrap: false,
              render: c => <span className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{c.note}</span> },
          ]}
        />
      </Card>
    </div>
  )
}

/* -------------------------------------------------------------- bits */

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

function Mini({ label, value, small }) {
  return (
    <div>
      <p className="text-[9.5px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>{label}</p>
      <p className={small ? 'text-[12px] font-bold tabular-nums' : 'text-[14px] font-bold tabular-nums'}
        style={{ color: 'var(--c-text)' }}>{value}</p>
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
