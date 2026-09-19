import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Card, CardHead, Badge, Btn, Input, Select, Field, Avatar, Drawer, Modal, Tabs, Gauge,
  Progress, Stat, Bars, Donut, Spark, Empty, useSort, Th, cx,
} from '../ui/kit.jsx'
import {
  inr, inrShort, num, dt, ago, customerTimeline, nextBestAction, groupSum,
} from '../lib/analytics.js'
import { CUSTOMERS, ORDERS, CARTS, TICKETS, eventsFor, PRODUCTS, NOW } from '../data/seed.js'

const SEGMENTS = ['All', 'Champion', 'Loyal', 'Potential Loyalist', 'New', 'Promising', 'Needs Attention', 'At Risk', 'Hibernating', 'Lost']
const TIERS = ['All', 'Platinum', 'Gold', 'Silver', 'Bronze']

/* =======================================================================
   LIST
======================================================================= */
export default function Customers({ focusId, clearFocus }) {
  const [q, setQ] = useState('')
  const [seg, setSeg] = useState('All')
  const [tier, setTier] = useState('All')
  const [state, setState] = useState('All')
  const [cityTier, setCityTier] = useState('All')
  const [risk, setRisk] = useState('All')
  const [openId, setOpenId] = useState(focusId || null)
  const [selected, setSelected] = useState([])
  const [bulk, setBulk] = useState(false)

  React.useEffect(() => { if (focusId) setOpenId(focusId) }, [focusId])

  const states = useMemo(() => ['All', ...new Set(CUSTOMERS.map(c => c.state))].sort(), [])

  const rows = useMemo(() => CUSTOMERS.filter(c => {
    if (q) {
      const s = q.toLowerCase()
      if (!(c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s) ||
        c.phone.includes(s) || c.city.toLowerCase().includes(s) || c.id.toLowerCase().includes(s))) return false
    }
    if (seg !== 'All' && c.segment !== seg) return false
    if (tier !== 'All' && c.loyaltyTier !== tier) return false
    if (state !== 'All' && c.state !== state) return false
    if (cityTier !== 'All' && String(c.cityTier) !== cityTier) return false
    if (risk === 'High' && c.churnRisk <= 65) return false
    if (risk === 'Low' && c.churnRisk > 35) return false
    return true
  }), [q, seg, tier, state, cityTier, risk])

  const { sorted, sort, toggle } = useSort(rows, ['spend', 'desc'])
  const active = openId ? CUSTOMERS.find(c => c.id === openId) : null

  const agg = useMemo(() => ({
    count: rows.length,
    spend: rows.reduce((s, c) => s + c.spend, 0),
    clv: rows.reduce((s, c) => s + c.clv, 0),
    aov: rows.length ? rows.reduce((s, c) => s + c.aov, 0) / rows.length : 0,
    risk: rows.filter(c => c.churnRisk > 65).length,
  }), [rows])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Customer Intelligence</h1>
          <p className="text-sm text-slate-500">{num(CUSTOMERS.length)} profiles · every signal tracked</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" size="sm" onClick={() => setBulk(true)} disabled={!selected.length}>
            Bulk action {selected.length ? `(${selected.length})` : ''}
          </Btn>
          <Btn variant="saffron" size="sm">Export CSV</Btn>
        </div>
      </div>

      {/* filter bar */}
      <Card className="p-3">
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <div className="lg:col-span-2">
            <Input placeholder="Search name, email, phone, city, ID…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <Select value={seg} onChange={e => setSeg(e.target.value)}>{SEGMENTS.map(s => <option key={s}>{s}</option>)}</Select>
          <Select value={tier} onChange={e => setTier(e.target.value)}>{TIERS.map(s => <option key={s}>{s}</option>)}</Select>
          <Select value={state} onChange={e => setState(e.target.value)}>{states.map(s => <option key={s}>{s}</option>)}</Select>
          <div className="grid grid-cols-2 gap-2">
            <Select value={cityTier} onChange={e => setCityTier(e.target.value)}>
              {['All', '1', '2', '3'].map(s => <option key={s} value={s}>{s === 'All' ? 'All tiers' : 'Tier ' + s}</option>)}
            </Select>
            <Select value={risk} onChange={e => setRisk(e.target.value)}>
              {['All', 'High', 'Low'].map(s => <option key={s}>{s === 'All' ? 'Any risk' : s + ' risk'}</option>)}
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 pt-3 border-t border-slate-100 text-xs">
          <span className="text-slate-500">Matching <b className="text-slate-800">{num(agg.count)}</b></span>
          <span className="text-slate-500">Revenue <b className="text-slate-800">{inrShort(agg.spend)}</b></span>
          <span className="text-slate-500">Predicted CLV <b className="text-slate-800">{inrShort(agg.clv)}</b></span>
          <span className="text-slate-500">Avg AOV <b className="text-slate-800">{inr(agg.aov)}</b></span>
          <span className="text-slate-500">At risk <b className="text-rose-600">{agg.risk}</b></span>
        </div>
      </Card>

      {/* table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="pl-3 w-8">
                  <input type="checkbox" className="rounded"
                    checked={selected.length === sorted.length && sorted.length > 0}
                    onChange={e => setSelected(e.target.checked ? sorted.map(c => c.id) : [])} />
                </th>
                <Th k="name" sort={sort} toggle={toggle}>Customer</Th>
                <Th k="segment" sort={sort} toggle={toggle}>Segment</Th>
                <Th k="orders" sort={sort} toggle={toggle} align="right">Orders</Th>
                <Th k="spend" sort={sort} toggle={toggle} align="right">Spend</Th>
                <Th k="aov" sort={sort} toggle={toggle} align="right">AOV</Th>
                <Th k="clv" sort={sort} toggle={toggle} align="right">CLV</Th>
                <Th k="recencyDays" sort={sort} toggle={toggle} align="right">Last seen</Th>
                <Th k="churnRisk" sort={sort} toggle={toggle} align="right">Risk</Th>
                <Th k="health" sort={sort} toggle={toggle} align="center">Health</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sorted.slice(0, 60).map(c => (
                <tr key={c.id} onClick={() => setOpenId(c.id)} className="hover:bg-indigo-50/40 cursor-pointer transition">
                  <td className="pl-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="rounded" checked={selected.includes(c.id)}
                      onChange={e => setSelected(s => e.target.checked ? [...s, c.id] : s.filter(x => x !== c.id))} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.name} size={34} />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 text-[13px] truncate flex items-center gap-1.5">
                          {c.name}
                          {c.gstin && <Badge tone="violet">B2B</Badge>}
                          {c.fraudFlags.length > 0 && <span title={c.fraudFlags.join(', ')} className="text-rose-500">⚑</span>}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">{c.city} · T{c.cityTier} · {c.language}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={SEG_TONE[c.segment]}>{c.segment}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{c.orders}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-800">{inrShort(c.spend)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{inr(c.aov)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-indigo-600 font-medium">{inrShort(c.clv)}</td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-slate-500">{ago(c.lastOrderAt)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={cx('tabular-nums font-semibold text-[13px]',
                      c.churnRisk > 65 ? 'text-rose-600' : c.churnRisk > 35 ? 'text-amber-600' : 'text-emerald-600')}>
                      {c.churnRisk}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="w-14 mx-auto"><Progress value={c.health} tone={c.health > 66 ? 'green' : c.health > 33 ? 'amber' : 'red'} /></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sorted.length > 60 && <div className="p-3 text-center text-xs text-slate-400 border-t border-slate-100">Showing 60 of {num(sorted.length)} — refine filters to narrow</div>}
        {!sorted.length && <Empty title="No customers match" sub="Try clearing a filter" />}
      </Card>

      <Drawer open={!!active} onClose={() => { setOpenId(null); clearFocus?.() }}>
        {active && <Customer360 c={active} onClose={() => { setOpenId(null); clearFocus?.() }} />}
      </Drawer>

      <Modal open={bulk} onClose={() => setBulk(false)} title={`Bulk action · ${selected.length} customers`}>
        <div className="p-5 space-y-3">
          {[
            ['Send WhatsApp campaign', 'Vernacular template, 3 languages detected in selection'],
            ['Add to segment', 'Create a static list for retargeting'],
            ['Issue store credit', 'Bulk credit with expiry'],
            ['Export with full profile', '68 columns incl. RFM, CLV, affinity'],
            ['Suppress from marketing', 'Respects DND + consent'],
          ].map(([t, d]) => (
            <button key={t} className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition">
              <p className="text-sm font-medium text-slate-800">{t}</p>
              <p className="text-xs text-slate-500 mt-0.5">{d}</p>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}

const SEG_TONE = {
  Champion: 'green', Loyal: 'green', 'Potential Loyalist': 'blue', New: 'blue',
  Promising: 'blue', 'Needs Attention': 'amber', 'At Risk': 'red',
  Hibernating: 'amber', Lost: 'gray',
}

/* =======================================================================
   CUSTOMER 360
======================================================================= */
function Customer360({ c, onClose }) {
  const [tab, setTab] = useState('Overview')
  const orders = useMemo(() => ORDERS.filter(o => o.customerId === c.id).sort((a, b) => b.placedAt - a.placedAt), [c.id])
  const events = useMemo(() => eventsFor(c.id), [c.id])
  const tickets = useMemo(() => TICKETS.filter(t => t.customerId === c.id), [c.id])
  const carts = useMemo(() => CARTS.filter(x => x.customerId === c.id), [c.id])
  const timeline = useMemo(() => customerTimeline(c.id), [c.id])
  const actions = useMemo(() => nextBestAction(c), [c])

  const monthly = useMemo(() => {
    const out = []
    for (let m = 11; m >= 0; m--) {
      const from = NOW - (m + 1) * 30 * 86400000, to = NOW - m * 30 * 86400000
      out.push(orders.filter(o => o.placedAt >= from && o.placedAt < to).reduce((s, o) => s + o.total, 0))
    }
    return out
  }, [orders])

  return (
    <div>
      {/* header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-4">
            <Avatar name={c.name} size={56} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-slate-900">{c.name}</h2>
                <Badge tone={SEG_TONE[c.segment]}>{c.segment}</Badge>
                <Badge tone={c.loyaltyTier === 'Platinum' ? 'violet' : c.loyaltyTier === 'Gold' ? 'amber' : 'gray'}>{c.loyaltyTier}</Badge>
                {c.gstin && <Badge tone="violet">B2B · GST</Badge>}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {c.id} · {c.city}, {c.state} (Tier {c.cityTier}) · joined {dt(c.joinedAt)} · {c.lifetimeDays}d lifetime
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {c.tags.map(t => <Badge key={t}>{t}</Badge>)}
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none shrink-0">✕</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
            <Stat label="Lifetime spend" value={inr(c.spend)} />
            <Stat label="Orders" value={c.orders} />
            <Stat label="AOV" value={inr(c.aov)} />
            <Stat label="Predicted CLV" value={inr(c.clv)} tone="text-indigo-600" />
            <Stat label="Last order" value={ago(c.lastOrderAt)} />
          </div>
        </div>
        <div className="px-4 sm:px-5">
          <Tabs tabs={['Overview', 'Orders', 'Behaviour', 'Preferences', 'Support', 'Timeline']} active={tab} onChange={setTab} className="pb-2" />
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {tab === 'Overview' && (
          <>
            <div className="grid sm:grid-cols-3 gap-4">
              <Card className="p-4 flex flex-col items-center justify-center">
                <Gauge value={c.churnRisk} label="Churn risk" />
                <p className="text-[11px] text-slate-500 mt-2 text-center">{c.recencyDays}d since last order</p>
              </Card>
              <Card className="p-4 flex flex-col items-center justify-center">
                <Gauge value={c.health} label="Health score" color={c.health > 66 ? '#10B981' : c.health > 33 ? '#F59E0B' : '#EF4444'} />
                <p className="text-[11px] text-slate-500 mt-2 text-center">RFM {c.rfm} · R{c.R} F{c.F} M{c.M}</p>
              </Card>
              <Card className="p-4">
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium mb-2">12-month revenue</p>
                <Spark data={monthly} w={200} h={54} color="#6366F1" />
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Stat label="Order freq" value={c.freqPerMonth + '/mo'} />
                  <Stat label="NPS" value={c.nps ?? '—'} tone={c.nps >= 9 ? 'text-emerald-600' : c.nps <= 6 ? 'text-rose-600' : ''} />
                </div>
              </Card>
            </div>

            {actions.length > 0 && (
              <Card>
                <CardHead title="Next best actions" sub="Generated from this customer's behaviour" />
                <div className="p-4 grid sm:grid-cols-2 gap-3">
                  {actions.map((a, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .06 }}
                      className={cx('rounded-xl p-3 border',
                        a.tone === 'red' ? 'bg-rose-50 border-rose-200' :
                          a.tone === 'green' ? 'bg-emerald-50 border-emerald-200' :
                            a.tone === 'amber' ? 'bg-amber-50 border-amber-200' :
                              a.tone === 'blue' ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200')}>
                      <p className="text-[13px] font-semibold text-slate-800">{a.t}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{a.d}</p>
                      <Btn size="sm" variant="soft" className="mt-2">Run</Btn>
                    </motion.div>
                  ))}
                </div>
              </Card>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <CardHead title="Category affinity" sub="Where the money goes" />
                <div className="p-4">
                  {c.affinity.length
                    ? <Bars data={c.affinity.map(a => ({ key: a.cat, value: a.amt }))} fmt={inrShort} color="#8B5CF6" />
                    : <Empty title="No purchases yet" />}
                </div>
              </Card>

              <Card>
                <CardHead title="Risk & quality signals" />
                <div className="p-4 space-y-3">
                  {[
                    ['Return rate', c.returnRate + '%', c.returnRate > 30 ? 'red' : c.returnRate > 15 ? 'amber' : 'green'],
                    ['COD share', c.codShare + '%', c.codShare > 70 ? 'amber' : 'green'],
                    ['Discount dependency', c.discountDependency + '%', c.discountDependency > 70 ? 'amber' : 'green'],
                    ['Support tickets', c.supportTickets, c.supportTickets > 2 ? 'amber' : 'green'],
                  ].map(([l, v, tone]) => (
                    <div key={l} className="flex items-center justify-between">
                      <span className="text-[13px] text-slate-600">{l}</span>
                      <Badge tone={tone}>{v}</Badge>
                    </div>
                  ))}
                  {c.fraudFlags.length > 0 && (
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-[11px] uppercase tracking-wide text-rose-500 font-semibold mb-1.5">Fraud flags</p>
                      {c.fraudFlags.map(f => <p key={f} className="text-xs text-rose-600">⚑ {f}</p>)}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </>
        )}

        {tab === 'Orders' && (
          <Card>
            <CardHead title={`Order history · ${orders.length}`} sub="Every order, item-level" />
            {orders.length ? (
              <div className="divide-y divide-slate-100">
                {orders.map(o => (
                  <div key={o.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 text-[13px]">{o.id}</span>
                        <Badge tone={ORDER_TONE[o.status] || 'gray'}>{o.status}</Badge>
                        <Badge>{o.paymentMethod}{o.upiApp ? ` · ${o.upiApp}` : ''}</Badge>
                        {o.occasion && <Badge tone="saffron">{o.occasion}</Badge>}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-800">{inr(o.total)}</p>
                        <p className="text-[11px] text-slate-400">{dt(o.placedAt)}</p>
                      </div>
                    </div>
                    <div className="mt-2.5 space-y-1.5">
                      {o.items.map((it, i) => (
                        <div key={i} className="flex items-center gap-2 text-[12px]">
                          <span className="w-3 h-3 rounded-full ring-1 ring-slate-200 shrink-0" style={{ background: it.hex }} />
                          <span className="text-slate-700 truncate flex-1">{it.name}</span>
                          <span className="text-slate-400 shrink-0">{it.size} · ×{it.qty}</span>
                          <span className="text-slate-600 tabular-nums shrink-0 w-16 text-right">{inr(it.price * it.qty)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 pt-2.5 border-t border-slate-50 text-[11px] text-slate-500">
                      <span>Sub {inr(o.subtotal)}</span>
                      {o.discount > 0 && <span className="text-emerald-600">Disc −{inr(o.discount)} {o.couponCode && `(${o.couponCode})`}</span>}
                      <span>GST {inr(o.gst)}</span>
                      <span>Ship {o.shipping ? inr(o.shipping) : 'Free'}</span>
                      <span>{o.courier} · {o.awb}</span>
                      <span>{o.deliveryDays}d delivery</span>
                      {o.rated && <span className="text-amber-600">★ {o.rated}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <Empty title="No orders yet" sub="Customer signed up but never converted" />}
          </Card>
        )}

        {tab === 'Behaviour' && (
          <>
            <div className="grid sm:grid-cols-4 gap-3">
              <Card className="p-4"><Stat label="Events tracked" value={events.length} /></Card>
              <Card className="p-4"><Stat label="Product views" value={events.filter(e => e.type === 'product_view').length} /></Card>
              <Card className="p-4"><Stat label="Cart adds" value={events.filter(e => e.type === 'add_to_cart').length} /></Card>
              <Card className="p-4"><Stat label="Searches" value={events.filter(e => e.type === 'search').length} /></Card>
            </div>

            {carts.length > 0 && (
              <Card>
                <CardHead title="Abandoned carts" />
                <div className="divide-y divide-slate-100">
                  {carts.map(ct => (
                    <div key={ct.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] text-slate-800">{ct.items.map(i => i.name).join(', ')}</p>
                        <p className="text-[11px] text-slate-500">Dropped at <b>{ct.stage}</b> · {ago(ct.updatedAt)} · {ct.remindersSent} reminders sent</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-slate-800">{inr(ct.value)}</p>
                        <Badge tone={ct.recovered ? 'green' : 'amber'}>{ct.recovered ? 'Recovered' : 'Open'}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card>
              <CardHead title="Event stream" sub="Most recent 40 interactions" />
              <div className="divide-y divide-slate-50 max-h-[420px] overflow-y-auto">
                {events.slice(0, 40).map(e => (
                  <div key={e.id} className="px-4 py-2 flex items-center gap-3 text-[12px]">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: EVENT_COLOR[e.type] || '#94A3B8' }} />
                    <span className="font-medium text-slate-700 w-32 shrink-0">{e.type.replace(/_/g, ' ')}</span>
                    <span className="text-slate-500 truncate flex-1">{e.product || e.query || '—'}</span>
                    <span className="text-slate-400 shrink-0">{e.device}</span>
                    <span className="text-slate-400 shrink-0 w-16 text-right">{ago(e.at)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {tab === 'Preferences' && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHead title="Contact & consent" />
              <div className="p-4 space-y-2.5 text-[13px]">
                {[
                  ['Email', c.email], ['Phone', c.phone],
                  ['WhatsApp', c.whatsapp ? 'Active' : 'Not on WhatsApp'],
                  ['Language', c.language], ['Device', c.device],
                  ['Acquisition', c.channel], ['Age band', c.ageBand], ['Gender', c.gender],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between gap-3">
                    <span className="text-slate-500 shrink-0">{l}</span>
                    <span className="text-slate-800 font-medium truncate">{v}</span>
                  </div>
                ))}
                <div className="pt-3 border-t border-slate-100 flex gap-2">
                  <Badge tone={c.emailOptIn ? 'green' : 'gray'}>Email {c.emailOptIn ? '✓' : '✕'}</Badge>
                  <Badge tone={c.smsOptIn ? 'green' : 'gray'}>SMS {c.smsOptIn ? '✓' : '✕'}</Badge>
                  <Badge tone={c.waOptIn ? 'green' : 'gray'}>WhatsApp {c.waOptIn ? '✓' : '✕'}</Badge>
                </div>
              </div>
            </Card>

            <Card>
              <CardHead title="Commerce preferences" />
              <div className="p-4 space-y-2.5 text-[13px]">
                {[
                  ['Preferred payment', c.preferredPayment + (c.preferredPayment === 'UPI' ? ` (${c.upiApp})` : '')],
                  ['Top size', `${c.sizeProfile.top} · ${c.sizeProfile.foot}`],
                  ['Store credit', inr(c.creditBalance)],
                  ['Loyalty points', num(c.points)],
                  ['Birthday', c.birthday],
                  ['Anniversary', c.anniversary || '—'],
                  ['Referrals made', c.referrals],
                  ['Reviews written', c.reviewsWritten],
                  ['Avg delivery', c.avgDeliveryDays ? c.avgDeliveryDays + ' days' : '—'],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between gap-3">
                    <span className="text-slate-500 shrink-0">{l}</span>
                    <span className="text-slate-800 font-medium">{v}</span>
                  </div>
                ))}
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1.5">Shops for occasions</p>
                  <div className="flex flex-wrap gap-1.5">{c.occasions.map(o => <Badge key={o} tone="saffron">{o}</Badge>)}</div>
                </div>
              </div>
            </Card>

            <Card className="sm:col-span-2">
              <CardHead title={`Saved addresses · ${c.addresses.length}`} />
              <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {c.addresses.map(a => (
                  <div key={a.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[13px] font-semibold text-slate-800">{a.label}</span>
                      {a.default && <Badge tone="blue">Default</Badge>}
                    </div>
                    <p className="text-[12px] text-slate-600 leading-relaxed">
                      {a.line1}<br />{a.line2}<br />{a.city}, {a.state} — {a.pincode}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === 'Support' && (
          <Card>
            <CardHead title={`Support history · ${tickets.length}`} />
            {tickets.length ? (
              <div className="divide-y divide-slate-100">
                {tickets.map(t => (
                  <div key={t.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-slate-800">{t.subject}</span>
                        <Badge tone={t.priority === 'Urgent' ? 'red' : t.priority === 'High' ? 'amber' : 'gray'}>{t.priority}</Badge>
                      </div>
                      <Badge tone={t.status === 'Resolved' ? 'green' : t.status === 'Escalated' ? 'red' : 'amber'}>{t.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500">
                      <span>{t.id}</span><span>{t.channel}</span><span>{dt(t.createdAt)}</span>
                      <span>First response {t.firstResponseMins}m</span>
                      {t.csat && <span className="text-amber-600">CSAT {t.csat}/5</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <Empty title="No support tickets" sub="Smooth customer so far" />}
          </Card>
        )}

        {tab === 'Timeline' && (
          <Card>
            <CardHead title="Unified timeline" sub="Orders, tickets, carts and signup in one stream" />
            <div className="p-4">
              <div className="relative pl-6 space-y-4">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
                {timeline.slice(0, 30).map((e, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .03 }} className="relative">
                    <span className={cx('absolute -left-[22px] top-1 w-3.5 h-3.5 rounded-full ring-4 ring-white',
                      e.kind === 'order' ? 'bg-indigo-500' : e.kind === 'ticket' ? 'bg-rose-500' : e.kind === 'cart' ? 'bg-amber-500' : 'bg-emerald-500')} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-800">
                          {e.kind === 'order' && `Order ${e.data.id} · ${e.data.status}`}
                          {e.kind === 'ticket' && `Ticket: ${e.data.subject}`}
                          {e.kind === 'cart' && `Cart abandoned at ${e.data.stage}`}
                          {e.kind === 'signup' && 'Account created'}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {e.kind === 'order' && `${e.data.items.length} items · ${e.data.paymentMethod} · ${inr(e.data.total)}`}
                          {e.kind === 'ticket' && `${e.data.channel} · ${e.data.status}`}
                          {e.kind === 'cart' && `${inr(e.data.value)} · ${e.data.recovered ? 'later recovered' : 'not recovered'}`}
                          {e.kind === 'signup' && `via ${e.data.channel}`}
                        </p>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0">{dt(e.at)}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

const ORDER_TONE = {
  Delivered: 'green', 'In Transit': 'blue', 'Out for Delivery': 'blue',
  Packed: 'gray', Confirmed: 'gray', RTO: 'red', Returned: 'amber', Cancelled: 'gray',
}
const EVENT_COLOR = {
  product_view: '#6366F1', add_to_cart: '#10B981', order_placed: '#059669',
  remove_from_cart: '#F59E0B', wishlist_add: '#EC4899', search: '#06B6D4',
  checkout_start: '#8B5CF6', support_chat: '#EF4444', payment_attempt: '#F97316',
}
