import { DEFAULT_LANGUAGE, LANGUAGE_CODES, getLanguage } from '../../../i18n/languages.js'
import { BASE_CURRENCY } from '../../../currency/rates.js'
import { isSupported } from '../../../currency/currencies.js'

/**
 * Active language + display currency.
 *
 * This lives in its own slice rather than inside `settings` because settings is
 * the *admin's* configuration of the store, while this is the *viewer's* current
 * choice. A shopper switching to French must not rewrite the store's configured
 * defaults, and the persistence layer treats the two differently.
 *
 * `rateOverrides` lets an operator correct a single exchange rate by hand
 * without replacing the whole snapshot — useful when one currency has drifted
 * but the rest are fine.
 */
export const localeSlice = {
  initial: () => ({
    language: DEFAULT_LANGUAGE,
    currency: BASE_CURRENCY,
    rateOverrides: {},
    autoDetect: true,
    // Admin can narrow the pickers; empty means "offer everything we support".
    allowedLanguages: [...LANGUAGE_CODES],
    allowedCurrencies: [],
    showCurrencyCode: false,
    compactLargeNumbers: true,
  }),

  actions: {
    setLanguage: (s, code) => {
      const next = LANGUAGE_CODES.includes(code) ? code : s.language
      return { language: next, autoDetect: false }
    },
    setCurrency: (s, code) => ({ currency: isSupported(code) ? code : s.currency }),
    setRateOverride: (s, { code, rate }) => {
      const next = { ...s.rateOverrides }
      if (rate == null || rate === '' || Number.isNaN(Number(rate))) delete next[code]
      else next[code] = Number(rate)
      return { rateOverrides: next }
    },
    clearRateOverrides: () => ({ rateOverrides: {} }),
    setAllowedLanguages: (_s, list) => ({ allowedLanguages: Array.isArray(list) ? list : [...LANGUAGE_CODES] }),
    setAllowedCurrencies: (_s, list) => ({ allowedCurrencies: Array.isArray(list) ? list : [] }),
    setShowCurrencyCode: (_s, v) => ({ showCurrencyCode: Boolean(v) }),
    setCompactLargeNumbers: (_s, v) => ({ compactLargeNumbers: Boolean(v) }),
    setAutoDetect: (_s, v) => ({ autoDetect: Boolean(v) }),
    set: (_s, patch) => patch,
  },
}

export const selectLanguage = (s) => s.locale.language
export const selectCurrency = (s) => s.locale.currency
export const selectRateOverrides = (s) => s.locale.rateOverrides
export const selectDir = (s) => getLanguage(s.locale.language).dir
export const selectIsRtl = (s) => getLanguage(s.locale.language).dir === 'rtl'

export default localeSlice
