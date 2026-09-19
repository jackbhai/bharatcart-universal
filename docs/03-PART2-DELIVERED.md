# Part 2 — Commerce Engines + UI Library + Catalogue Admin

**Status:** ✅ Delivered · 220 assertions passing · build green · deployed

**Live:** https://helpful-axolotl-3ff372.netlify.app (password `My-Drop-Site`)
**Claim (60 min window):** https://app.netlify.com/drop/helpful-axolotl-3ff372

---

## 1. Commerce engines (9 modules, `src/engines/`)

Ye pure JS modules hain — koi React dependency nahi, isliye ye admin aur storefront
dono me same logic chalate hain. Isi wajah se "admin jo configure kare, user panel
me wahi dikhe" guarantee milti hai.

| Engine | Kya karta hai |
|---|---|
| `tax/gst.js` | GST-inclusive pricing, CGST/SGST/IGST/UTGST split, GSTIN validation, HSN summary, full tax invoice |
| `pricing/priceEngine.js` | 5-layer price resolution (base → qty tier → group price list → scheduled sale) with audit trail; margin waterfall; bulk repricing |
| `promo/conditions.js` | 26-field rule engine, 11 operators, human-readable explanations |
| `promo/promoEngine.js` | 8 discount types, stacking/exclusivity, conflict detection, per-item distribution |
| `loyalty/loyaltyEngine.js` | Earn/redeem maths, 4 tiers with multipliers, expiry, liability reporting |
| `shipping/shippingEngine.js` | 7-courier rate shop, 5 zones, volumetric weight, serviceability, Sunday-aware ETA |
| `inventory/inventoryEngine.js` | ATP, statistical reorder point, EOQ, valuation, ageing, dead stock, forecasting, allocation |
| `search/searchEngine.js` | Typo-tolerant scoring, Indian-apparel synonyms, facets, 9 sorts |
| `analytics/recoEngine.js` | Similarity, FBT, complete-the-look, personalised feed, trending, cross-sell |

## 2. UI library (`src/ui/`)

- **`primitives/Button.jsx`** — 8 variants × 5 sizes, loading state, spring tap
- **`primitives/Input.jsx`** — Input, Textarea, Select, Label, Switch, Checkbox (with indeterminate), Radio, Slider, RangeSlider
- **`primitives/Display.jsx`** — Badge, Pill, Card, CardHead, Avatar (deterministic colour), AvatarGroup, Progress, Empty, Skeleton (shimmer), Divider, Tooltip, Tabs (shared-layout indicator), Modal, Drawer, Popover
- **`patterns/DataTable.jsx`** — sorting, multi-select with bulk action bar, column chooser, pagination, row expansion, sticky header, skeleton + empty states

Sab kuch theme tokens (`var(--c-*)`) se chalta hai, to Part 1 ke 11 templates
automatically in sab par apply hote hain.

## 3. Catalogue admin (`src/admin/catalogue/`)

5 tabs, sab engines se wired:

**Products** — 5 live KPI cards · typo-tolerant search · 12-facet filter drawer · 9 sorts · inline variant strip · bulk publish/draft/archive/reprice/delete · per-row margin health

**Product editor** (6 sub-tabs) — General · Pricing (margin waterfall, charm pricing, target-margin buttons, GST + loyalty preview) · Variants (size × colour matrix generator) · Inventory (adjustment ledger with 6 reasons) · Attributes (fabric/craft/origin/GI/handmade) · SEO (live Google preview)

**Categories** — HSN + GST slab defaults jo naye products me cascade hote hain, revenue ranking

**Collections** — smart rule builder with 17 fields, live product preview, publish toggle

**Inventory** — Reorder planner (lead-time + service-level sliders, PO builder) · Valuation (3 methods) · Ageing (5 buckets) · Dead stock (auto markdown) · Warehouses (capacity + fulfilment policy)

**Price lists** — customer-group lists · quantity breaks · scheduled sales · **price simulator** jo pura audit trail dikhata hai

## 4. Bugs jo testing me mile aur fix hue

Test likhne se 5 asli bugs pakde gaye — sirf assertions add nahi kiye:

1. **`promoEngine`: coded promos chup-chaap gayab ho rahe the.** Jo promo code gate fail karta tha wo `rejected` me bhi nahi aata tha — admin ko kabhi pata hi nahi chalta ki offer kyun nahi laga. Ab har gate (inactive / window ke bahar / budget khatam / code chahiye) explicit reason ke saath report hota hai.
2. **`promoEngine`: `ctx.code` (singular) support hi nahi tha** — sirf `ctx.codes` array. Checkout typically ek hi code bhejta hai. Ab dono chalte hain, case-insensitive.
3. **`priceEngine`: scheduled sales sirf per-product thi.** Admin UI category-wide aur brand-wide sale banane deta hai — engine unhe ignore kar deta. Ab `scope: all | category | brand` aur `discountPct` dono support hain.
4. **`recoEngine`: trending hamesha khali aata tha.** Seed orders `placedAt` use karte hain, engine sirf `createdAt`/`date` padh raha tha — matlab har order "purana" bucket me chala jata tha. Ab teeno padhta hai.
5. **`previewBulkPrice` sirf flat array return karta tha** — UI ko `changes` / `skipped` / `revenueImpact` chahiye the (below-cost guard ke saath). Ab structured object return hota hai jo array ki tarah bhi kaam karta hai, so purana code nahi toota.

Iske alawa InventoryTab ke field names engine ke asli return shapes se align kiye
(`suggestedQty`, `estimatedCost`, `lockedCapital`, `totalCost`/`totalRetail`), aur
`src/lib/salesHistory.js` add kiya jo seed orders se asli 90-din ki demand series
banata hai — pehle reorder planner khali chal raha tha kyunki demand data hi nahi tha.

## 5. Testing

| Suite | Assertions |
|---|---|
| `tests/render.mjs` | 74 (screens, store, theme, backend adapters) |
| `tests/part2.mjs` | 146 (9 engines, store slices, catalogue mount) |
| **Total** | **220 · 0 failed** |

```bash
cd /home/user/bharatcart
npm install --no-audit --no-fund
npx vite-node tests/render.mjs
npx vite-node tests/part2.mjs
npx vite build
```

## 6. Aage kya (Part 3)

Orders · Returns/RMA · Customers 360 · Operations/fulfilment — sab inhi engines par,
`shippingEngine.allocate()` aur `inventoryEngine` ke reservation model ko use karte hue.
