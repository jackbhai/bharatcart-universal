# 16 — Backend: where your data lives

BharatCart's data layer (`src/engines/backend/`) lets the merchant pick where
products, orders, customers and settings live — Supabase, Firebase, Neon,
their own REST API, or local development storage. The choice is made in
**Admin → Integrations → Database**, or via `VITE_` environment variables.
Nothing is pre-connected and nothing is faked: an unconfigured backend throws
an honest error instead of pretending to work.

## The layers

| Layer | Location | Owns |
|---|---|---|
| Data interface + adapters | `src/engines/backend/` | products, categories, orders, order_items, customers, settings |
| Auth / files / realtime | `src/backend/` (older) | sign-in, sessions, file uploads, realtime subscriptions |
| Integration registry | `src/engines/integrations/` | provider catalogue, per-category config, connection tests (see `docs/15-INTEGRATIONS.md`) |

The data layer is deliberately separate: auth and file storage have
provider-specific flows (OAuth redirects, signed uploads), while the data
layer is a uniform CRUD interface every adapter implements.

## Choosing a backend

| Backend | Best for | Free tier | Setup |
|---|---|---|---|
| **Supabase** | Most stores. Postgres + PostgREST, no SDK | 500 MB DB, 50k monthly users | Run `supabase/schema.sql` in the SQL editor; paste Project URL + anon key |
| **Neon** | Postgres purists, Vercel users | Generous free tier | Run `supabase/schema.sql` in the Neon SQL editor; paste the connection string |
| **Firebase** | Teams already on Google Cloud | 1 GiB Firestore, 50k reads/day | Collections are created on first write; set Firestore rules (below) |
| **Custom REST API** | Existing backend / ERP | — | Implement the endpoint contract below |
| **Local development** | Trying the UI, demos | — | Nothing. Data stays in this browser |

### Environment variables

All in `.env.example`. Secrets (`VITE_*ANON_KEY`, `VITE_NEON_CONNECTION_STRING`,
`VITE_REST_API_KEY`, …) must be set in your host dashboard (Vercel/Netlify →
Environment Variables) or a local `.env` — never committed, never pasted into
a browser form as anything but a password field. The admin UI only ever shows
**Set / Missing** for them.

> Honest caveat: `VITE_` variables ship inside the client bundle — that is how
> Vite works. Only *publishable* keys belong there (Supabase anon key, Firebase
> web key). Service-role keys and database passwords that grant full access
> belong on a server, behind your own REST API (the `rest` provider).

## Schema setup per provider

### Supabase
1. Dashboard → SQL Editor → paste `supabase/schema.sql` → Run.
2. Admin → Integrations → Database → Supabase → paste Project URL + anon key → **Test connection**.
3. Harden RLS: the schema file ends with commented example policies — adapt
   them to your auth model before going live.

### Neon (or Vercel Postgres — wire-compatible)
1. Neon dashboard → SQL Editor → paste `supabase/schema.sql` → Run.
2. Copy the connection string (it contains the password — treat it as a secret).
3. Set `VITE_NEON_CONNECTION_STRING` in your host's env dashboard (or local `.env`).
4. Admin → Integrations → Database → Neon → **Test connection**.

> Performance note: the Neon adapter's product search uses `ILIKE` across
> three columns. The schema's trigram index (`products_name_trgm`) keeps it
> fast; for very large catalogues add a dedicated search service.

