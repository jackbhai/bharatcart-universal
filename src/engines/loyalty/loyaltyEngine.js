/**
 * Loyalty engine.
 *
 * The admin configures everything (earn rate, tiers, multipliers, expiry,
 * redemption rules, bonuses) and this computes what the customer sees —
 * points preview on the PDP, tier progress, redemption caps at checkout.
 */

export const DEFAULT_CONFIG = {
  enabled: true,
  programName: 'BharatCart Rewards',
  currencyName: 'Points',

  // ---- earning
  earnPerRupee: 0.05,          // 5 points per ₹100
  earnOn: 'net',               // net (after discount) | gross
  earnRounding: 'floor',       // floor | round | ceil
  excludeShipping: true,
  excludeTax: true,
  excludeDiscounted: false,
  minOrderToEarn: 0,
  maxPointsPerOrder: 5000,

  categoryMultipliers: {},     // { 'Jewellery': 2 }
  brandMultipliers: {},

  // ---- bonuses
  signupBonus: 100,
  birthdayBonus: 250,
  reviewBonus: 50,
  photoReviewBonus: 100,
  referralBonusReferrer: 500,
  referralBonusReferee: 250,
  firstOrderBonus: 200,
  streakEnabled: true,
  streakBonus: 150,
  streakWindowDays: 45,

  // ---- redemption
  pointValue: 0.25,            // 1 point = ₹0.25
  minRedeem: 200,
  maxRedeemPercent: 20,        // max 20% of order
  maxRedeemPoints: 4000,
  redeemStep: 50,
  allowOnShipping: false,
  allowOnDiscounted: true,
  blackoutCategories: [],

  // ---- expiry
  expiryMonths: 12,
  expiryWarningDays: 30,
  expireOnInactivity: true,
  inactivityMonths: 18,

  // ---- tiers
  tiers: [
    { id: 'silver',   name: 'Silver',   threshold: 0,     colour: '#94A3B8', multiplier: 1,   perks: ['Earn 5 points per ₹100', 'Birthday reward'] },
    { id: 'gold',     name: 'Gold',     threshold: 15000, colour: '#EAB308', multiplier: 1.25, perks: ['1.25× points', 'Free shipping over ₹499', 'Early sale access'] },
    { id: 'platinum', name: 'Platinum', threshold: 50000, colour: '#64748B', multiplier: 1.5,  perks: ['1.5× points', 'Always free shipping', 'Priority support', 'Exclusive drops'] },
    { id: 'diamond',  name: 'Diamond',  threshold: 150000, colour: '#0EA5E9', multiplier: 2,   perks: ['2× points', 'Dedicated stylist', 'Free returns', 'Invite-only events'] },
  ],
  tierBasis: 'spend12m',       // spend12m | lifetimeSpend | points
  tierDowngrade: true,
  tierGraceMonths: 3,
}

/* --------------------------------------------------------------- earn */

/**
 * Points a cart/order will earn.
 * @param {object} order { items:[{product, qty, price, discount}], subtotal, discount, shipping, tax }
 * @param {object} customer
 * @param {object} config
 */
export function calculateEarn(order, customer = {}, config = DEFAULT_CONFIG) {
  const c = { ...DEFAULT_CONFIG, ...config }
  if (!c.enabled) return zeroEarn('Loyalty programme is switched off')

  const items = order.items || []
  let base = 0
  const lines = []

  for (const it of items) {
    const p = it.product || {}
    const qty = it.qty ?? 1
    const gross = (it.price ?? p.price ?? 0) * qty
    const net = gross - (it.discount || 0)
    let amount = c.earnOn === 'gross' ? gross : net

    if (c.excludeDiscounted && (it.discount > 0 || (p.discountPct || 0) > 0)) {
      lines.push({ name: p.name, points: 0, note: 'Discounted items excluded' })
      continue
    }

    const catMult = c.categoryMultipliers?.[p.category] ?? 1
    const brandMult = c.brandMultipliers?.[p.brand] ?? 1
    const linePoints = amount * c.earnPerRupee * catMult * brandMult

    base += linePoints
    lines.push({
      name: p.name,
      amount,
      multiplier: catMult * brandMult,
      points: applyRounding(linePoints, c.earnRounding),
      note: catMult * brandMult !== 1 ? `${catMult * brandMult}× category bonus` : null,
    })
  }

  const orderTotal = order.subtotal ?? items.reduce((s, i) => s + (i.price ?? 0) * (i.qty ?? 1), 0)
  if (orderTotal < c.minOrderToEarn) {
    return zeroEarn(`Minimum order of ₹${c.minOrderToEarn} required to earn points`)
  }

  const tier = resolveTier(customer, c)
  const tierMultiplier = tier?.multiplier ?? 1
  let total = base * tierMultiplier

  const bonuses = []
  if (c.firstOrderBonus && (customer.orders ?? 0) === 0) {
    bonuses.push({ label: 'First order bonus', points: c.firstOrderBonus })
    total += c.firstOrderBonus
  }
  if (c.streakEnabled && isStreak(customer, c)) {
    bonuses.push({ label: 'Loyalty streak bonus', points: c.streakBonus })
    total += c.streakBonus
  }

  let points = applyRounding(total, c.earnRounding)
  let capped = false
  if (c.maxPointsPerOrder && points > c.maxPointsPerOrder) {
    points = c.maxPointsPerOrder
    capped = true
  }

  return {
    points,
    basePoints: applyRounding(base, c.earnRounding),
    tierMultiplier,
    tier,
    bonuses,
    lines,
    capped,
    value: round2(points * c.pointValue),
    message: null,
  }
}

