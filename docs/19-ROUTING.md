# 19 — Split routing: clean storefront URLs, hash-routed admin

The app boots into one of two router trees. The **storefront (user panel)**
uses clean history-API URLs with no `#` anywhere. The **admin panel** stays
on hash routing (`#/admin/…`). There is deliberately no visible link from the
storefront to the admin panel.

## The two trees

| | Storefront | Admin |
|---|---|---|
| Router | `BrowserRouter` | `HashRouter` |
| URLs | `/`, `/shop`, `/category/:slug`, `/search?q=…`, `/product/:id`, `/cart`, `/checkout`, `/account`, `/account/login`, `/help`, … | `#/admin/setup`, `#/admin/login`, `#/admin/dashboard`, `#/admin/…` |
| Basename | `VITE_APP_BASENAME` (default `/`) | n/a — hashes need no basename |
| Entry | `src/shop/ShopApp.jsx` | `src/App.jsx` with `mode="admin"` |

`src/main.jsx` picks the tree at boot from `detectBootMode(window.location.hash)`
and listens for `hashchange`, so crossing between trees never needs a reload:
the setup wizard flips the shop to `#/admin/setup`, and "View storefront" in
the admin panel calls `goShop('/shop')` (a full navigation, because the
storefront lives under a different router — `useNavigate('/shop')` inside the
admin tree would wrongly produce `#/shop`).

`src/App.jsx` takes a `mode` prop: `'admin'`, `'shop'`, or unset (legacy
combined tree used by tests and embeds).

## A note on what hash routing does and does not do

Hash routing **obscures** the admin route; it does not secure it. The fragment
never reaches the HTTP server, so admin sub-paths stay out of server request
paths and access logs, and casual URL guessing lands on a shop 404 — but a
determined visitor can still type `#/admin/dashboard`. Real protection is the
staff-role route guard, the auth system, 2FA, rate limiting, and audit logs
(see `docs/17-AUTH.md`). Never describe the hash as access control.

## Storefront routes (`src/shop/ShopApp.jsx`, pages in `src/shop/pages.jsx`)

- `/` — home (hero, personalised + trending shelves, categories)
- `/shop` — full catalogue with search, facets, sort
- `/category/:slug` — catalogue pre-filtered to one category
- `/search?q=…` — search results
- `/product/:id` — product detail page (stale links render "Product not found")
- `/cart`, `/checkout` — cart and checkout
- `/account`, `/account/:tab` — account with URL-driven tabs
  (`orders`, `subscriptions`, `rewards`, `wishlist`, `returns`)
- `/account/login` — customer sign-in (canonical; legacy `/auth` redirects here)
- `/help`, `/terms`, `/privacy`, `/about`, `/contact`, `/careers` — info pages
- `*` — `ShopNotFound`, a real 404 page. Guessing `/admin/…` as a clean path
  lands here; the admin panel is never revealed from the shop tree.

Old bookmarked hashes (`#/shop`, `#/account/orders`, `#/product/123`, …) are
mapped to clean URLs by `resolveLegacyHash()` in `src/lib/siteUrls.js` and
redirected once via `location.replace` by `LegacyHashRedirect`. Admin hashes
are never rewritten — `resolveLegacyHash('#/admin/…')` returns `null`.

## Admin routes (hash)

- `#/admin/setup` — public first-run wizard. The setup gate sends a fresh
  store here from either tree; it never traps (the wizard has "Skip for now").
- `#/admin/login` — staff sign-in. Session-timeout sign-outs land here with
  `?reason=timeout` and an explanation.
- `#/admin/*` — guarded by `RequireAuth role={ROLES.STAFF}`; shoppers are sent
  to `#/admin/login` instead of staring at permission walls.
- Unknown admin paths fall back to `#/admin/dashboard`.

## Deploying

### GitHub Pages (project site)

Build with the sub-path so the router and asset URLs agree:

```bash
VITE_APP_BASENAME=/bharatcart-universal npm run build
```

`vite.config.js` reads the variable via `loadEnv` and sets both Vite's asset
`base` and the router `basename` from it. After every build, `postbuild`
(`scripts/copy-spa-fallback.mjs`) copies `dist/index.html` → `dist/404.html`
byte-for-byte. GitHub Pages serves `404.html` for unknown paths, so deep links
like `/bharatcart-universal/shop` boot the SPA and the router renders the
right page.

Caveat: Pages serves that fallback with an HTTP **404 status** even though the
page renders. That is fine for humans, but it means deep links are not
SEO-friendly on Pages. For real SEO (HTTP 200 on every route), deploy where
proper rewrites exist:

- **Vercel**: `vercel.json` → `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`
- **Netlify**: `_redirects` → `/* /index.html 200`
- **Cloudflare Pages**: `public/_redirects` → `/* /index.html 200`

### Local dev

Leave `VITE_APP_BASENAME` unset (or `/` in `.env.example`); `npm run dev`
serves the storefront at `/` and the admin at `/#/admin/dashboard`.

## Tests

`tests/part15.mjs` covers boot-mode detection (including the `#/adminfoo`
prefix trap), the legacy-hash table, basename-aware URL building (including a
child process with the Pages basename), source assertions that no storefront
`#` URLs remain and that admin hashes are kept, the `postbuild` 404 fallback,
and render smoke tests for both trees. It runs in the normal `npm test` loop.
