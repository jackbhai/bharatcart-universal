/**
 * Support desk: SLA tracking, queues and agent workload.
 *
 * The seed already had tickets but nothing measured them. A support screen that
 * cannot tell you which ticket is about to breach its SLA is just a list.
 */
import { TICKETS, CUSTOMERS, NOW } from '../../data/seed.js'
import { STAFF } from '../people/peopleEngine.js'

const HOUR = 3600000
const DAY = 24 * HOUR

/** First-response and resolution targets, in hours, by priority. */
// Priorities match the seed exactly ('Medium', not 'Normal') — inventing a
// fifth level here would leave most tickets falling through to a default.
export const SLA_TARGETS = {
  Urgent: { firstResponse: 1, resolution: 8 },
  High: { firstResponse: 4, resolution: 24 },
  Medium: { firstResponse: 12, resolution: 72 },
  Low: { firstResponse: 24, resolution: 120 },
}

export const TICKET_PRIORITIES = ['Urgent', 'High', 'Medium', 'Low']
export const TICKET_CHANNELS = ['Email', 'In-app chat', 'WhatsApp', 'Phone']
export const TICKET_STATUSES = ['Open', 'Pending customer', 'Escalated', 'Resolved']

/** Tickets carry a subject, not a category, so categories are derived from it. */
export const SUBJECT_CATEGORY = {
  'GST invoice needed': 'Billing',
  'Damaged item received': 'Damaged item',
  'COD not available on pincode': 'Delivery',
  'Size exchange request': 'Size exchange',
  'Coupon not applying': 'Promotions',
  'Wrong colour shipped': 'Wrong item',
  'Refund not credited': 'Refund status',
  'Delivery delay': 'Delivery',
}
export const TICKET_CATEGORIES = [...new Set(Object.values(SUBJECT_CATEGORY))]

const agents = STAFF.filter(s => ['support', 'manager', 'owner'].includes(s.role) && s.status === 'Active')

/**
 * Enrich the seeded tickets with the fields a desk actually runs on.
 * Derived deterministically from the ticket id so the numbers never shuffle.
 */
export function enrichedTickets(tickets = TICKETS, now = NOW) {
  return tickets.map((t, i) => {
    const priority = t.priority ?? 'Medium'
    const target = SLA_TARGETS[priority] ?? SLA_TARGETS.Medium
    const isOpen = !['Resolved', 'Closed'].includes(t.status)
    const seededAt = t.createdAt ?? t.at ?? now
    // The seed spreads every ticket across two years, which would mean every
    // still-open ticket is months old and 100% of the desk is in SLA breach —
    // true to the data, useless as a screen. Open tickets are therefore
    // re-dated into a live 0-96h window (deterministically, from the id) so the
    // queues show a realistic mix of healthy, at-risk and breached work.
    // Resolved tickets keep their real historical date for the trend charts.
    const openedAt = isOpen
      ? now - (((i * 17) % 96) + ((i * 7) % 60) / 60) * HOUR
      : seededAt
    // Every seeded ticket has a first response, but an unanswered queue is a
    // real state a desk must handle, so the newest Open tickets model it.
    const firstResponseMins = (t.status === 'Open' && i % 9 === 0) ? null : t.firstResponseMins
    const respondedAt = firstResponseMins == null ? null : openedAt + firstResponseMins * 60000
    const resolvedAt = isOpen ? null : openedAt + (2 + ((i * 53) % 90)) * HOUR

    const responseDeadline = openedAt + target.firstResponse * HOUR
    const resolutionDeadline = openedAt + target.resolution * HOUR
    const responseBreached = respondedAt ? respondedAt > responseDeadline : now > responseDeadline
    const resolutionBreached = resolvedAt ? resolvedAt > resolutionDeadline : now > resolutionDeadline

    // Hours left before the next deadline that still matters. Negative = breached.
    const nextDeadline = respondedAt ? resolutionDeadline : responseDeadline
    const hoursLeft = isOpen ? (nextDeadline - now) / HOUR : null

    return {
      ...t,
      priority,
      openedAt,
      respondedAt,
      resolvedAt,
      isOpen,
      channel: t.channel ?? TICKET_CHANNELS[i % TICKET_CHANNELS.length],
      category: t.category ?? SUBJECT_CATEGORY[t.subject] ?? 'Other',
      assignee: agents.length ? agents[i % agents.length] : null,
      assigneeName: agents.length ? agents[i % agents.length].name : 'Unassigned',
      firstResponseMins,
      responseDeadline,
      resolutionDeadline,
      responseBreached,
      resolutionBreached,
      breached: responseBreached || resolutionBreached,
      hoursLeft,
      // "At risk" is the useful state: not breached yet, but will be within 2h.
      atRisk: isOpen && !responseBreached && !resolutionBreached && hoursLeft != null && hoursLeft < 2,
      ageHours: Math.round((now - openedAt) / HOUR),
      satisfaction: t.csat ?? null,
      replies: 1 + ((i * 13) % 7),
    }
  })
}

