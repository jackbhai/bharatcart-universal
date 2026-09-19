# BharatCart — Feature Universe (Max Possibility Map)

> Step 1 of the plan: pehle **maximum kitne features possible hain** wo nikala gaya.
> Ye exhaustive audit hai — har module ko "deepest" level tak toda gaya hai.
> Target: **500+ admin**, **300+ user**, **+ theming layer (alag se)**.

---

## Counting Rules (taaki number honest rahe)

Ek "feature" tabhi count hoga jab wo **actually kaam kare** — UI + state + persistence + effect.
Jo sirf dikhe par kuch na kare, wo count nahi hoga.

Har feature ka ek **depth level** hai:

| Level | Matlab |
|---|---|
| **D1** | View / read-only surface |
| **D2** | Filter, sort, search, paginate, export |
| **D3** | Create / edit / delete with validation |
| **D4** | Config that **changes system behaviour** elsewhere |
| **D5** | Engine — rules, computation, automation, simulation |

"Deepest ho, deep me jaake kaam kare" ka matlab: **majority features D3–D5 ho**, D1 sirf support ke liye.

---

# PART A — ADMIN PANEL (target 500+)

## A1. Dashboard & Command Centre — 34
1. Revenue KPI + prev-period delta (D2)
2. Orders KPI + delta (D2)
3. AOV KPI + delta (D2)
4. Repeat-rate KPI (D2)
5. RTO-rate KPI (D2)
6. Gross-margin KPI (D2)
7. Conversion-rate KPI (D2)
8. Refund-rate KPI (D2)
9. Date-range switcher 7/30/90/365 (D2)
10. Custom date-range picker (D2)
11. Compare-to-previous-period toggle (D2)
12. Revenue timeseries w/ hover crosshair (D2)
13. Metric switcher on chart (revenue/orders/AOV/units) (D2)
14. Granularity switcher day/week/month (D2)
15. Channel split donut (D2)
16. Payment-mix donut (D2)
17. Category performance bars (D2)
18. State/zone heatmap (D2)
19. City-tier breakdown (D2)
20. Device breakdown (D2)
21. Language breakdown (D2)
22. Top products table (D2)
23. Top customers table (D2)
24. Low-stock alert widget (D3)
25. Abandoned-cart value widget (D2)
26. Open-tickets widget (D2)
27. Alert feed w/ severity (D2)
28. Alert dismiss + snooze (D3)
29. **Customisable widget grid — add/remove/reorder** (D4)
30. **Saved dashboard layouts per admin role** (D4)
31. Widget size presets (D4)
32. Dashboard export to PDF/PNG (D2)
33. Scheduled dashboard email digest config (D4)
34. Realtime "live orders" ticker (D2)

## A2. Orders — 48
35–46: List, search, multi-filter (status/payment/channel/state/courier/date), sort, pagination, column chooser, saved views, bulk select, CSV export, print manifest
47–58: Order detail — items, pricing breakdown, GST split (CGST/SGST/IGST), customer snapshot, address, payment trail, fulfilment trail, courier + AWB tracking timeline, notes, internal tags, activity log, attachments
59–66: Actions — accept, cancel (w/ reason codes), edit line items, apply discount, change address, split order, merge order, mark priority
67–74: Fulfilment — allocate warehouse, generate pick list, pack, generate label, handover, partial fulfilment, backorder, dropship route
75–82: Payments — capture, partial capture, void, refund full, refund partial, refund to store credit, COD remittance reconcile, payment retry
> **D-mix:** heavy D3/D4. Reason codes, refund rules, allocation logic = D5.

## A3. Returns / RMA — 26
83–108: RMA request queue, auto-approve rules engine (D5), return reasons taxonomy, return window config (D4), QC checklist, restock/scrap decision, refund calculation engine (D5), exchange flow, replacement order generation, return shipping label, reverse-pickup scheduling, RTO handling, fraud-return scoring (D5), return analytics by reason/product/customer

