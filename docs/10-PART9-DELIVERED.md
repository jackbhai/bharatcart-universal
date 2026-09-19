# Part 9 — Access split, auth providers, integrity layer, blank-screen fix

Every claim below is backed by an assertion in `tests/part9.mjs` (173) plus the
visibility assertions added to `tests/part8.mjs`. Suite total: **1,539 passing,
0 failing**.

---

## 1. The blank admin screen

### What was actually wrong

`src/App.jsx` wrapped the router like this:

```jsx
<PageFade k={page}>
  <Suspense fallback={<RouteLoading/>}>
    <Routes>…</Routes>
  </Suspense>
</PageFade>
```

`PageFade` is an `AnimatePresence` with `mode="wait"`. That mode holds the
incoming child at its `initial` state — `opacity: 0`, blurred, offset — until
the outgoing child signals that its exit animation has finished.

Admin routes are lazy-loaded. When one suspends, React discards the render and
swaps in the fallback. The exit handshake never completes, so the incoming page
is never released from `initial`. The route then mounts **underneath** a wrapper
that is still at `opacity: 0`.

The result matched the report exactly: open Customers, get a blank panel, and
only a manual reload fixes it — because a reload mounts the route without a
transition to get stuck in.

Reproduced in a jsdom harness. After a three-second settle the broken tree read:

```
text="Loading…"  style="opacity: 0; filter: blur(4px); transform: translateY(10px)"
```

Content fully rendered. Completely invisible.

### Why 1,329 tests missed it

Every route test asserted on `textContent`. The text was present the whole time.
**Visibility was never asserted once.** A total-outage-class bug sailed through
the entire suite.

### The fix

`src/ui/RouteTransition.jsx`. Two structural changes:

1. **Suspense is now the outer boundary.** A suspending route can no longer
   interrupt a transition, because the transition is inside it.
2. **No JavaScript owns opacity.** The first attempt kept framer-motion and
   gated it on a commit effect. It worked, but it was still one discarded
   render away from the same failure. The entrance is now a plain CSS keyframe
   with `animation-fill-mode: both`.

That is the part worth keeping: a CSS animation cannot be stranded by a React
render being thrown away, and an element with no animation applied is simply
visible. The worst case is now *a page that appears without a transition*,
never *a page that never appears*.

`PageFade` still exists in `src/ui/fx.jsx` for non-lazy content, and still
carries the trap. Do not put it around anything that can suspend.

### Guarding the fix

- `tests/part8.mjs` gained `visibleText()`, which walks the tree and ignores
  anything at `opacity < 0.15`, `display: none`, `visibility: hidden`, or
  `[hidden]`. Every one of the 22 routes now asserts on what is *visible*.
- Verified by mutation: forcing `opacity: 0` back onto the wrapper produced
  **22 route failures**; reverting returned 283/0. The test genuinely detects
  the bug rather than passing by construction.

---

## 2. No route from the storefront into the admin panel

`PanelSwitch` was a two-way toggle rendered as a floating button on the shop.
It is now one-directional: the admin rail links out to the storefront, and
nothing in the shop links in. `/#/admin` typed into the address bar is the only
entry point.

Two shopper-visible strings that named the admin panel were also rewritten —
a checkout error said "Enable a gateway in the admin Settings screen", and the
order confirmation said "open Admin → Orders to fulfil it". Both now read as
messages to a customer.

**This is obscurity, not access control.** The route still exists and anyone who
guesses the URL reaches it. What stops them from *using* it is the role check —
and in demo mode that check is not enforceable either. See §4.

---

## 3. Auth providers

### What the research turned up

The brief was "every free provider". The honest answer has exceptions, and they
are recorded in the registry rather than discovered later:

| Provider | Free? | Reality |
|---|---|---|
| Email/password, magic link, anonymous | Yes | Free to 50,000 MAU on Supabase and Firebase |
| Google, GitHub, Facebook, X, Microsoft, Discord, GitLab, LinkedIn, Spotify, Twitch, Slack, Notion, Figma, Zoom, Kakao, Yahoo | Yes | OAuth app registration is free on all of these |
| **Apple** | **No** | Sign in with Apple needs a paid Apple Developer account, $99/yr |
| **Phone / SMS OTP** | **No** | Firebase moved phone auth behind the paid Blaze plan in Sept 2024, with no SMS allowance on Spark. Supabase requires your own Twilio/MessageBird/Vonage account. **There is no free SMS OTP anywhere.** |
| **Custom OIDC / SAML** | **No** | Firebase needs Identity Platform, free only to 50 MAU. Supabase SSO is a paid add-on |

