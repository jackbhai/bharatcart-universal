import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import DataTable from '../../ui/patterns/DataTable.jsx'
import KpiRow from '../../ui/patterns/KpiRow.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select, Checkbox } from '../../ui/primitives/Input.jsx'
import { Badge, Card, CardHead, Tabs, Progress, Empty, Divider } from '../../ui/primitives/Display.jsx'
import {
  runReport, SAVED_REPORTS, SCHEDULES, SCHEDULE_FREQUENCIES, EXPORT_FORMATS,
  DIMENSIONS, MEASURES, DIMENSION_KEYS, MEASURE_KEYS,
  reportKpis, exportHistory, toCsv,
} from '../../engines/reports/reportEngine.js'
import { inr, inrShort } from '../../lib/analytics.js'

const TABS = [
  { id: 'builder', label: 'Builder', icon: '⚙' },
  { id: 'saved', label: 'Saved', icon: '★' },
  { id: 'schedules', label: 'Schedules', icon: '◷' },
  { id: 'exports', label: 'Export history', icon: '↓' },
]

const day = (ts) => (ts ? new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—')
const num = (n) => n.toLocaleString('en-IN')
const fmt = (value, format) => (format === 'inr' ? inr(value) : num(value))

export default function Reports() {
  const [tab, setTab] = useState('builder')
  const [loaded, setLoaded] = useState(null)
  const kpis = useMemo(() => reportKpis(), [])

  const openSaved = (report) => { setLoaded(report); setTab('builder') }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Reports</h1>
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          Ask your own question of the data, save it, and have the answer emailed on a schedule.
        </p>
      </div>

      <KpiRow columns={5} items={[
        { label: 'Saved reports', value: kpis.saved, sub: `${kpis.favourites} pinned`, icon: '★' },
        { label: 'Schedules', value: kpis.activeSchedules, sub: `of ${kpis.schedules} · ${kpis.recipients} recipients`, icon: '◷' },
        { label: 'Exports', value: kpis.exports30d, sub: 'last 30 days', icon: '↓' },
        { label: 'Failed', value: kpis.failedExports, tone: kpis.failedExports ? 'warn' : 'success', icon: '⚠' },
        { label: 'Success rate', value: kpis.successRate + '%', tone: kpis.successRate >= 95 ? 'success' : 'warn', icon: '✓' },
      ]} />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'builder' && <Builder preset={loaded} />}
          {tab === 'saved' && <Saved onOpen={openSaved} />}
          {tab === 'schedules' && <Schedules />}
          {tab === 'exports' && <Exports />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ---------------------------------------------------------------- Builder */

const RANGES = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
  { value: '365', label: 'Last year' },
  { value: '3650', label: 'All time' },
]

function Builder({ preset }) {
  const [dimension, setDimension] = useState(preset?.dimension ?? 'state')
  const [measure, setMeasure] = useState(preset?.measure ?? 'revenue')
  const [days, setDays] = useState(String(preset?.days ?? 90))

  // Re-apply whenever a saved report is loaded from the other tab.
  React.useEffect(() => {
    if (!preset) return
    setDimension(preset.dimension)
    setMeasure(preset.measure)
    setDays(String(preset.days))
  }, [preset])

  const result = useMemo(
    () => runReport({ dimension, measure, days: Number(days) }),
    [dimension, measure, days]
  )
  const max = result.ok ? Math.max(1, ...result.rows.map(r => r.value)) : 1

  return (
    <div className="space-y-3">
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
          <Select label="Group by" value={dimension} onChange={e => setDimension(e.target.value)}
            options={DIMENSION_KEYS.map(k => ({ value: k, label: DIMENSIONS[k].label }))} />
          <Select label="Measure" value={measure} onChange={e => setMeasure(e.target.value)}
            options={MEASURE_KEYS.map(k => ({ value: k, label: MEASURES[k].label }))} />
          <Select label="Period" value={days} onChange={e => setDays(e.target.value)} options={RANGES} />
          <div className="flex items-end gap-2">
            <Button size="sm" variant="primary" full>Save report</Button>
          </div>
        </div>
      </Card>

      {!result.ok
        ? (
          <Card>
            <Empty icon="⚠" title="These two do not go together" description={result.reason} />
          </Card>
        )
        : (
          <>
            <Card>
              <CardHead
                title={`${result.measureLabel} by ${result.dimensionLabel}`}
                subtitle={`${result.rowCount} groups · total ${fmt(result.total, result.format)}`}
                action={<Button size="xs" variant="ghost">Export CSV</Button>}
              />
              <div className="space-y-2 mt-2">
                {result.rows.slice(0, 15).map((r, i) => (
                  <motion.div key={r.key} className="flex items-center gap-3"
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.025, duration: 0.22 }}>
                    <span className="text-[12px] w-36 shrink-0 truncate" title={r.key}>{r.key}</span>
                    <div className="flex-1"><Progress value={(r.value / max) * 100} tone="primary" height={8} /></div>
                    <span className="text-[12px] tabular-nums w-20 text-right font-semibold">{fmt(r.value, result.format)}</span>
                    <span className="text-[11px] tabular-nums w-11 text-right" style={{ color: 'var(--c-text-muted)' }}>{r.share}%</span>
                  </motion.div>
                ))}
              </div>
            </Card>

            <Card padding={false}>
              <DataTable
                rows={result.rows}
                rowKey="key"
                pageSize={12}
                columns={[
                  { key: 'key', label: result.dimensionLabel, render: r => <span className="text-[12.5px] font-semibold">{r.key}</span> },
                  { key: 'value', label: result.measureLabel, align: 'right', render: r => <span className="tabular-nums text-[12px] font-semibold">{fmt(r.value, result.format)}</span> },
                  { key: 'share', label: 'Share', align: 'right', render: r => <span className="tabular-nums text-[12px]">{r.share}%</span> },
                  { key: 'count', label: 'Records', align: 'right', render: r => <span className="tabular-nums text-[12px]">{num(r.count)}</span> },
                ]}
              />
            </Card>

            <Card>
              <CardHead title="CSV preview" subtitle="Exactly what the export contains." />
              <pre className="text-[11px] font-mono mt-1.5 p-3 rounded-[var(--radius-sm)] overflow-auto max-h-44"
                style={{ background: 'var(--c-surface-2, rgba(0,0,0,0.04))' }}>
                {toCsv(result).split('\n').slice(0, 12).join('\n')}
              </pre>
            </Card>
          </>
        )}
    </div>
  )
}

