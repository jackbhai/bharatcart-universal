import React, { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Card, CardHead, Badge, Btn, Input, Select, Field, Avatar, Drawer, Modal, Tabs,
  Progress, Stat, Bars, Donut, Kpi, Empty, useSort, Th, cx, AreaChart,
} from '../ui/kit.jsx'
import { inr, inrShort, num, dt, ago, productPerf, groupSum, kpis, revenueSeries } from '../lib/analytics.js'
import { ORDERS, PRODUCTS, CUSTOMERS, COUPONS, TICKETS, CARTS, STATES, CATEGORIES, NOW } from '../data/seed.js'

const ORDER_TONE = {
  Delivered: 'green', 'In Transit': 'blue', 'Out for Delivery': 'blue',
  Packed: 'gray', Confirmed: 'gray', RTO: 'red', Returned: 'amber', Cancelled: 'gray',
}
const STATUSES = ['All', 'Confirmed', 'Packed', 'Out for Delivery', 'In Transit', 'Delivered', 'RTO', 'Returned', 'Cancelled']

/* ============================================================ ORDERS */
export function Orders() {
  const [q, setQ] = useState('')
  const [st, setSt] = useState('All')
  const [pay, setPay] = useState('All')
  const [open, setOpen] = useState(null)

  const rows = useMemo(() => ORDERS.filter(o => {
    if (st !== 'All' && o.status !== st) return false
    if (pay !== 'All' && o.paymentMethod !== pay) return false
    if (q) {
      const c = CUSTOMERS.find(x => x.id === o.customerId)
      const s = q.toLowerCase()
      if (!(o.id.toLowerCase().includes(s) || o.awb.toLowerCase().includes(s) || c?.name.toLowerCase().includes(s))) return false
    }
    return true
  }).sort((a, b) => b.placedAt - a.placedAt), [q, st, pay])

  const pays = ['All', ...new Set(ORDERS.map(o => o.paymentMethod))]
  const k = useMemo(() => {
    const rev = rows.filter(o => !['Cancelled', 'RTO', 'Returned'].includes(o.status)).reduce((s, o) => s + o.total, 0)
    return { rev, n: rows.length, rto: rows.filter(o => o.status === 'RTO').length, cod: rows.filter(o => o.paymentMethod === 'COD').length }
  }, [rows])

  const o = open ? ORDERS.find(x => x.id === open) : null
  const cust = o ? CUSTOMERS.find(c => c.id === o.customerId) : null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Orders</h1>
        <p className="text-sm text-slate-500">{num(ORDERS.length)} lifetime orders · GST-compliant invoicing</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Filtered revenue" value={inrShort(k.rev)} tone="saffron" />
        <Kpi label="Orders" value={num(k.n)} tone="blue" />
        <Kpi label="RTO" value={num(k.rto)} sub={k.n ? ((k.rto / k.n) * 100).toFixed(1) + '%' : ''} tone="violet" />
        <Kpi label="COD orders" value={num(k.cod)} sub={k.n ? ((k.cod / k.n) * 100).toFixed(0) + '% of mix' : ''} tone="green" />
      </div>

      <Card className="p-3">
        <div className="grid sm:grid-cols-3 gap-2">
          <Input placeholder="Search order ID, AWB, customer…" value={q} onChange={e => setQ(e.target.value)} />
          <Select value={st} onChange={e => setSt(e.target.value)}>{STATUSES.map(s => <option key={s}>{s}</option>)}</Select>
          <Select value={pay} onChange={e => setPay(e.target.value)}>{pays.map(s => <option key={s}>{s}</option>)}</Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[780px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <Th>Order</Th><Th>Customer</Th><Th>Items</Th><Th>Payment</Th><Th align="right">Total</Th><Th>Status</Th><Th>Courier</Th><Th align="right">Placed</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.slice(0, 50).map(o => {
                const c = CUSTOMERS.find(x => x.id === o.customerId)
                return (
                  <tr key={o.id} onClick={() => setOpen(o.id)} className="hover:bg-indigo-50/40 cursor-pointer">
                    <td className="px-3 py-2.5 font-medium text-slate-800 text-[13px]">{o.id}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar name={c?.name || '?'} size={26} />
                        <div className="min-w-0">
                          <p className="text-[12px] text-slate-700 truncate">{c?.name}</p>
                          <p className="text-[10px] text-slate-400">{c?.city}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-slate-500">{o.items.length}</td>
                    <td className="px-3 py-2.5"><Badge tone={o.paymentMethod === 'COD' ? 'amber' : 'green'}>{o.paymentMethod}</Badge></td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-800">{inr(o.total)}</td>
                    <td className="px-3 py-2.5"><Badge tone={ORDER_TONE[o.status]}>{o.status}</Badge></td>
                    <td className="px-3 py-2.5 text-[12px] text-slate-500">{o.courier}</td>
                    <td className="px-3 py-2.5 text-right text-[11px] text-slate-400">{dt(o.placedAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {rows.length > 50 && <div className="p-3 text-center text-xs text-slate-400 border-t">Showing 50 of {num(rows.length)}</div>}
      </Card>

      <Drawer open={!!o} onClose={() => setOpen(null)} width="max-w-2xl">
        {o && (
          <div>
            <div className="sticky top-0 bg-white/90 backdrop-blur border-b border-slate-200 p-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-900">{o.id}</h2>
                  <Badge tone={ORDER_TONE[o.status]}>{o.status}</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">{dt(o.placedAt)} · {o.courier} · {o.awb}</p>
              </div>
              <button onClick={() => setOpen(null)} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <Card className="p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2">Fulfilment progress</p>
                <div className="flex items-center gap-1">
                  {['Confirmed', 'Packed', 'Out for Delivery', 'In Transit', 'Delivered'].map((s, i, arr) => {
                    const cur = arr.indexOf(o.status)
                    const done = cur >= i && cur !== -1
                    return (
                      <React.Fragment key={s}>
                        <div className="flex flex-col items-center gap-1 flex-1">
                          <div className={cx('w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold',
                            done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400')}>{done ? '✓' : i + 1}</div>
                          <span className="text-[9px] text-slate-500 text-center leading-tight">{s}</span>
                        </div>
                        {i < arr.length - 1 && <div className={cx('h-0.5 flex-1 -mt-4', done ? 'bg-emerald-500' : 'bg-slate-200')} />}
                      </React.Fragment>
                    )
                  })}
                </div>
              </Card>

              <Card>
                <CardHead title="Items" />
                <div className="divide-y divide-slate-50">
                  {o.items.map((it, i) => (
                    <div key={i} className="p-3 flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg ring-1 ring-slate-200 shrink-0" style={{ background: it.hex }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-slate-800 truncate">{it.name}</p>
                        <p className="text-[11px] text-slate-400">{it.sku} · {it.size} · {it.color} · GST {it.gst}%</p>
                      </div>
                      <span className="text-[12px] text-slate-500 shrink-0">×{it.qty}</span>
                      <span className="text-[13px] font-semibold text-slate-800 shrink-0 w-20 text-right">{inr(it.price * it.qty)}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid sm:grid-cols-2 gap-4">
                <Card>
                  <CardHead title="Invoice breakdown" sub="GST-compliant" />
                  <div className="p-4 space-y-1.5 text-[13px]">
                    {[
                      ['Subtotal', inr(o.subtotal)],
                      ...(o.discount ? [[`Discount ${o.couponCode ? `(${o.couponCode})` : ''}`, '−' + inr(o.discount)]] : []),
                      ...(o.cgst ? [['CGST', inr(o.cgst)], ['SGST', inr(o.sgst)]] : [['IGST', inr(o.igst)]]),
                      ['Shipping', o.shipping ? inr(o.shipping) : 'Free'],
                      ...(o.codFee ? [['COD fee', inr(o.codFee)]] : []),
                    ].map(([l, v]) => (
                      <div key={l} className="flex justify-between"><span className="text-slate-500">{l}</span><span className="text-slate-800">{v}</span></div>
                    ))}
                    <div className="flex justify-between pt-2 mt-2 border-t border-slate-100 font-semibold">
                      <span className="text-slate-700">Total</span><span className="text-slate-900">{inr(o.total)}</span>
                    </div>
                    <Badge tone={o.paid ? 'green' : 'amber'} className="mt-2">{o.paid ? 'Paid' : 'Payment pending'}</Badge>
                  </div>
                </Card>

                <Card>
                  <CardHead title="Shipping address" />
                  <div className="p-4 text-[13px] text-slate-600 leading-relaxed">
                    <p className="font-semibold text-slate-800">{cust?.name}</p>
                    <p>{o.address?.line1}</p>
                    <p>{o.address?.line2}</p>
                    <p>{o.address?.city}, {o.address?.state} — {o.address?.pincode}</p>
                    <p className="mt-2 text-slate-500">{cust?.phone}</p>
                    <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
                      <Btn size="sm" variant="soft">Print invoice</Btn>
                      <Btn size="sm" variant="soft">Track</Btn>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

/* ============================================================ CATALOGUE */
export function Catalogue() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [stock, setStock] = useState('All')
  const [open, setOpen] = useState(null)
  const perf = useMemo(() => productPerf(), [])

  const rows = useMemo(() => perf.filter(p => {
    if (cat !== 'All' && p.category !== cat) return false
    if (stock === 'Low' && p.stock >= 15) return false
    if (stock === 'Out' && p.stock > 0) return false
    if (q && !p.name.toLowerCase().includes(q.toLowerCase()) && !p.brand.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [perf, q, cat, stock])

  const p = open ? perf.find(x => x.id === open) : null
  const cats = ['All', ...CATEGORIES.map(c => c.cat)]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Catalogue</h1>
          <p className="text-sm text-slate-500">{num(PRODUCTS.length)} products · {num(PRODUCTS.reduce((s, p) => s + p.variants.length, 0))} variants · HSN + GST mapped</p>
        </div>
        <Btn variant="saffron" size="sm">+ Add product</Btn>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Active SKUs" value={num(PRODUCTS.filter(p => p.status === 'active').length)} tone="blue" />
        <Kpi label="Inventory value" value={inrShort(PRODUCTS.reduce((s, p) => s + p.stock * p.price, 0))} tone="saffron" />
        <Kpi label="Low stock" value={num(PRODUCTS.filter(p => p.stock < 15).length)} tone="violet" />
        <Kpi label="GI-tagged" value={num(PRODUCTS.filter(p => p.gi).length)} sub="handloom certified" tone="green" />
      </div>

      <Card className="p-3">
        <div className="grid sm:grid-cols-3 gap-2">
          <Input placeholder="Search product or brand…" value={q} onChange={e => setQ(e.target.value)} />
          <Select value={cat} onChange={e => setCat(e.target.value)}>{cats.map(c => <option key={c}>{c}</option>)}</Select>
          <Select value={stock} onChange={e => setStock(e.target.value)}>{['All', 'Low', 'Out'].map(s => <option key={s}>{s === 'All' ? 'All stock' : s + ' stock'}</option>)}</Select>
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {rows.slice(0, 24).map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .02 }}>
            <Card className="overflow-hidden hover:shadow-lift transition cursor-pointer h-full flex flex-col" onClick={() => setOpen(p.id)}>
              <div className="h-28 relative" style={{ background: `linear-gradient(135deg, ${p.variants[0]?.hex || '#E2E8F0'}, ${p.variants[Math.min(1, p.variants.length - 1)]?.hex || '#CBD5E1'})` }}>
                <div className="absolute top-2 left-2 flex gap-1">
                  {p.gi && <Badge tone="violet">GI</Badge>}
                  {p.handmade && <Badge tone="saffron">Handmade</Badge>}
                </div>
                {p.stock < 15 && <div className="absolute top-2 right-2"><Badge tone={p.stock === 0 ? 'red' : 'amber'}>{p.stock === 0 ? 'Out' : p.stock + ' left'}</Badge></div>}
              </div>
              <div className="p-3 flex-1 flex flex-col">
                <p className="text-[13px] font-medium text-slate-800 line-clamp-2 leading-snug">{p.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{p.brand} · {p.origin}</p>
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="font-semibold text-slate-900">{inr(p.price)}</span>
                  <span className="text-[11px] text-slate-400 line-through">{inr(p.mrp)}</span>
                  <span className="text-[11px] text-emerald-600 font-medium">{p.discountPct}% off</span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50 text-[11px] text-slate-500">
                  <span>★ {p.rating} ({num(p.reviews)})</span>
                  <span className="font-medium text-slate-700">{inrShort(p.revenue)}</span>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
      {rows.length > 24 && <p className="text-center text-xs text-slate-400">Showing 24 of {num(rows.length)}</p>}

      <Drawer open={!!p} onClose={() => setOpen(null)} width="max-w-2xl">
        {p && (
          <div>
            <div className="h-36" style={{ background: `linear-gradient(135deg, ${p.variants[0]?.hex}, ${p.variants[p.variants.length - 1]?.hex})` }} />
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{p.name}</h2>
                  <p className="text-sm text-slate-500">{p.brand} · {p.category} › {p.subCategory}</p>
                </div>
                <button onClick={() => setOpen(null)} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Price" value={inr(p.price)} />
                <Stat label="Revenue" value={inrShort(p.revenue)} />
                <Stat label="Units sold" value={num(p.units)} />
                <Stat label="Stock" value={num(p.stock)} tone={p.stock < 15 ? 'text-amber-600' : ''} />
              </div>

              <Card>
                <CardHead title="Provenance & compliance" sub="India-specific attributes" />
                <div className="p-4 grid sm:grid-cols-2 gap-y-2 gap-x-4 text-[13px]">
                  {[
                    ['Fabric', p.fabric], ['Craft', p.craft], ['Origin cluster', p.origin],
                    ['HSN code', p.hsn], ['GST slab', p.gst + '%'], ['Weight', p.weightG + 'g'],
                    ['GI tagged', p.gi ? 'Yes' : 'No'], ['Handmade', p.handmade ? 'Yes' : 'No'],
                    ['COD eligible', p.codEligible ? 'Yes' : 'No'], ['Return rate', p.returnRate + '%'],
                  ].map(([l, v]) => (
                    <div key={l} className="flex justify-between border-b border-slate-50 pb-1">
                      <span className="text-slate-500">{l}</span><span className="text-slate-800 font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHead title={`Variants · ${p.variants.length}`} sub="SKU-level inventory" />
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead className="bg-slate-50"><tr>
                      <th className="px-3 py-2 text-left text-slate-500 font-medium">SKU</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-medium">Size</th>
                      <th className="px-3 py-2 text-left text-slate-500 font-medium">Colour</th>
                      <th className="px-3 py-2 text-right text-slate-500 font-medium">Stock</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {p.variants.slice(0, 12).map(v => (
                        <tr key={v.sku}>
                          <td className="px-3 py-1.5 font-mono text-[10px] text-slate-500">{v.sku}</td>
                          <td className="px-3 py-1.5 text-slate-700">{v.size}</td>
                          <td className="px-3 py-1.5"><span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full ring-1 ring-slate-200" style={{ background: v.hex }} />{v.color}</span></td>
                          <td className={cx('px-3 py-1.5 text-right font-medium', v.stock === 0 ? 'text-rose-600' : v.stock < 5 ? 'text-amber-600' : 'text-slate-700')}>{v.stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

/* ============================================================ MARKETING */
export function Marketing() {
  const [tab, setTab] = useState('Coupons')
  const openCarts = CARTS.filter(c => !c.recovered)
  const segs = groupSum(CUSTOMERS, c => c.segment)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Growth & Marketing</h1>
        <p className="text-sm text-slate-500">Campaigns, coupons, recovery and loyalty</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Coupon revenue" value={inrShort(COUPONS.reduce((s, c) => s + c.revenue, 0))} tone="saffron" />
        <Kpi label="Active coupons" value={COUPONS.filter(c => c.status === 'Active').length} tone="blue" />
        <Kpi label="Recoverable carts" value={inrShort(openCarts.reduce((s, c) => s + c.value, 0))} sub={openCarts.length + ' carts'} tone="violet" />
        <Kpi label="Loyalty members" value={num(CUSTOMERS.filter(c => c.loyaltyTier !== 'Bronze').length)} tone="green" />
      </div>

      <Tabs tabs={['Coupons', 'Abandoned carts', 'Segments', 'Loyalty']} active={tab} onChange={setTab} />

      {tab === 'Coupons' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-100"><tr>
                <Th>Code</Th><Th>Discount</Th><Th align="right">Min order</Th><Th align="right">Uses</Th><Th align="right">Revenue</Th><Th>Status</Th><Th align="right">Expires</Th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {COUPONS.map(c => (
                  <tr key={c.code} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5"><span className="font-mono text-[12px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{c.code}</span></td>
                    <td className="px-3 py-2.5 text-slate-700">{c.type === '%' ? c.value + '%' : inr(c.value)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{c.minOrder ? inr(c.minOrder) : '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{num(c.uses)}{c.cap ? <span className="text-slate-400">/{num(c.cap)}</span> : ''}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{inrShort(c.revenue)}</td>
                    <td className="px-3 py-2.5"><Badge tone={c.status === 'Active' ? 'green' : c.status === 'Paused' ? 'amber' : 'gray'}>{c.status}</Badge></td>
                    <td className="px-3 py-2.5 text-right text-[11px] text-slate-400">{dt(c.expiry)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'Abandoned carts' && (
        <Card className="overflow-hidden">
          <CardHead title={`${openCarts.length} open carts`} sub="Sorted by value — highest recovery potential first" />
          <div className="divide-y divide-slate-50">
            {openCarts.sort((a, b) => b.value - a.value).slice(0, 20).map(ct => {
              const c = CUSTOMERS.find(x => x.id === ct.customerId)
              return (
                <div key={ct.id} className="p-3 flex items-center gap-3">
                  <Avatar name={c?.name || '?'} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-slate-800 truncate">{c?.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{ct.items.map(i => i.name).join(', ')}</p>
                  </div>
                  <Badge tone={ct.stage === 'payment' ? 'red' : ct.stage === 'address' ? 'amber' : 'gray'}>{ct.stage}</Badge>
                  <span className="text-[13px] font-semibold text-slate-800 w-20 text-right shrink-0">{inr(ct.value)}</span>
                  <Btn size="sm" variant="soft" className="shrink-0 hidden sm:block">Nudge</Btn>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {tab === 'Segments' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card><CardHead title="Segment sizes" /><div className="p-4"><Bars data={segs} color="#6366F1" /></div></Card>
          <Card>
            <CardHead title="Segment value" sub="Total predicted CLV per segment" />
            <div className="p-4">
              <Bars data={groupSum(CUSTOMERS, c => c.segment, c => c.clv)} fmt={inrShort} color="#10B981" />
            </div>
          </Card>
          <Card className="lg:col-span-2">
            <CardHead title="Suggested campaigns" sub="Auto-generated from segment behaviour" />
            <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                ['Champions', 'Festive early access', 'Invite top 8% to a 24h pre-sale before Diwali drop', 'green'],
                ['At Risk', 'Win-back ladder', '3-step WhatsApp: reminder → 10% → 20% with urgency', 'red'],
                ['Tier-3 buyers', 'COD-to-prepaid nudge', '₹50 instant discount on UPI to cut RTO', 'amber'],
                ['New', 'Second-order push', 'Trigger at day 14 with category cross-sell', 'blue'],
                ['Hibernating', 'Vernacular re-engage', 'Hindi/Tamil creative — 34% of base is non-English', 'violet'],
                ['High CLV', 'Concierge styling', 'Personal shopper on WhatsApp for Platinum tier', 'saffron'],
              ].map(([seg, title, desc, tone]) => (
                <div key={title} className="rounded-xl border border-slate-200 p-3 hover:border-indigo-300 transition">
                  <Badge tone={tone}>{seg}</Badge>
                  <p className="text-[13px] font-semibold text-slate-800 mt-2">{title}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>
                  <Btn size="sm" variant="soft" className="mt-2.5 w-full">Launch</Btn>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'Loyalty' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {['Platinum', 'Gold', 'Silver', 'Bronze'].map(t => {
            const m = CUSTOMERS.filter(c => c.loyaltyTier === t)
            const tone = t === 'Platinum' ? 'violet' : t === 'Gold' ? 'amber' : t === 'Silver' ? 'blue' : 'gray'
            return (
              <Card key={t} className="p-4">
                <Badge tone={tone}>{t}</Badge>
                <p className="text-2xl font-semibold text-slate-900 mt-2">{num(m.length)}</p>
                <p className="text-xs text-slate-500">members</p>
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                  <Stat label="Total spend" value={inrShort(m.reduce((s, c) => s + c.spend, 0))} />
                  <Stat label="Avg AOV" value={inr(m.length ? m.reduce((s, c) => s + c.aov, 0) / m.length : 0)} />
                  <Stat label="Points issued" value={num(m.reduce((s, c) => s + c.points, 0))} />
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ============================================================ OPERATIONS */
export function Operations() {
  const [tab, setTab] = useState('Logistics')
  const byCourier = groupSum(ORDERS, o => o.courier)
  const rtoByState = useMemo(() => {
    const m = new Map()
    for (const o of ORDERS) {
      const c = CUSTOMERS.find(x => x.id === o.customerId)
      if (!c) continue
      const cur = m.get(c.state) || { total: 0, rto: 0 }
      cur.total++; if (o.status === 'RTO') cur.rto++
      m.set(c.state, cur)
    }
    return [...m.entries()].map(([k, v]) => ({ key: k, value: v.total ? Math.round((v.rto / v.total) * 100) : 0, n: v.total }))
      .filter(x => x.n > 15).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [])
  const open = TICKETS.filter(t => t.status !== 'Resolved')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Operations</h1>
        <p className="text-sm text-slate-500">Logistics, returns, support and GST</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Avg delivery" value={(ORDERS.reduce((s, o) => s + o.deliveryDays, 0) / ORDERS.length).toFixed(1) + ' days'} tone="blue" />
        <Kpi label="RTO orders" value={num(ORDERS.filter(o => o.status === 'RTO').length)} tone="saffron" />
        <Kpi label="Open tickets" value={num(open.length)} sub={open.filter(t => t.priority === 'Urgent').length + ' urgent'} tone="violet" />
        <Kpi label="GST collected" value={inrShort(ORDERS.reduce((s, o) => s + o.gst, 0))} tone="green" />
      </div>

      <Tabs tabs={['Logistics', 'Returns & RTO', 'Support', 'Tax & GST']} active={tab} onChange={setTab} />

      {tab === 'Logistics' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card><CardHead title="Orders by courier" /><div className="p-4"><Bars data={byCourier} color="#06B6D4" /></div></Card>
          <Card>
            <CardHead title="Delivery speed by zone" sub="Average days from dispatch" />
            <div className="p-4">
              <Bars data={groupSum(ORDERS, o => {
                const c = CUSTOMERS.find(x => x.id === o.customerId); return c?.zone
              }, o => o.deliveryDays).map(z => {
                const n = ORDERS.filter(o => {
                  const c = CUSTOMERS.find(x => x.id === o.customerId); return c?.zone === z.key
                }).length
                return { key: z.key, value: Math.round(z.value / Math.max(n, 1) * 10) / 10 }
              })} fmt={v => v + 'd'} color="#F59E0B" />
            </div>
          </Card>
        </div>
      )}

      {tab === 'Returns & RTO' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHead title="RTO rate by state" sub="Highest risk pincodes — consider COD limits" />
            <div className="p-4"><Bars data={rtoByState} fmt={v => v + '%'} color="#EF4444" /></div>
          </Card>
          <Card>
            <CardHead title="Return reasons" sub="Top drivers of reverse logistics" />
            <div className="p-4">
              <Bars data={[
                { key: 'Size / fit issue', value: 34 }, { key: 'Colour mismatch', value: 21 },
                { key: 'Quality below expectation', value: 16 }, { key: 'Damaged in transit', value: 12 },
                { key: 'Changed mind', value: 10 }, { key: 'Late delivery', value: 7 },
              ]} fmt={v => v + '%'} color="#F97316" />
            </div>
          </Card>
        </div>
      )}

      {tab === 'Support' && (
        <Card className="overflow-hidden">
          <CardHead title={`Open tickets · ${open.length}`} />
          <div className="divide-y divide-slate-50">
            {open.slice(0, 20).map(t => {
              const c = CUSTOMERS.find(x => x.id === t.customerId)
              return (
                <div key={t.id} className="p-3 flex items-center gap-3">
                  <Avatar name={c?.name || '?'} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-slate-800 truncate">{t.subject}</p>
                    <p className="text-[11px] text-slate-500">{c?.name} · {t.channel} · {ago(t.createdAt)}</p>
                  </div>
                  <Badge tone={t.priority === 'Urgent' ? 'red' : t.priority === 'High' ? 'amber' : 'gray'}>{t.priority}</Badge>
                  <Badge tone={t.status === 'Escalated' ? 'red' : 'amber'}>{t.status}</Badge>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {tab === 'Tax & GST' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHead title="GST by slab" sub="Output tax liability" />
            <div className="p-4">
              <Bars data={[3, 5, 12, 18].map(slab => ({
                key: slab + '% slab',
                value: ORDERS.reduce((s, o) => s + o.items.filter(i => i.gst === slab).reduce((a, i) => a + (i.price * i.qty * slab) / 100, 0), 0)
              }))} fmt={inrShort} color="#8B5CF6" />
            </div>
          </Card>
          <Card>
            <CardHead title="Intra vs inter-state" sub="CGST+SGST vs IGST split" />
            <div className="p-4">
              <Donut data={[
                { key: 'CGST + SGST (intra)', value: ORDERS.reduce((s, o) => s + o.cgst + o.sgst, 0) },
                { key: 'IGST (inter-state)', value: ORDERS.reduce((s, o) => s + o.igst, 0) },
              ]} />
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                <Stat label="B2B customers" value={num(CUSTOMERS.filter(c => c.gstin).length)} />
                <Stat label="Total GST" value={inrShort(ORDERS.reduce((s, o) => s + o.gst, 0))} />
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
