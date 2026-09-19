/**
 * Marketing engine — audience segmentation, campaign estimation and
 * attribution. Audiences are *rule-based and live*: the same rule set that
 * previews 400 customers today will resolve to a different 400 next week,
 * which is what makes them usable for automation rather than one-off exports.
 */

const DAY = 86400000

/* -------------------------------------------------------------- audiences */

/** Fields an audience rule can filter on, with the type driving the UI control. */
export const AUDIENCE_FIELDS = {
  segment:         { label: 'RFM segment', type: 'enum', source: 'segments' },
  total_spend:     { label: 'Lifetime spend', type: 'number', prefix: '₹' },
  order_count:     { label: 'Number of orders', type: 'number' },
  aov:             { label: 'Average order value', type: 'number', prefix: '₹' },
  days_since_order:{ label: 'Days since last order', type: 'number' },
  days_since_join: { label: 'Days since signup', type: 'number' },
  city:            { label: 'City', type: 'text' },
  state:           { label: 'State', type: 'enum', source: 'states' },
  city_tier:       { label: 'City tier', type: 'enum', source: 'tiers' },
  channel:         { label: 'Acquisition channel', type: 'enum', source: 'channels' },
  bought_category: { label: 'Bought from category', type: 'enum', source: 'categories' },
  payment_method:  { label: 'Preferred payment', type: 'enum', source: 'payments' },
  has_returned:    { label: 'Has returned an order', type: 'boolean' },
  churn_risk:      { label: 'Churn risk', type: 'enum', source: 'risk' },
  loyalty_tier:    { label: 'Loyalty tier', type: 'enum', source: 'tiers_loyalty' },
  clv:             { label: 'Predicted lifetime value', type: 'number', prefix: '₹' },
}

export const AUDIENCE_OPERATORS = {
  eq:       { label: 'is', types: ['enum', 'text', 'boolean', 'number'] },
  neq:      { label: 'is not', types: ['enum', 'text', 'boolean', 'number'] },
  gt:       { label: 'is more than', types: ['number'] },
  gte:      { label: 'is at least', types: ['number'] },
  lt:       { label: 'is less than', types: ['number'] },
  lte:      { label: 'is at most', types: ['number'] },
  contains: { label: 'contains', types: ['text'] },
  in:       { label: 'is any of', types: ['enum', 'text'] },
}

export function operatorsForField(field) {
  const type = AUDIENCE_FIELDS[field]?.type ?? 'text'
  return Object.entries(AUDIENCE_OPERATORS)
    .filter(([, op]) => op.types.includes(type))
    .map(([key, op]) => ({ value: key, label: op.label }))
}

/** Flatten a customer + their computed metrics into a fact bag the rules read. */
export function customerFacts(row, extra = {}) {
  const c = row.customer ?? row
  return {
    segment: row.segment,
    total_spend: row.monetary ?? c.spend ?? 0,
    order_count: row.frequency ?? c.orders ?? 0,
    aov: row.aov ?? 0,
    days_since_order: row.recencyDays ?? 999,
    days_since_join: Math.floor((Date.now() - (c.joinedAt ?? Date.now())) / DAY),
    city: c.city,
    state: c.state,
    city_tier: c.cityTier,
    channel: c.channel,
    payment_method: c.preferredPayment ?? extra.paymentMethod,
    has_returned: Boolean(extra.hasReturned),
    churn_risk: extra.churnRisk,
    loyalty_tier: extra.loyaltyTier,
    clv: extra.clv ?? 0,
    bought_category: extra.categories ?? [],
  }
}

function evalRule(rule, facts) {
  const actual = facts[rule.field]
  const v = rule.value
  if (v === '' || v == null) return true      // an empty rule is a no-op, not a blocker

  const num = Number(v)
  switch (rule.op) {
    case 'eq':  return Array.isArray(actual)
      ? actual.map(String).map(x => x.toLowerCase()).includes(String(v).toLowerCase())
      : String(actual).toLowerCase() === String(v).toLowerCase()
    case 'neq': return Array.isArray(actual)
      ? !actual.map(String).map(x => x.toLowerCase()).includes(String(v).toLowerCase())
      : String(actual).toLowerCase() !== String(v).toLowerCase()
    case 'gt':  return Number(actual) > num
    case 'gte': return Number(actual) >= num
    case 'lt':  return Number(actual) < num
    case 'lte': return Number(actual) <= num
    case 'contains': return Array.isArray(actual)
      ? actual.some(x => String(x).toLowerCase().includes(String(v).toLowerCase()))
      : String(actual ?? '').toLowerCase().includes(String(v).toLowerCase())
    case 'in': {
      const list = String(v).split(',').map(s => s.trim().toLowerCase())
      return Array.isArray(actual)
        ? actual.some(x => list.includes(String(x).toLowerCase()))
        : list.includes(String(actual).toLowerCase())
    }
    default: return false
  }
}

