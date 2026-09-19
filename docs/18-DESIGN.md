# 18 — Premium Design Language

The BharatCart premium design system. It sits **on top of** the 58-theme
token engine (`src/theme/tokens/`), not beside it: every surface, glow and
gradient derives from theme CSS variables, so a theme switch repaints the
whole premium look instantly without touching component code.

**Foundation file:** `src/ui/design/premium.css` (imported once in `main.jsx`).
**Motion primitives:** `src/ui/fx.jsx` (framer-motion: `Tilt`, `Reveal`,
`Stagger`, `Counter`, `Aurora`, `Spotlight`, `GlowCard`, …).
**Kit primitives:** `src/ui/kit.jsx` (`Card`, `Btn`, `Input`, `Badge`, `Kpi`, charts).

## 1. Design principles

1. **Glass over noise** — translucent, blurred surfaces float above softly
   animated gradient orbs. Glass never carries meaning alone; text always
   uses `--c-text` / `--c-text-muted` for contrast.
2. **Depth with restraint** — three elevation levels; 3D tilt only on
   pointer devices and only on cards, never on forms.
3. **Motion is feedback** — every animation answers a user action or guides
   the eye. Nothing moves "because it can".
4. **Theme-first** — no hardcoded white/black/palette in the design CSS.
   Use `color-mix(in srgb, var(--c-X) N%, transparent)` and the utilities
   below.

## 2. Glass utilities

| Class | Use for |
|---|---|
| `.glass` | Default glass surface: translucent theme surface, 18px blur, hairline border, top inner highlight |
| `.glass-deep` | Hero panels, feature cards — stronger blur + deeper shadow |
| `.glass-pop` | Modals, drawers, popovers — near-opaque for legibility |
| `.glass-dark` | Overlays, footers, floating toolbars (dark) |
| `.glass-tint` | Accent-tinted glass — promo banners, highlighted sections |
| `.glass-nav` | Sticky header/nav bars |

`@supports not (backdrop-filter…)` falls back to solid theme surfaces, so
older browsers still look clean.

## 3. Elevation & glow

- `.elev-1` / `.elev-2` / `.elev-3` — theme shadow levels.
- `.glow-primary` / `.glow-accent` — coloured ambient glow for primary CTAs
  and hero cards.
- `.glow-hover` — fades a glow + lift in on hover.
- `.glow-ok` / `.glow-warn` / `.glow-err` — status rings for integration
  cards, health pills, sync states.

## 4. 3D depth (pure CSS, GPU-friendly)

- `.scene-3d` on a parent gives children a 1400px perspective.
- `.card-3d` — hover lean (`rotateX/Y` 2.5°) + lift + deepened shadow.
  Degrades to a plain lift outside `.scene-3d`.
- Pointer-tracked tilt: use `<Tilt>` from `fx.jsx` (spring physics, glare).
- `.pop-3d` / `.pop-3d-sm` — translateZ layers inside a `Tilt` card.
- `.float-slow` / `.float-slower` — perpetual gentle float (hero art,
  empty-state icons).
- `.orb` + `.orb-a/.orb-b/.orb-c` — blurred, drifting gradient blobs in
  theme primary / accent / secondary. Position with inline styles.
- `.aurora-wash` — animated gradient band for hero backgrounds.
- `.sheen` — light-sweep hover effect on buttons/cards.

## 5. Motion tokens & utilities

Durations derive from `--dur-fast` / `--dur` / `--dur-slow` and scale with
the theme's `--motion-scale` (off / subtle / normal / cinematic).

| Class | Effect |
|---|---|
| `.anim-fade-up` / `.anim-fade-in` / `.anim-scale-in` / `.anim-slide-in` / `.anim-pop` | One-shot entrances |
| `.stagger > *` + `style={{'--i': index}}` | Cascading list entrances, 55ms steps |
| `.pressable` | Button press physics (hover brighten, active scale .965) |
| `.shimmer` | Skeleton loader shimmer |
| `.pulse-dot` | Pulsing status dot (needs `color` context) |
| `.spin-slower` | Decorative slow rotation |
| `.draw-stroke` | SVG stroke draw-on animation |

Route entrances are CSS keyframes in `RouteTransition.jsx` (`route-enter`) —
deliberately not JS-driven, so Suspense can never strand a page invisible.
Prefer `<Reveal>` / `<Stagger>` from `fx.jsx` for scroll entrances; they
no-op safely when `IntersectionObserver` is unavailable.

## 6. Typography

- `.display-1` / `.display-2` — fluid display headings, respect the theme
  type scale.
- `.text-gradient` — headline gradient `primary → accent` (theme-aware).
- `.eyebrow` — small uppercase section label in primary.

## 7. Focus & scrollbars

- `.focus-ring` — visible `:focus-visible` ring from `--c-primary-ring`.
- `.scroll-slim` — slim theme-tinted scrollbars for drawers/panels.
- `::selection` uses a primary tint.

## 8. Reduced motion

All premium animations are killed under **both**:

- `@media (prefers-reduced-motion: reduce)` (OS setting), and
- `html[data-motion="off"]` (theme "Reduce motion" option).

When adding new animation, include it in the kill-switch lists in
`premium.css`. Never animate `filter: blur()` on large areas (GPU cost);
prefer opacity/transform.

## 9. Guidance for theme authors

- Glass is computed from `--c-surface`, `--c-text`, `--c-primary`,
  `--c-accent`, `--c-bg` — if your theme sets these, glass/3D/glow all
  follow automatically. No per-theme CSS needed.
- Dark themes: glass keeps working because the inner highlight and borders
  are derived from `--c-text` / white mixes, not from assuming a light page.
- Brutalist or flat themes (`--shadow-*: none`): `.card-3d:hover` still
  lifts via transform; shadows degrade to none, which is correct for the
  theme's intent.
- Test every theme in Theme Studio at `#/admin/theme` — the "Reduce motion"
  toggle must freeze all ambient animation.

## 10. Accessibility notes

- Contrast: body text on glass uses `--c-text` on a surface that is at
  least 64% opaque over `--c-bg`; dark text on `.glass-dark` is `#f1f5f9`.
- Focus is always visible (`.focus-ring` / kit primitives carry rings).
- Motion: `prefers-reduced-motion` and the theme toggle fully disable
  ambient + entrance animation; content is never hidden pending animation
  (see `fx.jsx` `CAN_OBSERVE` guards).
- `aria-hidden` decorative orbs/rings; icon bubbles are decorative.
