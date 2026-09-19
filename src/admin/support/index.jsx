import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import DataTable from '../../ui/patterns/DataTable.jsx'
import EmptyState from '../../ui/EmptyState.jsx'
import KpiRow from '../../ui/patterns/KpiRow.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Textarea, Select } from '../../ui/primitives/Input.jsx'
import { Badge, Card, CardHead, Tabs, Progress, Empty, Drawer, Divider, Avatar } from '../../ui/primitives/Display.jsx'
import {
  enrichedTickets, supportKpis, ticketQueues, agentWorkload,
  breakdownBy, volumeTrend, MACROS, renderMacro,
  SLA_TARGETS, TICKET_PRIORITIES, TICKET_STATUSES,
} from '../../engines/support/supportEngine.js'

const TABS = [
  { id: 'queue', label: 'Queue', icon: '▤' },
  { id: 'sla', label: 'SLA', icon: '◷' },
  { id: 'agents', label: 'Agents', icon: '☺' },
  { id: 'insights', label: 'Insights', icon: '◴' },
  { id: 'macros', label: 'Macros', icon: '✎' },
]

const PRIORITY_TONE = { Urgent: 'danger', High: 'warn', Medium: 'info', Low: 'neutral' }
const STATUS_TONE = { Open: 'info', 'Pending customer': 'warn', Escalated: 'danger', Resolved: 'success' }

const hrs = (n) => (n == null ? '—' : n < 0 ? `${Math.abs(Math.round(n))}h over` : `${Math.round(n)}h left`)
const mins = (n) => (n == null ? '—' : n < 60 ? n + 'm' : (n / 60).toFixed(1) + 'h')

export default function Support() {
  const [tab, setTab] = useState('queue')
  const [open, setOpen] = useState(null)
  const nav = useNavigate()

  const tickets = useMemo(() => enrichedTickets(), [])
  const kpis = useMemo(() => supportKpis(tickets), [tickets])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Support desk</h1>
          <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
            Which ticket to answer next, who is about to breach an SLA, and what customers keep complaining about.
          </p>
        </div>
      </div>

      <KpiRow columns={6} items={[
        { label: 'Open', value: kpis.open, sub: `${kpis.total} all time`, icon: '▤' },
        { label: 'Breached', value: kpis.breached, sub: `${kpis.atRisk} at risk`, tone: kpis.breached ? 'danger' : 'success', icon: '⚠' },
        { label: 'Unanswered', value: kpis.awaitingFirstReply, sub: 'no first reply yet', tone: kpis.awaitingFirstReply ? 'warn' : 'success', icon: '✉' },
        { label: 'First reply', value: mins(kpis.avgFirstResponseMins), sub: 'average', icon: '◷' },
        { label: 'SLA', value: kpis.slaCompliance + '%', sub: 'met on time', tone: kpis.slaCompliance >= 90 ? 'success' : kpis.slaCompliance >= 75 ? 'warn' : 'danger', icon: '✓' },
        { label: 'CSAT', value: kpis.csat.toFixed(2), sub: `${kpis.csatResponses} ratings`, tone: kpis.csat >= 4 ? 'success' : kpis.csat >= 3 ? 'warn' : 'danger', icon: '★' },
      ]} />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tickets.length === 0 ? (
            <EmptyState
              icon="☏"
              title="No support tickets"
              message="Tickets raised by shoppers on your storefront will land here, sorted by who to answer next."
              secondaryLabel="Add a product"
              onSecondary={() => nav('/admin/catalogue')}
            />
          ) : (
          <>
          {tab === 'queue' && <Queue tickets={tickets} onOpen={setOpen} />}
          {tab === 'sla' && <Sla tickets={tickets} kpis={kpis} onOpen={setOpen} />}
          {tab === 'agents' && <Agents tickets={tickets} />}
          {tab === 'insights' && <Insights tickets={tickets} />}
          {tab === 'macros' && <Macros />}
          </>
          )}
        </motion.div>
      </AnimatePresence>

      <TicketDrawer ticket={open} onClose={() => setOpen(null)} />
    </div>
  )
}

/* ------------------------------------------------------------------ Queue */

const QUEUE_VIEWS = [
  { id: 'all', label: 'All open' },
  { id: 'breached', label: 'Breached' },
  { id: 'atRisk', label: 'At risk' },
  { id: 'awaitingReply', label: 'Unanswered' },
]