/** Resolve an audience definition against the customer base. */
export function resolveAudience(audience, rows = [], factsFor = customerFacts) {
  const rules = audience.rules || []
  const match = audience.match ?? 'all'
  if (!rules.length) return rows

  return rows.filter(row => {
    const facts = factsFor(row)
    return match === 'any'
      ? rules.some(r => evalRule(r, facts))
      : rules.every(r => evalRule(r, facts))
  })
}

/** Human-readable description of an audience, for the card view. */
export function describeAudience(audience) {
  const rules = audience.rules || []
  if (!rules.length) return 'Everyone'
  const joiner = audience.match === 'any' ? ' OR ' : ' AND '
  return rules.map(r => {
    const f = AUDIENCE_FIELDS[r.field]?.label ?? r.field
    const op = AUDIENCE_OPERATORS[r.op]?.label ?? r.op
    return `${f} ${op} ${r.value}`
  }).join(joiner)
}

/* --------------------------------------------------------------- channels */

/**
 * Per-channel economics. Indian D2C leans heavily on WhatsApp because delivery
 * and open rates dwarf email, so the defaults reflect that rather than western
 * benchmarks.
 */
/**
 * Conversion rates are share of DELIVERED messages that place an order, for a
 * broadcast campaign to an opted-in list. They are deliberately conservative —
 * an over-optimistic model here would green-light sends that lose money, which
 * is the exact failure this screen exists to prevent.
 */
export const CHANNELS = {
  whatsapp: {
    id: 'whatsapp', label: 'WhatsApp', icon: '◈',
    costPerMessage: 0.85, deliveryRate: 0.98, openRate: 0.82, clickRate: 0.12, conversionRate: 0.014,
    note: 'Highest engagement in India, but template approval is required',
  },
  email: {
    id: 'email', label: 'Email', icon: '✉',
    costPerMessage: 0.05, deliveryRate: 0.94, openRate: 0.22, clickRate: 0.028, conversionRate: 0.004,
    note: 'Cheapest per send, best for long-form and receipts',
  },
  sms: {
    id: 'sms', label: 'SMS', icon: '▭',
    costPerMessage: 0.18, deliveryRate: 0.96, openRate: 0.55, clickRate: 0.045, conversionRate: 0.006,
    note: 'DLT registration mandatory; keep to transactional-style copy',
  },
  push: {
    id: 'push', label: 'Web push', icon: '◉',
    costPerMessage: 0.01, deliveryRate: 0.62, openRate: 0.11, clickRate: 0.021, conversionRate: 0.0025,
    note: 'Free to send but only reaches opted-in browsers',
  },
}

/**
 * Forecast a campaign before it is sent. This is the screen that stops someone
 * blasting 40,000 WhatsApp messages at a ₹34,000 cost for a ₹12,000 return.
 */
