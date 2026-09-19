/**
 * Tiny i18n core — no runtime dependency, because the whole build is meant to
 * stay free of paid or heavyweight SaaS pieces and i18next would add ~40 kB for
 * features this app does not use.
 *
 * Design notes:
 *  - Every locale is imported eagerly. With 11 locales at ~10 kB of text each
 *    the total is small, and lazy-loading would make `t()` async, which would
 *    ripple into every component that renders a label.
 *  - Missing keys fall back to English, then to the key path itself. Returning
 *    the path (rather than an empty string) makes an untranslated string
 *    obvious on screen instead of silently blanking the UI.
 */
import en from './locales/en.js'
import hi from './locales/hi.js'
import pa from './locales/pa.js'
import ur from './locales/ur.js'
import ta from './locales/ta.js'
import bn from './locales/bn.js'
import ru from './locales/ru.js'
import fr from './locales/fr.js'
import de from './locales/de.js'
import es from './locales/es.js'
import ar from './locales/ar.js'

import { LANGUAGES, LANGUAGE_CODES, DEFAULT_LANGUAGE, getLanguage, isRtl, pluralCategory, languagesByGroup, RTL_LANGUAGES } from './languages.js'

export const BUNDLES = { en, hi, pa, ur, ta, bn, ru, fr, de, es, ar }

export { LANGUAGES, LANGUAGE_CODES, DEFAULT_LANGUAGE, getLanguage, isRtl, pluralCategory, languagesByGroup, RTL_LANGUAGES }

/** Walk a dotted path like 'shop.addToCart' through a bundle. */
function lookup(bundle, path) {
  if (!bundle) return undefined
  let node = bundle
  for (const part of path.split('.')) {
    if (node == null || typeof node !== 'object') return undefined
    node = node[part]
  }
  return typeof node === 'string' ? node : undefined
}

/**
 * Replace {{placeholders}}. Values are stringified; a missing value leaves the
 * placeholder visible rather than printing "undefined", which reads as a bug to
 * a user but as a clear TODO to a developer.
 */
export function interpolate(template, vars) {
  if (!vars || typeof template !== 'string') return template
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) && vars[key] != null ? String(vars[key]) : match
  )
}

/**
 * Translate `path` into `lang`.
 *
 * Pass `{ count }` to pick a plural form: the key `cart.items` with count 3
 * first tries `cart.items_other`, then `cart.items_few` etc. per the language's
 * plural category, and falls back to the base key.
 */
export function translate(lang, path, vars) {
  const code = BUNDLES[lang] ? lang : DEFAULT_LANGUAGE
  let value

  if (vars && typeof vars.count === 'number') {
    const category = pluralCategory(vars.count, code)
    value = lookup(BUNDLES[code], `${path}_${category}`) ?? lookup(BUNDLES[DEFAULT_LANGUAGE], `${path}_${category}`)
  }

  value = value ?? lookup(BUNDLES[code], path) ?? lookup(BUNDLES[DEFAULT_LANGUAGE], path) ?? path
  return interpolate(value, vars)
}

/** Curried translator for a language — what the React hook hands to components. */
export function translatorFor(lang) {
  const t = (path, vars) => translate(lang, path, vars)
  t.lang = lang
  t.dir = getLanguage(lang).dir
  t.rtl = t.dir === 'rtl'
  t.locale = getLanguage(lang).locale
  return t
}

/** Flatten a bundle to dotted paths — used by the coverage report and tests. */
export function flattenKeys(bundle, prefix = '') {
  const out = []
  for (const [key, value] of Object.entries(bundle || {})) {
    if (key === '_meta') continue
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') out.push(...flattenKeys(value, path))
    else out.push(path)
  }
  return out
}

/**
 * What fraction of the English key set each language actually defines.
 * Surfaced in the admin Localisation screen so a half-finished translation is
 * visible to the operator rather than discovered by a customer.
 */
export function coverage() {
  const baseKeys = flattenKeys(BUNDLES[DEFAULT_LANGUAGE])
  const report = {}
  for (const code of LANGUAGE_CODES) {
    const keys = new Set(flattenKeys(BUNDLES[code]))
    const missing = baseKeys.filter(k => !keys.has(k))
    report[code] = {
      code,
      total: baseKeys.length,
      translated: baseKeys.length - missing.length,
      percent: Math.round(((baseKeys.length - missing.length) / baseKeys.length) * 100),
      missing,
    }
  }
  return report
}

/** Pick the best supported language for a browser, e.g. ['pa-IN','en'] -> 'pa'. */
export function detectLanguage(preferred = [], enabled = LANGUAGE_CODES) {
  for (const tag of preferred) {
    const base = String(tag).toLowerCase().split('-')[0]
    if (enabled.includes(base) && BUNDLES[base]) return base
  }
  return enabled.includes(DEFAULT_LANGUAGE) ? DEFAULT_LANGUAGE : enabled[0] || DEFAULT_LANGUAGE
}

export default translate
