import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import DataTable from '../../ui/patterns/DataTable.jsx'
import EmptyState from '../../ui/EmptyState.jsx'
import KpiRow from '../../ui/patterns/KpiRow.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select } from '../../ui/primitives/Input.jsx'
import { Badge, Card, CardHead, Tabs, Progress, Empty, Drawer, Divider } from '../../ui/primitives/Display.jsx'
import {
  vendorKpis, vendorScorecard, poPipeline, overduePos,
  payablesAgeing, spendByVendor, concentrationRisk,
} from '../../engines/vendors/vendorEngine.js'
import { VENDORS, PURCHASE_ORDERS, PO_STATUS } from '../../data/vendorSeed.js'
import { inr, inrShort } from '../../lib/analytics.js'

const TABS = [
  { id: 'directory', label: 'Directory', icon: '⌂' },
  { id: 'scorecard', label: 'Scorecard', icon: '★' },
  { id: 'orders', label: 'Purchase orders', icon: '▤' },
  { id: 'payables', label: 'Payables', icon: '₹' },
  { id: 'spend', label: 'Spend analysis', icon: '◴' },
]

const day = (ts) => new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })

const STATUS_TONE = {
  Active: 'success', 'On hold': 'warn', Onboarding: 'info',
  Received: 'success', Cancelled: 'danger', 'Partially received': 'warn',
  Draft: 'neutral', Sent: 'info', Acknowledged: 'info',
}

export default function Vendors() {
  const [tab, setTab] = useState('directory')
  const [selected, setSelected] = useState(null)

  const kpis = useMemo(() => vendorKpis(), [])
  const risk = useMemo(() => concentrationRisk(), [])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Vendors</h1>
          <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
            Who supplies the catalogue, whether they deliver on time, and what you owe them.
          </p>
        </div>
        <Button variant="primary" size="sm">＋ Add vendor</Button>
      </div>

      <KpiRow columns={6} items={[
        { label: 'Vendors', value: kpis.total, sub: `${kpis.active} active`, icon: '⌂' },
        { label: 'Avg score', value: kpis.avgScore, sub: 'quality + punctuality', tone: kpis.avgScore >= 80 ? 'success' : 'warn', icon: '★' },
        { label: 'Avg lead time', value: kpis.avgLeadDays + 'd', sub: 'order to doorstep', icon: '◷' },
        { label: 'Open POs', value: kpis.openPos, sub: inrShort(kpis.openValue) + ' committed', tone: 'info', icon: '▤' },
        { label: 'Payable', value: inrShort(kpis.payable), sub: `${kpis.payableCount} unpaid`, tone: kpis.payable > 0 ? 'warn' : 'success', icon: '₹' },
        { label: 'On hold', value: kpis.onHold, sub: `${kpis.onboarding} onboarding`, tone: kpis.onHold ? 'warn' : 'neutral', icon: '⏸' },
      ]} />

      {risk.level !== 'low' && (
        <Card>
          <div className="flex items-start gap-2.5">
            <span className="text-[15px]" aria-hidden="true">⚠</span>
            <div>
              <div className="text-[13px] font-semibold" style={{ color: 'var(--c-text)' }}>
                Supplier concentration: {risk.level}
              </div>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>{risk.note}</p>
            </div>
          </div>
        </Card>
      )}

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'directory' && <Directory onOpen={setSelected} />}
          {tab === 'scorecard' && <Scorecard onOpen={setSelected} />}
          {tab === 'orders' && <Orders />}
          {tab === 'payables' && <Payables />}
          {tab === 'spend' && <Spend risk={risk} />}
        </motion.div>
      </AnimatePresence>

      <VendorDrawer vendor={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

/* ------------------------------------------------------------- Directory */

function Directory({ onOpen }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const nav = useNavigate()

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return VENDORS.filter(v =>
      (status === 'all' || v.status === status) &&
      (!needle || v.name.toLowerCase().includes(needle) || v.code.toLowerCase().includes(needle) ||
        v.contact.toLowerCase().includes(needle) || v.state.toLowerCase().includes(needle))
    )
  }, [q, status])

  return (
    <Card padding={false}>
      <div className="p-3 flex gap-2 flex-wrap items-center">
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, code, contact or state"
          className="!w-auto flex-1 min-w-[200px]" />
        <Select value={status} onChange={e => setStatus(e.target.value)} className="!w-auto"
          options={[{ value: 'all', label: 'All statuses' }, ...['Active', 'On hold', 'Onboarding'].map(s => ({ value: s, label: s }))]} />
      </div>
      {VENDORS.length === 0 ? (
        <div className="p-3">
          <EmptyState
            icon="⌂"
            title="No vendors yet"
            message="The suppliers behind your catalogue will appear here with quality scores, purchase orders and payables."
            secondaryLabel="Add a product"
            onSecondary={() => nav('/admin/catalogue')}
          />
        </div>
      ) : (
      <DataTable
        rows={rows}
        rowKey="id"
        pageSize={12}
        onRowClick={onOpen}
        columns={[
          { key: 'name', label: 'Vendor', render: v => (
            <div>
              <div className="font-semibold text-[12.5px]">{v.name}</div>
              <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{v.code} · {v.state}</div>
            </div>
          ) },
          { key: 'contact', label: 'Contact', render: v => (
            <div>
              <div className="text-[12px]">{v.contact}</div>
              <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{v.phone}</div>
            </div>
          ) },
          { key: 'status', label: 'Status', render: v => <Badge tone={STATUS_TONE[v.status] ?? 'neutral'}>{v.status}</Badge> },
          { key: 'terms', label: 'Terms', render: v => <span className="text-[12px]">{v.terms}</span> },
          { key: 'leadDays', label: 'Lead', align: 'right', render: v => <span className="tabular-nums text-[12px]">{v.leadDays}d</span> },
          { key: 'skuCount', label: 'SKUs', align: 'right', render: v => <span className="tabular-nums text-[12px]">{v.skuCount}</span> },
          { key: 'score', label: 'Score', align: 'right', render: v => (
            <div className="flex items-center gap-2 justify-end">
              <span className="tabular-nums text-[12px] font-semibold">{v.score}</span>
              <div className="w-14"><Progress value={v.score} tone={v.score >= 80 ? 'success' : v.score >= 65 ? 'primary' : 'warn'} height={5} /></div>
            </div>
          ) },
        ]}
      />
      )}
    </Card>
  )
}