const zeroEarn = (message) => ({
  points: 0, basePoints: 0, tierMultiplier: 1, tier: null,
  bonuses: [], lines: [], capped: false, value: 0, message,
})

/* ------------------------------------------------------------- redeem */

/**
 * How many points can be spent on this cart, and what they're worth.
 */
export function calculateRedeem(cart, customer = {}, config = DEFAULT_CONFIG, requestedPoints = null) {
  const c = { ...DEFAULT_CONFIG, ...config }
  const balance = customer.points ?? 0

  if (!c.enabled) return zeroRedeem(balance, 'Loyalty programme is switched off')
  if (balance < c.minRedeem) {
    return zeroRedeem(balance, `You need at least ${c.minRedeem} points to redeem`)
  }

  const eligibleSubtotal = (cart.items || [])
    .filter(i => !c.blackoutCategories.includes(i.product?.category))
    .filter(i => c.allowOnDiscounted || !(i.discount > 0))
    .reduce((s, i) => s + (i.price ?? 0) * (i.qty ?? 1) - (i.discount || 0), 0)

  if (eligibleSubtotal <= 0) {
    return zeroRedeem(balance, 'No eligible items for point redemption')
  }

  const capByPercent = eligibleSubtotal * (c.maxRedeemPercent / 100)
  const capByPoints = c.maxRedeemPoints * c.pointValue
  const capByBalance = balance * c.pointValue
  const maxValue = Math.min(capByPercent, capByPoints, capByBalance, eligibleSubtotal)

  let maxPoints = Math.floor(maxValue / c.pointValue)
  maxPoints = Math.floor(maxPoints / c.redeemStep) * c.redeemStep
  if (maxPoints < c.minRedeem) {
    return zeroRedeem(balance, `Order too small — redeem at least ${c.minRedeem} points`)
  }

  let usePoints = requestedPoints == null ? maxPoints : Math.min(requestedPoints, maxPoints)
  usePoints = Math.floor(usePoints / c.redeemStep) * c.redeemStep
  if (usePoints < c.minRedeem) usePoints = 0

  const limiter =
    maxValue === capByPercent ? `Capped at ${c.maxRedeemPercent}% of the order` :
    maxValue === capByPoints ? `Capped at ${c.maxRedeemPoints} points per order` :
    maxValue === capByBalance ? 'Limited by your points balance' : null

  return {
    balance,
    maxPoints,
    maxValue: round2(maxPoints * c.pointValue),
    usePoints,
    discount: round2(usePoints * c.pointValue),
    remaining: balance - usePoints,
    step: c.redeemStep,
    minRedeem: c.minRedeem,
    pointValue: c.pointValue,
    limiter,
    message: null,
  }
}

const zeroRedeem = (balance, message) => ({
  balance, maxPoints: 0, maxValue: 0, usePoints: 0, discount: 0,
  remaining: balance, step: 50, minRedeem: 200, pointValue: 0.25, limiter: null, message,
})

/* -------------------------------------------------------------- tiers */

export function resolveTier(customer = {}, config = DEFAULT_CONFIG) {
  const c = { ...DEFAULT_CONFIG, ...config }
  const tiers = [...(c.tiers || [])].sort((a, b) => a.threshold - b.threshold)
  const basis = tierBasisValue(customer, c)
  let current = tiers[0] || null
  for (const t of tiers) if (basis >= t.threshold) current = t
  return current ? { ...current, basisValue: basis } : null
}

export function tierProgress(customer = {}, config = DEFAULT_CONFIG) {
  const c = { ...DEFAULT_CONFIG, ...config }
  const tiers = [...(c.tiers || [])].sort((a, b) => a.threshold - b.threshold)
  const basis = tierBasisValue(customer, c)
  const current = resolveTier(customer, c)
  const next = tiers.find(t => t.threshold > basis) || null

  const floor = current?.threshold ?? 0
  const ceiling = next?.threshold ?? floor
  const span = ceiling - floor

  return {
    current,
    next,
    basis,
    basisLabel: { spend12m: 'spend in last 12 months', lifetimeSpend: 'lifetime spend', points: 'points earned' }[c.tierBasis],
    toNext: next ? Math.max(0, ceiling - basis) : 0,
    percent: next && span > 0 ? Math.min(100, Math.round(((basis - floor) / span) * 100)) : 100,
    isTop: !next,
    allTiers: tiers.map(t => ({ ...t, reached: basis >= t.threshold, current: t.id === current?.id })),
  }
}

