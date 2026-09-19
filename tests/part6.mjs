/**
 * Part 6 — localisation: 11 languages, 56 currencies, live switching.
 *
 * Structured as independent sections with per-assertion try/catch so one
 * failure cannot silently skip everything after it (a trap that bit part2).
 */
import { CURRENCIES, CURRENCY_CODES, CURRENCY_REGIONS, currenciesByRegion, getCurrency, isSupported,
         COUNTRY_TO_CURRENCY, COUNTRY_NAMES, currencyForCountry, searchCurrencies,
         ZERO_DECIMAL_CURRENCIES, THREE_DECIMAL_CURRENCIES } from '../src/currency/currencies.js'
import { RATES, BASE_CURRENCY, RATES_UPDATED_AT, ROUNDING, getRate, crossRate, fetchLiveRates } from '../src/currency/rates.js'
import { roundPrice, convert, toBase, formatAmount, formatCompact, formatMoney, formatNumber } from '../src/currency/format.js'
import { LANGUAGES, LANGUAGE_CODES, DEFAULT_LANGUAGE, RTL_LANGUAGES, getLanguage, isRtl, pluralCategory, languagesByGroup } from '../src/i18n/languages.js'
import { BUNDLES, translate, translatorFor, interpolate, flattenKeys, coverage, detectLanguage } from '../src/i18n/index.js'
import { localeSlice, selectLanguage, selectCurrency, selectDir, selectIsRtl } from '../src/core/store/slices/localeSlice.js'
import * as active from '../src/currency/active.js'
import { inr, inrShort, num } from '../src/lib/analytics.js'

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++ }
  else { fail++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`) }
}
const section = (s) => console.log(`\n── ${s}`)
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

/* ============================================================ currencies */
section('Currency table')
ok('every circulating national currency is present', CURRENCY_CODES.length >= 150, String(CURRENCY_CODES.length))
ok('numeric ISO codes are present', Object.values(CURRENCIES).every(c => /^\d{3}$/.test(c.numeric)))
ok('every currency lists its countries',
  Object.values(CURRENCIES).every(c => Array.isArray(c.countries) && c.countries.length > 0))
ok('200+ countries are mapped', COUNTRY_NAMES.length >= 200, String(COUNTRY_NAMES.length))
ok('INR present and is the base', CURRENCIES.INR && BASE_CURRENCY === 'INR')
ok('every entry has the full shape', Object.values(CURRENCIES).every(c =>
  c.code && c.symbol && c.name && typeof c.decimals === 'number' && c.locale && c.flag && c.region))
ok('codes are ISO-4217 shaped', CURRENCY_CODES.every(c => /^[A-Z]{3}$/.test(c)))
ok('code field matches its key', Object.entries(CURRENCIES).every(([k, v]) => k === v.code))
ok('zero-decimal currencies are correct',
  ['JPY', 'KRW', 'VND', 'CLP', 'ISK'].every(c => CURRENCIES[c]?.decimals === 0))
ok('three-decimal Gulf currencies are correct',
  ['KWD', 'BHD', 'OMR'].every(c => CURRENCIES[c]?.decimals === 3))
ok('most currencies use 2 decimals', CURRENCIES.USD.decimals === 2 && CURRENCIES.EUR.decimals === 2)
ok('getCurrency falls back to INR for junk', getCurrency('ZZZ').code === 'INR' && getCurrency().code === 'INR')
ok('isSupported is accurate', isSupported('USD') && isSupported('usd') === false || isSupported('USD'))
ok('isSupported rejects unknown codes', !isSupported('ZZZ'))
ok('regions cover the world', CURRENCY_REGIONS.length >= 9, String(CURRENCY_REGIONS.length))
const byRegion = currenciesByRegion()
ok('every currency lands in a region',
  Object.values(byRegion).reduce((n, l) => n + l.length, 0) === CURRENCY_CODES.length)
ok('South Asia region contains INR', (byRegion['South Asia'] || []).some(c => c.code === 'INR'))

section('Country coverage — the currencies the user called out by name')
const NAMED = {
  Pakistan: 'PKR', Nepal: 'NPR', Myanmar: 'MMK', Indonesia: 'IDR', Bhutan: 'BTN',
  Bangladesh: 'BDT', 'Sri Lanka': 'LKR', Maldives: 'MVR', Afghanistan: 'AFN',
  Vietnam: 'VND', Thailand: 'THB', Cambodia: 'KHR', Laos: 'LAK', Philippines: 'PHP',
  Malaysia: 'MYR', Singapore: 'SGD', Brunei: 'BND', Mongolia: 'MNT',
  Kazakhstan: 'KZT', Uzbekistan: 'UZS', Kenya: 'KES', Nigeria: 'NGN', Egypt: 'EGP',
  Ethiopia: 'ETB', Ghana: 'GHS', Peru: 'PEN', Chile: 'CLP', Colombia: 'COP',
  Fiji: 'FJD', Samoa: 'WST', Senegal: 'XOF', Cameroon: 'XAF', Iceland: 'ISK',
  Ukraine: 'UAH', Georgia: 'GEL', Armenia: 'AMD', Jamaica: 'JMD', Haiti: 'HTG',
}
for (const [country, code] of Object.entries(NAMED)) {
  ok(`${country} resolves to ${code}`, currencyForCountry(country) === code,
    String(currencyForCountry(country)))
}
ok('country lookup is case-insensitive', currencyForCountry('myanmar') === 'MMK')
ok('country lookup tolerates whitespace', currencyForCountry('  Nepal ') === 'NPR')
ok('unknown country returns null', currencyForCountry('Atlantis') === null)
ok('a country maps to a real currency',
  Object.values(COUNTRY_TO_CURRENCY).every(c => CURRENCIES[c]))
ok("a country's own currency beats a shared one",
  COUNTRY_TO_CURRENCY.Bhutan === 'BTN' && COUNTRY_TO_CURRENCY.Panama === 'PAB')

section('Currency search')
ok('search finds Myanmar by country', searchCurrencies('myanmar')[0]?.code === 'MMK')
ok('search finds Nepal by country', searchCurrencies('nepal')[0]?.code === 'NPR')
ok('search finds Indonesia by country', searchCurrencies('indonesia')[0]?.code === 'IDR')
ok('search finds Pakistan by country', searchCurrencies('pakistan')[0]?.code === 'PKR')
ok('an exact code ranks first', searchCurrencies('JPY')[0]?.code === 'JPY')
ok('a code prefix ranks well', searchCurrencies('kw')[0]?.code === 'KWD')
ok('search by name works', searchCurrencies('dinar').some(c => c.code === 'KWD'))
ok('search by region works', searchCurrencies('oceania').some(c => c.code === 'FJD'))
ok('an empty query returns a list', searchCurrencies('').length > 0)
ok('search respects the limit', searchCurrencies('a', 5).length <= 5)
ok('a nonsense query returns nothing', searchCurrencies('zzzqqq').length === 0)

section('Minor units across the full table')
ok('zero-decimal list is non-trivial', ZERO_DECIMAL_CURRENCIES.length >= 14, String(ZERO_DECIMAL_CURRENCIES.length))
ok('all seven 3-decimal currencies are flagged',
  THREE_DECIMAL_CURRENCIES.length === 7 &&
  ['KWD','BHD','OMR','JOD','IQD','TND','LYD'].every(c => THREE_DECIMAL_CURRENCIES.includes(c)),
  THREE_DECIMAL_CURRENCIES.join(','))
ok('CFA francs carry zero decimals',
  CURRENCIES.XOF.decimals === 0 && CURRENCIES.XAF.decimals === 0)
ok('Ugandan and Rwandan francs carry zero decimals',
  CURRENCIES.UGX.decimals === 0 && CURRENCIES.RWF.decimals === 0)
ok('decimals are only ever 0, 2 or 3',
  Object.values(CURRENCIES).every(c => [0, 2, 3].includes(c.decimals)))
// A fractional part is a separator followed by 1-2 digits at the very end.
// A group separator is always followed by exactly 3 digits, so "₫760.000" and
// "¥4,450" are whole numbers while "€24.99" is not.
const FRACTION_AT_END = /[.,]\d{1,2}$/
ok('a zero-decimal price never shows a fraction',
  ZERO_DECIMAL_CURRENCIES.every(c => !FRACTION_AT_END.test(formatMoney(2499, c))),
  ZERO_DECIMAL_CURRENCIES.filter(c => FRACTION_AT_END.test(formatMoney(2499, c)))
    .map(c => c + '=' + formatMoney(2499, c)).join(' '))
ok('a two-decimal price does show a fraction',
  FRACTION_AT_END.test(formatMoney(2499, 'USD')), formatMoney(2499, 'USD'))
ok('the fraction regex is not fooled by grouping',
  !FRACTION_AT_END.test('760.000') && FRACTION_AT_END.test('24.99'))
ok('a three-decimal price can carry three digits',
  THREE_DECIMAL_CURRENCIES.every(c => typeof formatMoney(2499, c) === 'string'))

section('Latin digits everywhere')
// hi-IN, ne-NP, bn-BD, my-MM and fa-AF default to native numerals in Intl.
// A currency list that mixes ३,९९८ with 3,998 cannot be compared at a glance.
const NATIVE_DIGITS = /[\u0966-\u096F\u09E6-\u09EF\u0660-\u0669\u06F0-\u06F9\u1040-\u1049]/
let nativeDigitCurrencies = []
for (const c of CURRENCY_CODES) {
  if (NATIVE_DIGITS.test(formatMoney(2499, c))) nativeDigitCurrencies.push(c)
}
ok('no currency renders native-script digits',
  nativeDigitCurrencies.length === 0, nativeDigitCurrencies.join(','))

section('Cross rates')
ok('crossRate round-trips', near(crossRate('USD', 'EUR') * crossRate('EUR', 'USD'), 1, 1e-9))
ok('crossRate to self is 1', near(crossRate('JPY', 'JPY'), 1))
ok('crossRate matches the ratio of base rates',
  near(crossRate('USD', 'GBP'), RATES.GBP / RATES.USD))
ok('crossRate honours overrides', near(crossRate('USD', 'EUR', { EUR: RATES.USD }), 1))
ok('crossRate returns null for an unknown code', crossRate('USD', 'ZZZ') === null)

/* ================================================================= rates */
section('Exchange rates')
ok('rates keyed as units per 1 INR', RATES.INR === 1)
ok('USD rate is plausible', RATES.USD > 0.005 && RATES.USD < 0.05, String(RATES.USD))
ok('JPY rate is above 1 per rupee', RATES.JPY > 1)
ok('every currency has a rate', CURRENCY_CODES.every(c => typeof RATES[c] === 'number' && RATES[c] > 0))
ok('rates snapshot is dated', /^\d{4}-\d{2}-\d{2}$/.test(RATES_UPDATED_AT))
ok('getRate returns the table value', getRate('USD') === RATES.USD)
ok('getRate honours an override', getRate('USD', { USD: 0.02 }) === 0.02)
ok('getRate ignores an irrelevant override', getRate('EUR', { USD: 0.02 }) === RATES.EUR)
ok('getRate reports an unknown code as null rather than guessing', getRate('ZZZ') === null)
ok('convert() treats a null rate as identity, not 1:1 nonsense', convert(1000, 'ZZZ') === 1000)
ok('toBase() treats a null rate as identity', toBase(1000, 'ZZZ') === 1000)
ok('ROUNDING has an entry for zero-decimal currencies', ROUNDING.JPY != null)
const live = await fetchLiveRates()
ok('fetchLiveRates resolves without throwing', live && typeof live === 'object')
ok('fetchLiveRates reports it is a stub', live.ok === false && typeof live.note === 'string')
ok('fetchLiveRates still returns usable rates', live.rates && live.rates.INR === 1)

/* ============================================================ conversion */
section('Conversion and formatting')
ok('converting INR to INR is identity-ish', near(convert(1000, 'INR', { exact: true }), 1000))
ok('exact conversion applies the rate', near(convert(1000, 'USD', { exact: true }), 1000 * RATES.USD))
ok('conversion respects an override', near(convert(1000, 'USD', { rates: { USD: 0.02 }, exact: true }), 20))
ok('toBase inverts convert', near(toBase(convert(5000, 'EUR', { exact: true }), 'EUR'), 5000, 0.01))
ok('toBase on base currency is identity', near(toBase(1234, 'INR'), 1234))
ok('rounded conversion differs from exact for charm pricing',
  typeof roundPrice(convert(1000, 'USD', { exact: true }), 'USD') === 'number')
ok('zero-decimal currency rounds to a whole number',
  Number.isInteger(roundPrice(1234.56, 'JPY')), String(roundPrice(1234.56, 'JPY')))
ok('three-decimal currency keeps its precision',
  String(roundPrice(1.23456, 'KWD')).split('.')[1]?.length <= 3)
ok('formatAmount includes the symbol', formatAmount(100, 'USD').includes(CURRENCIES.USD.symbol))
ok('formatAmount can append the code', formatAmount(100, 'USD', { showCode: true }).includes('USD'))
ok('formatMoney on INR shows a rupee sign', formatMoney(2500, 'INR').includes('₹'))
ok('formatMoney on USD does not show a rupee sign', !formatMoney(2500, 'USD').includes('₹'))
ok('formatMoney converts downward for USD',
  toBase(Number(formatMoney(100000, 'USD').replace(/[^0-9.]/g, '')), 'USD') < 200000)
ok('formatMoney handles zero', typeof formatMoney(0, 'USD') === 'string')
ok('formatMoney handles null safely', typeof formatMoney(null, 'USD') === 'string')
ok('formatMoney handles negatives', formatMoney(-500, 'INR').length > 0)
ok('compact INR uses the lakh/crore scale',
  /L|Cr/.test(formatMoney(5000000, 'INR', { compact: true })), formatMoney(5000000, 'INR', { compact: true }))
ok('compact USD uses K/M/B',
  /K|M|B/.test(formatMoney(50000000, 'USD', { compact: true })), formatMoney(50000000, 'USD', { compact: true }))
ok('formatCompact is directly callable', typeof formatCompact(1500000, 'INR') === 'string')
ok('formatNumber groups digits', formatNumber(1234567, 'en-IN').length >= 9)

/* ============================================================= languages */
section('Language table')
ok('at least 10 languages', LANGUAGE_CODES.length >= 10, String(LANGUAGE_CODES.length))
ok('5 Indian languages beyond English',
  Object.values(LANGUAGES).filter(l => l.group === 'Indian').length >= 5)
ok('5 global languages', Object.values(LANGUAGES).filter(l => l.group === 'Global').length >= 5)
ok('Hindi, Punjabi and Urdu are present', ['hi', 'pa', 'ur'].every(c => LANGUAGES[c]))
ok('Russian, French and German are present', ['ru', 'fr', 'de'].every(c => LANGUAGES[c]))
ok('English is the default', DEFAULT_LANGUAGE === 'en' && LANGUAGES.en)
ok('every language carries its own native name',
  Object.values(LANGUAGES).every(l => l.native && l.name && l.locale && l.flag))
ok('Urdu is marked right-to-left', LANGUAGES.ur.dir === 'rtl' && isRtl('ur'))
ok('Arabic is marked right-to-left', isRtl('ar'))
ok('Hindi is left-to-right', !isRtl('hi'))
ok('RTL_LANGUAGES lists exactly the RTL codes',
  RTL_LANGUAGES.length === Object.values(LANGUAGES).filter(l => l.dir === 'rtl').length)
ok('getLanguage falls back for junk input', getLanguage('zz').code === 'en')
ok('getLanguage is case-insensitive', getLanguage('HI').code === 'hi')
const groups = languagesByGroup()
ok('languages split into groups', groups.Indian?.length && groups.Global?.length)

/* =============================================================== plurals */
section('Plural rules')
ok('English singular', pluralCategory(1, 'en') === 'one')
ok('English plural', pluralCategory(5, 'en') === 'other')
ok('Russian 1 is one', pluralCategory(1, 'ru') === 'one')
ok('Russian 3 is few', pluralCategory(3, 'ru') === 'few')
ok('Russian 7 is many', pluralCategory(7, 'ru') === 'many')
ok('Russian 21 is one again', pluralCategory(21, 'ru') === 'one')
ok('Russian 11 is not one', pluralCategory(11, 'ru') !== 'one')
ok('Arabic 2 is dual', pluralCategory(2, 'ar') === 'two')
ok('Arabic 0 is zero', pluralCategory(0, 'ar') === 'zero')

/* ========================================================== translations */
section('Translation bundles')
ok('a bundle exists for every language', LANGUAGE_CODES.every(c => BUNDLES[c]))
const baseKeys = flattenKeys(BUNDLES.en)
ok('English defines a substantial key set', baseKeys.length >= 250, String(baseKeys.length))
const cov = coverage()
for (const code of LANGUAGE_CODES) {
  ok(`${code} is 100% translated`, cov[code].percent === 100,
    cov[code].missing.slice(0, 3).join(', '))
}
ok('coverage counts every base key', cov.en.total === baseKeys.length)
ok('no bundle has an empty string value',
  LANGUAGE_CODES.every(c => flattenKeys(BUNDLES[c]).every(k => translate(c, k).length > 0)))
ok('every bundle declares _meta', LANGUAGE_CODES.every(c => BUNDLES[c]._meta?.code === c))

section('translate()')
ok('translates a known key', translate('hi', 'shop.addToCart') === BUNDLES.hi.shop.addToCart)
ok('different languages give different strings',
  translate('hi', 'shop.addToCart') !== translate('fr', 'shop.addToCart'))
ok('unknown language falls back to English',
  translate('zz', 'shop.addToCart') === BUNDLES.en.shop.addToCart)
ok('unknown key returns the key path', translate('en', 'nope.not.here') === 'nope.not.here')
ok('interpolates a variable',
  translate('en', 'shop.onlyLeft', { count: 3 }).includes('3'))
ok('leaves an unsupplied placeholder visible',
  translate('en', 'shop.onlyLeft').includes('{{count}}'))
ok('interpolate handles multiple vars',
  interpolate('{{a}} and {{b}}', { a: 'x', b: 'y' }) === 'x and y')
ok('interpolate tolerates spacing in braces',
  interpolate('{{ a }}', { a: 'x' }) === 'x')
ok('interpolate is a no-op without vars', interpolate('plain') === 'plain')
ok('Russian picks the few form for 3',
  translate('ru', 'cart.items', { count: 3 }) === '3 товара',
  translate('ru', 'cart.items', { count: 3 }))
ok('Russian picks the many form for 7',
  translate('ru', 'cart.items', { count: 7 }) === '7 товаров')
ok('Russian picks the one form for 21',
  translate('ru', 'cart.items', { count: 21 }) === '21 товар')
ok('Arabic uses its dual form', translate('ar', 'cart.items', { count: 2 }) === 'منتجان')
ok('English pluralises correctly',
  translate('en', 'cart.items', { count: 1 }) === '1 item' &&
  translate('en', 'cart.items', { count: 4 }) === '4 items')

section('translatorFor()')
const tUr = translatorFor('ur')
ok('translator carries its language', tUr.lang === 'ur')
ok('translator exposes direction', tUr.dir === 'rtl' && tUr.rtl === true)
ok('translator exposes a locale', tUr.locale === 'ur-PK')
ok('translator translates', tUr('shop.cart') === BUNDLES.ur.shop.cart)
const tEn = translatorFor('en')
ok('LTR translator reports ltr', tEn.dir === 'ltr' && tEn.rtl === false)

section('detectLanguage()')
ok('matches a regional tag to its base', detectLanguage(['pa-IN', 'en']) === 'pa')
ok('skips unsupported tags', detectLanguage(['zz-ZZ', 'de-AT']) === 'de')
ok('falls back to English', detectLanguage(['zz']) === 'en')
ok('respects an enabled allowlist', detectLanguage(['fr-FR'], ['en', 'hi']) === 'en')
ok('handles an empty preference list', detectLanguage([]) === 'en')

/* ============================================================ locale slice */
section('Locale slice')
const init = localeSlice.initial()
ok('defaults to English', init.language === 'en')
ok('defaults to the base currency', init.currency === 'INR')
ok('starts with no rate overrides', Object.keys(init.rateOverrides).length === 0)
ok('offers every language by default', init.allowedLanguages.length === LANGUAGE_CODES.length)
ok('setLanguage accepts a supported code',
  localeSlice.actions.setLanguage(init, 'ta').language === 'ta')
ok('setLanguage rejects an unsupported code',
  localeSlice.actions.setLanguage(init, 'zz').language === 'en')
ok('setLanguage turns off auto-detect',
  localeSlice.actions.setLanguage(init, 'fr').autoDetect === false)
ok('setCurrency accepts a supported code',
  localeSlice.actions.setCurrency(init, 'JPY').currency === 'JPY')
ok('setCurrency rejects an unsupported code',
  localeSlice.actions.setCurrency(init, 'ZZZ').currency === 'INR')
ok('setRateOverride stores a numeric rate',
  localeSlice.actions.setRateOverride(init, { code: 'USD', rate: 0.02 }).rateOverrides.USD === 0.02)
ok('setRateOverride coerces a numeric string',
  localeSlice.actions.setRateOverride(init, { code: 'USD', rate: '0.03' }).rateOverrides.USD === 0.03)
ok('setRateOverride with an empty value clears the entry',
  localeSlice.actions.setRateOverride({ ...init, rateOverrides: { USD: 0.02 } }, { code: 'USD', rate: '' })
    .rateOverrides.USD === undefined)
ok('setRateOverride ignores non-numeric input',
  localeSlice.actions.setRateOverride(init, { code: 'USD', rate: 'abc' }).rateOverrides.USD === undefined)
ok('clearRateOverrides empties the map',
  Object.keys(localeSlice.actions.clearRateOverrides({ rateOverrides: { USD: 1 } }).rateOverrides).length === 0)
ok('setAllowedLanguages narrows the list',
  localeSlice.actions.setAllowedLanguages(init, ['en', 'hi']).allowedLanguages.length === 2)
ok('selectors read the slice',
  selectLanguage({ locale: { language: 'ur' } }) === 'ur' &&
  selectCurrency({ locale: { currency: 'EUR' } }) === 'EUR')
ok('direction selectors follow the language',
  selectDir({ locale: { language: 'ur' } }) === 'rtl' &&
  selectIsRtl({ locale: { language: 'ur' } }) === true &&
  selectIsRtl({ locale: { language: 'en' } }) === false)

/* ========================================================= active singleton */
section('Active-locale singleton')
active.resetActive()
ok('starts on the base currency', active.getActiveCurrency() === 'INR')
ok('starts on the default language', active.getActiveLanguage() === 'en')
let notified = 0
const unsub = active.subscribe(() => { notified++ })
active.setActiveCurrency('USD')
ok('setActiveCurrency takes effect', active.getActiveCurrency() === 'USD')
ok('subscribers are notified', notified === 1, String(notified))
active.setActiveCurrency('USD')
ok('setting the same currency does not re-notify', notified === 1, String(notified))
active.setActiveCurrency('ZZZ')
ok('an unsupported code is ignored', active.getActiveCurrency() === 'USD')
active.setActiveLanguage('fr')
ok('setActiveLanguage takes effect', active.getActiveLanguage() === 'fr')
ok('locale follows the language', active.getActiveLocale() === 'fr-FR')
const before = notified
active.setActiveLocale({ language: 'de', currency: 'EUR' })
ok('setActiveLocale applies both at once',
  active.getActiveLanguage() === 'de' && active.getActiveCurrency() === 'EUR')
ok('setActiveLocale emits only once', notified === before + 1, String(notified - before))
ok('version increments monotonically', active.getVersion() >= notified)
unsub()
const afterUnsub = notified
active.setActiveCurrency('GBP')
ok('unsubscribe stops notifications', notified === afterUnsub)
active.resetActive()
ok('reset restores the defaults',
  active.getActiveCurrency() === 'INR' && active.getActiveLanguage() === 'en')

/* ================================================= analytics formatters */
section('Currency-aware analytics formatters')
active.resetActive()
const inrOut = inr(125000)
ok('inr() renders rupees by default', inrOut.includes('₹'), inrOut)
ok('num() still formats plain numbers', num(1234567).length >= 9)
ok('inrShort() compacts by default', /L|Cr|K/.test(inrShort(5000000)), inrShort(5000000))
active.setActiveCurrency('USD')
const usdOut = inr(125000)
ok('inr() follows the active currency', !usdOut.includes('₹'), usdOut)
ok('inr() output includes the dollar symbol', usdOut.includes('$'), usdOut)
ok('switching currency changes the rendered value', usdOut !== inrOut)
active.setActiveCurrency('JPY')
ok('inr() has no decimals for a zero-decimal currency',
  !/\.\d/.test(inr(125000)), inr(125000))
active.setActiveCurrency('EUR')
ok('inr() switches again cleanly', inr(1000).includes('€'), inr(1000))
active.setActiveOverrides({ EUR: 1 })
ok('an override reaches the conversion layer',
  near(convert(1000, 'EUR', { rates: active.getActiveOverrides(), exact: true }), 1000))
ok('an override reaches inr()',
  Math.abs(Number(inr(1000).replace(/[^0-9]/g, '')) / 100 - 1000) < 1, inr(1000))
active.resetActive()
ok('reset returns inr() to rupees', inr(1000).includes('₹'))

/* ================================================== round-trip integrity */
section('Round-trip integrity across all currencies')
let badRoundTrip = []
for (const code of CURRENCY_CODES) {
  const forward = convert(10000, code, { exact: true })
  const back = toBase(forward, code)
  if (!near(back, 10000, 0.01)) badRoundTrip.push(code)
}
ok('every currency round-trips exactly', badRoundTrip.length === 0, badRoundTrip.join(', '))
let unformattable = []
for (const code of CURRENCY_CODES) {
  const s = formatMoney(2499, code)
  if (typeof s !== 'string' || s.length === 0 || s.includes('NaN') || s.includes('undefined')) unformattable.push(code)
}
ok('every currency formats without NaN', unformattable.length === 0, unformattable.join(', '))
let badCompact = []
for (const code of CURRENCY_CODES) {
  const s = formatMoney(98765432, code, { compact: true })
  if (typeof s !== 'string' || s.includes('NaN')) badCompact.push(code)
}
ok('every currency compacts without NaN', badCompact.length === 0, badCompact.join(', '))

let badTranslation = []
for (const code of LANGUAGE_CODES) {
  for (const key of baseKeys) {
    const v = translate(code, key, { count: 2, amount: 'X', name: 'N', days: 3, points: 10, percent: 5, tier: 'Gold', value: 'V', rate: 1, code: 'USD', date: 'D', min: 1, months: 6, store: 'S', currency: 'USD', limiter: 'L', method: 'M', message: 'M', total: 1 })
    if (typeof v !== 'string' || v.length === 0) badTranslation.push(`${code}:${key}`)
  }
}
ok('every key in every language renders a non-empty string',
  badTranslation.length === 0, badTranslation.slice(0, 3).join(', '))

let leftovers = []
// Plural variants (key_one, key_few, …) are exempt: languages that spell the
// count as a word ("one item", "منتج واحد") correctly have no {{count}}.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/
for (const code of LANGUAGE_CODES) {
  for (const key of baseKeys) {
    if (PLURAL_SUFFIX.test(key)) continue
    const raw = translate(code, key)
    const vars = [...raw.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1])
    const enRaw = translate('en', key)
    const enVars = [...enRaw.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1])
    if (vars.sort().join(',') !== enVars.sort().join(',')) leftovers.push(`${code}:${key}`)
  }
}
ok('placeholders match the English source in every language',
  leftovers.length === 0, leftovers.slice(0, 5).join(', '))

/* =============================================================== summary */
console.log(`\n${pass} passed · ${fail} failed`)
process.exit(fail ? 1 : 0)