/* ------------------------------------------------------------- Scorecard */

function Scorecard({ onOpen }) {
  const rows = useMemo(() => vendorScorecard(), [])
  return (
    <div className="space-y-3">
      <Card padding={false}>
        <CardHead title="Supplier scorecard"
          subtitle="Quality 40%, punctuality 35%, fill rate 25% — a fast supplier who ships defects should not rank first." />
        <DataTable
          rows={rows}
          rowKey="id"
          pageSize={12}
          onRowClick={onOpen}
          columns={[
            { key: 'rank', label: '#', render: (_v, i) => <span className="tabular-nums text-[12px]" style={{ color: 'var(--c-text-muted)' }}>{i + 1}</span> },
            { key: 'name', label: 'Vendor', render: v => <span className="font-semibold text-[12.5px]">{v.name}</span> },
            { key: 'blendedScore', label: 'Score', align: 'right', render: v => (
              <div className="flex items-center gap-2 justify-end">
                <span className="tabular-nums font-bold text-[12.5px]">{v.blendedScore}</span>
                <div className="w-16"><Progress value={v.blendedScore} tone={v.blendedScore >= 80 ? 'success' : v.blendedScore >= 65 ? 'primary' : 'danger'} height={5} /></div>
              </div>
            ) },
            { key: 'qualityPct', label: 'Quality', align: 'right', render: v => <span className="tabular-nums text-[12px]">{v.qualityPct}%</span> },
            { key: 'onTimePct', label: 'On time', align: 'right', render: v => <span className="tabular-nums text-[12px]">{v.onTimePct}%</span> },
            { key: 'fillRate', label: 'Fill rate', align: 'right', render: v => <span className="tabular-nums text-[12px]">{v.fillRate}%</span> },
            { key: 'poCount', label: 'POs', align: 'right', render: v => <span className="tabular-nums text-[12px]">{v.poCount}</span> },
            { key: 'lateCount', label: 'Late', align: 'right', render: v => (
              v.lateCount ? <Badge tone="warn" size="sm">{v.lateCount} ({v.latePct}%)</Badge> : <span className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>—</span>
            ) },
            { key: 'spend', label: 'Spend', align: 'right', render: v => <span className="tabular-nums text-[12px]">{inrShort(v.spend)}</span> },
          ]}
        />
      </Card>
    </div>
  )
}

