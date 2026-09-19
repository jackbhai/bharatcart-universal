import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useSlice, useDispatch } from './useStore.js'
import { translatorFor, LANGUAGES, LANGUAGE_CODES, languagesByGroup, coverage, detectLanguage, getLanguage } from '../i18n/index.js'
import { setActiveLocale, subscribe as subscribeActive, getVersion } from '../currency/active.js'

/**
 * Language access for components.
 *
 * Besides returning `t`, this hook is the one place that pushes the chosen
 * language into the module singleton that `inr()` and friends read, and sets
 * `dir`/`lang` on <html>. Doing that here rather than in a top-level effect
 * means the singleton is correct on the very first render of any screen that
 * uses translations, instead of one paint later.
 */
export function useI18n() {
  const locale = useSlice('locale')
  const dispatch = useDispatch()
  const lang = locale.language

  const t = useMemo(() => translatorFor(lang), [lang])
  const language = getLanguage(lang)

  // Keep the formatter singleton in step with store state.
  setActiveLocale({ language: lang, currency: locale.currency, rateOverrides: locale.rateOverrides })

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('lang', lang)
    document.documentElement.setAttribute('dir', language.dir)
  }, [lang, language.dir])

  const setLanguage = useCallback((code) => dispatch('locale/setLanguage', code), [dispatch])

  const available = useMemo(() => {
    const allowed = locale.allowedLanguages?.length ? locale.allowedLanguages : LANGUAGE_CODES
    return allowed.filter(c => LANGUAGES[c]).map(c => LANGUAGES[c])
  }, [locale.allowedLanguages])

  return {
    t,
    lang,
    language,
    dir: language.dir,
    rtl: language.dir === 'rtl',
    locale: language.locale,
    setLanguage,
    available,
    groups: languagesByGroup(),
    coverage,
    detectLanguage,
  }
}

/**
 * Re-render whenever the active currency/language singleton changes.
 *
 * Components that only render already-formatted money (via `inr()`) have no
 * store subscription of their own, so without this they would keep painting the
 * old currency after a switch.
 */
export function useLocaleVersion() {
  return useSyncExternalStore(subscribeActive, getVersion, getVersion)
}

export default useI18n