## A4. Catalogue — 72
109–124: Products — grid/list, search, filter (category/brand/stock/price/status/tag), bulk edit, duplicate, archive, import CSV, export CSV, media manager, drag-reorder gallery, alt-text, SEO fields, slug editor, publish scheduling
125–140: Variants — matrix generator (size × colour), per-variant SKU/price/stock/weight/barcode, bulk variant edit, variant images, option sets, swatch config
141–152: Pricing — cost, MRP, sale price, margin calc, price-list per customer group (D4), tiered/quantity pricing (D5), scheduled price changes (D4), bulk price rules (D5), currency rounding, price history
153–164: Inventory — per-warehouse stock, low-stock threshold, safety stock, reorder point, backorder policy, stock adjustments w/ reason, stock ledger, transfer between warehouses, stock-take/audit, ATP calculation (D5)
165–172: Taxonomy — categories tree (drag-nest), collections, smart/auto collections by rules (D5), brands, tags, attributes, attribute sets, HSN + GST slab mapping
173–180: Enrichment — bundles/kits, related products, cross-sell, upsell, FAQ per product, size chart, care instructions, GI-tag/handmade/origin metadata

## A5. Customers & CRM — 64
181–200: List, search, segment filter, RFM filter, CLV filter, churn-risk filter, tags, saved segments, bulk tag, bulk email, export, merge duplicates, GDPR delete/anonymise, impersonate (view-as)
201–226: **Customer 360** — profile, demographics, lifetime stats, RFM scores, CLV, churn risk, AOV trend, category affinity, brand affinity, price-band affinity, purchase timeline, session/event timeline, addresses, payment methods, wishlist, active cart, abandoned carts, orders, returns, tickets, reviews, loyalty balance, store credit, referrals, consent/preferences, notes
227–236: **Next-best-action engine** (D5), win-back suggestion, cross-sell suggestion, risk flag, VIP flag, manual segment override
237–244: Groups — customer groups, group-based pricing (D4), group-based shipping (D4), B2B GSTIN, credit limit, payment terms, approval workflow

## A6. Loyalty & Rewards — 38  ← *admin fully configures*
245–256: Program on/off, earn rate per ₹, category multipliers, tier definitions (name/threshold/colour/perks), tier benefits config, point expiry rules, rounding rules, signup bonus, birthday bonus, review bonus, referral bonus, streak bonus
257–268: Redemption — point value, min/max redeem, redeem on shipping toggle, redeem caps, blackout products, redemption ladder, cashback vs discount mode
269–278: Ops — manual point adjust, bulk point grant, point ledger, expiry notifications, tier up/down automation (D5), loyalty analytics, liability report
279–282: Referral program — reward both sides, tracking links, fraud guard

## A7. Promotions, Offers & Pricing Rules — 52  ← *admin fully configures*
283–300: Coupon CRUD, code generator, bulk unique codes, % off, ₹ off, free shipping, BOGO, buy-X-get-Y, tiered cart discount, first-order only, new-vs-returning, min cart value, max discount cap, usage limit total, usage limit per customer, stacking rules, priority/exclusivity
301–316: **Conditions engine (D5)** — cart value, item count, specific products/categories/brands/tags, customer group, segment, RFM band, state/zone, city tier, payment method, channel, device, first-order, day-of-week, time window, date range
317–328: Automatic discounts (no code), flash sales w/ countdown, scheduled campaigns, festive presets (Diwali/Holi/Raksha Bandhan), bundle offers, volume offers, cart-level gifts, free-gift threshold
329–334: Testing — **rule simulator / preview on sample cart (D5)**, conflict detector, discount analytics, margin-impact guard

## A8. Marketing & Campaigns — 44
335–352: Campaign builder, audience picker from segments, channel (email/SMS/WhatsApp/push), template editor, variable merge tags, A/B split, send scheduling, throttling, UTM builder, preview, test send, campaign analytics (sent/open/click/convert/revenue)
353–366: **Automation / journey builder (D5)** — triggers (signup, first order, abandoned cart, browse abandon, post-delivery, churn risk, birthday, tier-up, back-in-stock), delays, conditions, multi-step flows, exit rules
367–378: Content — banners, hero slides, announcement bar, popups, exit-intent, landing-page blocks, blog posts, SEO meta, sitemap, redirects, nav-menu builder, footer builder