function tierBasisValue(customer, c) {
  switch (c.tierBasis) {
    case 'lifetimeSpend': return customer.spend ?? 0
    case 'points': return customer.lifetimePoints ?? customer.points ?? 0
    case 'spend12m':
    default: return customer.spend12m ?? customer.spend ?? 0
  }
}

/* ------------------------------------------------------------- expiry */

/** Points expiring soon, given a ledger of earn entries. */
export function expiringPoints(ledger = [], config = DEFAULT_CONFIG, now = Date.now()) {
  const c = { ...DEFAULT_CONFIG, ...config }
  if (!c.expiryMonths) return { total: 0, soon: 0, entries: [] }

  const ms = c.expiryMonths * 30 * 24 * 3600 * 1000
  const warnMs = c.expiryWarningDays * 24 * 3600 * 1000

  const entries = ledger
    .filter(e => e.type === 'earn' && !e.expired)
    .map(e => ({ ...e, expiresAt: e.at + ms, daysLeft: Math.ceil((e.at + ms - now) / 86400000) }))
    .filter(e => e.expiresAt > now)
    .sort((a, b) => a.expiresAt - b.expiresAt)

  return {
    total: entries.reduce((s, e) => s + e.points, 0),
    soon: entries.filter(e => e.expiresAt - now <= warnMs).reduce((s, e) => s + e.points, 0),
    soonestDate: entries[0]?.expiresAt ?? null,
    entries: entries.filter(e => e.expiresAt - now <= warnMs),
  }
}

/** Programme-wide liability — what the points on issue are worth. */
export function liabilityReport(customers = [], config = DEFAULT_CONFIG) {
  const c = { ...DEFAULT_CONFIG, ...config }
  const totalPoints = customers.reduce((s, cu) => s + (cu.points ?? 0), 0)
  const byTier = {}
  for (const cu of customers) {
    const t = resolveTier(cu, c)
    const key = t?.name || 'None'
    byTier[key] = byTier[key] || { tier: key, customers: 0, points: 0, colour: t?.colour }
    byTier[key].customers++
    byTier[key].points += cu.points ?? 0
  }
  return {
    totalPoints,
    liability: round2(totalPoints * c.pointValue),
    avgBalance: customers.length ? Math.round(totalPoints / customers.length) : 0,
    membersWithPoints: customers.filter(cu => (cu.points ?? 0) > 0).length,
    byTier: Object.values(byTier)
      .map(b => ({ ...b, value: round2(b.points * c.pointValue) }))
      .sort((a, b) => b.points - a.points),
  }
}

/* ----------------------------------------------------------- previews */

/** Points a single product would earn — shown on the PDP. */
export function productEarnPreview(product, customer = {}, config = DEFAULT_CONFIG, qty = 1) {
  return calculateEarn(
    { items: [{ product, qty, price: product.price }], subtotal: product.price * qty },
    customer, config
  )
}

/** Ways-to-earn checklist for the loyalty dashboard. */
export function waysToEarn(config = DEFAULT_CONFIG) {
  const c = { ...DEFAULT_CONFIG, ...config }
  return [
    { id: 'purchase', label: 'Make a purchase', points: `${Math.round(c.earnPerRupee * 100)} per ₹100`, icon: '🛍' },
    { id: 'signup', label: 'Create an account', points: c.signupBonus, icon: '✦', oneTime: true },
    { id: 'first', label: 'Place your first order', points: c.firstOrderBonus, icon: '🎉', oneTime: true },
    { id: 'review', label: 'Write a review', points: c.reviewBonus, icon: '★' },
    { id: 'photo', label: 'Add a photo to a review', points: c.photoReviewBonus, icon: '📷' },
    { id: 'birthday', label: 'Birthday reward', points: c.birthdayBonus, icon: '🎂', annual: true },
    { id: 'referral', label: 'Refer a friend', points: c.referralBonusReferrer, icon: '👥' },
    { id: 'streak', label: `Order within ${c.streakWindowDays} days`, points: c.streakBonus, icon: '🔥', hidden: !c.streakEnabled },
  ].filter(w => !w.hidden && w.points)
}

/* ------------------------------------------------------------ helpers */
function applyRounding(n, mode) {
  if (mode === 'ceil') return Math.ceil(n)
  if (mode === 'round') return Math.round(n)
  return Math.floor(n)
}
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

function isStreak(customer, c) {
  const days = customer.daysSinceOrder
  return days != null && days <= c.streakWindowDays && (customer.orders ?? 0) > 0
}

export default {
  DEFAULT_CONFIG, calculateEarn, calculateRedeem, resolveTier, tierProgress,
  expiringPoints, liabilityReport, productEarnPreview, waysToEarn,
}
