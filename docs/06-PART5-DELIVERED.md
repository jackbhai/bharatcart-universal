# Part 5 — Storefront · Payments · Wiring · Ship

**Status:** ✅ Delivered — project complete · 676 assertions passing · build green · deployed

**Live:** https://darling-druid-e38c45.netlify.app (password `My-Drop-Site`)
**Claim (60 min):** https://app.netlify.com/drop/darling-druid-e38c45

---

## 1. Storefront ko admin se joda (Part 5 ka core)

Pehle ka storefront **disconnected** tha — apna hardcoded GST, apna ₹999 shipping threshold, hardcoded slate colours, aur `me.affinity` / `me.points` jaise fields jo seed data me the hi nahi.

`src/shop/shopState.jsx` poora dobara likha. Design rule ek hi hai: **yahan koi business logic nahi hai.** Tax, promos, loyalty, shipping, stock — sab wahi engines calculate karte hain jo admin panel configure karta hai.

Concretely, ab ye sab admin se live control hota hai:

| Admin me badlo | Storefront pe turant asar |
|---|---|
| Settings → free shipping threshold | Cart ka shipping charge + "add ₹X more" nudge |
| Settings → COD on/off, max value | Checkout me COD option block, reason ke saath |
| Settings → registered state | GST CGST+SGST ya IGST me switch |
| Settings → maintenance mode | Poora storefront offline page |
| Settings → feature flags | Wishlist / loyalty / COD UI gayab |
| Settings → payment gateways | Checkout me kaunse methods dikhein |
| Promotions → koi bhi promo | Cart me discount, "applied/rejected" reasons ke saath |
| Loyalty → earn rate, tiers, caps | Points earned, redeemable slider, tier progress |
| Catalogue → price, stock, status | Product cards, PDP, cart line prices |

Ek cart **product IDs** store karta hai, objects nahi — warna admin ka price edit us cart tak pahunchta hi nahi jo edit se pehle bana tha.

**Ulta direction bhi jud gaya:** storefront pe order place karo → `orders/placeOrder` → wahi order admin ke Orders screen, SLA board, courier scorecard aur P&L me turant dikh jaata hai.

## 2. Payments — Razorpay + Stripe

`src/payments/index.js` — dono gateways ke **asli SDK call shapes aur return objects**:
- Razorpay: `orders.create()` → paise me amount, `order_` / `pay_` prefixed ids, signature field, 6 methods (UPI 0% fee aur highest success rate)
- Stripe: `paymentIntents.create()` → `pi_` / `ch_` ids, `client_secret`, charges array
- Unified `pay()` — UI ko pata hi nahi chalta kaunsa gateway chala

**Simulated hai, aur jaan-boojh ke:** backend ke bina real order create karne ke liye secret key browser me bhejni padti — har visitor ko. Isliye nahi kiya. File ke end me `MIGRATION` block exactly likha hai kya replace karna hai (3 endpoints, signature verification, kaunsi keys server-only hain).

Ek cheez jo maine deliberately simulate ki: **failures**. Sirf happy path banata to checkout ka error handling kabhi test hi na hota. Ab ~3-12% attempts realistically fail hote hain aur UI unhe handle karta hai.

## 3. Naye storefront screens

- **Storefront** — hero, personalised feed, trending, category grid, recently viewed; faceted browse (5 facet groups + filters), search with suggestions; PDP with variants, live pincode serviceability, FBT + similar products; mobile bottom nav
- **Cart** — free-shipping progress, coupon apply (engine se verify), **loyalty points slider** with live cap reason, full tax breakdown
- **Checkout** — 3-step (delivery → payment → confirm), pincode validation, admin-driven payment methods, failure handling, confirmation with payment reference
- **Account** — orders with live tracking + per-item **return eligibility**, self-service return request with refund preview, rewards/tier benefits, wishlist, returns tracking

## 4. Code splitting

13 route-level lazy chunks + Suspense. 500kB warning gaya — ab **21 chunks**, sabse bada 494kB (React + framer-motion vendor), har admin module 15-28kB apna.

## 5. Bugs jo testing me mile

Saat failures, sab asli:

1. **`search()` array nahi, `{results, tokens, corrected, total}` return karta hai** — browse page pe `.map()` crash.
2. **`SORTS` comparator functions ka map hai** — maine `s.label` padha, dropdown me `undefined`.
3. **Reco engine ke chaar signatures galat the.** `personalisedFeed(customer, catalogue)` — maine ulta pass kiya, `catalogue.filter is not a function`, **poora storefront blank**. Same `similarProducts`, `frequentlyBoughtTogether`, `cartCrossSell`. Session notes me ye warning pehle se thi ("hamesha grep karo, documented signature pe bharosa mat karo") — maine phir bhi assume kiya. Ab teeno ke liye dedicated signature tests hain.
4. **`cartCrossSell` cart lines `{product, qty}` expect karta tha, bare products nahi** — engine ko dono accept karne layak banaya.
5. **Finance test bahut dheela tha** (`>= length - 5`) — exact reconciliation me badla.
6. **Promotion test seeded promos ko count nahi kar raha tha** — delta measure karne layak banaya.
7. **Free-shipping assumption meri galat thi.** Maine socha threshold badhane se shipping wapas lagega. Nahi laga — seed me ek *promotion* bhi hai "Free shipping over ₹999", jo apni condition alag se satisfy karti hai. Pehle maine ise bug samajh ke shopState "fix" kar diya tha; phir dekha ki behaviour **sahi** hai (do independent levers hain), to apna fix revert kiya aur test ko asli behaviour verify karne layak banaya — dono levers band karo tabhi shipping lagta hai.

## 6. Testing

| Suite | Assertions |
|---|---|
| `tests/render.mjs` | 74 |
| `tests/part2.mjs` | 146 |
| `tests/part3.mjs` | 168 |
| `tests/part4.mjs` | 163 |
| **`tests/part5.mjs`** | **125** |
| **Total** | **676 · 0 failed** |

Part 5 ke tests ek live `ShopProvider` mount karke ek probe component se context nikalte hain, phir **admin action dispatch karke verify karte hain ki storefront badla** — ye cross-panel wiring ka asli proof hai.

## 7. Poora project

| Part | Kya | Assertions |
|---|---|---|
| 1 | Foundation, theming (11 templates), pluggable backend, auth | 74 |
| 2 | 9 engines, UI primitives, Catalogue (5 tabs) | 146 |
| 3 | Orders, Returns, Customer 360, Operations | 168 |
| 4 | Loyalty, Promotions, Growth, Analytics, Finance, Settings | 163 |
| 5 | Storefront wiring, payments, code splitting | 125 |

**110 source files · 12 admin modules · 13 engines · 21 build chunks · 676 tests.**

## 8. Kya real hai, kya nahi — saaf-saaf

**Real:** saari business logic (tax, promos, loyalty, returns, RFM/CLV, P&L, GST), dono panels ka wiring, persistence, theming, backend adapter layer.

**Simulated:** payments (backend nahi hai), data (deterministic seed), aur finance ke COGS/marketing/conversion-rate assumptions — wo UI me tunable sliders hain, hardcoded nahi.

**Backend jodne ke liye:** `src/backend/adapters/` me Supabase/Firebase adapters pehle se hain, `VITE_BACKEND` env var se switch. Payments ke liye `src/payments/index.js` ka `MIGRATION` block follow karo.