## A9. Analytics & Reports — 46
379–400: Sales report, product report, category report, customer report, cohort retention grid, RFM grid, funnel analysis, channel attribution, discount/promo report, tax report (GST summary), payment report, shipping report, return report, inventory valuation, stock-ageing, margin report, COD report, RTO report, abandoned-cart report, loyalty liability, ticket SLA, search-terms report
401–414: Every report: date range, compare, group-by, filter, drill-down, column chooser, sort, CSV export, chart/table toggle, save as view, schedule email
415–424: **Custom report builder (D5)** — pick metrics + dimensions + filters, cohort builder, anomaly detection, forecast (moving avg / linear trend)

## A10. Operations — 40
425–440: Warehouses CRUD, zones, pin-code serviceability, courier partners, courier rate cards, rate-shopping rule (D5), SLA config, shipping zones, shipping methods, free-shipping threshold, weight/dimension slabs, packaging materials, pick-pack-ship queues, manifest, NDR management, delivery-exception queue
441–452: Purchase orders, suppliers, supplier lead time, PO receive (GRN), landed-cost calc, reorder suggestions (D5), stock forecast, dead-stock report
453–464: Support desk — tickets, priority, SLA timers, canned responses, macros, assignment rules (D5), escalation, CSAT, ticket analytics

## A11. Payments & Finance — 32
465–480: Gateway config (Stripe + Razorpay), test/live mode, methods toggle (UPI/card/netbanking/wallet/EMI/COD), COD availability rules (D5), COD fee config, partial-COD, EMI plans, saved-card policy, refund policy, settlement view, reconciliation, chargeback log
481–496: Invoicing — invoice templates, GST invoice, e-invoice fields, credit notes, store credit ledger, gift cards (issue/redeem/balance), wallet, payment links, dunning, tax rules per HSN/state, TCS/TDS fields, financial exports (Tally-friendly CSV)

## A12. Platform, Users & Settings — 38
497–514: Admin users, roles, granular permission matrix (D4), audit log, login history, 2FA toggle, session policy, API keys, webhooks, integrations registry, notification preferences per admin
515–534: Store settings — store profile, legal entity, GSTIN, addresses, currency, locale, languages, timezone, units, order-number format, invoice numbering, business hours, holiday calendar, maintenance mode, feature flags, data import/export, backup/restore, reset-to-demo

**ADMIN RUNNING TOTAL: ~534 features** ✅ (target 500+)

---

# PART B — USER / STOREFRONT PANEL (target 300+)

## B1. Discovery & Navigation — 40
1–16: Home hero/slider, announcement bar, category tiles, featured rails, new arrivals, best sellers, trending, recently viewed, recommended-for-you, editorial blocks, festive banners, countdown timers, brand strip, testimonial rail, blog rail, Instagram-style grid
17–30: Mega menu, mobile drawer nav, breadcrumb, category landing, collection pages, tag pages, brand pages, sitemap page, 404 recovery, search entry points
31–40: **Search** — instant/typeahead, product+category+brand suggestions, recent searches, popular searches, typo tolerance, synonyms, zero-result recovery, search filters, search analytics feed, voice-search stub

## B2. Product Listing (PLP) — 30
41–70: Grid/list toggle, density switch, sort (relevance/price/newest/rating/popularity/discount), infinite scroll + pagination, filters — category, price slider, brand, size, colour swatch, rating, discount %, availability, fabric, craft, origin, GI-tag, occasion, new-arrival, express-delivery; multi-select facets, facet counts, applied-filter chips, clear all, mobile filter sheet, sticky toolbar, per-card quick view, quick add, wishlist toggle, compare toggle, badges (new/bestseller/low-stock/discount), colour-variant preview on card, skeleton loading

