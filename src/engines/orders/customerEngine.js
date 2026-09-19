/**
 * Customer intelligence engine — RFM, CLV, churn risk, segments and
 * next-best-action. This is what turns a customer list into a 360 view.
 */

const DAY = 86400000

/* ------------------------------------------------------------------ RFM */

/** Quintile-scored RFM across the whole base (scores are relative, as they should be). */
export function rfmScores(customers = [], ordersByCustomer = {}, now = Date.now()) {
  const rows = customers.map(c => {
    const orders = (ordersByCustomer[c.id] || []).filter(o => o.status !== 'Cancelled')
    const valid = orders.filter(o => !['RTO', 'Returned'].includes(o.status))
    const last = orders.length ? Math.max(...orders.map(o => o.placedAt)) : c.joinedAt
    const monetary = valid.reduce((s, o) => s + (o.total ?? 0), 0)
    return {
      customer: c,
      recencyDays: Math.floor((now - last) / DAY),
      frequency: valid.length,
      monetary,
      lastOrderAt: last,
      aov: valid.length ? Math.round(monetary / valid.length) : 0,
    }
  })

  const rScale = quintiles(rows.map(r => r.recencyDays), true)   // lower recency = better
  const fScale = quintiles(rows.map(r => r.frequency))
  const mScale = quintiles(rows.map(r => r.monetary))

  return rows.map(r => {
    const R = scoreIn(rScale, r.recencyDays, true)
    const F = scoreIn(fScale, r.frequency)
    const M = scoreIn(mScale, r.monetary)
    return { ...r, R, F, M, rfm: `${R}${F}${M}`, rfmTotal: R + F + M, segment: segmentFor(R, F, M) }
  })
}

function quintiles(values, invert = false) {
  const sorted = [...values].sort((a, b) => a - b)
  if (!sorted.length) return [0, 0, 0, 0]
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
  return [at(0.2), at(0.4), at(0.6), at(0.8)]
}

function scoreIn(scale, value, invert = false) {
  let s = 1
  for (const cut of scale) if (value > cut) s++
  s = Math.min(5, s)
  return invert ? 6 - s : s
}

/** The 11 classic RFM segments, named the way a marketer would say them. */
export function segmentFor(R, F, M) {
  if (R >= 4 && F >= 4 && M >= 4) return 'Champions'
  if (R >= 3 && F >= 3 && M >= 3) return 'Loyal Customers'
  if (R >= 4 && F <= 2) return 'New Customers'
  if (R >= 3 && F <= 2 && M >= 3) return 'Promising'
  if (R >= 3 && F >= 3 && M <= 2) return 'Potential Loyalist'
  if (R <= 2 && F >= 4 && M >= 4) return 'Cannot Lose Them'
  if (R <= 2 && F >= 3) return 'At Risk'
  if (R <= 2 && F <= 2 && M >= 3) return 'Hibernating'
  if (R <= 1 && F <= 2) return 'Lost'
  if (R >= 3) return 'Need Attention'
  return 'About to Sleep'
}

export const SEGMENT_META = {
  'Champions':          { tone: 'success', action: 'Reward them — early access and referral asks' },
  'Loyal Customers':    { tone: 'success', action: 'Upsell premium ranges, invite to loyalty tier' },
  'Potential Loyalist': { tone: 'info',    action: 'Nudge with a membership offer' },
  'New Customers':      { tone: 'info',    action: 'Onboard well — second-order discount' },
  'Promising':          { tone: 'info',    action: 'Recommend complementary products' },
  'Need Attention':     { tone: 'warning', action: 'Time-limited offer before they drift' },
  'About to Sleep':     { tone: 'warning', action: 'Reactivation email with bestsellers' },
  'At Risk':            { tone: 'danger',  action: 'Win-back campaign with a real incentive' },
  'Cannot Lose Them':   { tone: 'danger',  action: 'Personal outreach — these are high-value defectors' },
  'Hibernating':        { tone: 'neutral', action: 'Low-cost reactivation, then suppress' },
  'Lost':               { tone: 'neutral', action: 'Suppress from paid media' },
}

