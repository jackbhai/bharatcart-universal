/**
 * Condition engine for promotions.
 *
 * A condition is a plain object the admin builds in the UI:
 *   { field, op, value }
 * Conditions combine into groups: { all: [...] } / { any: [...] } / { none: [...] }
 *
 * Everything evaluates against a single `ctx` describing the cart + customer.
 */

export const FIELDS = {
  // cart
  cart_subtotal:     { label: 'Cart subtotal', type: 'number', group: 'Cart' },
  cart_item_count:   { label: 'Item count', type: 'number', group: 'Cart' },
  cart_unit_count:   { label: 'Total units', type: 'number', group: 'Cart' },
  cart_weight:       { label: 'Cart weight (g)', type: 'number', group: 'Cart' },
  cart_has_product:  { label: 'Cart contains product', type: 'product', group: 'Cart' },
  cart_has_category: { label: 'Cart contains category', type: 'category', group: 'Cart' },
  cart_has_brand:    { label: 'Cart contains brand', type: 'brand', group: 'Cart' },
  cart_has_tag:      { label: 'Cart contains tag', type: 'tag', group: 'Cart' },
  cart_max_discount: { label: 'Highest item discount %', type: 'number', group: 'Cart' },

  // customer
  customer_group:    { label: 'Customer group', type: 'group', group: 'Customer' },
  customer_segment:  { label: 'RFM segment', type: 'segment', group: 'Customer' },
  customer_orders:   { label: 'Lifetime orders', type: 'number', group: 'Customer' },
  customer_spend:    { label: 'Lifetime spend', type: 'number', group: 'Customer' },
  customer_is_new:   { label: 'First-time buyer', type: 'bool', group: 'Customer' },
  customer_tier:     { label: 'Loyalty tier', type: 'tier', group: 'Customer' },
  customer_days_since_order: { label: 'Days since last order', type: 'number', group: 'Customer' },
  customer_has_gstin: { label: 'Has GSTIN (B2B)', type: 'bool', group: 'Customer' },

  // location
  state:             { label: 'State', type: 'state', group: 'Location' },
  zone:              { label: 'Zone', type: 'zone', group: 'Location' },
  city_tier:         { label: 'City tier', type: 'number', group: 'Location' },
  pincode:           { label: 'Pincode', type: 'text', group: 'Location' },

  // context
  payment_method:    { label: 'Payment method', type: 'payment', group: 'Context' },
  channel:           { label: 'Channel', type: 'channel', group: 'Context' },
  device:            { label: 'Device', type: 'device', group: 'Context' },
  day_of_week:       { label: 'Day of week', type: 'weekday', group: 'Context' },
  hour_of_day:       { label: 'Hour of day', type: 'number', group: 'Context' },
  date:              { label: 'Date', type: 'date', group: 'Context' },
}

export const OPERATORS = {
  eq:      { label: 'is', types: ['number','text','bool','group','segment','tier','state','zone','payment','channel','device','weekday','category','brand','tag','product'] },
  ne:      { label: 'is not', types: ['number','text','bool','group','segment','tier','state','zone','payment','channel','device','weekday','category','brand','tag','product'] },
  gt:      { label: 'is more than', types: ['number','date'] },
  gte:     { label: 'is at least', types: ['number','date'] },
  lt:      { label: 'is less than', types: ['number','date'] },
  lte:     { label: 'is at most', types: ['number','date'] },
  between: { label: 'is between', types: ['number','date'] },
  in:      { label: 'is one of', types: ['group','segment','tier','state','zone','payment','channel','device','weekday','category','brand','tag','product','text'] },
  nin:     { label: 'is none of', types: ['group','segment','tier','state','zone','payment','channel','device','weekday','category','brand','tag','product','text'] },
  contains:{ label: 'contains', types: ['text','category','brand','tag','product'] },
  starts:  { label: 'starts with', types: ['text'] },
}

/** Operators valid for a given field. */
export function operatorsFor(field) {
  const type = FIELDS[field]?.type || 'text'
  return Object.entries(OPERATORS)
    .filter(([, o]) => o.types.includes(type))
    .map(([id, o]) => ({ id, ...o }))
}

/* ------------------------------------------------------------ extract */

