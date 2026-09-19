# 17 — Authentication

Sign-in is **real**, pluggable, and merchant-owned. The merchant picks the
identity provider in **Admin → Integrations → Auth**; the app talks to it
through the `AuthProvider` interface in `src/engines/auth/`. Nothing is
pre-connected and there are no demo logins.

## Architecture

```
Admin → Integrations → Auth        (provider choice + credentials)
        │
src/engines/auth/index.js          getAuth() / getAuthInfo()
        │                          selects provider, falls back honestly
        ▼
src/engines/auth/providers/
  local.js        Local development (browser only)
  supabase.js     Supabase Auth via GoTrue REST (no SDK)
  firebase.js     Firebase Auth via Identity Toolkit REST (no SDK)
  clerk.js        @clerk/clerk-js, lazy-loaded from CDN
  custom-jwt.js   Merchant IdP — RS256 JWT verified against JWKS (WebCrypto)
        │
src/hooks/useAuth.js               React binding (session, roles, guards)
src/auth/RequireAuth.jsx           Route guards (admin stays guarded)
```

The contract (`AuthProvider.js`): `signIn`, `signUp`, `signOut`,
`getSession` → `{id,name,email,role}|null`, `onAuthChange(cb)` →
unsubscribe. All async; failures **throw `AuthError`** — never a fake
success.

## Provider setup

| Provider | What the merchant provides | Where |
|---|---|---|
| Supabase Auth | Project URL + anon (publishable) key | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Firebase Auth | Web API key (+ Project ID) | `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID` |
| Clerk | Publishable key (`pk_test_`/`pk_live_`) | `VITE_CLERK_PUBLISHABLE_KEY` |
| Custom JWT | JWKS URL + expected issuer | `VITE_JWT_JWKS_URL`, `VITE_JWT_ISSUER` |
| Local dev | nothing | — |

Secrets (service_role keys, client secrets, JWKS private keys) **never
enter the browser**. The integrations store strips secret fields before
persisting; secrets live only in `VITE_` env vars / the host dashboard.

## Roles

Cloud providers return the merchant's own roles; the merchant assigns them
in the provider's dashboard:

- Supabase: `app_metadata.role` or `user_metadata.role`
- Firebase: custom claims → `role` (set with the Admin SDK on the backend)
- Clerk: `publicMetadata.role`
- Custom JWT: `role` claim (or `https://bharatcart/role`)

Mapping (`mapCloudRole`): `owner` → owner, `admin` → admin,
`manager` → manager, other staff-like roles → staff, **everything else
(including unknown) → customer**. Staff access is granted explicitly by the
merchant — never by default. Fine-grained screen permissions still come
from `src/auth/rbac.jsx`.

**Local dev invariant:** the first-ever account becomes the store **owner**
(so the setup wizard can bootstrap the admin); every later signup is forced
to **customer**. A public signup can never self-promote — the requested
role is ignored.

## Sessions

- `getSession()` runs on boot: reload keeps you signed in; expired sessions
  return `null` and the UI signs you out honestly.
- Supabase/Firebase silently refresh the access token with the stored
  refresh token.
- Custom JWT re-verifies the token (signature + expiry) on every restore;
  a tampered or expired token ends the session.
- Session tokens are persisted in `localStorage` — the same model the
  official Supabase/Firebase/Clerk browser SDKs use. They are bearer
  tokens: anyone with the device can use them. For higher assurance the
  merchant should move sessions to `httpOnly` cookies on their own backend
  (not possible on pure static hosting — stated plainly, not hidden).
- Switching the provider in the Integrations hub is picked up without a
  reload (`getAuth()` re-reads the config; a storage event re-inits auth).
- If a cloud provider is selected but its credentials are missing, the app
  logs a loud error, falls back to local dev auth, and the sign-in screen
  shows a warning banner — never a silent fake.

## Custom JWT sign-in flow

`signIn({ email, password })` cannot exist for this provider — there is no
login endpoint to call. The flow:

1. The user signs in on the merchant's own IdP login page.
2. The IdP issues an RS256 JWT (with `kid`, `exp`, `iss`).
3. The merchant's page hands the token to the store (paste field, URL
   fragment handler they add, etc.) → `getAuth().signIn({ token })`.
4. We verify the RS256 signature against the JWKS document with WebCrypto,
   check `exp`/`iss`, and map claims to a user.

HS256 tokens are **refused**: verifying them needs the shared secret,
which must stay on the backend. Browser verification is a genuine
cryptographic check, but sensitive operations must re-verify the token
server-side on the merchant's backend.

## Open-source notes

- Adding a provider: create `src/engines/auth/providers/<id>.js`
  implementing the five interface methods (use `assertAuthProvider` to
  verify), register the provider id in the Integrations hub
  (`src/engines/integrations/providers.js`, category `auth`), and add a
  case in `getAuth()`'s `buildProvider`.
- Providers are dependency-free by design: REST via `fetch`, Clerk via
  lazy CDN import. No new npm packages for auth, ever.
- Tests mock `fetch` / inject fakes — no real network in the suite
  (`tests/part13.mjs`).
