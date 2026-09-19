# BharatCart — 5-Part Build Plan

Total target: **~960 features**, **~1,100 files**, poora project **5 parts** me.

---

## Part 1 — Foundation, Backend Auth & Theme Engine  ← *ABHI*
- Core store (slices, selectors, dispatch), event bus, versioned localStorage + migrations
- **Cross-tab sync** — admin tab me change → shop tab me turant
- **Backend adapter layer** — `local` | `supabase` | `firebase`, ek env var se switch
- Auth: signup, login, logout, session, password reset, OAuth, roles/guards — teeno backend pe same API
- Schema/validation layer per entity
- Theme engine + CSS variables + **10 UI templates**
- Brand/typography/layout/motion token system
- Deploy-anywhere config (GitHub Pages, Netlify, Vercel, static host)

## Part 2 — Engines + UI Library + Catalogue
- Pricing, promo/rules, loyalty, tax(GST), shipping, ATP, RFM/CLV/churn, NBA, search, recommendation, automation engines
- ~70 UI primitives, ~30 charts, ~25 motion components, ~45 patterns
- Admin catalogue (72 features): products, variants, pricing, inventory, taxonomy, enrichment

## Part 3 — Admin: Orders, Returns, Customers, Operations
- Orders (48), Returns/RMA (26), Customers & CRM (64), Operations (40)
- Customer 360 deep profile, next-best-action engine

## Part 4 — Admin: Loyalty, Promotions, Marketing, Analytics, Finance, Settings
- Loyalty (38), Promotions (52), Marketing (44), Analytics (46), Payments/Finance (32), Platform/Settings (38)
- Header/footer/page builders wired to storefront

## Part 5 — Full Storefront + Wiring + Deploy
- Discovery (40), PLP (30), PDP (46), Cart/Checkout (44), Account (52), Loyalty/Offers (34), Platform (30)
- End-to-end wiring, tests, deploy

---

## Backend Adapter — "kahi bhi deploy karu to kaam kare"

Ek interface, teen implementations:

```
src/backend/
├─ index.js          # picks adapter from config
├─ types.js          # the contract
├─ adapters/
│  ├─ local.js       # localStorage + IndexedDB (default, zero setup)
│  ├─ supabase.js    # Supabase auth + postgres
│  └─ firebase.js    # Firebase auth + firestore
```

**Contract** (sab adapters yahi implement karte hain):
```js
auth.signUp / signIn / signInWithOAuth / signOut
auth.getSession / onAuthStateChange / resetPassword / updateUser
db.list / get / insert / update / remove / query
storage.upload / getUrl / remove
realtime.subscribe / unsubscribe
```

**Switch karna:**
```
VITE_BACKEND=local                      # default, kuch nahi chahiye
VITE_BACKEND=supabase + VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
VITE_BACKEND=firebase + VITE_FIREBASE_* keys
```

Admin panel me **Settings → Backend** screen se bhi runtime pe switch + connection test.

**Deploy-anywhere:** default `local` adapter me koi server nahi chahiye, isliye GitHub Pages / Netlify / Vercel / kisi bhi static host pe as-is chalega. HashRouter + relative base path se subpath deploy (jaise `user.github.io/repo/`) bhi kaam karega.

## Payments
Part 1 ke answer ke mutabik: **simulated, real SDK shape** — Stripe + Razorpay ka poora flow/UI, code real SDK jaisa, API call mock. Backend adapter connect karo to real bhi ho sakta hai.