/* ------------------------------------------------------------------ CLV */

/**
 * Predictive CLV. Deliberately a transparent margin × frequency × lifespan
 * model rather than a black box, because an ops team has to trust the number.
 */
export function predictCLV(row, { marginPct = 32, horizonMonths = 24, discountRate = 0.1 } = {}) {
  const { frequency, monetary, aov, recencyDays, customer } = row
  const tenureDays = Math.max(30, Math.floor((Date.now() - customer.joinedAt) / DAY))
  const tenureMonths = tenureDays / 30

  const ordersPerMonth = frequency / tenureMonths
  const grossMargin = aov * (marginPct / 100)

  // Churn probability rises with silence, scaled against their own cadence.
  const expectedGapDays = frequency > 1 ? tenureDays / frequency : 120
  const overdueRatio = recencyDays / Math.max(20, expectedGapDays)
  const churnProb = Math.min(0.95, Math.max(0.05, 1 - Math.exp(-0.55 * overdueRatio)))
  const retention = 1 - churnProb

  let clv = 0
  for (let m = 1; m <= horizonMonths; m++) {
    const survive = Math.pow(retention, m / 6)
    clv += ordersPerMonth * grossMargin * survive / Math.pow(1 + discountRate / 12, m)
  }

  const historic = monetary * (marginPct / 100)

  return {
    historicValue: Math.round(historic),
    predictedValue: Math.round(clv),
    totalValue: Math.round(historic + clv),
    ordersPerMonth: Math.round(ordersPerMonth * 100) / 100,
    expectedGapDays: Math.round(expectedGapDays),
    churnProbability: Math.round(churnProb * 100),
    retentionProbability: Math.round(retention * 100),
    risk: churnProb >= 0.7 ? 'high' : churnProb >= 0.4 ? 'medium' : 'low',
    grossMarginPerOrder: Math.round(grossMargin),
  }
}

/** Churn risk list, worth-most-first — the call list for retention. */
export function churnRisk(rows = [], opts = {}) {
  return rows
    .map(r => ({ ...r, clv: predictCLV(r, opts) }))
    .filter(r => r.clv.risk !== 'low' && r.frequency > 0)
    .sort((a, b) => (b.clv.totalValue * b.clv.churnProbability) - (a.clv.totalValue * a.clv.churnProbability))
}

/* -------------------------------------------------------------- cohorts */

/**
 * Monthly acquisition cohorts with retention by month offset.
 *
 * A customer belongs to the month of their first fulfilled order — that is
 * what "acquisition" means everywhere this is shown (the dashboard cohorts
 * are keyed by firstOrderAt too) — so M0 is 100% by construction and M1 is
 * the true second-order rate. Cohort by signup month instead and M0 becomes
 * a data accident: not everyone buys in the month they sign up.
 */
export function cohortRetention(customers = [], ordersByCustomer = {}, months = 12, now = Date.now()) {
  const key = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
  const monthIndex = (ts) => { const d = new Date(ts); return d.getFullYear() * 12 + d.getMonth() }
  const nowIdx = monthIndex(now)
  const fulfilled = (o) => !['Cancelled', 'RTO'].includes(o.status)

  const cohorts = {}
  for (const c of customers) {
    const valid = (ordersByCustomer[c.id] || []).filter(fulfilled)
    if (!valid.length) continue
    const first = valid.reduce((a, b) => (a.placedAt <= b.placedAt ? a : b))
    const ci = monthIndex(first.placedAt)
    if (nowIdx - ci >= months) continue
    const k = key(first.placedAt)
    cohorts[k] = cohorts[k] || { cohort: k, startIdx: ci, size: 0, buckets: {}, revenue: {} }
    cohorts[k].size++

    for (const o of valid) {
      const offset = monthIndex(o.placedAt) - ci
      if (offset < 0 || offset > months) continue
      cohorts[k].buckets[offset] = cohorts[k].buckets[offset] || new Set()
      cohorts[k].buckets[offset].add(c.id)
      cohorts[k].revenue[offset] = (cohorts[k].revenue[offset] || 0) + (o.total ?? 0)
    }
  }

  return Object.values(cohorts)
    .sort((a, b) => a.startIdx - b.startIdx)
    .map(c => {
      const maxOffset = nowIdx - c.startIdx
      const cells = []
      for (let m = 0; m <= Math.min(maxOffset, months); m++) {
        const active = c.buckets[m]?.size ?? 0
        cells.push({
          month: m,
          active,
          pct: c.size ? Math.round((active / c.size) * 100) : 0,
          revenue: Math.round(c.revenue[m] || 0),
          revenuePerUser: c.size ? Math.round((c.revenue[m] || 0) / c.size) : 0,
        })
      }
      return { cohort: c.cohort, size: c.size, cells }
    })
}