### `src/auth/providers.js`

One registry, 21 providers, each declaring which backends can genuinely perform
it and whether it is actually free. The sign-in screen is generated from it and
filtered twice — by the active backend's real capabilities, and by what the
operator enabled. **A button is never shown for a flow that would fail.**

Concretely: Discord is not offered on Firebase, Yahoo is not offered on
Supabase, and Cloudflare does not offer guest checkout, because none of those
combinations work.

### Adapter work

- **Firebase** — was four hardcoded providers. Now maps the dedicated classes
  (Google, GitHub, Facebook, Twitter) and the generic `OAuthProvider` id style
  (Apple, Microsoft, Yahoo, custom OIDC), adds `signInAnonymously`, adds phone
  OTP with reCAPTCHA, and falls back from popup to redirect when a popup is
  blocked. A billing error is translated into "needs the Blaze plan" rather
  than a raw Firebase code.
- **Supabase** — added `signInAnonymously` and a phone path that explains the
  SMS provider requirement instead of surfacing a generic failure.
- **Cloudflare** — new adapter: Workers + D1 + R2, identity via Cloudflare
  Access. It works differently and the file explains why at length: Access is a
  reverse proxy that authenticates *before* the request reaches your code, so
  there is no client SDK and no password to submit. The provider list lives in
  the Zero Trust dashboard. Free for up to 50 users.
- **Local** — guest sessions, so the whole flow is explorable with no keys.

Every flow the local adapter advertises is executed end to end in the test:
sign up, wrong password rejected, right password accepted, guest session, OTP
requested / wrong code rejected / right code accepted, and **every social
button pressed**.

---

## 4. Tamper protection — and its limits

I want to be direct about this, because it is the one place where the honest
answer is not the reassuring one.

**A browser application cannot defend itself against the person operating the
browser.** Everything in `src/core/security/integrity.js` runs on the attacker's
machine, in code they can read, pause, and rewrite. Anyone willing to open
devtools can neutralise all of it. That is a property of where the code runs,
not of how well it is written. No amount of obfuscation changes it.

What the layer does deliver:

- **Signed state.** FNV-1a with a per-install salt. Editing a value in
  localStorage while keeping its signature is detected. Deliberately not
  SHA-256: a key sitting in the same bundle as the verifier is not a secret, so
  the goal is detecting edits, not resisting a forger — and a synchronous hash
  keeps every state write synchronous.
- **Price re-derivation at checkout.** `placeOrder` recomputes every line from
  the catalogue through the pricing engine and compares. A tampered price
  blocks the order and is logged. The recomputed figure is what would be
  charged — never the number the client supplied.
- **Amount bounds.** Negative, non-numeric, absurd, and >95%-discount totals
  are refused.
- **Role-claim honesty.** A privileged role backed by a server-issued session
  is trusted. The same role in demo mode is flagged `unverifiable_locally` with
  an explicit warning, because the stored role is the only record that exists.
- **Tamper log**, capped at 50 entries.
- **`securityPosture()`** so the UI never overstates how protected the operator
  is: demo mode reports "all data lives in this browser and can be edited".

The real defence is the generalised version of the price check: **nothing the
client says about money is trusted.** When Supabase, Firebase, or a Cloudflare
Worker is connected, those same recomputations move server-side and become
genuinely authoritative. The call sites do not change — only where verification
runs. This layer is the shape that migration slots into.

---

## Test summary

```
render     80    part5    125    part8    283   (visibility assertions added)
part2     146    part6    230    part9    173   (new)
part3     168    part7    171
part4     163                    TOTAL  1,539 · 0 failing
```

Both new suites were mutation-tested — deliberately breaking the fix produced
failures (22 for the transition, 3 for the integrity and honesty checks), and
reverting restored a clean run.
