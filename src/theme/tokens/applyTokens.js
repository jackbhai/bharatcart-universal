/**
 * Turns a flat token map into CSS custom properties on :root.
 * This is what makes theme switching instant and global.
 */
import { TOKEN_META } from './schema.js'

const SHADOWS = {
  none:   { sm: 'none', md: 'none', lg: 'none' },
  soft:   { sm: '0 1px 2px rgba(16,24,40,.05)', md: '0 4px 12px -4px rgba(16,24,40,.12)', lg: '0 18px 40px -20px rgba(16,24,40,.3)' },
  medium: { sm: '0 1px 3px rgba(16,24,40,.1)',  md: '0 8px 20px -6px rgba(16,24,40,.18)', lg: '0 26px 54px -22px rgba(16,24,40,.4)' },
  strong: { sm: '0 2px 6px rgba(16,24,40,.16)', md: '0 14px 32px -8px rgba(16,24,40,.26)', lg: '0 36px 70px -24px rgba(16,24,40,.5)' },
  brutal: { sm: '3px 3px 0 var(--c-text)', md: '5px 5px 0 var(--c-text)', lg: '8px 8px 0 var(--c-text)' },
}

const MOTION_SCALE = { off: 0, subtle: 0.6, normal: 1, cinematic: 1.5 }

export function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim())
  if (!m) return null
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

export function rgbaOf(hex, alpha) {
  const c = hexToRgb(hex)
  return c ? `rgba(${c.r},${c.g},${c.b},${alpha})` : hex
}

/** Perceived luminance -> pick readable foreground. */
export function readableOn(hex) {
  const c = hexToRgb(hex)
  if (!c) return '#000000'
  const L = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255
  return L > 0.6 ? '#0F172A' : '#FFFFFF'
}

export function contrastRatio(a, b) {
  const lum = (hex) => {
    const c = hexToRgb(hex); if (!c) return 0
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  const l1 = lum(a), l2 = lum(b)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2))
}

/** Lighten/darken for auto-generated ramps. */
export function shade(hex, amount) {
  const c = hexToRgb(hex)
  if (!c) return hex
  const f = (v) => Math.max(0, Math.min(255, Math.round(amount > 0 ? v + (255 - v) * amount : v * (1 + amount))))
  return '#' + [f(c.r), f(c.g), f(c.b)].map(v => v.toString(16).padStart(2, '0')).join('')
}

export function applyTokens(tokens, target) {
  if (typeof document === 'undefined') return
  const root = target || document.documentElement
  const t = tokens

  const setVar = (k, v) => { if (v != null && v !== '') root.style.setProperty(k, String(v)) }

  // ---- colours (+ auto ramps + alpha variants)
  const colourKeys = Object.entries(TOKEN_META).filter(([, m]) => m.type === 'colour').map(([k]) => k)
  for (const key of colourKeys) {
    const val = t[key]
    if (!val) continue
    setVar(`--c-${kebab(key)}`, val)
    const rgb = hexToRgb(val)
    if (rgb) setVar(`--c-${kebab(key)}-rgb`, `${rgb.r},${rgb.g},${rgb.b}`)
  }
  if (t.primary) {
    setVar('--c-primary-50',  shade(t.primary, 0.92))
    setVar('--c-primary-100', shade(t.primary, 0.82))
    setVar('--c-primary-200', shade(t.primary, 0.62))
    setVar('--c-primary-400', shade(t.primary, 0.2))
    setVar('--c-primary-600', shade(t.primary, -0.14))
    setVar('--c-primary-700', shade(t.primary, -0.3))
    setVar('--c-primary-soft', rgbaOf(t.primary, 0.1))
    setVar('--c-primary-ring', rgbaOf(t.primary, 0.35))
    setVar('--c-primary-fg', t.primaryFg || readableOn(t.primary))
  }
  if (t.secondary) setVar('--c-secondary-soft', rgbaOf(t.secondary, 0.1))
  if (t.accent) setVar('--c-accent-soft', rgbaOf(t.accent, 0.12))

  // ---- typography
  setVar('--font-heading', t.fontHeading)
  setVar('--font-body', t.fontBody)
  setVar('--font-mono', t.fontMono)
  setVar('--fs-base', px(t.baseSize))
  const r = Number(t.scaleRatio) || 1.25
  const base = Number(t.baseSize) || 15
  setVar('--fs-xs', px(base / r / 1.1))
  setVar('--fs-sm', px(base / Math.sqrt(r)))
  setVar('--fs-md', px(base))
  setVar('--fs-lg', px(base * r))
  setVar('--fs-xl', px(base * r * r))
  setVar('--fs-2xl', px(base * r * r * r))
  setVar('--fs-3xl', px(base * r * r * r * r))
  setVar('--fw-heading', t.headingWeight)
  setVar('--fw-body', t.bodyWeight)
  setVar('--lh', t.lineHeight)
  setVar('--ls', px(t.letterSpacing))
  setVar('--heading-case', t.headingCase === 'none' ? 'none' : t.headingCase)

  // ---- shape
  setVar('--radius', px(t.radius))
  setVar('--radius-sm', px(t.radiusSm))
  setVar('--radius-full', px(t.radiusFull))
  setVar('--border-w', px(t.borderWidth))
  setVar('--container', px(t.containerWidth))
  setVar('--section-gap', px(t.sectionGap))
  setVar('--grid-gap', px(t.gridGap))
  setVar('--plp-cols', t.plpColumns)
  setVar('--img-ratio', t.imageRatio)

  const sh = SHADOWS[t.shadowIntensity] || SHADOWS.soft
  setVar('--shadow-sm', sh.sm)
  setVar('--shadow-md', sh.md)
  setVar('--shadow-lg', sh.lg)

  // ---- motion
  const m = MOTION_SCALE[t.intensity] ?? 1
  const dur = (Number(t.duration) || 1)
  setVar('--motion-scale', m)
  setVar('--dur-fast', `${(0.15 * dur * (m || 0.001)).toFixed(3)}s`)
  setVar('--dur', `${(0.32 * dur * (m || 0.001)).toFixed(3)}s`)
  setVar('--dur-slow', `${(0.6 * dur * (m || 0.001)).toFixed(3)}s`)

  // ---- data attributes drive CSS variants
  root.dataset.cardStyle = t.cardStyle || 'raised'
  root.dataset.buttonStyle = t.buttonStyle || 'solid'
  root.dataset.inputStyle = t.inputStyle || 'outlined'
  root.dataset.motion = t.intensity || 'normal'
  root.dataset.bgFx = t.backgroundFx || 'aurora'

  // ---- favicon + title
  if (t.faviconUrl) {
    let link = document.querySelector("link[rel~='icon']")
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
    link.href = t.faviconUrl
  }
  if (t.storeName) document.title = t.storeName
}

const px = (v) => (v == null || v === '' ? null : `${v}px`)
const kebab = (s) => s.replace(/[A-Z]/g, c => '-' + c.toLowerCase())

export { SHADOWS, MOTION_SCALE }
export default applyTokens
