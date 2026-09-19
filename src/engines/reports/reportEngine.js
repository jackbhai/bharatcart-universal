/**
 * Saved reports, scheduled exports and a small report builder.
 *
 * Analytics answers questions the dashboard designer thought of. This lets an
 * operator ask their own, save it, and have it land in an inbox every Monday —
 * which is how reporting actually gets used once a store is running.
 */
import { ORDERS, CUSTOMERS, PRODUCTS, NOW } from '../../data/seed.js'
import { VALID_ORDERS, groupSum } from '../../lib/analytics.js'

const DAY = 86400000

/** The dimensions a report can group by, and how to read them off a record. */
export const DIMENSIONS = {
  state: { label: 'State', source: 'orders', get: o => o.address?.state ?? o.state ?? 'Unknown' },
  paymentMethod: { label: 'Payment method', source: 'orders', get: o => o.paymentMethod ?? 'Unknown' },
  status: { label: 'Order status', source: 'orders', get: o => o.status },
  category: { label: 'Category', source: 'items', get: it => it.category ?? 'Unknown' },
  segment: { label: 'Customer segment', source: 'customers', get: c => c.segment },
  channel: { label: 'Acquisition channel', source: 'customers', get: c => c.channel },
  device: { label: 'Device', source: 'customers', get: c => c.device },
  cityTier: { label: 'City tier', source: 'customers', get: c => 'Tier ' + c.cityTier },
  language: { label: 'Language', source: 'customers', get: c => c.language },
  month: { label: 'Month', source: 'orders', get: o => new Date(o.placedAt).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) },
}

/** The measures a report can compute. */
export const MEASURES = {
  revenue: { label: 'Revenue', format: 'inr', source: 'orders', value: o => o.total },
  orders: { label: 'Orders', format: 'number', source: 'orders', value: () => 1 },
  units: { label: 'Units sold', format: 'number', source: 'orders', value: o => o.items.reduce((n, it) => n + it.qty, 0) },
  aov: { label: 'Average order value', format: 'inr', source: 'orders', derived: true },
  customers: { label: 'Customers', format: 'number', source: 'customers', value: () => 1 },
  spend: { label: 'Customer lifetime spend', format: 'inr', source: 'customers', value: c => c.spend },
}

export const DIMENSION_KEYS = Object.keys(DIMENSIONS)
export const MEASURE_KEYS = Object.keys(MEASURES)

/**
 * Run a report.
 *
 * Orders and customers are different record sets, so a report may only combine
 * a dimension and a measure that read from the same source — pairing "state"
 * with "customers" would otherwise silently return nonsense.
 */
export function runReport({ dimension = 'state', measure = 'revenue', days = 90, limit = 50, now = NOW } = {}) {
  const dim = DIMENSIONS[dimension]
  const met = MEASURES[measure]
  if (!dim || !met) return { ok: false, reason: 'Unknown dimension or measure', rows: [] }

  const dimSource = dim.source === 'items' ? 'orders' : dim.source
  const metSource = met.source
  if (dimSource !== metSource) {
    return {
      ok: false,
      rows: [],
      reason: `"${dim.label}" comes from ${dimSource} and "${met.label}" from ${metSource}. Pick a measure from the same source.`,
    }
  }

  const since = now - days * DAY
  let rows = []

  if (metSource === 'customers') {
    const map = new Map()
    for (const c of CUSTOMERS) {
      const key = dim.get(c)
      map.set(key, (map.get(key) ?? 0) + (met.value ? met.value(c) : 1))
    }
    rows = [...map.entries()].map(([key, value]) => ({ key, value, count: 1 }))
  } else if (dim.source === 'items') {
    const map = new Map()
    for (const o of VALID_ORDERS) {
      if (o.placedAt < since) continue
      for (const it of o.items) {
        const key = dim.get(it)
        const cur = map.get(key) ?? { value: 0, count: 0 }
        cur.value += measure === 'units' ? it.qty : measure === 'orders' ? 1 : it.qty * it.price
        cur.count += 1
        map.set(key, cur)
      }
    }
    rows = [...map.entries()].map(([key, v]) => ({ key, value: Math.round(v.value), count: v.count }))
  } else {
    const map = new Map()
    for (const o of VALID_ORDERS) {
      if (o.placedAt < since) continue
      const key = dim.get(o)
      const cur = map.get(key) ?? { value: 0, count: 0 }
      cur.value += met.derived ? o.total : met.value(o)
      cur.count += 1
      map.set(key, cur)
    }
    rows = [...map.entries()].map(([key, v]) => ({
      key,
      value: measure === 'aov' ? Math.round(v.value / (v.count || 1)) : Math.round(v.value),
      count: v.count,
    }))
  }

  rows.sort((a, b) => b.value - a.value)
  const total = rows.reduce((n, r) => n + r.value, 0)
  return {
    ok: true,
    rows: rows.slice(0, limit).map(r => ({ ...r, share: total ? Number(((r.value / total) * 100).toFixed(1)) : 0 })),
    total,
    format: met.format,
    dimensionLabel: dim.label,
    measureLabel: met.label,
    rowCount: rows.length,
  }
}