/** Desk-level KPIs. */
export function supportKpis(tickets = enrichedTickets()) {
  const open = tickets.filter(t => t.isOpen)
  const closed = tickets.filter(t => !t.isOpen)
  const responded = tickets.filter(t => t.firstResponseMins != null)
  const rated = closed.filter(t => t.satisfaction != null)
  const avgFirstResponse = responded.length
    ? Math.round(responded.reduce((n, t) => n + t.firstResponseMins, 0) / responded.length)
    : 0
  const resolutionTimes = closed.filter(t => t.resolvedAt).map(t => (t.resolvedAt - t.openedAt) / HOUR)
  return {
    total: tickets.length,
    open: open.length,
    unassigned: tickets.filter(t => t.assigneeName === 'Unassigned').length,
    awaitingFirstReply: open.filter(t => t.firstResponseMins == null).length,
    breached: open.filter(t => t.breached).length,
    atRisk: open.filter(t => t.atRisk).length,
    urgent: open.filter(t => t.priority === 'Urgent').length,
    avgFirstResponseMins: avgFirstResponse,
    avgResolutionHours: resolutionTimes.length
      ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length)
      : 0,
    slaCompliance: tickets.length
      ? Math.round((tickets.filter(t => !t.breached).length / tickets.length) * 100)
      : 100,
    csat: rated.length ? Number((rated.reduce((n, t) => n + t.satisfaction, 0) / rated.length).toFixed(2)) : 0,
    csatResponses: rated.length,
  }
}

/**
 * Work queues, ordered the way an agent should actually pick tickets up:
 * breached first, then at risk, then by priority, then oldest.
 */
export function ticketQueues(tickets = enrichedTickets()) {
  const rank = { Urgent: 0, High: 1, Medium: 2, Low: 3 }
  const sorter = (a, b) =>
    (b.breached - a.breached) ||
    (b.atRisk - a.atRisk) ||
    (rank[a.priority] - rank[b.priority]) ||
    (a.openedAt - b.openedAt)

  const open = tickets.filter(t => t.isOpen)
  return {
    breached: open.filter(t => t.breached).sort(sorter),
    atRisk: open.filter(t => t.atRisk && !t.breached).sort(sorter),
    awaitingReply: open.filter(t => t.firstResponseMins == null).sort(sorter),
    unassigned: open.filter(t => t.assigneeName === 'Unassigned').sort(sorter),
    all: open.sort(sorter),
  }
}

/** Per-agent workload, so nobody is silently drowning. */
export function agentWorkload(tickets = enrichedTickets()) {
  const map = new Map()
  for (const t of tickets) {
    const key = t.assigneeName
    const cur = map.get(key) || { name: key, open: 0, closed: 0, breached: 0, csatSum: 0, csatCount: 0, responseSum: 0, responseCount: 0 }
    if (t.isOpen) cur.open += 1; else cur.closed += 1
    if (t.breached) cur.breached += 1
    if (t.satisfaction != null) { cur.csatSum += t.satisfaction; cur.csatCount += 1 }
    if (t.firstResponseMins != null) { cur.responseSum += t.firstResponseMins; cur.responseCount += 1 }
    map.set(key, cur)
  }
  return [...map.values()].map(a => ({
    ...a,
    handled: a.open + a.closed,
    csat: a.csatCount ? Number((a.csatSum / a.csatCount).toFixed(2)) : null,
    avgResponseMins: a.responseCount ? Math.round(a.responseSum / a.responseCount) : null,
  })).sort((a, b) => b.open - a.open)
}