### Firebase
1. Firebase console → Firestore Database → Create database.
2. Admin → Integrations → Database → Firebase → paste Web API key + Project ID → **Test connection**.
3. Collections (`products`, `orders`, `customers`, `categories`, `settings`)
   are created on first write. Start with these rules, then tighten:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /products/{d} { allow read: if true; allow write: if request.auth != null; }
    match /categories/{d} { allow read: if true; allow write: if request.auth != null; }
    match /orders/{d} { allow create: if true; allow read, update: if request.auth != null; }
    match /customers/{d} { allow read, write: if request.auth != null; }
    match /settings/{d} { allow read, write: if request.auth != null; }
  }
}
```

### Custom REST API — endpoint contract

Base URL: `VITE_REST_API_BASE`. Optional `Authorization: Bearer <VITE_REST_API_KEY>`.
Responses may be `{ data, total }` / `{ data }` or bare arrays/objects.

| Method | Path | Body / query |
|---|---|---|
| `GET` | `/products?filter…&sort=&order=&limit=&offset=&search=` | filter: `field=v`, `field=a,b` (in), `field[gt]=v` … |
| `GET` | `/products/:id` | 404 → treated as "not found" (null) |
| `POST` | `/products` | product object → created product |
| `PATCH` | `/products/:id` | patch → updated product |
| `DELETE` | `/products/:id` | — |
| `GET` | `/categories` | array |
| `GET` | `/orders?…` | same query style as products |
| `GET` / `POST` | `/orders` / `/orders/:id` | create accepts `{ …, items: […] }` |
| `PATCH` | `/orders/:id` | `{ status }` |
| `GET` | `/customers?…` | same query style |
| `GET` / `PUT` / `POST` | `/customers/:id` (upsert) | customer object |
| `GET` | `/settings/:key` | 404 → null; else `{ value }` or bare value |
| `PUT` | `/settings/:key` | `{ value }` |

## Using it in code

```js
import { catalogue, orders, customers } from './engines/backend/repositories.js'

// Products (the migrated catalogue path)
const { rows, count } = await catalogue.listProducts({
  filter: { status: 'active', price: { op: 'gte', value: 500 } },
  sort: ['createdAt', 'desc'],
  limit: 24,
})
const p = await catalogue.getProduct(id)          // null when missing
await catalogue.saveProduct({ id, price: 999 })    // update
await catalogue.saveProduct({ name: 'Saree' })    // create
await catalogue.deleteProduct(id)

// Orders & customers
const order = await orders.createOrder({ items: [...], total: 1299 })
await orders.updateOrderStatus(order.id, 'shipped')
await customers.upsertCustomer({ id, name, email })

// Settings (feature flags, store profile, …)
await catalogue.setSetting('storeName', 'My Store')
const name = await catalogue.getSetting('storeName') // null when unset
```

Lower level, when you need it:

```js
import { getBackend, backendInfo, isCloudBackend, resetBackend } from './engines/backend/index.js'
const backend = getBackend() // cached; call resetBackend() after config changes
backendInfo() // { id, label, isDevOnly, configured, misconfigured, detail } — safe for UI
```

## Migration pattern (for the remaining slices)

The catalogue/products path is fully migrated (see `repositories.js`). Other
slices still read localStorage directly. The pattern to move one:

```js
// BEFORE — slice reads its own localStorage key
const readCart = () => storage.getJSON('bharatcart:cart', [])

// AFTER — repository owns persistence; the slice keeps a read cache
import { catalogue } from '../engines/backend/repositories.js'
async function hydrateCatalogueSlice() {
  const { rows } = await catalogue.listProducts({ limit: 500 })
  store.set('catalogue.products', rows) // sync UI cache, async source of truth
}
```

Rules: repositories throw `BackendError` (catch at the UI boundary and show
the message — it is written for operators); `get*` returning `null` is normal,
not an error; never put secrets in slice state.

## Adding a new backend (open source)

1. Create `src/engines/backend/adapters/<name>.js` exporting
   `create<Name>Adapter(config)` implementing the 15 methods in
   `src/engines/backend/BackendAdapter.js` (run `assertConforms` on it).
2. Register it in `FACTORES`/`LABELS` in `src/engines/backend/index.js` and add
   the provider to the `database` category in
   `src/engines/integrations/providers.js`.
3. Add conformance + mocked-fetch tests to `tests/part13.mjs`.
4. Document its setup here. No new npm dependencies — dynamic ESM/CDN imports
   only, parameterized queries / header auth only, secrets never logged.

## Failure behaviour (by design)

- Selected backend not configured → loud `console.warn`, local fallback, and
  the admin shows "Backend not configured — running on local dev storage".
- Adapter initialisation throws → `console.error`, local fallback.
- Any data method fails → throws `BackendError` with `{ code, provider,
  status }` and a message that names the fix. No silent empty arrays, no fake
  successes.
