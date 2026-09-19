/**
 * Subscription engine — milk / dairy delivery schedules.
 *
 * Pure, side-effect free. All date math is UTC-based and every function takes
 * an injectable `now`, so schedules are deterministic and testable.
 */

const DAY = 86400000

export const FREQUENCIES = [
  { id: 'daily',     label: 'Every day',     days: 1 },
  { id: 'alternate', label: 'Alternate days', days: 2 },
  { id: 'weekly',    label: 'Weekly',         days: 7 },
]

export const FREQUENCY_BY_ID = Object.fromEntries(FREQUENCIES.map(f => [f.id, f]))

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dateOnlyISO(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

function parseDateISO(iso) {
  // Interpret YYYY-MM-DD as UTC midnight — stable across timezones.
  const ms = Date.parse(`${iso}T00:00:00Z`)
  return Number.isFinite(ms) ? ms : null
}

function labelFor(ms, slot) {
  const d = new Date(ms)
  const slotLabel = slot === 'morning' ? 'Morning (6–9 AM)' : 'Evening (5–8 PM)'
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} — ${slotLabel}`
}

/**
 * Upcoming delivery slots for a subscribable product.
 *
 * @param {object} product  uses product.attributes.noDeliveryDays (0=Sun..6=Sat) ?? []
 * @param {string} pincode  kept for future cold-chain routing; not used in maths
 * @param {number} [now=Date.now()]
 * @param {number} [count=7]  how many slots to return
 * @returns {Array<{ dateISO, slot:'morning'|'evening', label }>}
 */
export function nextDeliverySlots(product, pincode, now = Date.now(), count = 7) {
  const noDays = new Set(product?.attributes?.noDeliveryDays ?? [])
  const eveningOff = product?.attributes?.eveningDelivery === false
  const slots = []

  // Start tomorrow — same-day ordering closes at the morning cutoff.
  let dayMs = Math.floor(now / DAY) * DAY + DAY

  while (slots.length < count && slots.length < 500) {
    const dow = new Date(dayMs).getUTCDay()
    if (!noDays.has(dow)) {
      slots.push({ dateISO: dateOnlyISO(dayMs), slot: 'morning', label: labelFor(dayMs, 'morning') })
      if (!eveningOff && slots.length < count) {
        slots.push({ dateISO: dateOnlyISO(dayMs), slot: 'evening', label: labelFor(dayMs, 'evening') })
      }
    }
    dayMs += DAY
  }

  return slots.slice(0, count)
}

/**
 * Build a delivery schedule.
 *
 * @param {object} p
 * @param {string} p.productId
 * @param {string} p.variantSku
 * @param {number} p.qty
 * @param {string|object} p.frequency  'daily' | 'alternate' | 'weekly' or { days }
 * @param {string} p.startDateISO      'YYYY-MM-DD'
 * @param {number} p.occurrences
 * @returns {Array<{ dateISO, qty, status:'scheduled', productId, variantSku, frequency }>}
 */
export function buildSchedule({ productId, variantSku, qty, frequency, startDateISO, occurrences }) {
  const freqId = typeof frequency === 'string' ? frequency : frequency?.id
  const step = typeof frequency === 'object' && frequency?.days != null
    ? Number(frequency.days)
    : (FREQUENCY_BY_ID[freqId]?.days ?? 1)

  const startMs = parseDateISO(startDateISO)
  if (startMs == null) throw new Error(`Invalid startDateISO: ${startDateISO}`)
  if (!Number.isFinite(occurrences) || occurrences <= 0) {
    throw new Error(`occurrences must be a positive number, got ${occurrences}`)
  }

  const schedule = []
  for (let i = 0; i < occurrences; i++) {
    schedule.push({
      dateISO: dateOnlyISO(startMs + i * step * DAY),
      qty,
      status: 'scheduled',
      productId,
      variantSku,
      frequency: freqId ?? 'daily',
    })
  }
  return schedule
}

/**
 * Totals for a schedule at a unit price.
 * @returns {{ totalQty, unitPrice, total, occurrences }}
 */
export function scheduleTotal(schedule = [], unitPrice = 0) {
  const active = schedule.filter(s => s.status === 'scheduled')
  const totalQty = active.reduce((sum, s) => sum + (s.qty ?? 0), 0)
  return {
    totalQty,
    unitPrice,
    total: Math.round(totalQty * unitPrice * 100) / 100,
    occurrences: active.length,
  }
}

/** Mark one date skipped — returns a new array, input untouched. */
export function skipDate(schedule = [], dateISO) {
  return schedule.map(s =>
    s.dateISO === dateISO ? { ...s, status: 'skipped' } : s
  )
}

/** Pause every delivery in [fromISO, toISO] — returns a new array, input untouched. */
export function pauseSchedule(schedule = [], fromISO, toISO) {
  const from = parseDateISO(fromISO)
  const to = parseDateISO(toISO)
  if (from == null || to == null) throw new Error(`Invalid pause range: ${fromISO} – ${toISO}`)
  return schedule.map(s => {
    const ms = parseDateISO(s.dateISO)
    return ms != null && ms >= from && ms <= to ? { ...s, status: 'paused' } : s
  })
}

export default { FREQUENCIES, FREQUENCY_BY_ID, nextDeliverySlots, buildSchedule, scheduleTotal, skipDate, pauseSchedule }
