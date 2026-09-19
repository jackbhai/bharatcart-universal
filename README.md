# BharatCart

A complete ecommerce suite — **admin panel and customer storefront** — built with
React and Vite. Runs entirely in the browser with no backend, and connects to a
real one when you add keys.

**MIT licensed. No paid dependency anywhere.**

```bash
git clone <your-repo-url> bharatcart
cd bharatcart
npm install
npm run dev
```

Open the printed URL. The storefront loads immediately with sample data — no
signup, no database, no configuration.

**Admin panel:** add `/#/admin` to the URL, then click **"Enter admin as demo
owner"**. There is deliberately no link from the shop into the admin panel.

---

## What is in it

| | |
|---|---|
| **Admin screens** | 22 — dashboard, catalogue, orders, returns, customers, inventory, shipping, vendors, support, analytics, reports, finance, marketing, promotions, loyalty, content, operations, theme, localisation, integrations, people, settings |
| **Storefront** | browse, search, filters, cart, checkout, order tracking, returns, wishlist, loyalty, account |
| **Languages** | 11 (English, हिन्दी, ਪੰਜਾਬੀ, اردو, தமிழ், বাংলা, Русский, Français, Deutsch, Español, العربية) with full RTL |
| **Currencies** | 157, with live-shaped conversion |
| **Countries** | 90, with per-country address formats and shipping zones |
| **Auth providers** | 21 (email/password, magic link, Google, GitHub, Apple, Facebook, Discord, phone OTP, anonymous, …) |
| **Backends** | 4 pluggable — local, Supabase, Firebase, Cloudflare |
| **Payments** | Stripe + Razorpay, simulated with the real SDK shape |
| **Products** | 380 across 9 business verticals — fashion, innerwear, footwear, artificial jewellery, fine jewellery, confectionery, dairy, grocery, general |
| **Tests** | 2,048 assertions, 0 failing |
| **Runtime dependencies** | 4 |

---

## Multi-vertical

BharatCart is not a fashion shop with other categories bolted on — it is a
multi-vertical platform. Nine verticals share one registry
(`src/engines/catalogue/verticals.js`) that declares, per vertical, its
variant axes (pack size for food, weight + purity for gold, …), its attribute
schema, its size chart, and its flags: perishable, cold-chain,
subscription-capable, gold-priced.

Seven purpose-built engines hang off that registry:

- **Gold pricing** — live-shaped 24K/22K/18K/14K rates, making + wastage +
  stone math with 3% GST, and rate snapshots locked at checkout.
- **Unit pricing** — `₹240/kg`-style labels so a 250 g pack and a 5 kg pack
  compare fairly.
- **Expiry / FEFO** — floor-day freshness status, oldest-expiry-first
  allocation, automatic 25% near-expiry markdown.
- **Subscriptions** — daily / alternate-day / weekly delivery schedules with
  skip, pause, and no-delivery-day handling (milk-run style).
- **Cold chain** — detects cold-chain need, adds zonal surcharges, validates
  serviceable pincodes and delivery slots.
- **Size charts** — UK ⇄ US ⇄ EU ⇄ CM conversion, per-vertical tables.
- **Vertical price dispatcher** — routes each product to the right pricing
  logic and returns an explainable source + trail.

The storefront PDP picks a per-vertical variant selector automatically
(pack pills for groceries, weight options for jewellery, size grids for
apparel); the admin catalogue editor adapts its fields and filters to the
selected vertical. Adding a vertical is registry + seed + picker —
see `docs/13-PART12-VERTICALS.md`.

---

## Running it against a real backend

The app ships with a `local` backend: everything works, data lives in
`localStorage`, and nothing leaves the browser. That is the demo mode.

To connect a real one, copy `.env.example` to `.env` and fill in one section:

```bash
cp .env.example .env
```

