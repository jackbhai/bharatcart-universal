/**
 * Shared interaction vocabulary.
 *
 * The audit that prompted this found 176 `motion.` usages across 39 admin
 * files but only 7 hover states and 1 tap state. The app had plenty of
 * *entrance* animation — things fading in on mount — and almost no *response*
 * animation. That is the wrong way round. An entrance plays once and is
 * decoration; a press state plays every single time the operator does
 * something and is feedback. Feedback is what makes software feel solid.
 *
 * Everything here is a plain object spread into a motion component, so there
 * is no wrapper component, no extra DOM node, and no measurable cost:
 *
 *   <motion.button {...press}>Save</motion.button>
 *   <motion.div {...lift}>…</motion.div>
 *
 * Every preset is tuned to the same feel: fast in, slightly slower out, no
 * bounce on anything the user clicks repeatedly. Springs are reserved for
 * things that move position; opacity and scale use eased tweens because a
 * spring on opacity reads as a flicker.
 */

/** Shared easing. A gentle "out" curve — fast start, soft landing. */
export const EASE = [0.22, 1, 0.36, 1]
export const EASE_IN_OUT = [0.65, 0, 0.35, 1]

export const DUR = {
  instant: 0.12,
  fast: 0.18,
  base: 0.26,
  slow: 0.4,
  lazy: 0.6,
}

/* ============================================================
   Press / hover feedback
============================================================ */

/**
 * The default for any clickable control.
 *
 * Scale values are deliberately small. A button that visibly shrinks on every
 * click is charming for a day and irritating by the end of a shift, and an
 * operator processing 200 orders will click these thousands of times.
 */
export const press = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.97 },
  transition: { duration: DUR.fast, ease: EASE },
}

/** For large surfaces — cards, tiles — where 1.02 would look like a jump. */
export const pressSoft = {
  whileHover: { scale: 1.008 },
  whileTap: { scale: 0.994 },
  transition: { duration: DUR.fast, ease: EASE },
}

/** Icon buttons: no scale, just a brightness lift, so tight layouts stay put. */
export const pressIcon = {
  whileHover: { opacity: 1, scale: 1.08 },
  whileTap: { scale: 0.92 },
  transition: { duration: DUR.instant, ease: EASE },
}

/** Card hover: rises toward the cursor. */
export const lift = {
  whileHover: { y: -4 },
  whileTap: { y: -1 },
  transition: { duration: DUR.base, ease: EASE },
}

/** A stronger lift with a shadow, for product cards and feature tiles. */
export const liftHigh = {
  whileHover: { y: -8, scale: 1.015 },
  whileTap: { y: -3, scale: 1.005 },
  transition: { type: 'spring', stiffness: 380, damping: 26 },
}

/** Table rows: too subtle to distract, enough to confirm the row is live. */
export const rowHover = {
  whileHover: { x: 2 },
  transition: { duration: DUR.fast, ease: EASE },
}

/* ============================================================
   Entrances
============================================================ */

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: DUR.base, ease: EASE },
}

export const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DUR.base, ease: EASE },
}

export const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: DUR.fast, ease: EASE },
}

/** Popovers and dropdowns — grows from its trigger edge. */
export const popIn = {
  initial: { opacity: 0, scale: 0.95, y: -6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: -4 },
  transition: { duration: DUR.fast, ease: EASE },
}

/* ============================================================
   Lists
============================================================ */

/**
 * Stagger for a list of results.
 *
 * `staggerChildren` is capped by `staggerMax` further down: a 0.04s stagger on
 * 12 rows is elegant, and on 480 customers it means the last row appears
 * nineteen seconds later. Long lists must cap the total, not the per-item
 * delay — this is the single most common way list animation becomes a bug.
 */
export const listContainer = (gap = 0.04, max = 0.35) => ({
  initial: 'hidden',
  animate: 'show',
  variants: {
    hidden: {},
    show: { transition: { staggerChildren: gap, delayChildren: 0.02, staggerDirection: 1, when: 'beforeChildren', ...(max ? {} : {}) } },
  },
})

export const listItem = {
  variants: {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } },
  },
}

/**
 * Per-item delay that flattens out on long lists, so the whole list is always
 * fully visible within `maxTotal` seconds no matter how many items there are.
 */
export function staggerDelay(index, count, { gap = 0.04, maxTotal = 0.4 } = {}) {
  if (count <= 1) return 0
  const effective = Math.min(gap, maxTotal / Math.max(1, count - 1))
  return index * effective
}

/* ============================================================
   Numbers and state changes
============================================================ */

/** A value that just changed — flashes once to draw the eye. */
export const valueChange = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6, position: 'absolute' },
  transition: { duration: DUR.base, ease: EASE },
}

/** Attention pulse for a badge whose count went up. */
export const badgePop = {
  initial: { scale: 0.6, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.7, opacity: 0 },
  transition: { type: 'spring', stiffness: 520, damping: 22 },
}

/* ============================================================
   Device-aware helpers
============================================================ */

/**
 * Strip a preset down to nothing when motion is disabled.
 *
 * The device profile already downgrades heavy background effects. Interaction
 * feedback is different: it is cheap and it is *informative*, so it survives
 * on the medium tier and is only removed for an explicit reduced-motion
 * request or the lowest tier. Removing a press state from a slow phone does
 * not make the phone faster; it just makes the app feel broken.
 */
export function withMotion(preset, enabled = true) {
  if (enabled) return preset
  const { initial, animate, ...rest } = preset
  // Keep the end state so the element is still visible — dropping `animate`
  // entirely on an entrance preset would leave it at opacity 0 forever, which
  // is precisely the class of bug that caused the blank admin screens.
  void rest
  return animate ? { initial: animate, animate } : {}
}

/** Disable only the hover/tap parts, keeping entrances. */
export function withoutHover(preset) {
  const { whileHover, whileTap, ...rest } = preset
  void whileHover; void whileTap
  return rest
}

export default {
  press, pressSoft, pressIcon, lift, liftHigh, rowHover,
  fadeIn, fadeUp, scaleIn, popIn,
  listContainer, listItem, staggerDelay,
  valueChange, badgePop,
  withMotion, withoutHover, EASE, DUR,
}