/* -------------------------------------------------------- next best action */

/** One concrete, ranked recommendation per customer. */
export function nextBestAction(row, { tickets = [], returns = [] } = {}) {
  const { customer: c, recencyDays, frequency, monetary, aov, segment } = row
  const actions = []

  const openTickets = tickets.filter(t => t.customerId === c.id && !['Resolved', 'Closed'].includes(t.status))
  if (openTickets.length) {
    actions.push({
      priority: 100, type: 'support',
      title: `Resolve ${openTickets.length} open ticket${openTickets.length > 1 ? 's' : ''}`,
      why: 'An unresolved complaint is the fastest route to churn',
      cta: 'Open ticket',
    })
  }

  if (segment === 'Cannot Lose Them') {
    actions.push({
      priority: 95, type: 'winback',
      title: 'Personal win-back call',
      why: `High spender (₹${monetary.toLocaleString('en-IN')}) silent for ${recencyDays} days`,
      cta: 'Assign to account manager',
    })
  }

  if (segment === 'At Risk') {
    actions.push({
      priority: 80, type: 'winback',
      title: 'Send a win-back offer',
      why: `Ordered ${frequency}× before, nothing in ${recencyDays} days`,
      cta: 'Create 20% win-back coupon',
    })
  }

  if (segment === 'Champions') {
    actions.push({
      priority: 70, type: 'advocacy',
      title: 'Ask for a referral',
      why: 'Top-decile buyer with recent activity — highest referral conversion',
      cta: 'Send referral link',
    })
  }

  if (frequency === 1 && recencyDays < 45) {
    actions.push({
      priority: 75, type: 'repeat',
      title: 'Drive the second order',
      why: 'The 1st→2nd order jump is the single biggest retention lever',
      cta: 'Send second-order discount',
    })
  }

  const custReturns = returns.filter(r => r.customerId === c.id)
  if (custReturns.length >= 3) {
    actions.push({
      priority: 60, type: 'risk',
      title: 'Review serial return behaviour',
      why: `${custReturns.length} returns filed — check for abuse or a sizing problem`,
      cta: 'Open return history',
    })
  }

  if (aov > 0 && aov < 1200 && frequency >= 2) {
    actions.push({
      priority: 45, type: 'aov',
      title: 'Raise basket size',
      why: `AOV of ₹${aov} is below the store average — bundle recommendations`,
      cta: 'Suggest bundles',
    })
  }

  if (!actions.length) {
    actions.push({
      priority: 10, type: 'nurture',
      title: 'Keep nurturing',
      why: 'No urgent signal — keep them in the regular lifecycle flow',
      cta: 'View profile',
    })
  }

  return actions.sort((a, b) => b.priority - a.priority)
}

/** Customers worth the most attention right now, across all signals. */
export function priorityCustomers(rows = [], ctx = {}, limit = 20) {
  return rows
    .map(r => {
      const actions = nextBestAction(r, ctx)
      const clv = predictCLV(r)
      return { ...r, clv, topAction: actions[0], actions, urgency: actions[0].priority + Math.min(40, clv.totalValue / 500) }
    })
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, limit)
}

export default {
  rfmScores, segmentFor, SEGMENT_META, predictCLV, churnRisk,
  cohortRetention, nextBestAction, priorityCustomers,
}
