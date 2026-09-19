# Part 10 — Enterprise hardening

Four gaps separated this project from something you could put in front of a
real back-office team. Each is now closed and guarded by tests.

**Suite total: 1,664 passing, 0 failing** (was 1,539).

---

## The gaps, found by auditing rather than guessing

Before writing anything I probed the codebase for what enterprise software is
actually expected to have. The results were worse than I expected in two places:

| Check | Before |
|---|---|
| Error boundaries | **Zero.** One bad render blanked the entire admin panel |
| Permission enforcement | **Zero call sites.** 38 permissions defined, none checked |
| Accessibility | **4 aria attributes** across 33,000 lines. No focus traps, no skip link, no focus rings |
| Idle session timeout | **None** |

The permissions finding is the one worth dwelling on. `PERMISSIONS` (38 keys),
`ROLE_TEMPLATES` (7 roles) and a working `can(role, permission)` function all
existed and were tested. Nothing in the interface ever called `can()`. **A
support agent saw exactly the same admin panel as the owner** — payouts, staff
management, pricing, everything. The permission model was documentation
wearing the costume of access control.

---

## 1. Crash isolation — `src/core/errors/ErrorBoundary.jsx`

React unmounts the whole tree when a render throws. In an admin panel that
means one malformed record blanks the application and the operator loses their
work with no explanation.

Three levels, because they do different jobs:

- **app** — last resort, for failures outside any route.
- **route** — one admin screen failed; the sidebar and all other screens keep
  working, so the operator can navigate away instead of reloading. Keyed on the
  route, so navigating away and back clears the error automatically.
- **widget** — one card or chart failed; the rest of the page is unaffected.

The widget level earns its keep daily: a single bad row in an API response
should degrade one card, not a page of otherwise correct information.

Details that matter in practice: the error *message* is shown (useful in a bug
report) but the stack trace is not (noise); after four consecutive failures the
retry button is withdrawn rather than letting the operator spin in a render
loop; a failing error reporter can never mask the original error.

Verified by actually rendering a component that throws next to one that does
not, and asserting the healthy sibling survives.

---

## 2. Permission enforcement — `src/auth/rbac.jsx`

Connects the existing 38-permission model to the interface.

```
usePermission()      — ask, then decide what to render
<Can>                — hide or disable a single control
<RequirePermission>  — block a whole screen
visibleNav()         — filter the sidebar
```

Design decisions worth stating:

**Fail closed, always.** An unknown role gets customer access, not owner
access — so editing `localStorage` to `"superadmin"` grants nothing. An unknown
*permission key* is denied and logged as an error, because it is almost always
a typo, and a typo that silently grants access is how real breaches happen.

**One guard, not twenty-two.** Rather than wrapping each `<Route>`,
`SCREEN_PERMISSIONS` maps every screen to its permission and a single guard
reads it. A test asserts every NAV id appears in that map, so a new screen
cannot be added without a deliberate access decision.

**The sidebar only offers reachable screens**, and an entire nav group hides
when nothing in it is permitted — no stray "Analyse" heading over an empty
list. Denied access attempts are logged as security events.

Resulting access, verified:

| Role | Screens | Role | Screens |
|---|---|---|---|
| owner | 22/22 | merchandiser | 9/22 |
| manager | 22/22 | finance | 11/22 |
| viewer | 19/22 | support | 7/22 |
| ops | 12/22 | customer/guest | 1/22 |

Specifically asserted: support can refund but **cannot** change prices, manage
staff, or issue payouts. Merchandiser is the mirror image — prices yes, refunds
no.

**Same caveat as always:** with the local backend this is not enforceable — the
role lives in `localStorage`. What it gives you in demo mode is a correct,
reviewable model and an interface that behaves properly per role. Connect a
backend and the same model is enforced server-side, where it counts.

**A risk I checked before shipping:** adding access control is exactly the kind
of change that locks everyone out. The demo owner still reaches 22/22, a new
shopper signup gets 1, a guest gets 1. All three are now regression tests.

---

## 3. Accessibility

`src/ui/a11y/useFocusTrap.js` plus fixes across the primitives.

**Dialogs were not dialogs.** `Modal` had an Escape handler and nothing else —
no `role`, no focus management. Tab moved focus behind the overlay into the
page underneath, and closing it dropped focus to the top of the document.
Both `Modal` and `Drawer` now: move focus in on open, cycle Tab within,
restore focus to the exact element that opened them, mark background content
`aria-hidden`, lock body scroll (compensating for the scrollbar so the layout
does not jump), and carry `role="dialog"` + `aria-modal` + a real label.

**Tabs follow the WAI-ARIA pattern** — a tablist is one tab stop, arrows move
between tabs, Home/End jump to the ends, roving tabindex. On a 10-tab screen
this is the difference between usable and painful.

**Toasts are announced.** They had no ARIA at all, so a screen-reader user got
no confirmation that anything happened. Now a labelled live region; errors
escalate to `assertive` because a failed payment should interrupt.

**Global, in CSS:** a skip link (otherwise every navigation means tabbing past
22 sidebar items), `sr-only`, a `:focus-visible` ring on every interactive
element (several custom-styled buttons had no focus style at all — fine with a
mouse, unusable without), app-wide `prefers-reduced-motion`, and
`prefers-contrast` support.

Went from **4 aria attributes to 45**, plus 12 landmark roles.

---

## 4. Idle session timeout — `src/auth/useIdleTimeout.js`

30 minutes idle, 2-minute warning, one click to stay signed in. An admin panel
left open on a shared terminal is a mundane and common way to lose control of
a business's data.

Two implementation details that are easy to get wrong:

- **Activity is shared across tabs** via `localStorage`. Per-tab timers sign
  you out of one tab while you work in another.
- **The deadline is wall-clock, not a decrementing counter.** Background tabs
  get throttled and laptops sleep; a counter would simply be wrong on wake,
  leaving a session alive for hours past its expiry.

Activity during the warning deliberately does **not** extend the session — the
operator has been asked a direct question and a stray scroll is not an answer.

---

## Testing notes

`tests/part10.mjs` — 125 assertions. Every suite was mutation-tested:

| Mutation | Caught |
|---|---|
| Unknown permission key fails *open* | ✅ |
| Modal loses `aria-modal` | ✅ |
| Sidebar stops filtering by permission | ❌ → fixed |

The third is the interesting one. My assertion was `app.includes('visibleNav')`,
which matched the **import line** — so deleting the actual filtering still
passed. It now asserts on the call expression and on the rendered list, and
re-running the mutation fails correctly.

Two other failures during this work were **harness** bugs, not product bugs,
and I checked rather than assuming: jsdom has no layout engine, so every
element reports zero dimensions. My `getFocusable` treated "no measurements" as
"invisible". That was worth fixing in the product too — it now distinguishes
"this element is hidden" from "this environment has no layout", which also
makes it correct under SSR.