function Queue({ tickets, onOpen }) {
  const [view, setView] = useState('all')
  const [priority, setPriority] = useState('all')
  const [q, setQ] = useState('')

  const queues = useMemo(() => ticketQueues(tickets), [tickets])
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (queues[view] ?? queues.all).filter(t =>
      (priority === 'all' || t.priority === priority)
      && (!needle || t.subject.toLowerCase().includes(needle) || t.id.toLowerCase().includes(needle)))
  }, [queues, view, priority, q])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {QUEUE_VIEWS.map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            className="text-left rounded-[var(--radius-md)] px-3 py-2.5 transition-transform hover:-translate-y-0.5"
            style={{ background: 'var(--c-surface)', border: '1px solid ' + (view === v.id ? 'var(--c-primary)' : 'var(--c-border)') }}>
            <div className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--c-text-muted)' }}>{v.label}</div>
            <div className="text-[19px] font-bold tabular-nums">{(queues[v.id] ?? []).length}</div>
          </button>
        ))}
      </div>

      <Card padding={false}>
        <div className="p-3 flex gap-2 flex-wrap items-center">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search subject or ticket id"
            className="!w-auto flex-1 min-w-[180px]" />
          <Select value={priority} onChange={e => setPriority(e.target.value)} className="!w-auto"
            options={[{ value: 'all', label: 'All priorities' }, ...TICKET_PRIORITIES.map(p => ({ value: p, label: p }))]} />
        </div>
        {rows.length === 0
          ? <Empty icon="✓" title="Queue is clear" description="Nothing in this view needs attention right now." />
          : (
            <DataTable
              rows={rows}
              rowKey="id"
              pageSize={12}
              onRowClick={onOpen}
              columns={[
                { key: 'id', label: 'Ticket', render: t => <span className="font-mono text-[11.5px]">{t.id}</span> },
                { key: 'subject', label: 'Subject', render: t => (
                  <div>
                    <div className="text-[12.5px] font-semibold">{t.subject}</div>
                    <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{t.channel} · {t.category}</div>
                  </div>
                ) },
                { key: 'priority', label: 'Priority', render: t => <Badge tone={PRIORITY_TONE[t.priority]} size="sm">{t.priority}</Badge> },
                { key: 'status', label: 'Status', render: t => <Badge tone={STATUS_TONE[t.status] ?? 'neutral'} size="sm">{t.status}</Badge> },
                { key: 'ageHours', label: 'Age', align: 'right', render: t => <span className="tabular-nums text-[12px]">{t.ageHours}h</span> },
                { key: 'hoursLeft', label: 'SLA', align: 'right', render: t => (
                  <span className="tabular-nums text-[12px] font-semibold"
                    style={{ color: t.breached ? 'var(--c-danger, #dc2626)' : t.atRisk ? 'var(--c-warn, #d97706)' : 'var(--c-text-muted)' }}>
                    {hrs(t.hoursLeft)}
                  </span>
                ) },
                { key: 'assigneeName', label: 'Agent', render: t => <span className="text-[12px]">{t.assigneeName}</span> },
              ]}
            />
          )}
      </Card>
    </div>
  )
}

/* -------------------------------------------------------------------- SLA */

function Sla({ tickets, kpis, onOpen }) {
  const open = tickets.filter(t => t.isOpen)
  const byPriority = TICKET_PRIORITIES.map(p => {
    const mine = open.filter(t => t.priority === p)
    const met = mine.filter(t => !t.breached).length
    return {
      priority: p,
      target: SLA_TARGETS[p],
      count: mine.length,
      met,
      breached: mine.length - met,
      pct: mine.length ? Math.round((met / mine.length) * 100) : 100,
    }
  })

  return (
    <div className="space-y-3">
      <Card>
        <CardHead title="SLA targets by priority"
          subtitle="First reply and full resolution clocks start when the ticket opens." />
        <div className="space-y-2.5 mt-2">
          {byPriority.map(r => (
            <div key={r.priority}>
              <div className="flex items-center justify-between gap-2 text-[12px] mb-1">
                <div className="flex items-center gap-2">
                  <Badge tone={PRIORITY_TONE[r.priority]} size="sm">{r.priority}</Badge>
                  <span style={{ color: 'var(--c-text-muted)' }}>
                    reply in {r.target.firstResponse}h · resolve in {r.target.resolution}h
                  </span>
                </div>
                <span className="tabular-nums font-semibold">
                  {r.met}/{r.count} on track
                </span>
              </div>
              <Progress value={r.pct} tone={r.pct >= 90 ? 'success' : r.pct >= 70 ? 'warn' : 'danger'} height={7} />
            </div>
          ))}
        </div>
      </Card>

      <Card padding={false}>
        <CardHead title={`Breached (${kpis.breached})`} subtitle="Sorted by how far past the deadline they are. Answer from the top." />
        {kpis.breached === 0
          ? <Empty icon="✓" title="No breaches" description="Every open ticket is inside its SLA." />
          : (
            <DataTable
              rows={open.filter(t => t.breached).sort((a, b) => (a.hoursLeft ?? 0) - (b.hoursLeft ?? 0))}
              rowKey="id"
              pageSize={10}
              onRowClick={onOpen}
              columns={[
                { key: 'id', label: 'Ticket', render: t => <span className="font-mono text-[11.5px]">{t.id}</span> },
                { key: 'subject', label: 'Subject', render: t => <span className="text-[12.5px]">{t.subject}</span> },
                { key: 'priority', label: 'Priority', render: t => <Badge tone={PRIORITY_TONE[t.priority]} size="sm">{t.priority}</Badge> },
                { key: 'which', label: 'Breach', render: t => (
                  <span className="text-[12px]">{t.responseBreached ? 'First reply' : 'Resolution'}</span>
                ) },
                { key: 'hoursLeft', label: 'Over by', align: 'right', render: t => (
                  <span className="tabular-nums text-[12px] font-semibold" style={{ color: 'var(--c-danger, #dc2626)' }}>
                    {Math.abs(Math.round(t.hoursLeft ?? 0))}h
                  </span>
                ) },
                { key: 'assigneeName', label: 'Agent', render: t => <span className="text-[12px]">{t.assigneeName}</span> },
              ]}
            />
          )}
      </Card>
    </div>
  )
}