```env
VITE_BACKEND=supabase
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

Restart the dev server. The whole app — auth, data, storage — switches over.
Nothing else changes.

**Supabase is the recommended choice** because it covers Postgres, auth, file
storage and realtime in one free signup. Firebase and Cloudflare adapters exist
and work; a Neon adapter would sit alongside them in `src/backend/adapters/`.

### Adding your own backend

Implement the contract in `src/backend/types.js` and drop the file into
`src/backend/adapters/`. The rest of the app never talks to a vendor SDK
directly — it only talks to the adapter interface.

---

## Deploying

It builds to plain static files, so any host works:

```bash
npm run build     # → dist/
```

- **Netlify / Cloudflare Pages / Vercel** — point at the repo, build command
  `npm run build`, publish directory `dist`
- **GitHub Pages** — push `dist/` to a `gh-pages` branch
- **Any web server** — copy `dist/` into the document root

The app uses `HashRouter`, so deep links work on hosts that do not support
SPA rewrite rules.

> **Going to production?** Read `docs/14-PRODUCTION.md` first — it covers
> env vars, choosing a backend, real payments (Razorpay/Stripe), the live
> gold-rate feed, and the go-live checklist.

---

## Project layout

```
src/
  admin/       22 admin modules, one folder each
  shop/        storefront, cart, checkout, account
  auth/        sign-in screens, provider registry, RBAC, idle timeout
  backend/     pluggable adapters — local, supabase, firebase, cloudflare
  engines/     business logic: pricing, tax, promo, loyalty, shipping,
               inventory, search, orders, returns, finance, people, …
  ui/          primitives, patterns, motion presets, accessibility helpers
  core/        store, events, persistence, error boundaries, security
  i18n/        11 locale bundles
  currency/    157 currencies (generated)
  geo/         90 countries (generated)
  theme/       theming layer
tests/         11 suites, 1,782 assertions
docs/          delivery notes for each build phase
scripts/       generators for the currency and country data
```

**Business logic lives in `src/engines/` and is plain JavaScript with no React
imports.** Every engine can be tested, reused, or moved to a server without
touching the UI. That is the single most useful thing to know before changing
anything.

---

## Testing

```bash
npm test                          # all 11 suites
npx vite-node tests/part10.mjs    # one suite
```

The tests run against jsdom with real React rendering — not snapshots. They
assert on **visible** text where it matters, because asserting on `textContent`
does not prove a page is actually on screen. That distinction caught a bug where
the admin panel rendered correctly and then sat invisible at `opacity: 0`.

**If you add a test and it passes first time, mutate the code it covers and
confirm it fails.** Several tests in this repo were written, passed, and turned
out to assert nothing useful. The practice is documented in the delivery notes.

---

## Generated files — do not edit by hand

- `src/currency/currencies.js`, `src/currency/rates.js` → `scripts/gen_currencies.py`
- `src/geo/countries.js` → `scripts/gen_countries.py`

```bash
npm run gen:currencies
npm run gen:countries
```

---

## Honest limitations

Worth knowing before you build on this:

**Client-side security is not security.** The role checks and price-tamper
detection are real and worth having, but with the `local` backend the role lives
in `localStorage` and a determined user can edit it. The permission model is
correct and reviewable, and it becomes enforceable the moment you connect a
backend that checks it server-side. Do not ship the local backend as production.

**Payments are simulated.** The gateway calls follow the real Stripe and
Razorpay SDK shapes, including realistic failure rates, but no charge is ever
made. Wiring a real gateway needs a server to hold the secret key.

**Phone OTP is not free anywhere.** Supabase requires your own SMS provider and
Firebase requires a billing account. The UI surfaces this rather than letting
you discover it on a bill.

**The sample data is fictional**, generated deterministically from a fixed seed
so every developer sees the same numbers.

---

## Contributing

The delivery notes in `docs/` explain what was built in each phase and why,
including the bugs found along the way — that is the fastest way to get the
context behind a design decision.

`ARCHITECTURE.md` covers the data flow, the store, and the backend contract.

## Licence

MIT — see [LICENSE](LICENSE). Use it commercially, fork it, rebrand it, sell it.
No attribution required, though it is appreciated.