/** Derive every field value from the runtime context. */
export function deriveFacts(ctx = {}) {
  const { cart = [], customer = {}, address = {}, payment, channel, device, now = Date.now() } = ctx
  const d = new Date(now)

  const items = cart.map(l => ({
    ...l,
    product: l.product || {},
    qty: l.qty ?? 1,
    lineTotal: (l.price ?? l.product?.price ?? 0) * (l.qty ?? 1),
  }))

  const subtotal = items.reduce((s, l) => s + l.lineTotal, 0)

  return {
    cart_subtotal: subtotal,
    cart_item_count: items.length,
    cart_unit_count: items.reduce((s, l) => s + l.qty, 0),
    cart_weight: items.reduce((s, l) => s + (l.product.weightG || 0) * l.qty, 0),
    cart_has_product: items.map(l => l.product.id),
    cart_has_category: [...new Set(items.map(l => l.product.category))],
    cart_has_brand: [...new Set(items.map(l => l.product.brand))],
    cart_has_tag: [...new Set(items.flatMap(l => l.product.tags || []))],
    cart_max_discount: Math.max(0, ...items.map(l => l.product.discountPct || 0)),

    customer_group: customer.group || 'retail',
    customer_segment: customer.segment || 'New',
    customer_orders: customer.orders ?? 0,
    customer_spend: customer.spend ?? 0,
    customer_is_new: (customer.orders ?? 0) === 0,
    customer_tier: customer.tier || 'none',
    customer_days_since_order: customer.daysSinceOrder ?? 9999,
    customer_has_gstin: Boolean(customer.gstin),

    state: address.state || customer.state || null,
    zone: address.zone || customer.zone || null,
    city_tier: address.tier ?? customer.tier2 ?? 1,
    pincode: address.pin || null,

    payment_method: payment || null,
    channel: channel || 'web',
    device: device || 'desktop',
    day_of_week: d.getDay(),
    hour_of_day: d.getHours(),
    date: now,
  }
}

/* ----------------------------------------------------------- evaluate */

/** Evaluate one condition against derived facts. */
export function evalCondition(cond, facts) {
  if (!cond || !cond.field) return true
  const actual = facts[cond.field]
  const expected = cond.value
  const op = cond.op || 'eq'

  // array-valued facts (cart contents) use membership semantics
  if (Array.isArray(actual)) {
    const wanted = Array.isArray(expected) ? expected : [expected]
    switch (op) {
      case 'eq': case 'in': case 'contains':
        return wanted.some(w => actual.includes(w))
      case 'ne': case 'nin':
        return !wanted.some(w => actual.includes(w))
      default:
        return wanted.some(w => actual.includes(w))
    }
  }

  switch (op) {
    case 'eq':  return looseEq(actual, expected)
    case 'ne':  return !looseEq(actual, expected)
    case 'gt':  return num(actual) > num(expected)
    case 'gte': return num(actual) >= num(expected)
    case 'lt':  return num(actual) < num(expected)
    case 'lte': return num(actual) <= num(expected)
    case 'between': {
      const [a, b] = Array.isArray(expected) ? expected : [expected?.min, expected?.max]
      return num(actual) >= num(a) && num(actual) <= num(b)
    }
    case 'in':  return toArr(expected).some(v => looseEq(actual, v))
    case 'nin': return !toArr(expected).some(v => looseEq(actual, v))
    case 'contains': return String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase())
    case 'starts': return String(actual ?? '').toLowerCase().startsWith(String(expected ?? '').toLowerCase())
    default: return true
  }
}

/** Evaluate a condition group (all / any / none), recursively. */
export function evalGroup(group, facts) {
  if (!group) return { pass: true, reasons: [] }

  // bare array == all
  if (Array.isArray(group)) return evalGroup({ all: group }, facts)

  const reasons = []
  const run = (conds) => (conds || []).map(c => {
    const isGroup = c.all || c.any || c.none
    const res = isGroup ? evalGroup(c, facts) : { pass: evalCondition(c, facts), cond: c }
    if (!res.pass && !isGroup) reasons.push(describe(c, facts))
    if (!res.pass && isGroup) reasons.push(...(res.reasons || []))
    return res.pass
  })

  let pass = true
  if (group.all) pass = pass && run(group.all).every(Boolean)
  if (group.any) {
    const results = run(group.any)
    const anyPass = results.some(Boolean)
    if (anyPass) reasons.length = 0     // an `any` that passes clears its reasons
    pass = pass && anyPass
  }
  if (group.none) pass = pass && !run(group.none).some(Boolean)

  return { pass, reasons }
}

/** Human-readable failure reason, used by the simulator. */
export function describe(cond, facts) {
  const f = FIELDS[cond.field]
  const label = f?.label || cond.field
  const opLabel = OPERATORS[cond.op || 'eq']?.label || cond.op
  const actual = facts?.[cond.field]
  const shown = Array.isArray(actual) ? actual.join(', ') : actual
  const want = Array.isArray(cond.value) ? cond.value.join(' / ') : cond.value
  return `${label} ${opLabel} ${want} (currently ${shown ?? '—'})`
}

/* ------------------------------------------------------------ helpers */
const num = (v) => (typeof v === 'number' ? v : parseFloat(v) || 0)
const toArr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v])
function looseEq(a, b) {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b)
  if (!isNaN(num(a)) && !isNaN(num(b)) && a !== '' && b !== '') return num(a) === num(b)
  return String(a).toLowerCase() === String(b).toLowerCase()
}

export default { deriveFacts, evalCondition, evalGroup, FIELDS, OPERATORS, operatorsFor }