/* -------------------------------------------------------- Purchase orders */

function Orders() {
  const [status, setStatus] = useState('all')
  const pipeline = useMemo(() => poPipeline(), [])
  const overdue = useMemo(() => overduePos(), [])

  const rows = useMemo(
    () => PURCHASE_ORDERS.filter(o => status === 'all' || o.status === status).sort((a, b) => b.raisedAt - a.raisedAt),
    [status]
  )

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {PO_STATUS.map(s => {
          const col = pipeline.find(p => p.status === s)
          return (
            <button key={s} onClick={() => setStatus(status === s ? 'all' : s)}
              className="text-left rounded-[var(--radius-md)] px-3 py-2.5 transition-transform hover:-translate-y-0.5"
              style={{
                background: 'var(--c-surface)',
                border: '1px solid ' + (status === s ? 'var(--c-primary)' : 'var(--c-border)'),
              }}>
              <div className="text-[11px] uppercase tracking-wide font-semibold truncate" style={{ color: 'var(--c-text-muted)' }}>{s}</div>
              <div className="text-[17px] font-bold tabular-nums">{col?.count ?? 0}</div>
              <div className="text-[11px] tabular-nums" style={{ color: 'var(--c-text-muted)' }}>{inrShort(col?.value ?? 0)}</div>
            </button>
          )
        })}
      </div>

      {overdue.length > 0 && (
        <Card>
          <CardHead title={`${overdue.length} purchase orders are late`}
            subtitle="These are the ones that turn into stockouts. Sorted by how far past the promised date they are." />
          <div className="space-y-1.5 mt-1">
            {overdue.slice(0, 5).map(o => (
              <div key={o.id} className="flex items-center justify-between gap-3 text-[12px] py-1.5"
                style={{ borderBottom: '1px solid var(--c-border)' }}>
                <div className="min-w-0">
                  <span className="font-semibold">{o.id}</span>
                  <span style={{ color: 'var(--c-text-muted)' }}> · {o.vendorName}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="tabular-nums" style={{ color: 'var(--c-text-muted)' }}>{o.outstandingQty} units</span>
                  <Badge tone={o.daysLate > 30 ? 'danger' : 'warn'} size="sm">{o.daysLate}d late</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card padding={false}>
        <DataTable
          rows={rows}
          rowKey="id"
          pageSize={12}
          expandable={o => (
            <div>
              <div className="text-[11px] uppercase tracking-wide font-semibold mb-1.5" style={{ color: 'var(--c-text-muted)' }}>Line items</div>
              <div className="space-y-1">
                {o.items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="truncate">{it.name}</span>
                    <span className="tabular-nums shrink-0" style={{ color: 'var(--c-text-muted)' }}>
                      {it.received}/{it.qty} @ {inr(it.unitCost)} = {inr(it.lineTotal)}
                    </span>
                  </div>
                ))}
              </div>
              <Divider />
              <div className="flex justify-between text-[12px]">
                <span style={{ color: 'var(--c-text-muted)' }}>Subtotal {inr(o.subtotal)} + GST {inr(o.tax)}</span>
                <span className="font-bold tabular-nums">{inr(o.total)}</span>
              </div>
            </div>
          )}
          columns={[
            { key: 'id', label: 'PO', render: o => <span className="font-semibold text-[12.5px]">{o.id}</span> },
            { key: 'vendorName', label: 'Vendor', render: o => <span className="text-[12px]">{o.vendorName}</span> },
            { key: 'status', label: 'Status', render: o => <Badge tone={STATUS_TONE[o.status] ?? 'neutral'}>{o.status}</Badge> },
            { key: 'raisedAt', label: 'Raised', render: o => <span className="text-[12px] tabular-nums">{day(o.raisedAt)}</span> },
            { key: 'expectedAt', label: 'Expected', render: o => {
              const late = !['Received', 'Cancelled'].includes(o.status) && o.expectedAt < Date.now()
              return <span className="text-[12px] tabular-nums" style={{ color: late ? 'var(--c-danger, #dc2626)' : 'inherit' }}>{day(o.expectedAt)}</span>
            } },
            { key: 'items', label: 'Lines', align: 'right', render: o => <span className="tabular-nums text-[12px]">{o.items.length}</span> },
            { key: 'total', label: 'Value', align: 'right', render: o => <span className="tabular-nums text-[12px] font-semibold">{inr(o.total)}</span> },
          ]}
        />
      </Card>
    </div>
  )
}

/* -------------------------------------------------------------- Payables */

const BUCKET_LABELS = {
  current: 'Not yet due', d1_30: '1-30 days', d31_60: '31-60 days', d61_90: '61-90 days', d90plus: '90+ days',
}

function Payables() {
  const ageing = useMemo(() => payablesAgeing(), [])
  const max = Math.max(1, ...Object.values(ageing.buckets))

  return (
    <div className="space-y-3">
      <Card>
        <CardHead title="Payables ageing" subtitle={`${inr(ageing.total)} outstanding to suppliers, bucketed by how overdue it is.`} />
        <div className="space-y-2 mt-2">
          {Object.entries(ageing.buckets).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-[12px] w-24 shrink-0" style={{ color: 'var(--c-text-muted)' }}>{BUCKET_LABELS[key]}</span>
              <div className="flex-1">
                <Progress value={(value / max) * 100}
                  tone={key === 'current' ? 'success' : key === 'd90plus' ? 'danger' : 'warn'} height={8} />
              </div>
              <span className="text-[12px] tabular-nums font-semibold w-20 text-right">{inrShort(value)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card padding={false}>
        <CardHead title="Unpaid invoices" subtitle="Oldest first. Paying these late is what turns a good supplier into an unreliable one." />
        {ageing.rows.length === 0
          ? <Empty icon="✓" title="Nothing outstanding" description="Every received purchase order has been paid." />
          : (
            <DataTable
              rows={ageing.rows}
              rowKey="id"
              pageSize={10}
              columns={[
                { key: 'id', label: 'PO', render: o => <span className="font-semibold text-[12.5px]">{o.id}</span> },
                { key: 'vendorName', label: 'Vendor', render: o => <span className="text-[12px]">{o.vendorName}</span> },
                { key: 'terms', label: 'Terms', render: o => <span className="text-[12px]">{o.terms}</span> },
                { key: 'dueAt', label: 'Due', render: o => <span className="text-[12px] tabular-nums">{day(o.dueAt)}</span> },
                { key: 'overdueDays', label: 'Overdue', align: 'right', render: o => (
                  o.overdueDays > 0
                    ? <Badge tone={o.overdueDays > 60 ? 'danger' : 'warn'} size="sm">{o.overdueDays}d</Badge>
                    : <Badge tone="success" size="sm">On time</Badge>
                ) },
                { key: 'total', label: 'Amount', align: 'right', render: o => <span className="tabular-nums text-[12px] font-semibold">{inr(o.total)}</span> },
                { key: 'pay', label: '', align: 'right', render: () => <Button size="xs" variant="ghost">Mark paid</Button> },
              ]}
            />
          )}
      </Card>
    </div>
  )
}

/* ---------------------------------------------------------------- Spend */

function Spend({ risk }) {
  const [days, setDays] = useState('180')
  const rows = useMemo(() => spendByVendor(undefined, { days: Number(days) }), [days])
  const max = Math.max(1, ...rows.map(r => r.spend))

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <CardHead title="Spend by vendor" subtitle="Where the purchasing budget actually goes." />
          <Select value={days} onChange={e => setDays(e.target.value)} className="!w-auto"
            options={[{ value: '90', label: 'Last 90 days' }, { value: '180', label: 'Last 6 months' }, { value: '365', label: 'Last year' }, { value: '3650', label: 'All time' }]} />
        </div>
        {rows.length === 0
          ? <Empty icon="◌" title="No purchase orders in this window" description="Widen the date range to see spend." />
          : (
            <div className="space-y-2 mt-1">
              {rows.slice(0, 12).map(r => (
                <div key={r.vendorId} className="flex items-center gap-3">
                  <span className="text-[12px] w-40 shrink-0 truncate" title={r.name}>{r.name}</span>
                  <div className="flex-1"><Progress value={(r.spend / max) * 100} tone="primary" height={8} /></div>
                  <span className="text-[12px] tabular-nums w-16 text-right font-semibold">{inrShort(r.spend)}</span>
                  <span className="text-[11px] tabular-nums w-10 text-right" style={{ color: 'var(--c-text-muted)' }}>{r.share}%</span>
                </div>
              ))}
            </div>
          )}
      </Card>

      <Card>
        <CardHead title="Concentration risk" subtitle="How exposed the catalogue is to a single supplier failing." />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-1">
          <div>
            <div className="text-[11px] uppercase font-semibold" style={{ color: 'var(--c-text-muted)' }}>Top supplier</div>
            <div className="text-[13px] font-semibold mt-0.5">{risk.topVendor}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase font-semibold" style={{ color: 'var(--c-text-muted)' }}>Their share</div>
            <div className="text-[19px] font-bold tabular-nums">{risk.top1}%</div>
          </div>
          <div>
            <div className="text-[11px] uppercase font-semibold" style={{ color: 'var(--c-text-muted)' }}>Top 3 share</div>
            <div className="text-[19px] font-bold tabular-nums">{risk.top3}%</div>
          </div>
          <div>
            <div className="text-[11px] uppercase font-semibold" style={{ color: 'var(--c-text-muted)' }}>Risk level</div>
            <div className="mt-1"><Badge tone={risk.level === 'high' ? 'danger' : risk.level === 'medium' ? 'warn' : 'success'}>{risk.level}</Badge></div>
          </div>
        </div>
        <p className="text-[12px] mt-2.5" style={{ color: 'var(--c-text-muted)' }}>{risk.note}</p>
      </Card>
    </div>
  )
}

/* ---------------------------------------------------------- Vendor drawer */

function VendorDrawer({ vendor, onClose }) {
  const detail = useMemo(() => (vendor ? vendorScorecard().find(v => v.id === vendor.id) : null), [vendor])
  if (!vendor) return <Drawer open={false} onClose={onClose} title="" />

  const pos = PURCHASE_ORDERS.filter(o => o.vendorId === vendor.id).sort((a, b) => b.raisedAt - a.raisedAt)

  return (
    <Drawer open onClose={onClose} title={vendor.name} width={520}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          {[
            ['Code', vendor.code], ['Status', vendor.status], ['Contact', vendor.contact],
            ['Phone', vendor.phone], ['Email', vendor.email], ['GSTIN', vendor.gstin],
            ['State', vendor.state], ['Terms', vendor.terms],
            ['Lead time', vendor.leadDays + ' days'], ['Min order', vendor.minOrderValue ? inr(vendor.minOrderValue) : 'None'],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--c-text-muted)' }}>{k}</div>
              <div className="text-[12.5px] break-words">{v}</div>
            </div>
          ))}
        </div>

        <Divider label="Performance" />
        <div className="space-y-2">
          {[
            ['Blended score', detail?.blendedScore ?? vendor.score],
            ['Quality', vendor.qualityPct],
            ['On time', vendor.onTimePct],
            ['Fill rate', detail?.fillRate ?? 100],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-[12px] w-28 shrink-0" style={{ color: 'var(--c-text-muted)' }}>{label}</span>
              <div className="flex-1"><Progress value={value} tone={value >= 80 ? 'success' : value >= 65 ? 'primary' : 'warn'} height={7} /></div>
              <span className="text-[12px] tabular-nums w-10 text-right font-semibold">{value}</span>
            </div>
          ))}
        </div>

        <Divider label={`Purchase orders (${pos.length})`} />
        <div className="space-y-1.5">
          {pos.slice(0, 8).map(o => (
            <div key={o.id} className="flex items-center justify-between gap-2 text-[12px] py-1"
              style={{ borderBottom: '1px solid var(--c-border)' }}>
              <span className="font-semibold">{o.id}</span>
              <Badge tone={STATUS_TONE[o.status] ?? 'neutral'} size="sm">{o.status}</Badge>
              <span className="tabular-nums" style={{ color: 'var(--c-text-muted)' }}>{day(o.raisedAt)}</span>
              <span className="tabular-nums font-semibold">{inrShort(o.total)}</span>
            </div>
          ))}
          {pos.length === 0 && <Empty icon="◌" title="No purchase orders yet" />}
        </div>
      </div>
    </Drawer>
  )
}