## B3. Product Detail (PDP) — 46
71–116: Gallery w/ zoom + thumbnails + video slot, colour swatches, size selector, size chart, fit guide, stock indicator, low-stock urgency, price + MRP + discount %, **loyalty points preview**, tax note, variant-aware everything, quantity stepper, add to cart, buy now, wishlist, compare, share, pin-code serviceability check, EDD (estimated delivery date), COD availability check, express-delivery badge, offers box (auto-applied + coupon list), bank offers, bundle/frequently-bought-together, complete-the-look, related products, recently viewed, description tabs, specifications, care instructions, GI-tag/handmade/origin story, ratings summary, rating histogram, reviews list, review filters, review sort, photo reviews, helpful votes, verified-buyer badge, write review, Q&A list, ask question, seller info, return policy, warranty, back-in-stock notify

## B4. Cart & Checkout — 44
117–140: Cart drawer + full cart page, line edit, qty stepper, remove, save-for-later, move to wishlist, variant change in cart, stock revalidation, price-change notice, coupon apply/remove, **auto-applied offers display**, **loyalty points redeem slider**, store-credit apply, gift-card apply, gift wrap, gift message, order notes, cart summary w/ GST breakdown, shipping estimate, free-shipping progress bar, cross-sell in cart, empty-cart recovery, cart persistence, cart merge on login
141–160: Checkout — guest checkout, login/OTP, address book, add/edit address, pin-code autofill, GSTIN for B2B, billing≠shipping, delivery-slot picker, shipping-method selector, payment method (UPI/card/netbanking/wallet/EMI/COD), UPI app picker, saved cards, EMI plan selector, COD fee display, order review, T&C consent, place order, payment retry, order confirmation, invoice download

## B5. Account & Post-Purchase — 52
161–186: Dashboard, profile edit, avatar, phone/email verify, password, addresses CRUD + default, payment methods, GSTIN, preferences (language/currency/sizes), communication consent (email/SMS/WhatsApp), privacy/data export, delete account
187–212: Orders list, filters, order detail, live tracking timeline, AWB link, invoice, reorder, cancel item/order, return/exchange request w/ reason + photos, return tracking, refund status, rate & review prompt, delivery feedback, support ticket from order, chat thread, FAQ
> plus wishlist (multi-list, share, move to cart, price-drop alerts), compare page, browsing history, saved searches

## B6. Loyalty, Offers & Engagement — 34
213–246: **Loyalty dashboard** — point balance, tier badge, progress to next tier, tier perks list, earn history ledger, redeem history, expiring-points warning, ways-to-earn checklist, birthday reward, streak tracker; **Offers page** — all coupons, eligible-for-you, copy code, apply from page, expiry countdown, terms; **Referral** — invite link, share sheet, referral status, rewards earned; store credit + wallet balance + gift-card balance; notifications centre; back-in-stock + price-drop subscriptions

## B7. Experience & Platform — 30
247–276: Fully responsive (mobile/tablet/desktop), dark mode, language switcher (EN/HI/+), currency display, RTL-ready, keyboard nav, focus states, ARIA labels, reduced-motion respect, skeletons, optimistic UI, toasts, error boundaries, offline notice, PWA install prompt, scroll restoration, deep-linkable filters, share targets, WhatsApp support CTA, live-chat widget, cookie consent, newsletter signup, exit-intent offer, recently-viewed persistence, session continuity, page-transition animations, micro-interactions, confetti moments, haptic-style feedback

**USER RUNNING TOTAL: ~316 features** ✅ (target 300+)

---

# PART C — THEMING & CUSTOMISATION LAYER (alag se, 500+ me count nahi)

> User ki alag demand: *"admin panel me 5-10 template do UI ke, logo/name/colour/theme/font/header/footer sab customize kar sake"*

## C1. Theme Templates — 10
1. **Saffron Bazaar** — festive Indian, warm saffron/maroon, ornate
2. **Midnight Luxe** — dark premium, gold accents, serif
3. **Minimal Muji** — ultra-clean, lots of whitespace, mono
4. **Neo Brutalist** — hard shadows, thick borders, bold type
5. **Pastel Boutique** — soft pinks/creams, rounded, playful
6. **Electric Mono** — high-contrast black/white + neon accent
7. **Handloom Heritage** — earthy, textile textures, block-print motifs
8. **Glass Aurora** — glassmorphic, blurred gradients (current look)
9. **Corporate Trust** — navy/grey, dense, B2B-oriented
10. **Sunrise Commerce** — bright gradient, high-energy, D2C

