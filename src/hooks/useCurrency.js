import { useCallback, useMemo } from 'react'
import { useSlice, useDispatch } from './useStore.js'
import { CURRENCIES, CURRENCY_CODES, currenciesByRegion, getCurrency } from '../currency/currencies.js'
import { getRate, RATES_UPDATED_AT, BASE_CURRENCY } from '../currency/rates.js'
import { formatMoney, convert, toBase } from '../currency/format.js'
import { setActiveLocale } from '../currency/active.js'
import { useLocaleVersion } from './useI18n.js'

/**
 * Currency access for components.
 *
 * `money()` is the explicit, local alternative to the global `inr()`. New code
 * should prefer it: it takes the currency from the hook rather than a module
 * singleton, so it is honest about its dependency and works in tests without
 * having to reset global state.
 */
export function useCurrency() {
  const locale = useSlice('locale')
  const dispatch = useDispatch()
  useLocaleVersion() // re-render on singleton changes

  const code = locale.currency
  const currency = getCurrency(code)
  const overrides = locale.rateOverrides

  setActiveLocale({ language: locale.language, currency: code, rateOverrides: overrides })

  const money = useCallback(
    (amountInr, opts) => formatMoney(amountInr, code, { rates: overrides, ...opts }),
    [code, overrides],
  )

  const setCurrency = useCallback((next) => dispatch('locale/setCurrency', next), [dispatch])
  const setRateOverride = useCallback((c, rate) => dispatch('locale/setRateOverride', { code: c, rate }), [dispatch])
  const clearRateOverrides = useCallback(() => dispatch('locale/clearRateOverrides'), [dispatch])

  const available = useMemo(() => {
    const allowed = locale.allowedCurrencies?.length ? locale.allowedCurrencies : CURRENCY_CODES
    return allowed.filter(c => CURRENCIES[c]).map(c => CURRENCIES[c])
  }, [locale.allowedCurrencies])

  return {
    code,
    currency,
    symbol: currency.symbol,
    isBase: code === BASE_CURRENCY,
    rate: getRate(code, overrides),
    ratesUpdatedAt: RATES_UPDATED_AT,
    overrides,
    money,
    convert: (amountInr, opts) => convert(amountInr, code, { rates: overrides, ...opts }),
    toBase: (amount) => toBase(amount, code, { rates: overrides }),
    setCurrency,
    setRateOverride,
    clearRateOverrides,
    available,
    byRegion: currenciesByRegion,
  }
}

export default useCurrency