/* ----------------------------------------------------------------- Agents */

function Agents({ tickets }) {
  const rows = useMemo(() => agentWorkload(tickets), [tickets])
  const maxOpen = Math.max(1, ...rows.map(r => r.open))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {rows.map((a, i) => (
          <motion.div key={a.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}>
            <Card>
              <div className="flex items-center gap-2.5">
                <Avatar name={a.name} size={34} />
                <div className="min-w-0">
                  <div className="font-semibold text-[13px] truncate">{a.name}</div>
                  <div className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>{a.handled} handled</div>
                </div>
              </div>
              <div className="mt-2.5">
                <div className="flex justify-between text-[11.5px] mb-1">
                  <span style={{ color: 'var(--c-text-muted)' }}>Open workload</span>
                  <span className="tabular-nums font-semibold">{a.open}</span>
                </div>
                <Progress value={(a.open / maxOpen) * 100} tone={a.open > maxOpen * 0.8 ? 'warn' : 'primary'} height={7} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
                <div>
                  <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>Breached</div>
                  <div className="text-[13px] font-bold tabular-nums"
                    style={{ color: a.breached ? 'var(--c-danger, #dc2626)' : 'inherit' }}>{a.breached}</div>
                </div>
                <div>
                  <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>Reply</div>
                  <div className="text-[13px] font-bold tabular-nums">{mins(a.avgResponseMins)}</div>
                </div>
                <div>
                  <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>CSAT</div>
                  <div className="text-[13px] font-bold tabular-nums">{a.csat ?? '—'}</div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- Insights */

function Insights({ tickets }) {
  const [field, setField] = useState('category')
  const rows = useMemo(() => breakdownBy(field, tickets), [field, tickets])
  const trend = useMemo(() => volumeTrend(tickets), [tickets])
  const maxCount = Math.max(1, ...rows.map(r => r.count))
  const maxTrend = Math.max(1, ...trend.map(t => t.count))

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <CardHead title="What customers contact you about"
            subtitle="The top reason is usually a product or process problem, not a support problem." />
          <Select value={field} onChange={e => setField(e.target.value)} className="!w-auto"
            options={[
              { value: 'category', label: 'By reason' },
              { value: 'channel', label: 'By channel' },
              { value: 'priority', label: 'By priority' },
              { value: 'status', label: 'By status' },
            ]} />
        </div>
        <div className="space-y-2 mt-1">
          {rows.map(r => (
            <div key={r.key} className="flex items-center gap-3">
              <span className="text-[12px] w-36 shrink-0 truncate" title={r.key}>{r.key}</span>
              <div className="flex-1"><Progress value={(r.count / maxCount) * 100} tone="primary" height={8} /></div>
              <span className="text-[12px] tabular-nums w-10 text-right font-semibold">{r.count}</span>
              <span className="text-[11px] tabular-nums w-9 text-right" style={{ color: 'var(--c-text-muted)' }}>{r.share}%</span>
              {r.breached > 0 && <Badge tone="warn" size="sm">{r.breached}</Badge>}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title="Ticket volume, last 30 days" subtitle="Spikes usually follow a delivery problem or a broken promotion." />
        <div className="flex items-end gap-[3px] h-24 mt-2">
          {trend.map((t, i) => (
            <motion.div key={t.at}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(3, (t.count / maxTrend) * 100)}%` }}
              transition={{ delay: i * 0.012, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 rounded-t-[2px]"
              style={{ background: 'var(--c-primary)', opacity: 0.35 + (t.count / maxTrend) * 0.65 }}
              title={`${new Date(t.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: ${t.count}`}
            />
          ))}
        </div>
      </Card>
    </div>
  )
}

/* ----------------------------------------------------------------- Macros */

function Macros() {
  const [selected, setSelected] = useState(MACROS[0])
  const [vars, setVars] = useState({ name: 'Priya', order: 'ORD-48211', date: '22 Sep', amount: '₹2,499', tracking: 'bharatcart.in/t/48211', minimum: '₹1,499', code: 'FESTIVE10' })
  const rendered = useMemo(() => renderMacro(selected, vars), [selected, vars])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3">
      <div className="space-y-1.5">
        {MACROS.map(m => (
          <button key={m.id} onClick={() => setSelected(m)}
            className="w-full text-left rounded-[var(--radius-md)] px-3 py-2 transition-transform hover:translate-x-0.5"
            style={{ background: 'var(--c-surface)', border: '1px solid ' + (selected.id === m.id ? 'var(--c-primary)' : 'var(--c-border)') }}>
            <div className="font-semibold text-[12.5px]">{m.title}</div>
            <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{m.category}</div>
          </button>
        ))}
        <Button size="sm" variant="ghost" full>＋ New macro</Button>
      </div>

      <div className="space-y-3">
        <Card>
          <CardHead title={selected.title} subtitle="Placeholders in double braces are filled from the ticket when you send it." />
          <Textarea rows={5} value={selected.body} readOnly className="mt-1.5 font-mono text-[12px]" />
        </Card>

        <Card>
          <CardHead title="Preview" subtitle="Any placeholder without a value is left visible so nothing goes out half-written." />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1.5">
            {[...new Set([...rendered.used, ...rendered.missing])].map(k => (
              <Input key={k} label={k} value={vars[k] ?? ''}
                onChange={e => setVars(v => ({ ...v, [k]: e.target.value }))} />
            ))}
          </div>
          <Divider />
          <div className="rounded-[var(--radius-sm)] p-3 text-[12.5px] leading-relaxed"
            style={{ background: 'var(--c-surface-2, rgba(0,0,0,0.03))' }}>
            {rendered.text}
          </div>
          <div className="flex items-center justify-between gap-2 mt-2.5">
            {rendered.ready
              ? <Badge tone="success" size="sm">Ready to send</Badge>
              : <Badge tone="warn" size="sm">Missing: {rendered.missing.join(', ')}</Badge>}
            <Button size="sm" variant="primary" disabled={!rendered.ready}>Insert into reply</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- Ticket drawer */

function TicketDrawer({ ticket, onClose }) {
  if (!ticket) return <Drawer open={false} onClose={onClose} title="" />

  return (
    <Drawer open onClose={onClose} title={ticket.subject} width={520}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone={PRIORITY_TONE[ticket.priority]} size="sm">{ticket.priority}</Badge>
          <Badge tone={STATUS_TONE[ticket.status] ?? 'neutral'} size="sm">{ticket.status}</Badge>
          {ticket.breached && <Badge tone="danger" size="sm">SLA breached</Badge>}
          {ticket.atRisk && <Badge tone="warn" size="sm">At risk</Badge>}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {[
            ['Ticket', ticket.id], ['Customer', ticket.customerId],
            ['Channel', ticket.channel], ['Reason', ticket.category],
            ['Age', ticket.ageHours + 'h'], ['SLA', hrs(ticket.hoursLeft)],
            ['First reply', mins(ticket.firstResponseMins)], ['Replies', ticket.replies],
            ['Agent', ticket.assigneeName], ['CSAT', ticket.satisfaction ?? 'Not rated'],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--c-text-muted)' }}>{k}</div>
              <div className="text-[12.5px]">{v}</div>
            </div>
          ))}
        </div>

        <Divider label="Reply" />
        <Textarea rows={4} placeholder="Type a reply, or insert a macro from the Macros tab…" />
        <div className="flex gap-2">
          <Button size="sm" variant="primary">Send reply</Button>
          <Button size="sm" variant="ghost">Resolve</Button>
          <Button size="sm" variant="ghost">Escalate</Button>
        </div>
      </div>
    </Drawer>
  )
}