## C2. Brand Identity — 14
Logo upload/URL, logo height, favicon, store name, tagline, brand colour, secondary colour, accent, success/warn/danger, neutral ramp, gradient presets, dark-mode palette, auto-contrast checker

## C3. Typography — 12
Heading font, body font, mono font, font pairing presets, base size, scale ratio, heading weight, body weight, line height, letter spacing, uppercase toggles, Indic-script fallback

## C4. Layout & Shape — 16
Container width, section spacing, grid gap, border radius scale, border width, shadow intensity, card style (flat/raised/outlined/glass), button style (solid/soft/outline/ghost/pill), input style, divider style, icon style, image aspect ratio, PLP columns (mobile/tablet/desktop)

## C5. Header Builder — 14
Layout presets (logo-left / centered / split), sticky toggle, transparent-on-hero, announcement bar on/off + text + colour + scroll speed, nav items CRUD + reorder + nesting, search style (icon/inline/full), show wishlist/account/cart, cart icon style, mobile header variant, top-bar links

## C6. Footer Builder — 12
Column count, column CRUD, link CRUD per column, newsletter block, social links, payment badges, trust badges, app-store badges, copyright text, back-to-top, footer background, legal links

## C7. Page Composer — 12
Home section list, add/remove/reorder sections, per-section config, section visibility by device, section scheduling, hero variants, banner slots, USP strip, testimonial source, CTA blocks

## C8. Motion & Effects — 10
Animation intensity (off/subtle/normal/cinematic), page-transition style, hover-lift toggle, parallax toggle, confetti toggle, skeleton style, cursor effects, background FX (aurora/grid/noise/none), scroll-reveal, reduced-motion override

## C9. Theme Ops — 10
Live preview, device preview (mobile/tablet/desktop), save as custom theme, duplicate theme, export theme JSON, import theme JSON, reset to default, per-theme dark variant, publish/draft, theme version history

**THEMING TOTAL: ~110 configurable controls across 10 templates**

---

# GRAND TOTAL

| Layer | Count |
|---|---|
| Admin panel | **~534** |
| User panel | **~316** |
| Theming & customisation | **~110** |
| **TOTAL** | **~960 working features** |

---

# File Architecture — 1000+ files

Ye feature count naturally 1000+ files banata hai, artificially nahi:

```
src/
├─ core/                    ~60 files   store, events, persistence, router, di
├─ config/                  ~40 files   feature flags, defaults, constants
├─ data/
│  ├─ generators/           ~30 files   one per entity
│  ├─ fixtures/             ~25 files
│  └─ schema/               ~35 files   zod-style validators per entity
├─ engines/                 ~55 files   pricing, promo, loyalty, tax, shipping,
│                                       ATP, RFM, CLV, churn, NBA, search,
│                                       recommendation, automation, rules
├─ services/                ~70 files   one per domain, CRUD + queries
├─ hooks/                   ~90 files   one hook per concern
├─ ui/
│  ├─ primitives/          ~70 files   Button, Input, ... each own file
│  ├─ charts/              ~30 files
│  ├─ motion/              ~25 files
│  └─ patterns/            ~45 files
├─ theme/
│  ├─ templates/           ~10 files   the 10 UI templates
│  ├─ tokens/              ~25 files
│  └─ builder/             ~35 files   header/footer/page composers
├─ admin/
│  ├─ dashboard/           ~35 files
│  ├─ orders/              ~45 files
│  ├─ returns/             ~25 files
│  ├─ catalogue/           ~65 files
│  ├─ customers/           ~55 files
│  ├─ loyalty/             ~35 files
│  ├─ promotions/          ~50 files
│  ├─ marketing/           ~45 files
│  ├─ analytics/           ~45 files
│  ├─ operations/          ~40 files
│  ├─ finance/             ~32 files
│  └─ settings/            ~38 files
├─ shop/
│  ├─ home/                ~30 files
│  ├─ plp/                 ~30 files
│  ├─ pdp/                 ~45 files
│  ├─ cart/                ~25 files
│  ├─ checkout/            ~40 files
│  ├─ account/             ~50 files
│  └─ loyalty/             ~30 files
└─ lib/                     ~60 files   utils, formatters, validators
```

