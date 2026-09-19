/**
 * Supported languages: 5 Indian + 5 global, as requested.
 *
 * `dir` drives RTL layout — Urdu is written right-to-left, and getting that
 * wrong makes the whole storefront unreadable for those users rather than just
 * untranslated.
 *
 * `plural` picks the plural rule family. Russian genuinely needs three forms
 * (1 товар / 2 товара / 5 товаров), so a naive `n === 1 ? a : b` would be wrong
 * for a third of its number range.
 */
export const LANGUAGES = {
  // ---------------- Indian
  en: { code: 'en', name: 'English', native: 'English', dir: 'ltr', locale: 'en-IN', flag: '🇬🇧', plural: 'one-other', group: 'Global' },
  hi: { code: 'hi', name: 'Hindi', native: 'हिन्दी', dir: 'ltr', locale: 'hi-IN', flag: '🇮🇳', plural: 'one-other', group: 'Indian' },
  pa: { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', dir: 'ltr', locale: 'pa-IN', flag: '🇮🇳', plural: 'one-other', group: 'Indian' },
  ur: { code: 'ur', name: 'Urdu', native: 'اُردُو', dir: 'rtl', locale: 'ur-PK', flag: '🇵🇰', plural: 'one-other', group: 'Indian' },
  ta: { code: 'ta', name: 'Tamil', native: 'தமிழ்', dir: 'ltr', locale: 'ta-IN', flag: '🇮🇳', plural: 'one-other', group: 'Indian' },
  bn: { code: 'bn', name: 'Bengali', native: 'বাংলা', dir: 'ltr', locale: 'bn-IN', flag: '🇮🇳', plural: 'one-other', group: 'Indian' },

  // ---------------- Global
  ru: { code: 'ru', name: 'Russian', native: 'Русский', dir: 'ltr', locale: 'ru-RU', flag: '🇷🇺', plural: 'slavic', group: 'Global' },
  fr: { code: 'fr', name: 'French', native: 'Français', dir: 'ltr', locale: 'fr-FR', flag: '🇫🇷', plural: 'one-other', group: 'Global' },
  de: { code: 'de', name: 'German', native: 'Deutsch', dir: 'ltr', locale: 'de-DE', flag: '🇩🇪', plural: 'one-other', group: 'Global' },
  es: { code: 'es', name: 'Spanish', native: 'Español', dir: 'ltr', locale: 'es-ES', flag: '🇪🇸', plural: 'one-other', group: 'Global' },
  ar: { code: 'ar', name: 'Arabic', native: 'العربية', dir: 'rtl', locale: 'ar-AE', flag: '🇦🇪', plural: 'arabic', group: 'Global' },
}

export const LANGUAGE_CODES = Object.keys(LANGUAGES)
export const DEFAULT_LANGUAGE = 'en'
export const RTL_LANGUAGES = Object.values(LANGUAGES).filter(l => l.dir === 'rtl').map(l => l.code)

export function getLanguage(code) {
  return LANGUAGES[String(code || '').toLowerCase()] || LANGUAGES[DEFAULT_LANGUAGE]
}

export function isRtl(code) {
  return getLanguage(code).dir === 'rtl'
}

/** Languages grouped for the picker. */
export function languagesByGroup() {
  const out = {}
  for (const l of Object.values(LANGUAGES)) (out[l.group] = out[l.group] || []).push(l)
  return out
}

/**
 * Plural category for a count. Intl.PluralRules does this properly where
 * available; the fallbacks encode the same rules by hand.
 */
export function pluralCategory(n, code) {
  const lang = getLanguage(code)
  try {
    return new Intl.PluralRules(lang.locale).select(n)
  } catch {
    if (lang.plural === 'slavic') {
      const mod10 = n % 10, mod100 = n % 100
      if (mod10 === 1 && mod100 !== 11) return 'one'
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few'
      return 'many'
    }
    if (lang.plural === 'arabic') {
      if (n === 0) return 'zero'
      if (n === 1) return 'one'
      if (n === 2) return 'two'
      if (n % 100 >= 3 && n % 100 <= 10) return 'few'
      if (n % 100 >= 11) return 'many'
      return 'other'
    }
    return n === 1 ? 'one' : 'other'
  }
}

export default LANGUAGES