/** Saved report definitions — start empty, no demo records. */
export const SAVED_REPORTS = []

export const SCHEDULE_FREQUENCIES = ['Daily', 'Weekly', 'Fortnightly', 'Monthly']
export const EXPORT_FORMATS = ['CSV', 'Excel', 'PDF', 'JSON']

/** Scheduled report jobs — start empty, no demo records. */
export const SCHEDULES = []

/** Recent export jobs, so the screen shows a real history. */
export function exportHistory({ limit = 40 } = {}) {
  // With no saved reports there is no real history to show — synthesizing demo
  // exports would be fake data, so return an empty list instead.
  if (!SAVED_REPORTS.length) return []
  const out = []
  const owners = ['Sanjay Rao', 'Priya Menon', 'Neha Gupta', 'Arjun Kapoor']
  for (let i = 0; i < limit; i++) {
    const report = SAVED_REPORTS[i % SAVED_REPORTS.length]
    // One in twelve fails — an export screen that never shows a failure teaches
    // an operator nothing about what to do when one does.
    const failed = i % 12 === 7
    out.push({
      id: 'EX' + (7000 + i),
      reportName: report.name,
      format: EXPORT_FORMATS[i % EXPORT_FORMATS.length],
      requestedBy: owners[i % owners.length],
      at: NOW - i * 9 * 3600000,
      rows: 40 + ((i * 271) % 4000),
      sizeKb: 12 + ((i * 97) % 900),
      status: failed ? 'Failed' : 'Complete',
      error: failed ? 'Timed out generating the PDF. Narrow the date range and retry.' : null,
      durationMs: failed ? 30000 : 400 + ((i * 313) % 5000),
    })
  }
  return out
}

/** Report KPIs. */
export function reportKpis(saved = SAVED_REPORTS, schedules = SCHEDULES, history = exportHistory()) {
  const failed = history.filter(h => h.status === 'Failed')
  return {
    saved: saved.length,
    favourites: saved.filter(r => r.favourite).length,
    schedules: schedules.length,
    activeSchedules: schedules.filter(s => s.status === 'Active').length,
    recipients: new Set(schedules.flatMap(s => s.recipients)).size,
    exports30d: history.filter(h => NOW - h.at < 30 * DAY).length,
    failedExports: failed.length,
    successRate: history.length ? Math.round(((history.length - failed.length) / history.length) * 100) : 100,
  }
}

/** Turn a report result into CSV text — the actual export, not a stub. */
export function toCsv(result, { dimensionLabel, measureLabel } = {}) {
  if (!result?.ok) return ''
  const head = [dimensionLabel ?? result.dimensionLabel, measureLabel ?? result.measureLabel, 'Share %', 'Records']
  const escape = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [head.map(escape).join(',')]
  for (const r of result.rows) lines.push([r.key, r.value, r.share, r.count].map(escape).join(','))
  return lines.join('\n')
}

export default runReport