**Estimated: ~1,050–1,150 files**

Rule: **one component / hook / engine / schema per file.** Koi barrel-dump nahi.

---

# The Connection Layer (admin → user, real-time)

Ye sabse important architectural piece hai. User ne kaha: *"pura user panel admin panel se connected rahe"*.

```
┌──────────────────────────────────────────────┐
│  ADMIN PANEL                                 │
│  koi bhi config badlo                        │
└───────────────┬──────────────────────────────┘
                │ dispatch(action)
                ▼
┌──────────────────────────────────────────────┐
│  CORE STORE  (single source of truth)        │
│  • slices per domain                         │
│  • localStorage persistence (versioned)      │
│  • pub/sub event bus                         │
│  • cross-tab sync (storage event)            │
└───────────────┬──────────────────────────────┘
                │ subscribe
                ▼
┌──────────────────────────────────────────────┐
│  ENGINES — pure functions, read store        │
│  pricing · promo · loyalty · tax · shipping  │
└───────────────┬──────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│  USER PANEL — instantly reflects             │
│  theme, nav, offers, loyalty, prices, stock  │
└──────────────────────────────────────────────┘
```

**Concrete proof-points** (demo me dikhane layak):
- Admin theme badle → storefront turant naya look
- Admin loyalty earn-rate badle → PDP pe points preview turant badle
- Admin coupon banaye → user ke offers page pe turant dikhe
- Admin stock ghataye → PLP pe "low stock" badge turant
- Admin nav item add kare → storefront header turant update
- Admin COD band kare ek state ke liye → checkout pe COD hide
- User order kare → admin orders list me turant naya order + KPI update

Cross-tab sync ka matlab: **do browser tab kholo — ek admin, ek shop — ek me change karo, dusre me turant dikhega.**

---

# Tech Decisions

| Decision | Choice | Why |
|---|---|---|
| Backend | **None** — client-side store + localStorage | 100% free hosting, koi server cost nahi, Netlify pe chalega |
| State | Custom lightweight store (no Redux dep) | zero deps, full control, cross-tab sync built-in |
| Persistence | localStorage, versioned + migrations | admin changes survive reload |
| Styling | Tailwind + **CSS variables** | theme switching runtime pe possible |
| Charts | Hand-rolled SVG | zero deps |
| Motion | framer-motion | already in use |
| Payments | Stripe + Razorpay **simulated** (real SDK shape) | bina backend ke real charge impossible; integration-ready code |

> **Honest note:** payments simulate honge kyunki real gateway ko server-side secret key chahiye. Code structure real SDK jaisa hoga, sirf API call mock hoga — baad me backend lagao to swap easy.

---

# Build Phases

| Phase | Content | Files |
|---|---|---|
| **0** | Core store, event bus, persistence, cross-tab sync, schema layer | ~120 |
| **1** | Theme engine + 10 templates + all builders | ~110 |
| **2** | Engines (pricing, promo, loyalty, tax, shipping, search, reco) | ~90 |
| **3** | UI primitives + charts + motion library | ~140 |
| **4** | Admin: catalogue, orders, customers, returns | ~230 |
| **5** | Admin: loyalty, promotions, marketing, analytics | ~185 |
| **6** | Admin: operations, finance, settings | ~110 |
| **7** | Storefront: home, PLP, PDP, cart, checkout | ~180 |
| **8** | Storefront: account, loyalty, engagement | ~90 |
| **9** | Wiring, tests, polish, deploy | ~40 |

Har phase ke baad build green + deploy update.
