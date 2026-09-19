# 13 — PART12 · Multi-vertical system (delivered)

**Status:** done and green. `npm test` runs 12 suites, **2,048 assertions, 0
failing**. `npx vite build` passes. No new runtime dependencies.

## What was built

BharatCart went from a fashion-only catalogue to a **multi-vertical commerce
platform** covering nine business verticals with a single shared registry,
seven new domain engines, one engine dispatcher, vertical-aware admin
adapters, vertical-aware storefront pickers, and 200 new seeded products
(180 vertical products + 20 general fill) across dairy, grocery,
confectionery, fine jewellery, artificial jewellery, innerwear and footwear —
taking the catalogue from 180 to **380 products**.

### The vertical registry — `src/engines/catalogue/verticals.js`

The single source of truth. Nine verticals — `fashion`, `innerwear`,
`footwear`, `artificial-jewellery`, `fine-jewellery`, `confectionery`,
`dairy`, `grocery`, `general` — each declaring:

- **flags**: `perishable`, `needsColdChain`, `supportsSubscription`,
  `goldPriced`
- **variant axes** (how SKUs differ): pack size for food, weight + purity for
  gold, size + colour for fashion/footwear, band/cup for innerwear
- **attribute schema**: the structured product facts each vertical stores
  (making %, stone value, shelf life, storage temp, …)
- **size chart** reference: `apparel`, `footwear`, `kids`, `innerwear`
- **storefront picker hint**: which picker component the PDP renders

Legacy categories still resolve through a mapping (`Ethnic Wear → fashion`,
`Jewellery → artificial-jewellery`, …); unknown verticals fall back to
`general`, so old data never breaks.

### The seven new engines (pure JS, no React — five-layer rule)

| Engine | File | What it does |
|---|---|---|
| Gold pricing | `src/engines/pricing/goldEngine.js` | Live-shaped purity rates (24K/22K/18K/14K), metal + wastage + making + stone math, 3% GST, rate snapshots so a checkout locks the price even if rates move |
| Unit-of-measure | `src/engines/pricing/uomEngine.js` | Parses `500 g` / `2 L` / `12 pcs`, converts to base units, renders `₹240/kg` labels so a 250 g and a 5 kg pack are comparable |
| Expiry / FEFO | `src/engines/perishables/expiryEngine.js` | Floor-day freshness status (fresh / near-expiry ≤3d / expired), FEFO-sorted allocation with reserved-stock and shortfall handling, near-expiry auto-discount |
| Size charts | `src/engines/catalogue/sizeChartEngine.js` | UK ⇄ US ⇄ EU ⇄ CM footwear conversion, chart tables for innerwear / footwear / kids / apparel |
| Subscriptions | `src/engines/subscriptions/subscriptionEngine.js` | Recurring schedules (daily / alternate-day / weekly / custom), skip / pause ranges (pure functions), delivery slots that skip `noDeliveryDays`, evening-delivery toggle |
| Cold chain | `src/engines/shipping/coldChainEngine.js` | Detects cold-chain need from vertical, attributes or storage-temp markers; zonal surcharges (local → national); order validation (serviceable pincode, cold-capable zone, delivery slot present); same-day/tomorrow slots with a 12:00 UTC cut-off |
| Vertical pricing | `src/engines/pricing/verticalPriceEngine.js` | The dispatcher. Fashion/footwear/innerwear/artificial-jewellery delegate to the legacy engine unchanged; grocery/dairy/confectionery price per variant pack with ₹/kg-₹/L unit labels; fine jewellery prices from live gold math; any near-expiry variant is auto-marked-down 25% and the whole decision is returned as a source + trail, so the UI can explain the price |

### Integration points (no chunk left isolated)

- **Checkout / cart** — `shopState.jsx` reprices every line through the
  dispatcher; fine-jewellery lines lock a gold snapshot, dairy/grocery lines
  show unit-price labels, near-expiry lines show the markdown.
- **Inventory** — `allocateBatches` does FEFO allocation across batch rows;
  `reserveStock`/`releaseStock` batch-aware.
- **Returns** — `verticalReturnRule` slots into `checkEligibility`:
  perishables are non-returnable, fine jewellery gets a 7-day 90% buyback to
  store credit; legacy innerwear hygiene rule unchanged.
- **Admin** — the catalogue editor and products table get vertical adapters:
  a vertical selector drives which attribute schema, variant axes and filters
  are shown; gold items expose purity/weight/making controls.
- **Storefront** — `VerticalPicker` renders per-vertical variant selectors
  (pack pills for food, weight options for jewellery, size grids for apparel)
  and `AttributeSections` renders schema-backed PDP detail blocks; a bridge
  auto-adopts new engines without rewrites.

## How to add a new vertical

1. **Registry** — add one entry to `VERTICALS` in
   `src/engines/catalogue/verticals.js` with its flags, variant axes,
   attribute schema, size chart and picker hint.
2. **Seed** — add products in `src/engines/catalogue/verticalSeed.js` tagged
   with the new vertical id (axes drive the SKU/variant generation).
3. **Picker** — add a branch in `src/shop/verticalPickers.jsx` if the default
   generic picker does not fit (the bridge picks it up automatically).
4. **Engine rule** (optional) — if pricing/returns need vertical-specific
   logic, extend the dispatcher switch in `verticalPriceEngine.js` or the
   rule map in `returnEngine.js`. Food-style and jewellery-style behaviour
   already compose without new code.
5. **Tests** — extend `tests/part12.mjs` in the same `ok(name, cond)` style;
   the registry self-tests (axes/schema non-empty) run per vertical.

## Delivery notes

- Existing engines were **not** changed behaviourally: fashion-family
  verticals delegate to the untouched legacy price engine, and the admin
  catalogue re-exports the canonical registry so both surfaces share one
  contract.
- Three seed-growth fixes were needed when the catalogue hit 380 products
  (cheap items refunding to ₹0 after the flat pickup fee; acquisition cohorts
  mixing cancelled orders; warehouse capacities sized for 180 products) —
  each fixed at the data/engine level with existing suites re-verified green.
- Test harness note: on Node 24 the jsdom bootstrap in nine suites needed
  `Object.defineProperty` for `globalThis.navigator` (assignment throws on a
  getter-only property). No assertions were touched.