/* ------------------------------------------------------------------ Saved */

function Saved({ onOpen }) {
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return SAVED_REPORTS
      .filter(r => !needle || r.name.toLowerCase().includes(needle) || r.owner.toLowerCase().includes(needle))
      .sort((a, b) => (b.favourite - a.favourite) || (b.createdAt - a.createdAt))
  }, [q])

  return (
    <div className="space-y-3">
      <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search saved reports" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {rows.map((r, i) => {
          const result = runReport(r)
          return (
            <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.035, duration: 0.25 }} whileHover={{ y: -2 }}>
              <Card className="h-full cursor-pointer" onClick={() => onOpen(r)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-[13px]">{r.name}</div>
                  {r.favourite && <span className="text-[13px]" style={{ color: 'var(--c-warn, #d97706)' }} aria-label="Pinned">★</span>}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                  {DIMENSIONS[r.dimension]?.label} · {MEASURES[r.measure]?.label} · {r.days >= 3650 ? 'all time' : r.days + 'd'}
                </div>
                {result.ok && (
                  <>
                    <div className="text-[19px] font-bold tabular-nums mt-2">{fmt(result.total, result.format)}</div>
                    <div className="space-y-1 mt-1.5">
                      {result.rows.slice(0, 3).map(row => (
                        <div key={row.key} className="flex justify-between text-[11.5px]">
                          <span className="truncate" style={{ color: 'var(--c-text-muted)' }}>{row.key}</span>
                          <span className="tabular-nums shrink-0">{row.share}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div className="text-[11px] mt-2 pt-2" style={{ borderTop: '1px solid var(--c-border)', color: 'var(--c-text-muted)' }}>
                  {r.owner} · {day(r.createdAt)}
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>
      {rows.length === 0 && <Empty icon="◌" title="No reports match" description="Try a different search." />}
    </div>
  )
}

/* -------------------------------------------------------------- Schedules */

function Schedules() {
  return (
    <Card padding={false}>
      <div className="p-3 flex items-center justify-between gap-2 flex-wrap">
        <CardHead title="Scheduled reports" subtitle="Delivered by email. A paused schedule keeps its history but stops sending." />
        <Button size="sm" variant="primary">＋ New schedule</Button>
      </div>
      <DataTable
        rows={SCHEDULES}
        rowKey="id"
        pageSize={10}
        expandable={s => (
          <div>
            <div className="text-[11px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--c-text-muted)' }}>Recipients</div>
            <div className="flex flex-wrap gap-1.5">
              {s.recipients.map(r => (
                <span key={r} className="text-[11.5px] px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--c-surface-2, rgba(0,0,0,0.05))' }}>{r}</span>
              ))}
            </div>
          </div>
        )}
        columns={[
          { key: 'name', label: 'Report', render: s => <span className="font-semibold text-[12.5px]">{s.name}</span> },
          { key: 'frequency', label: 'Frequency', render: s => <Badge tone="neutral" size="sm">{s.frequency}</Badge> },
          { key: 'format', label: 'Format', render: s => <span className="text-[12px]">{s.format}</span> },
          { key: 'recipients', label: 'To', align: 'right', render: s => <span className="tabular-nums text-[12px]">{s.recipients.length}</span> },
          { key: 'lastRunAt', label: 'Last run', render: s => <span className="text-[12px] tabular-nums">{day(s.lastRunAt)}</span> },
          { key: 'nextRunAt', label: 'Next run', render: s => <span className="text-[12px] tabular-nums">{day(s.nextRunAt)}</span> },
          { key: 'runs', label: 'Runs', align: 'right', render: s => <span className="tabular-nums text-[12px]">{s.runs}</span> },
          { key: 'status', label: 'Status', render: s => (
            <Badge tone={s.status === 'Active' ? 'success' : 'neutral'} size="sm">{s.status}</Badge>
          ) },
        ]}
      />
    </Card>
  )
}

/* ---------------------------------------------------------------- Exports */

function Exports() {
  const [onlyFailed, setOnlyFailed] = useState(false)
  const all = useMemo(() => exportHistory({ limit: 60 }), [])
  const rows = onlyFailed ? all.filter(h => h.status === 'Failed') : all

  return (
    <Card padding={false}>
      <div className="p-3 flex items-center justify-between gap-3 flex-wrap">
        <CardHead title="Export history" subtitle="Every file generated, and why the failures failed." />
        <Checkbox checked={onlyFailed} onChange={setOnlyFailed} label="Failures only" />
      </div>
      {rows.length === 0
        ? <Empty icon="✓" title="No failed exports" description="Every export in the window completed." />
        : (
          <DataTable
            rows={rows}
            rowKey="id"
            pageSize={15}
            expandable={h => (h.error
              ? <span className="text-[12px]" style={{ color: 'var(--c-danger, #dc2626)' }}>{h.error}</span>
              : <span className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>
                  Completed in {(h.durationMs / 1000).toFixed(1)}s · {num(h.rows)} rows · {h.sizeKb} KB
                </span>)}
            columns={[
              { key: 'at', label: 'When', render: h => <span className="text-[12px] tabular-nums">{day(h.at)}</span> },
              { key: 'reportName', label: 'Report', render: h => <span className="text-[12.5px]">{h.reportName}</span> },
              { key: 'format', label: 'Format', render: h => <Badge tone="neutral" size="sm">{h.format}</Badge> },
              { key: 'requestedBy', label: 'By', render: h => <span className="text-[12px]">{h.requestedBy}</span> },
              { key: 'rows', label: 'Rows', align: 'right', render: h => <span className="tabular-nums text-[12px]">{num(h.rows)}</span> },
              { key: 'sizeKb', label: 'Size', align: 'right', render: h => <span className="tabular-nums text-[12px]">{h.sizeKb} KB</span> },
              { key: 'status', label: 'Status', render: h => (
                <Badge tone={h.status === 'Complete' ? 'success' : 'danger'} size="sm">{h.status}</Badge>
              ) },
            ]}
          />
        )}
    </Card>
  )
}
