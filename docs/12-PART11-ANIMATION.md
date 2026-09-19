# Part 11 — Animation and interaction feedback

**Suite: 1,755 passing, 0 failing** (was 1,664). Bundle unchanged. No new
dependency.

---

## What the audit found

I measured before building, and the shape of the problem was not what
"add more animation" implies:

| Area | `motion.` | hover | tap |
|---|---|---|---|
| admin (39 files) | 176 | **7** | **1** |
| shop (5 files) | 52 | 3 | 1 |
| ui (12 files) | 91 | 1 | 1 |

Plenty of *entrance* animation — things fading in on mount — and almost no
*response* animation. That is backwards. An entrance plays once and is
decoration. A press plays every time the operator acts and is **feedback**,
and feedback is what makes software feel solid.

Worse, `fx.jsx` contained **20 finished effect components and 10 were imported
nowhere**: Confetti, Shimmer, Reveal, Ring, GlowCard, Marquee, Rangoli, Silk,
GridBg, ScrollProgress. Fully written, fully dead.

So the highest-value work was not writing new effects. It was adding the
missing feedback layer and using what already existed.

---

## What changed

**A shared interaction vocabulary** — `src/ui/motion/interactions.js`. Plain
objects spread into any motion component, so no wrapper, no extra DOM node, no
bundle cost. Values are deliberately small: an operator processing 200 orders
clicks these thousands of times a shift, and a button that visibly jumps is
charming for a day and irritating by Friday.

**Feedback on every button, not seven of them.** The shared `Button` primitive
gained hover and press states. For the 56 raw `<button>` elements scattered
through the admin panel I used CSS rather than converting each one — safer (no
JSX rewiring, no duplicate-prop bugs) and free (`transform` composites on the
GPU). Disabled and loading controls are explicitly inert: responding to a press
that will not do anything is a lie the interface tells the user.

**Skeletons replaced spinners** — `src/ui/feedback/Skeleton.jsx`. A spinner says
"something is happening"; a skeleton says "here is what is arriving and where".
The second feels faster for the same wait. Deliberately CSS-only: these render
while the main thread is already busy mounting a chunk, which is the worst
possible moment to hand framer-motion fifty elements.

**KPI count-up**, with a conservative parser. KPI values are pre-formatted
strings, so this needed care — `₹1,23,456` and `71%` count up, while `₹7.34 Cr`,
`In Transit` and `12 of 18` render untouched. Counting up a value we cannot
reassemble exactly would print a *wrong number on a dashboard*, which is far
worse than no animation. Sixteen parser cases are tested.

**Dead components brought to life.** Confetti now fires on order confirmation —
the highest-emotion moment in the storefront was its plainest screen. It fires
once, not on a loop, and is suppressed on low-end devices. Reveal drives the
storefront shelves. Counter drives the KPIs.

**Product cards** got a proper hover: rise, shadow lift, a sheen sweep, and a
wishlist heart that pops on save.

---

## Why the admin JSX counts did not move

Honest accounting: `whileHover` in `src/admin` is still 7. I did not add
hundreds of motion props there. Admin feedback comes from the CSS layer and the
shared primitives instead, which covers **all** 56 raw buttons plus the 32 files
using the Button primitive, in ~60 lines, with no bundle growth and no risk of
the duplicate-prop bug described below.

Where the increase is real and measurable: `ui` hover 1 → 11, tap 1 → 9 (shared
primitives, so it lands everywhere), dead effect components 10 → 8, and every
button and card in the app now has press feedback where almost none did.

---

## Three bugs this work caught

**1. Duplicate motion props silently disable animation.** A product card ended
up with both `initial={{...}}` and `initial="rest"`. The later prop wins with no
error and no build failure — the entrance animation simply vanished. There is
now a lint-style test that scans every `motion.*` element in the codebase for
repeated props.

**2. Scroll effects broke without IntersectionObserver.** Wiring `Reveal` into
the storefront broke `tests/part5` — its harness has no `IntersectionObserver`,
and Reveal starts at `opacity: 0` waiting for an intersection that never
arrives. **The content rendered and stayed permanently invisible.** This is the
same outage-class failure as the original blank admin screens, arriving through
a different door, and old browsers and server renderers have the same gap. Every
scroll-triggered effect now detects the missing API and renders plainly. The
test deletes the API and re-renders to prove it.

**3. My own test assertions matched comments instead of code.** Two "failures"
were my checks grepping prose that explained the very thing being checked. Fixed
to assert on imports and code.

---

## Guardrails

Animation becomes a performance bug on long lists, so the caps are tested:
480-row stagger completes in ≤0.4s total rather than 19 seconds; product grids
and table rows are capped the same way. Reduced motion is honoured in five
separate CSS layers, and hover transforms are *removed* rather than shortened —
a shortened transform still snaps.

Every entrance preset is asserted to end at `opacity: 1`, because that is the
specific mistake that has now cost this project two outages.

Mutation-tested: making the parser greedy (4 failures), giving disabled buttons
a hover state (1), and reintroducing a duplicate prop (1) were all caught;
reverting returned a clean run.
