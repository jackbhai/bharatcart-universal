# BharatCart — Architecture & Customisation Guide

A complete, self-contained ecommerce operating system: a customer storefront and
a 22-module admin panel, built with React and Vite, with no backend required to
run it and no paid dependency anywhere in the stack.

This document is written for somebody who has just cloned the repository and
wants to make it their own. It covers what every directory is for, where the
business logic lives, and exactly which files to touch for the changes people
most commonly want to make.

---

## Table of contents

1. [What this is](#1-what-this-is)
2. [Quick start](#2-quick-start)
3. [The five-layer architecture](#3-the-five-layer-architecture)
4. [Complete file structure](#4-complete-file-structure)
5. [Feature inventory](#5-feature-inventory)
6. [The state store](#6-the-state-store)
7. [The engine layer](#7-the-engine-layer)
8. [The UI kit](#8-the-ui-kit)
9. [Theming](#9-theming)
10. [Localisation: languages and currencies](#10-localisation-languages-and-currencies)
11. [Payments](#11-payments)
12. [Pluggable backends](#12-pluggable-backends)
13. [Mobile performance](#13-mobile-performance)
14. [Testing](#14-testing)
15. [Deployment](#15-deployment)
16. [Common customisations](#16-common-customisations)
17. [Known limitations](#17-known-limitations)

---

## 1. What this is

| | |
|---|---|
| **Stack** | React 18.3 · Vite 6 · React Router 6 · Framer Motion 11 · Tailwind 3.4 |
| **Source files** | 157 |
| **Lines of source** | ~33,400 |
| **Test assertions** | 1,329 across 8 suites |
| **Admin modules** | 22 |
| **Runtime dependencies** | 5 (react, react-dom, react-router-dom, framer-motion, and Tailwind at build time) |
| **Backend required** | None. Optional adapters for Supabase and Firebase. |
| **Licence of every dependency** | MIT or equivalent permissive |

There is no server. All data comes from a deterministic seed
(`src/data/seed.js`), and all state persists to `localStorage`. This is a
deliberate choice: it means the whole thing deploys to any static host, runs
offline, and can be evaluated without provisioning anything. When you are ready
for a real backend, the adapter layer in `src/backend/` is where it plugs in —
no screen imports a database directly.

### What "no backend" does and does not mean

- **Payments are simulated.** `src/payments/index.js` mirrors the real Razorpay
  and Stripe SDK call shapes and return values, including a realistic failure
  rate, but no money moves. Swapping in the real SDKs is a change to one file.
- **Persistence is local.** State survives a refresh but lives in the browser.
- **Everything else is real.** Tax calculation, promotion stacking, loyalty
  accrual, shipping quotes, SLA clocks, reorder points, ABC analysis and the
  report builder all run genuine logic against the seeded data.

---

## 2. Quick start

```bash
npm install
npm run dev        # http://localhost:5180
npm run build      # -> dist/
npm test           # runs every suite (see section 14)
```

The app opens on the admin panel. `#/shop` is the storefront. Any email and
password signs you in — auth is local until you attach a backend.

**Routing uses `HashRouter` on purpose.** Static hosts that do not let you
configure rewrites (Netlify Drop, GitHub Pages, an S3 bucket) will 404 on a deep
link with `BrowserRouter`. If your host supports rewrites and you want clean
URLs, change the one line in `src/main.jsx`.

---

## 3. The five-layer architecture

The single most important thing to understand about this codebase: **screens
never contain business logic.** Data flows in one direction through five layers,
and each one is independently testable.

```
┌──────────────────────────────────────────────────────────────┐
│  5. SCREENS        src/admin/*  src/shop/*                   │
│     Compose UI. Read from hooks, call engines, render.       │
│     No calculations live here.                               │
├──────────────────────────────────────────────────────────────┤
│  4. UI KIT         src/ui/*                                  │
│     Primitives, patterns, effects. Knows nothing about       │
│     commerce — a DataTable does not know what an order is.   │
├──────────────────────────────────────────────────────────────┤
│  3. HOOKS + STORE  src/hooks/*  src/core/store/*             │
│     React-facing state. Slices own state shape; hooks give   │
│     components a clean read/write surface.                   │
├──────────────────────────────────────────────────────────────┤
│  2. ENGINES        src/engines/*                             │
│     Pure functions. Given data, return an answer. No React,  │
│     no store, no side effects. This is where the commerce    │
│     rules actually live, and where the tests point.          │
├──────────────────────────────────────────────────────────────┤
│  1. DATA           src/data/*  src/currency/*  src/geo/*     │
│     Deterministic seed data and generated reference tables.  │
└──────────────────────────────────────────────────────────────┘
```

**Why this matters when you customise:** to change how GST is calculated you
edit one pure function in `src/engines/tax/gst.js`, and every screen that shows
tax updates. To change how the tax *looks*, you edit a screen. The two concerns
never tangle.

---

## 4. Complete file structure

```
bharatcart/
├── index.html
├── package.json
├── vite.config.js              Build config incl. manual chunk splitting
├── tailwind.config.js
├── postcss.config.js
├── ARCHITECTURE.md             This document
│
├── scripts/                    Code generators — see the warning below
│   ├── gen_currencies.py       Emits src/currency/currencies.js + rates.js
│   └── gen_countries.py        Emits src/geo/countries.js
│
├── tests/                      Plain .mjs, no test framework
│   ├── render.mjs     (74)     Component mounting
│   ├── part2.mjs     (146)     Catalogue, orders, customers
│   ├── part3.mjs     (168)     Promotions, loyalty, theming
│   ├── part4.mjs     (163)     Returns, marketing, finance
│   ├── part5.mjs     (125)     Storefront, cart, checkout
│   ├── part6.mjs     (230)     i18n and currency
│   ├── part7.mjs     (171)     Geo, shipping zones, addresses
│   └── part8.mjs     (252)     Admin route smoke tests + Part 8 engines
│
├── docs/                       Build journal, one file per delivered part
│
└── src/
    ├── main.jsx                Entry. HashRouter lives here.
    ├── App.jsx                 Admin shell, sidebar NAV array, all routes
    ├── index.css               Tokens, base styles, RTL rules, mobile perf
    │
    ├── data/                   ── LAYER 1: DATA ──
    │   ├── seed.js             The dataset: 180 products, 480 customers,
    │   │                       1,018 orders, 228 tickets, 16 states, coupons.
    │   │                       Seeded mulberry32 — identical every reload.
    │   ├── returnsSeed.js      Return requests and their timelines
    │   └── vendorSeed.js       18 vendors, 64 purchase orders, 5 warehouses,
    │                           per-warehouse stock split, 220 movements
    │
    ├── currency/               157 currencies
    │   ├── currencies.js       ⚠ GENERATED by scripts/gen_currencies.py
    │   ├── rates.js            ⚠ GENERATED — rates are units per 1 INR
    │   ├── format.js           formatMoney, formatCompact (lakh/crore), dates
    │   └── active.js           Module singleton behind the inr() helper
    │
    ├── geo/                    90 countries
    │   ├── countries.js        ⚠ GENERATED by scripts/gen_countries.py
    │   ├── shipping.js         8 zones, quoteShipping(), duty de-minimis
    │   ├── addressFormat.js    Per-country field order, labels, validation
    │   └── index.js            Barrel
    │
    ├── i18n/
    │   ├── languages.js        11 languages, RTL flags, plural categories
    │   ├── index.js            translate(), translatorFor(), coverage()
    │   └── locales/            en hi pa ur ta bn ru fr de es ar
    │                           283 keys each, 100% coverage
    │
    ├── engines/                ── LAYER 2: ENGINES (pure functions) ──
    │   ├── tax/gst.js          CGST/SGST/IGST split, GSTIN validation
    │   ├── pricing/            Price resolution with a full decision trail
    │   ├── promo/              Stacking rules, conditions, exclusions
    │   ├── loyalty/            Earn, redeem, tiers, tier progress
    │   ├── shipping/           Pincode serviceability, ETA, COD rules
    │   ├── inventory/
    │   │   ├── inventoryEngine.js   Single-location stock
    │   │   └── warehouseEngine.js   Multi-warehouse, ABC, reorder, routing
    │   ├── search/             Tokenising search with typo correction
    │   ├── analytics/          Recommendations: similar, cross-sell, trending
    │   ├── orders/             Status machine, transitions, customer 360
    │   ├── returns/            Return eligibility and refund calculation
    │   ├── marketing/          Campaign performance, attribution
    │   ├── finance/            P&L, GST filing, settlements, unit economics
    │   ├── vendors/            Scorecards, PO pipeline, payables ageing
    │   ├── people/             Permission catalogue, roles, audit log
    │   ├── support/            SLA clocks, queues, agent workload, macros
    │   ├── content/            Pages, banners, SEO audit, sitemap
    │   ├── reports/            Report builder, saved reports, CSV export
    │   └── integrations/       Integration catalogue, webhooks, API keys
    │
    ├── core/                   ── LAYER 3: STATE ──
    │   ├── store/
    │   │   ├── createStore.js  ~100-line store. Throws on unknown actions.
    │   │   ├── index.js        Singleton, wires every slice
    │   │   └── slices/         auth catalogue locale loyalty marketing
    │   │                       orders promo returns settings theme ui
    │   ├── persist/            localStorage sync with versioned keys
    │   └── events/             Pub/sub for cross-cutting concerns
    │
    ├── hooks/
    │   ├── useStore.js         useSlice(name), useDispatch()
    │   ├── useAuth.js          Session, sign in/out, role
    │   ├── useTheme.js         Active template and token overrides
    │   ├── useI18n.js          t(), lang, dir, setLanguage
    │   ├── useCurrency.js      money(), convert(), setCurrency
    │   └── useToast.js         Toast notifications
    │
    ├── backend/                Swap the data source without touching screens
    │   ├── types.js            The contract every adapter implements
    │   ├── index.js            Selects an adapter from VITE_BACKEND
    │   └── adapters/           local.js · supabase.js · firebase.js
    │
    ├── auth/                   Sign-in screen and route guard
    │
    ├── payments/
    │   └── index.js            pay() — Razorpay + Stripe shaped, simulated
    │
    ├── theme/
    │   ├── templates/          11 complete visual templates
    │   ├── tokens/             Token schema and CSS-variable application
    │   └── builder/            Live theme editor UI
    │
    ├── ui/                     ── LAYER 4: UI KIT ──
    │   ├── primitives/
    │   │   ├── Button.jsx      5 sizes, 6 variants, loading state
    │   │   ├── Input.jsx       Input Textarea Select Switch Checkbox
    │   │   │                   Radio Slider RangeSlider Label
    │   │   └── Display.jsx     Badge Card CardHead Avatar Progress Empty
    │   │                       Skeleton Divider Tooltip Tabs Modal Drawer
    │   │                       Popover Pill  ← canonical source
    │   ├── patterns/
    │   │   ├── DataTable.jsx   Sort, paginate, select, bulk act, expand
    │   │   └── KpiRow.jsx      The KPI strip every module heads with
    │   ├── locale/             LanguagePicker CurrencyPicker LocaleBar
    │   ├── feedback/           ToastHost
    │   ├── fx.jsx              Motion effects: Reveal, Stagger, Tilt,
    │   │                       Aurora, Marquee, Confetti, Counter, Ring
    │   ├── kit.jsx             Legacy re-exports — prefer primitives/
    │   └── useDeviceProfile.js Device capability tiers (section 13)
    │
    ├── admin/                  ── LAYER 5: SCREENS ──
    │   ├── Dashboard.jsx
    │   ├── analytics/  reports/  customers/  finance/        (Analyse)
    │   ├── orders/  catalogue/  inventory/  returns/
    │   │   shipping/  vendors/  support/  operations/        (Operate)
    │   ├── marketing/  promotions/  loyalty/  content/       (Grow)
    │   └── theme/  localisation/  integrations/  people/
    │       settings/                                         (Customise)
    │
    └── shop/                   Customer-facing storefront
        ├── Storefront.jsx      Home, listing, product detail
        ├── Cart.jsx
        ├── Checkout.jsx        Address, shipping, payment
        ├── Account.jsx         Orders, returns, rewards, addresses
        └── shopState.jsx       Shop context: cart, wishlist, totals
```

> ### ⚠ Generated files
> `src/currency/currencies.js`, `src/currency/rates.js` and
> `src/geo/countries.js` are **generated**. Editing them directly works until
> the next regeneration silently wipes your change — which has already happened
> once in this repository's history. Edit the Python generator in `scripts/`
> and re-run it:
> ```bash
> python3 scripts/gen_currencies.py
> python3 scripts/gen_countries.py
> ```
> `format.js`, `shipping.js` and `addressFormat.js` are hand-written and safe to
> edit directly.

---

## 5. Feature inventory

### Admin — 22 modules

| Group | Module | Route | What it does |
|---|---|---|---|
| **Analyse** | Dashboard | `/admin/dashboard` | KPI overview, live activity, quick actions |
| | Analytics | `/admin/analytics` | Cohorts, RFM grid, funnels, channel and geography breakdowns |
| | Reports | `/admin/reports` | Build a report from 10 dimensions × 6 measures, save it, schedule it, export CSV |
| | Customers | `/admin/customers` | 480-customer directory, full customer 360, segments, churn risk |
| | Finance | `/admin/finance` | P&L, GST summary and filing calendar, gateway settlements, unit economics |
| **Operate** | Orders | `/admin/orders` | Order list, detail, status transitions, bulk fulfilment, invoices |
| | Catalogue | `/admin/catalogue` | Products, variants, pricing, media, bulk edit, import/export |
| | Inventory | `/admin/inventory` | Multi-warehouse stock, reorder planning, ABC analysis, dead stock, transfers, movement ledger |
| | Returns | `/admin/returns` | Return requests, approval flow, refund calculation, reasons analysis |
| | Shipping | `/admin/shipping` | 8 zone rate cards, live rate calculator, 90-country coverage, checkout rules |
| | Vendors | `/admin/vendors` | Supplier directory, blended scorecards, PO pipeline, payables ageing, spend concentration |
| | Support | `/admin/support` | SLA-driven queues, breach tracking, agent workload, CSAT, canned macros |
| | Operations | `/admin/operations` | Daily control room: today's work, SLA breaches, pickups, exceptions |
| **Grow** | Growth | `/admin/marketing` | Campaigns, attribution, audience builder, channel performance |
| | Promotions | `/admin/promotions` | Coupons, automatic discounts, stacking rules, conditions, gifts |
| | Loyalty | `/admin/loyalty` | Points config, tiers, rewards, member ledger |
| | Content | `/admin/content` | Pages, banners with CTR tracking, journal, navigation editor, SEO audit, sitemap |
| **Customise** | Theme Studio | `/admin/theme` | 11 templates, token editor, header/footer builder, live preview |
| | Localisation | `/admin/localisation` | 11 languages, 157 currencies, rate overrides, translation coverage |
| | Integrations | `/admin/integrations` | 16 services with real free tiers, webhooks, API keys, health review |
| | People | `/admin/people` | Staff, 7 roles, 38 granular permissions, audit log, security review |
| | Settings | `/admin/settings` | Store profile, payments, tax, checkout, notifications, backend |

### Storefront

Home with editorial sections · category and search listing with faceted filters ·
product detail with variants, reviews, recommendations and delivery estimate ·
cart with promotion and points application · multi-step checkout with address
validation, shipping selection, COD rules and dual payment gateways · account
area with orders, returns, rewards, addresses and wishlist · 11-language and
157-currency switching throughout.

---

## 6. The state store

`src/core/store/createStore.js` is roughly 100 lines. It was written rather than
imported because Redux Toolkit would have been the largest dependency in the
project for a feature set this app uses a tenth of.

```js
import store from './core/store/index.js'

store.getState()                          // whole tree
store.dispatch('orders/placeOrder', { order })
store.subscribe(listener)
```

In components, always go through the hooks:

```jsx
import { useSlice, useDispatch } from '../hooks/useStore.js'

const orders = useSlice('orders')         // re-renders only on this slice
const dispatch = useDispatch()
dispatch('orders/placeOrder', { order })
```

**The store throws on an unknown action** rather than ignoring it. A typo in an
action name is a loud error at the call site instead of a mutation that silently
never happens.

### Slices

| Slice | Owns |
|---|---|
| `auth` | Session, user, role. Actions: `loading` `signedIn` `signedOut` `error` `clearError` `initialised` `patchUser` |
| `catalogue` | Products, categories, edits |
| `orders` | Placed orders layered over the seed |
| `returns` | Return requests and their state |
| `promo` | Coupons and automatic discounts |
| `loyalty` | Programme configuration and ledger |
| `marketing` | Campaigns and audiences |
| `theme` | Active template and token overrides |
| `locale` | Language, currency, rate overrides, allow-lists |
| `settings` | Store, tax, checkout, notification settings |
| `ui` | Sidebar, modals, transient UI state |

### Persistence

`localStorage` keys, all versioned so a schema change can migrate rather than
corrupt:

```
bharatcart:state:v1      Store snapshot
bharatcart:sync          Cross-tab sync channel
bharatcart:backend:active  Selected backend adapter
bharatcart:auth:*        Session
bharatcart:db:{table}    Local backend adapter tables
bharatcart:shop:v1       Cart, wishlist, recently viewed
```

---

## 7. The engine layer

Engines are pure functions in `src/engines/`. No React, no store, no I/O. This
is the layer to read first if you want to understand how the commerce actually
works, and the layer to change first when you want different behaviour.

> **Before writing a caller or a test, `grep` the real export.** Assuming an
> engine's signature from its name caused four separate bugs during this
> project's development. The signatures below are accurate as of this document,
> but the source is the truth.

### Selected signatures

```js
// Tax — src/engines/tax/gst.js
taxLine({ price, qty, gst, interState })   // -> { cgst, sgst, igst, total }
validateGstin(gstin)                       // -> { ok, reason? }

// Pricing — src/engines/pricing/priceEngine.js
resolvePrice(product, variant, context)    // -> { price, source, discount, cost, trail }

// Promotions — src/engines/promo/promoEngine.js
applyPromotions(cart, promos, context)
// -> { applied, rejected, payable, totalDiscount, freeShipping, gifts }

// Loyalty — src/engines/loyalty/loyaltyEngine.js
calculateEarn(order, config)
calculateRedeem(points, config)
resolveTier(spend, config)
tierProgress(customer, config)

// Shipping — src/engines/shipping/shippingEngine.js
checkServiceability(pincode)
// -> { ok, pincode, city, days, eta: { min, max, label }, cod, express, sameDay, returnPickup, zone }

// Geo shipping — src/geo/shipping.js
quoteShipping({ country, weightG, orderValueInr, express })
// -> { ok, zone, zoneLabel, cost, free, freeAbove, shortfall, minDays, maxDays, billableKg, breakdown }
estimateDuty({ country, orderValueInr })   // -> { applies, amount, threshold, note }

// Warehouses — src/engines/inventory/warehouseEngine.js
stockPositions(products, { days = 365 })   // per-SKU cover, reorder point, status
inventoryKpis(positions)
abcAnalysis(positions)                     // A/B/C by cumulative revenue share
reorderPlan(positions)                     // what to buy, most urgent first
reorderByVendor(plan)                      // grouped into draft purchase orders
warehouseSummary(positions)                // utilisation per site
transferSuggestions(positions)             // move stock instead of buying it
routeOrder(state, productId, qty)          // -> { ok, warehouseId } or a split

// Vendors — src/engines/vendors/vendorEngine.js
vendorScorecard()      // quality 40% + punctuality 35% + fill rate 25%
poPipeline()           // purchase orders grouped by status
overduePos()           // late and still not received
payablesAgeing()       // current / 1-30 / 31-60 / 61-90 / 90+
concentrationRisk()    // -> { top1, top3, level, note }

// Support — src/engines/support/supportEngine.js
enrichedTickets()      // adds SLA clocks, assignee, category, risk flags
ticketQueues(tickets)  // breached / atRisk / awaitingReply / unassigned / all
agentWorkload(tickets)
renderMacro(macro, vars)   // -> { text, used, missing, ready }

// People — src/engines/people/peopleEngine.js
can(role, permission)      // 'owner' holds the only wildcard
permissionsByGroup(role)
roleDiff(roleA, roleB)
securityReview(staff)
auditLog({ limit })

// Reports — src/engines/reports/reportEngine.js
runReport({ dimension, measure, days })
// -> { ok, rows: [{ key, value, share, count }], total, format, ... }
// Refuses to combine a dimension and measure from different record sets.
toCsv(result)

// Content — src/engines/content/contentEngine.js
seoAudit(pages)        // -> { issues, score, high, warn }
sitemap()              // -> { entries, total, byType }
bannerPerformance()
```

### The vertical system

Nine business verticals share one registry —
`src/engines/catalogue/verticals.js` — which declares per vertical its flags
(`perishable`, `needsColdChain`, `supportsSubscription`, `goldPriced`), its
variant axes, its attribute schema, its size chart and its storefront picker
hint. Seven engines hang off it: gold pricing, unit-of-measure pricing,
expiry/FEFO, size charts, subscriptions, cold chain, and the vertical price
dispatcher (`src/engines/pricing/verticalPriceEngine.js`) that routes each
product to the right logic and returns an explainable `{ price, source,
trail }`. Engines stay React-free (five-layer rule) and are imported directly
by tests. Legacy categories map into the registry (`Ethnic Wear → fashion`,
`Jewellery → artificial-jewellery`) and unknown verticals fall back to
`general`, so old data never breaks. Storefront (`VerticalPicker`,
`AttributeSections` in `src/shop/verticalPickers.jsx`) and the admin
catalogue (`src/admin/catalogue/verticals.js` re-exports the canonical
registry) adapt to the registry automatically. Adding a vertical is: one
registry entry, seed rows, and optionally a picker branch —
see `docs/13-PART12-VERTICALS.md`.

### Data shapes that trip people up

These are the ones that have actually caused bugs here:

| Thing | Correct | Not |
|---|---|---|
| Order timestamp | `order.placedAt` | ~~`createdAt`~~ |
| State record key | `STATES[].state` | ~~`.name`~~ |
| Category record key | `CATEGORIES[].cat` | ~~`.name`~~ |
| Country record key | `COUNTRIES[].iso2` | ~~`.code`~~ |
| Ticket priority values | `Urgent High Medium Low` | ~~`Normal`~~ |
| Shipping zone rate | `zone.baseRate`, `zone.perKg` | ~~`.base`~~ |
| Products | no `emoji`, no `cost` field | |
| Order items | no `hsn` field | |

---

## 8. The UI kit

### Import from `primitives/`, not `kit.jsx`

`src/ui/kit.jsx` and `src/ui/primitives/Display.jsx` both export components
called `Tabs`, `Input`, `Select`, `Card` and `Badge`. They are **not the same
components** and historically had incompatible prop contracts.

This caused the worst bug in the project's history: `Localisation.jsx` imported
`Tabs` from `kit.jsx` but passed `Display.jsx`'s props. The component rendered a
raw object as a React child, threw, and because it threw inside the shared admin
shell it **took down all 14 admin pages**, not just its own. 1,077 passing tests
missed it, because every suite imported components directly and none of them
exercised the router.

Two things came out of that, and both still hold:

1. **Always import UI from `src/ui/primitives/`.** Every module does.
   `kit.jsx` now tolerates both prop shapes defensively, but it is legacy.
2. **`tests/part8.mjs` mounts every admin route through the real `App`** and
   asserts non-blank, distinct content. Add a route, add it to that list.

### Core contracts

```jsx
// Tabs — canonical, from primitives/Display.jsx
<Tabs
  tabs={[{ id, label, icon, count }]}   // also accepts a plain string[]
  value={activeId}                       // note: `value`, not `active`
  onChange={setActive}
  size="md" full={false}
/>

<DataTable
  rows={rows}
  rowKey="id"                            // a field name or a function
  columns={[{ key, label, align, render: (row, i) => node }]}
  pageSize={12}
  selectable bulkActions={[...]}
  expandable={row => node}
  onRowClick={row => {}}
/>

<KpiRow columns={6} items={[
  { label, value, sub, tone, icon, hint, delta, onClick }
]} />
// tone: neutral | primary | success | warn | danger | info

<Modal open onClose title footer size="md" />
<Drawer open onClose title width={520} />
<Badge tone="success" size="sm" dot>Live</Badge>
<Progress value={72} tone="success" height={7} />
<Empty icon="◌" title="Nothing here" description="..." action={node} />
```

### The standard module shape

Every admin module follows the same skeleton. Copying it is the fastest way to
add a new one:

```jsx
export default function MyModule() {
  const [tab, setTab] = useState('first')
  const kpis = useMemo(() => myEngine(), [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Title</h1>
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          One sentence on what an operator can actually do here.
        </p>
      </div>

      <KpiRow columns={6} items={[...]} />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'first' && <FirstTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
```

**Always style with CSS variables** (`var(--c-text)`, `var(--c-surface)`,
`var(--c-border)`, `var(--c-primary)`), never hard-coded colours. That is what
makes all 11 themes work on a component you just wrote.

---

## 9. Theming

Eleven complete templates live in `src/theme/templates/`: `glassAurora`
(default), `saffronBazaar`, `handloomHeritage`, `midnightLuxe`, `minimalMuji`,
`neoBrutalist`, `nordicCalm`, `pastelBoutique`, `electricMono`,
`corporateTrust`, `sunriseCommerce`.

A template is a plain object of design tokens — colours, radii, shadows,
typography, spacing, motion. `src/theme/tokens/applyTokens.js` writes them to
CSS custom properties on `:root`, which is why a theme switch is instant and
requires no re-render of anything.

**To add a template:** copy the closest existing file in
`src/theme/templates/`, adjust the tokens, and register it in
`src/theme/templates/index.js`. It appears in Theme Studio automatically.

Theme Studio (`/admin/theme`) additionally exposes logo, store name, fonts,
header layout, footer columns and announcement bar, with a live preview.

---

## 10. Localisation: languages and currencies

### Languages

Eleven: English, Hindi, Punjabi, Urdu, Tamil, Bengali, Russian, French, German,
Spanish, Arabic. Urdu and Arabic are right-to-left, handled by `dir` on `<html>`
plus logical-property CSS rules in `index.css`.

```jsx
const { t, lang, dir, rtl, setLanguage, available } = useI18n()
t('shop.addToCart')
t('cart.items', { count: 3 })      // picks the right plural category
```

Bundles are `src/i18n/locales/*.js`, 283 keys each at 100% coverage. Missing
keys fall back to English, then to the key path itself — so an untranslated
string shows as `shop.someKey` on screen rather than blanking the UI.

**To add a language:** add the entry to `src/i18n/languages.js`, copy
`locales/en.js` to your code, translate the values, import it in
`src/i18n/index.js`. The admin Localisation screen reports coverage, so a
half-finished translation is visible to you rather than to a customer.

### Currencies

157 currencies, 209 country mappings, 10 regions.

```jsx
const { code, symbol, money, convert, setCurrency, available } = useCurrency()
money(4999)                        // formatted in the active currency
```

Details that are easy to get wrong and are already handled:

- **Zero-decimal currencies** (16, including JPY and KRW) and
  **three-decimal currencies** (7: KWD BHD OMR JOD IQD TND LYD).
- **Native numeral systems.** `Intl` renders Devanagari digits for `hi-IN` and
  similar for `ne-NP`, `bn-BD`, `my-MM`, `fa-AF`. Every locale is suffixed with
  `-u-nu-latn` so prices stay legible.
- **Indian number grouping.** `formatCompact` produces lakh and crore for INR,
  PKR, BDT, LKR and NPR, and K/M/B elsewhere.
- **Base rate precision.** `RATES` are units per 1 INR with INR pinned to
  exactly 1. Deriving a base rate by multiplication introduced drift
  (`83.47 × 0.01198 = 0.999971`) and is avoided.

Rates are static and dated (`RATES_UPDATED_AT`). `fetchLiveRates()` exists as
the seam to attach a live feed and currently returns `{ ok: false }`.

---

## 11. Payments

`src/payments/index.js` exposes one function:

```js
pay({ gateway, amount, method, settings, customer, receipt })
// -> { ok, gateway, method, reference, orderRef, signature?, captured, fee?, raw }
```

Both **Razorpay** (UPI, cards, netbanking, wallets, EMI) and **Stripe**
(international cards and wallets) are modelled with their real call shapes,
reference formats and fee structures. A realistic 3–12% failure rate is
simulated, because a checkout that has never been tested against a declined
payment is a checkout that will break in production.

> If you are writing a test against `pay()`, remember it is probabilistic —
> loop until you get the outcome you need rather than asserting on one call.

**Going live** means replacing the simulated call inside this one file with the
real SDK. Nothing else imports a gateway.

---

## 12. Pluggable backends

`src/backend/` lets you change where data lives without touching a screen.

```
VITE_BACKEND=local      # default, localStorage
VITE_BACKEND=supabase   # Postgres, auth, storage
VITE_BACKEND=firebase   # Firestore, auth
```

Every adapter implements the contract in `src/backend/types.js`: `list`, `get`,
`insert`, `update`, `remove`, `query`, plus the auth surface. To add your own
(PocketBase, Appwrite, your own REST API), copy `adapters/local.js`, implement
the same methods, and register it in `src/backend/index.js`.

---

## 13. Mobile performance

The requirement was that this feels smooth on a cheap Android phone, not only on
the machine it was built on. Four things were done, and they are worth
understanding before you change them.

### 1. Bundle splitting

The build originally produced a single 674 kB entry chunk: nothing rendered
until all of it had parsed. `vite.config.js` now splits along
"changes rarely" versus "changes every deploy" lines:

| Chunk | Raw | Why it is separate |
|---|---|---|
| entry | 200 kB | App shell |
| react | 140 kB | Never changes between your deploys |
| i18n | 135 kB | 11 locale bundles |
| motion | 113 kB | Framer Motion |
| locale-data | 62 kB | Generated currency and country tables |
| data | 31 kB | The seed dataset |

Every admin module is additionally lazy-loaded per route, so opening the
dashboard does not download the vendor module.

### 2. Device capability tiers

`src/ui/useDeviceProfile.js` classifies the device once and lets components step
down gracefully:

```js
const { tier, motion, loops, blur, effects, coarse, narrow } = useDeviceProfile()
```

| Tier | Trigger | Effect |
|---|---|---|
| `low` | reduced-motion preference, Data Saver, 2G/3G, or ≤2 GB **and** ≤2 cores | No animation, no blur, no effects |
| `medium` | ≤4 GB, ≤4 cores, or a phone-width viewport | Normal transitions; no looping animation, no blur |
| `high` | Everything else | Full experience |

Two details that matter: a **single** weak hardware signal is never enough to
downgrade, because iOS Safari reports no `deviceMemory` at all and some browsers
under-report core counts — treating either as "slow" would have stripped the
experience from perfectly capable iPhones. And an explicit user preference
(reduced motion, Data Saver) **is** authoritative on its own.

Decorative infinite animations go through the `loop()` helper:

```js
import { loop } from '../ui/useDeviceProfile.js'
<motion.div transition={loop({ duration: 14, ease: 'easeInOut' })} />
```

Loading shimmers and skeletons deliberately keep looping on every tier — those
communicate progress rather than decorate.

### 3. CSS

In `src/index.css`, under `MOBILE PERFORMANCE`:

- **Backdrop blur is disabled below 768px.** It is the most expensive thing on
  the page — a full-surface repaint every scroll frame on mid-range Android —
  and at phone size the solid fallback looks near-identical.
- Tap highlight removed and `touch-action: manipulation` set, killing the 300 ms
  delay and the grey flash Android paints over tappable elements.
- `overscroll-behavior` contained, so a scrollable panel hitting its end does not
  rubber-band the whole page.
- 40 px minimum touch targets under `(pointer: coarse)`.
- 16 px minimum font size on inputs, because anything smaller makes iOS Safari
  zoom the viewport on focus.
- `content-visibility: auto` available via `.cv-auto` for long lists.
- Safe-area insets for notched devices.

### 4. Build

Terser with two compression passes, `drop_console` in production, CSS code
splitting.

---

## 14. Testing

No test framework. Eight plain `.mjs` files run under `vite-node`, mounting real
components in jsdom.

```bash
for t in render part2 part3 part4 part5 part6 part7 part8; do
  printf "%-8s " $t; npx vite-node tests/$t.mjs 2>&1 | grep passed
done
```

```
render     74 passed · 0 failed
part2     146 passed · 0 failed
part3     168 passed · 0 failed
part4     163 passed · 0 failed
part5     125 passed · 0 failed
part6     230 passed · 0 failed
part7     171 passed · 0 failed
part8     252 passed · 0 failed
────────────────────────────────
        1,329 passed · 0 failed
```

### If you write tests here, read this first

These are hard-won and will save you hours:

- **Dynamic imports inside a test must use absolute paths**
  (`/home/user/bharatcart/src/...`). Relative dynamic imports fail under
  vite-node with "Cannot find module".
- **jsdom needs shims** before React will mount: `url: 'http://localhost/'`,
  `SVGElement`, `AbortController`/`AbortSignal` from `dom.window`, `matchMedia`
  on both `global` and `dom.window`, `requestAnimationFrame` as
  `cb => setTimeout(() => cb(Date.now()), 16)`, and
  `IS_REACT_ACT_ENVIRONMENT = true`.
- **Wrap every `act()` in a timeout race.** Framer Motion's looping animations
  never let the act queue settle under a fake rAF, and the run will hang
  forever.
- **Never assert on a lazy route after a fixed delay.** Suspense needs many
  ticks; poll until the fallback clears. A fixed 250 ms once produced ten false
  "blank page" results.
- **When navigating between routes, wait for the content to *change*.** The
  previous page is still mounted immediately after a hash change, so a
  "not blank" check passes against stale DOM and every route looks identical.
- **`App` does not include a Router** — wrap it in `HashRouter`. Sign in with
  `store.dispatch('auth/signedIn', { user, session })`; `auth/signIn` does not
  exist and the store throws on unknown actions.
- **Assume a failing test is a wrong assumption before assuming it is a bug.**
  Three "failures" in part 5 and all four in part 6 were bad tests, and one led
  to a wrong code change that had to be reverted.

---

## 15. Deployment

The build is fully static. `dist/` deploys anywhere.

```bash
npm run build
```

| Host | Notes |
|---|---|
| Netlify | Drag `dist/` onto the drop zone, or `netlify deploy --dir=dist --prod` |
| Vercel | `vercel --prod` |
| GitHub Pages | Push `dist/`. HashRouter means deep links work with no config. |
| Cloudflare Pages | Connect the repo, build `npm run build`, output `dist` |
| Any static host | It is just files |

Because routing is hash-based, **no rewrite rules are required anywhere**. This
is why anonymous Netlify drops — which ignore `_redirects` and `netlify.toml`
entirely — work correctly.

---

## 16. Common customisations

### Add an admin module

1. `mkdir src/admin/mymodule` and create `index.jsx` using the skeleton in
   [section 8](#8-the-ui-kit).
2. Put the logic in `src/engines/mymodule/myEngine.js` as pure functions.
3. In `src/App.jsx`: add a `lazy()` import, an entry in the `NAV` array with a
   `group`, and a `<Route path="mymodule" ... />`.
4. Add `'mymodule'` to the `ROUTES` array in `tests/part8.mjs` — the smoke test
   will then assert it mounts, renders real content, and does not blank.

### Change the seed data

Everything comes from `src/data/seed.js`, which is deterministic via a seeded
mulberry32 PRNG (seed `20260914`). Change the constants at the top — product
count, customer count, category list, states — and the whole app follows.
Keep it deterministic; the tests depend on stable numbers.

### Rebrand

- Store name, logo, colours, fonts: Theme Studio, no code.
- Deeper visual change: add a template in `src/theme/templates/`.
- Copy and labels: `src/i18n/locales/en.js`.

### Change tax rules for a different country

`src/engines/tax/gst.js` implements the Indian CGST/SGST/IGST split. For a
single-rate VAT country, replace `taxLine()` with a flat calculation — every
screen that shows tax picks it up. Per-country rates already exist in
`src/geo/countries.js` (`taxFor(country)`).

### Connect a real backend

Set `VITE_BACKEND=supabase` (or `firebase`) and fill in the credentials in the
adapter. For anything else, copy `src/backend/adapters/local.js` and implement
the same contract.

### Go live with payments

Replace the simulated call in `src/payments/index.js` with the real Razorpay or
Stripe SDK. Keep the return shape and every caller keeps working.

---

## 17. Known limitations

Stated plainly, because discovering these yourself would waste your time:

- **No server.** Orders, customers and content live in the browser. Multi-user
  editing, real auth and real payments all need the backend layer wired up.
- **Payments are simulated.** No money moves.
- **Exchange rates are static**, dated in `RATES_UPDATED_AT`.
- **Translation covers the storefront, not the admin panel.** The admin UI is
  English. The 283 translated keys cover customer-facing surfaces; admin labels
  are hard-coded.
- **The geo layer is not fully wired into checkout.** `src/geo/` is complete and
  tested, and the Shipping module uses it, but `Checkout.jsx` and `Account.jsx`
  are still India-only.
- **Seed data is honestly lopsided.** The catalogue holds ~203 units per SKU
  against roughly 12 sales a year, so the Inventory module correctly reports
  most SKUs as overstocked. That is the data telling the truth, not a bug — but
  it means the reorder screen is quieter than a real store's would be.
- **No virtualised lists.** Tables paginate instead. At 480 customers and 1,018
  orders this is fine; at 100,000 rows you would want a virtualiser.
- **No image pipeline.** Products use emoji and CSS gradients rather than
  photography, so the repository stays small and has no asset licensing.

---

## Licence

MIT. Every dependency is MIT or equivalent. There is no paid service, no
subscription, and no API key required to run any part of this.