export function estimateCampaign(campaign, audienceSize, { aov = 2400, marginPct = 32 } = {}) {
  const ch = CHANNELS[campaign.channel] ?? CHANNELS.email
  const reach = Math.round(audienceSize * ch.deliveryRate)
  const opens = Math.round(reach * ch.openRate)
  const clicks = Math.round(reach * ch.clickRate)

  // A discount lifts conversion but eats margin — model both sides.
  const discountPct = campaign.discountPct ?? 0
  const liftFactor = 1 + Math.min(1.4, discountPct / 22)
  const conversions = Math.round(reach * ch.conversionRate * liftFactor)

  const orderValue = aov * (1 - discountPct / 100)
  const revenue = Math.round(conversions * orderValue)
  // Revenue is already net of the discount (orderValue is discounted), so this
  // figure is reported for visibility only — never subtract it again.
  const grossMargin = Math.round(revenue * (marginPct / 100))
  const cost = Math.round(audienceSize * ch.costPerMessage)
  const discountCost = Math.round(conversions * aov * (discountPct / 100))
  const netReturn = grossMargin - cost
  const roi = cost > 0 ? Math.round((netReturn / cost) * 10) / 10 : 0

  return {
    channel: ch,
    audienceSize,
    reach, opens, clicks, conversions,
    conversionRate: reach > 0 ? Math.round((conversions / reach) * 1000) / 10 : 0,
    revenue,
    grossMargin,
    cost,
    discountCost,
    netReturn,
    roi,
    costPerAcquisition: conversions > 0 ? Math.round(cost / conversions) : 0,
    revenuePerMessage: audienceSize > 0 ? Math.round((revenue / audienceSize) * 100) / 100 : 0,
    worthSending: netReturn > 0,
    verdict: netReturn > cost * 3 ? 'Strong — send it'
      : netReturn > 0 ? 'Marginal — consider a tighter audience'
      : 'Do not send — the cost exceeds the expected margin',
  }
}

/** Compare the same campaign across every channel, best ROI first. */
export function compareChannels(campaign, audienceSize, opts = {}) {
  return Object.keys(CHANNELS)
    .map(id => ({ id, ...estimateCampaign({ ...campaign, channel: id }, audienceSize, opts) }))
    .sort((a, b) => b.netReturn - a.netReturn)
}

/* ------------------------------------------------------------ attribution */

/**
 * Channel attribution from the order book. Supports the three models teams
 * actually argue about, so the numbers can be sanity-checked against each other.
 */
export function attribution(orders = [], model = 'last_touch') {
  const groups = {}

  for (const o of orders) {
    if (['Cancelled'].includes(o.status)) continue
    const touchpoints = o.touchpoints?.length ? o.touchpoints : [o.channel ?? 'Direct']

    let weights
    if (model === 'first_touch') {
      weights = touchpoints.map((_, i) => (i === 0 ? 1 : 0))
    } else if (model === 'linear') {
      weights = touchpoints.map(() => 1 / touchpoints.length)
    } else {
      weights = touchpoints.map((_, i) => (i === touchpoints.length - 1 ? 1 : 0))
    }

    touchpoints.forEach((tp, i) => {
      if (!weights[i]) return
      groups[tp] = groups[tp] || { channel: tp, orders: 0, revenue: 0, credit: 0 }
      groups[tp].orders += weights[i]
      groups[tp].revenue += (o.total ?? 0) * weights[i]
      groups[tp].credit += weights[i]
    })
  }

  const total = Object.values(groups).reduce((s, g) => s + g.revenue, 0) || 1
  return Object.values(groups)
    .map(g => ({
      ...g,
      orders: Math.round(g.orders * 10) / 10,
      revenue: Math.round(g.revenue),
      sharePct: Math.round((g.revenue / total) * 1000) / 10,
      aov: g.orders > 0 ? Math.round(g.revenue / g.orders) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
}

/** Abandoned-cart recovery opportunity sizing. */
export function cartRecovery(carts = [], { aov = 2400, recoveryRate = 0.11, marginPct = 32 } = {}) {
  const active = carts.filter(c => !c.converted)
  const value = active.reduce((s, c) => s + (c.value ?? c.total ?? aov), 0)
  const recoverable = Math.round(value * recoveryRate)

  return {
    abandonedCarts: active.length,
    cartValue: Math.round(value),
    avgCartValue: active.length ? Math.round(value / active.length) : 0,
    recoverableRevenue: recoverable,
    recoverableMargin: Math.round(recoverable * (marginPct / 100)),
    expectedOrders: Math.round(active.length * recoveryRate),
    stages: [
      { at: '1 hour', channel: 'whatsapp', lift: 0.05, note: 'Gentle nudge, no discount' },
      { at: '24 hours', channel: 'email', lift: 0.035, note: 'Show the items again with reviews' },
      { at: '72 hours', channel: 'whatsapp', lift: 0.025, note: 'Offer free shipping or 10% off' },
    ],
  }
}

export default {
  AUDIENCE_FIELDS, AUDIENCE_OPERATORS, operatorsForField,
  customerFacts, resolveAudience, describeAudience,
  CHANNELS, estimateCampaign, compareChannels, attribution, cartRecovery,
}