/** Ticket volume split by a field, for the breakdown charts. */
export function breakdownBy(field, tickets = enrichedTickets()) {
  const map = new Map()
  for (const t of tickets) {
    const key = t[field] ?? 'Unknown'
    const cur = map.get(key) || { key, count: 0, open: 0, breached: 0 }
    cur.count += 1
    if (t.isOpen) cur.open += 1
    if (t.breached) cur.breached += 1
    map.set(key, cur)
  }
  const rows = [...map.values()].sort((a, b) => b.count - a.count)
  const total = rows.reduce((n, r) => n + r.count, 0) || 1
  return rows.map(r => ({ ...r, share: Math.round((r.count / total) * 100) }))
}

/** Canned replies — the single biggest time-saver on any real desk. */
export const MACROS = [
  { id: 'M1', title: 'Delivery delayed', category: 'Delivery', body: 'Hi {{name}}, apologies for the delay on order {{order}}. It is currently in transit and the courier expects delivery by {{date}}. Here is your tracking link: {{tracking}}.' },
  { id: 'M2', title: 'Refund initiated', category: 'Refund status', body: 'Hi {{name}}, your refund of {{amount}} for order {{order}} has been initiated. It reaches your original payment method in 5-7 working days.' },
  { id: 'M3', title: 'Damaged item — replacement', category: 'Damaged item', body: 'Hi {{name}}, very sorry your item arrived damaged. A replacement has been arranged at no cost and a pickup for the damaged piece is scheduled.' },
  { id: 'M4', title: 'Size exchange steps', category: 'Size exchange', body: 'Hi {{name}}, happy to exchange the size. Reply with the size you need and we will raise a pickup within 48 hours.' },
  { id: 'M5', title: 'Payment failed but debited', category: 'Billing', body: 'Hi {{name}}, when a payment fails after debit, the bank auto-reverses it within 5-7 working days. If it has not reached you by {{date}}, share the bank reference and we will chase it.' },
  { id: 'M6', title: 'Coupon not applying', category: 'Promotions', body: 'Hi {{name}}, that coupon needs a minimum cart of {{minimum}} and excludes items already on sale. Here is a code that will work on your cart: {{code}}.' },
  { id: 'M7', title: 'Cancellation confirmed', category: 'Delivery', body: 'Hi {{name}}, order {{order}} has been cancelled and no amount will be charged. Any amount already debited is refunded automatically.' },
  { id: 'M8', title: 'Care instructions', category: 'Other', body: 'Hi {{name}}, this piece is handwoven. Dry clean only, store folded in muslin, and keep away from direct sunlight to protect the dye.' },
]

/** Fill a macro's placeholders. Unknown placeholders are left visible on purpose. */
export function renderMacro(macro, vars = {}) {
  const body = String(macro?.body ?? '')
  const used = []
  const missing = []
  const out = body.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (vars[key] != null && vars[key] !== '') { used.push(key); return String(vars[key]) }
    missing.push(key)
    return match
  })
  return { text: out, used: [...new Set(used)], missing: [...new Set(missing)], ready: missing.length === 0 }
}

/** Daily ticket volume, for the trend sparkline. */
export function volumeTrend(tickets = enrichedTickets(), { days = 30, now = NOW } = {}) {
  const out = []
  for (let d = days - 1; d >= 0; d--) {
    const start = now - d * DAY
    const dayStart = start - (start % DAY)
    const count = tickets.filter(t => t.openedAt >= dayStart && t.openedAt < dayStart + DAY).length
    out.push({ at: dayStart, count })
  }
  return out
}

export default supportKpis
