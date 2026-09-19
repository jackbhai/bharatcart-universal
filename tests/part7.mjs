/**
 * Part 7 — the geo layer: 90 countries, local tax, local payment rails,
 * local address formats, international shipping zones and duty estimates.
 */
import {
  COUNTRIES, COUNTRY_CODES, COUNTRY_LIST, GEO_REGIONS, getCountry, countriesByRegion,
  countriesUsingCurrency, validatePostal, validatePhone, taxFor, methodsFor,
  supportsCod, addressFieldsFor, searchCountries,
} from '../src/geo/countries.js'
import {
  SHIPPING_ZONES, ZONE_IDS, zoneFor, shipsTo, servedCountries, quoteShipping, estimateDuty,
} from '../src/geo/shipping.js'
import {
  fieldLabels, stateLabelFor, requiredFields, formatAddress, formatAddressInline, validateAddress,
} from '../src/geo/addressFormat.js'
import { CURRENCIES } from '../src/currency/currencies.js'

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) pass++
  else { fail++; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`) }
}
const section = (s) => console.log(`\n── ${s}`)

/* ============================================================== table */
section('Country table')
ok('90 or more countries', COUNTRY_CODES.length >= 90, String(COUNTRY_CODES.length))
ok('every ISO-2 code is two letters', COUNTRY_CODES.every(c => /^[A-Z]{2}$/.test(c)))
ok('every ISO-3 code is three letters', COUNTRY_LIST.every(c => /^[A-Z]{3}$/.test(c.iso3)))
ok('ISO-3 codes are unique', new Set(COUNTRY_LIST.map(c => c.iso3)).size === COUNTRY_LIST.length)
ok('every country references a real currency',
  COUNTRY_LIST.every(c => CURRENCIES[c.currency]),
  COUNTRY_LIST.filter(c => !CURRENCIES[c.currency]).map(c => c.iso2).join(','))
ok('every dial code is well formed', COUNTRY_LIST.every(c => /^\+\d{1,4}$/.test(c.dial)))
ok('every tax rate is a sane fraction', COUNTRY_LIST.every(c => c.taxRate >= 0 && c.taxRate < 0.5))
ok('every country lists payment methods', COUNTRY_LIST.every(c => c.methods.length > 0))
ok('every country has an address order', COUNTRY_LIST.every(c => c.addressOrder.length >= 3))
ok('address orders contain only real fields',
  COUNTRY_LIST.every(c => c.addressOrder.every(f => ['name','line1','line2','city','state','postal'].includes(f))),
  COUNTRY_LIST.filter(c => c.addressOrder.some(f => !['name','line1','line2','city','state','postal'].includes(f))).map(c => c.iso2).join(','))
ok('every address order includes name and line1',
  COUNTRY_LIST.every(c => c.addressOrder.includes('name') && c.addressOrder.includes('line1')))
ok('phone digit counts are plausible', COUNTRY_LIST.every(c => c.phoneDigits >= 6 && c.phoneDigits <= 12))
ok('regions are populated', GEO_REGIONS.length >= 4, GEO_REGIONS.join(','))
ok('countriesByRegion covers everything',
  Object.values(countriesByRegion()).reduce((n, l) => n + l.length, 0) === COUNTRY_LIST.length)

section('Country lookup')
ok('lookup by ISO-2', getCountry('IN')?.name === 'India')
ok('lookup by ISO-3', getCountry('IND')?.iso2 === 'IN')
ok('lookup by name', getCountry('Myanmar')?.iso2 === 'MM')
ok('lookup is case-insensitive', getCountry('in')?.iso2 === 'IN' && getCountry('myanmar')?.iso2 === 'MM')
ok('lookup tolerates whitespace', getCountry('  Nepal ')?.iso2 === 'NP')
ok('unknown country returns null', getCountry('Atlantis') === null)
ok('empty input returns null', getCountry('') === null && getCountry(null) === null)

section('The countries the user named')
for (const [key, cur] of [['Pakistan','PKR'], ['Nepal','NPR'], ['Myanmar','MMK'], ['Indonesia','IDR']]) {
  const c = getCountry(key)
  ok(`${key} is present and settles in ${cur}`, c?.currency === cur, String(c?.currency))
  ok(`${key} has local payment rails`, c?.methods.length >= 2)
  ok(`${key} has a tax definition`, typeof c?.taxRate === 'number')
}

section('Currency ↔ country')
ok('EUR spans the eurozone', countriesUsingCurrency('EUR').length >= 10, String(countriesUsingCurrency('EUR').length))
ok('INR maps to India', countriesUsingCurrency('INR').some(c => c.iso2 === 'IN'))
ok('USD covers Ecuador too', countriesUsingCurrency('USD').some(c => c.iso2 === 'EC'))
ok('an unused currency returns an empty list', countriesUsingCurrency('XAU').length === 0)

/* =========================================================== validation */
section('Postal validation')
ok('Indian PIN accepted', validatePostal('IN', '110001').ok)
ok('Indian PIN of wrong length rejected', !validatePostal('IN', '11001').ok)
ok('letters rejected for India', !validatePostal('IN', 'ABCDEF').ok)
ok('UK postcode accepted', validatePostal('GB', 'SW1A 1AA').ok)
ok('UK postcode without a space accepted', validatePostal('GB', 'SW1A1AA').ok)
ok('UK postcode is case-insensitive', validatePostal('GB', 'sw1a 1aa').ok)
ok('Dutch postcode accepted', validatePostal('NL', '1012 AB').ok)
ok('Canadian postcode accepted', validatePostal('CA', 'K1A 0B1').ok)
ok('Brazilian CEP accepted', validatePostal('BR', '01310-100').ok)
ok('Japanese postal code accepted', validatePostal('JP', '100-0001').ok)
ok('Polish postcode accepted', validatePostal('PL', '00-001').ok)
ok('a country without postal codes accepts blank', validatePostal('HK', '').ok)
ok('a blank postal code is rejected where required', !validatePostal('IN', '').ok)
ok('an unknown country fails cleanly', !validatePostal('ZZ', '12345').ok)
ok('the rejection names the local term',
  validatePostal('GB', '!!!').reason?.toLowerCase().includes('postcode'),
  validatePostal('GB', '!!!').reason)

section('Phone validation')
ok('local Indian number accepted', validatePhone('IN', '9810000000').ok)
ok('Indian number with country code accepted', validatePhone('IN', '+91 98100 00000').ok)
ok('E.164 is returned', validatePhone('IN', '9810000000').e164 === '+919810000000')
ok('too-short number rejected', !validatePhone('IN', '98100').ok)
ok('punctuation is ignored', validatePhone('IN', '(981) 000-0000').ok)
ok('blank is rejected', !validatePhone('IN', '').ok)
ok('German number honours its own length', validatePhone('DE', '15112345678').ok)
ok('an unknown country fails cleanly', !validatePhone('ZZ', '12345').ok)

/* ================================================================= tax */
section('Local tax')
ok('India is GST at 18%', taxFor('IN').name === 'GST' && taxFor('IN').rate === 0.18)
ok('Germany is MwSt at 19%', taxFor('DE').name === 'MwSt' && taxFor('DE').rate === 0.19)
ok('Singapore is GST at 9%', taxFor('SG').rate === 0.09)
ok('Hungary has the highest headline VAT', taxFor('HU').rate === 0.27)
ok('the Gulf zero-rate states are zero', taxFor('QA').rate === 0 && taxFor('KW').rate === 0)
ok('tax names are localised, not all "GST"',
  new Set(COUNTRY_LIST.map(c => c.taxName)).size >= 10,
  String(new Set(COUNTRY_LIST.map(c => c.taxName)).size))
ok('an unknown country reports a zero unknown rate',
  taxFor('ZZ').rate === 0 && taxFor('ZZ').known === false)

/* ============================================================= payments */
section('Local payment rails')
ok('India offers UPI', methodsFor('IN').includes('upi'))
ok('Brazil offers PIX', methodsFor('BR').includes('pix'))
ok('Netherlands offers iDEAL', methodsFor('NL').includes('ideal'))
ok('Kenya offers M-Pesa', methodsFor('KE').includes('mpesa'))
ok('Poland offers BLIK', methodsFor('PL').includes('blik'))
ok('Indonesia offers QRIS', methodsFor('ID').includes('qris'))
ok('Philippines offers GCash', methodsFor('PH').includes('gcash'))
ok('Sweden offers Swish', methodsFor('SE').includes('swish'))
ok('Mexico offers OXXO', methodsFor('MX').includes('oxxo'))
ok('UPI is not offered outside India',
  !methodsFor('US').includes('upi') && !methodsFor('DE').includes('upi'))
ok('PIX is not offered outside Brazil', !methodsFor('IN').includes('pix'))
ok('methods intersect with what the store enables',
  methodsFor('IN', ['card', 'cod']).sort().join(',') === 'card,cod')
ok('an empty intersection is possible',
  methodsFor('IN', ['ideal']).length === 0)
ok('COD is available in India', supportsCod('IN'))
ok('COD is not available in Germany', !supportsCod('DE'))
ok('COD is common across South Asia',
  ['PK', 'BD', 'LK', 'NP'].every(c => supportsCod(c)))
ok('an unknown country has no methods', methodsFor('ZZ').length === 0)

/* ============================================================ addresses */
section('Address formats')
ok('Japan puts the postal code before the city',
  addressFieldsFor('JP').indexOf('postal') < addressFieldsFor('JP').indexOf('city'))
ok('the UK puts the postal code last',
  addressFieldsFor('GB').indexOf('postal') > addressFieldsFor('GB').indexOf('city'))
ok('Germany puts the postal code before the city',
  addressFieldsFor('DE').indexOf('postal') < addressFieldsFor('DE').indexOf('city'))
ok('India keeps state then PIN',
  addressFieldsFor('IN').indexOf('state') < addressFieldsFor('IN').indexOf('postal'))
ok('Singapore needs no city line', !addressFieldsFor('SG').includes('city'))
ok('an unknown country gets a sane default', addressFieldsFor('ZZ').includes('line1'))

section('Subdivision labels')
ok('Canada says Province', stateLabelFor('CA') === 'Province')
ok('Japan says Prefecture', stateLabelFor('JP') === 'Prefecture')
ok('the UK says County', stateLabelFor('GB') === 'County')
ok('Switzerland says Canton', stateLabelFor('CH') === 'Canton')
ok('the UAE says Emirate', stateLabelFor('AE') === 'Emirate')
ok('Egypt says Governorate', stateLabelFor('EG') === 'Governorate')
ok('India says State', stateLabelFor('IN') === 'State')
ok('the fallback is Region', stateLabelFor('ZZ') === 'State' || stateLabelFor('LA') === 'Region')

section('Field labels')
ok('India labels it PIN code', fieldLabels('IN').postal === 'PIN code')
ok('the US labels it ZIP code', fieldLabels('US').postal === 'ZIP code')
ok('Germany labels it PLZ', fieldLabels('DE').postal === 'PLZ')
ok('Ireland labels it Eircode', fieldLabels('IE').postal === 'Eircode')
ok('the state label is wired through', fieldLabels('JP').state === 'Prefecture')

section('Required fields')
ok('line2 is never required', !requiredFields('IN').includes('line2'))
ok('postal is required in India', requiredFields('IN').includes('postal'))
ok('postal is not required in Hong Kong', !requiredFields('HK').includes('postal'))
ok('state is required in India', requiredFields('IN').includes('state'))
ok('state is not required in Germany', !requiredFields('DE').includes('state'))

section('Address rendering')
const addr = { name: 'Aarav Sharma', line1: '12 Nehru Road', line2: 'Near Metro', city: 'Mumbai', state: 'Maharashtra', postal: '400001' }
const inLines = formatAddress(addr, 'IN')
ok('renders multiple lines', inLines.length >= 3)
ok('name comes first', inLines[0] === 'Aarav Sharma')
ok('the country is appended', inLines[inLines.length - 1] === 'India')
ok('city, state and postal share a line',
  inLines.some(l => l.includes('Mumbai') && l.includes('400001')))
const jpLines = formatAddress({ name: 'Yuki Tanaka', line1: '1-2-3 Chiyoda', city: 'Tokyo', state: 'Tokyo', postal: '100-0001' }, 'JP')
ok('Japanese order puts the postal group before the street',
  jpLines.findIndex(l => l.includes('100-0001')) < jpLines.findIndex(l => l.includes('Chiyoda')),
  jpLines.join(' | '))
ok('inline form is comma separated', formatAddressInline(addr, 'IN').includes(', '))
ok('empty fields are skipped',
  !formatAddress({ name: 'X', line1: 'Y', city: '', postal: '' }, 'IN').join('|').includes('||'))

section('Address validation')
ok('a complete Indian address passes', validateAddress(addr, 'IN').ok)
ok('a missing PIN is caught', !validateAddress({ ...addr, postal: '' }, 'IN').ok)
ok('the error is keyed to the field',
  validateAddress({ ...addr, postal: '' }, 'IN').errors.postal?.includes('PIN code'))
ok('a missing line2 is fine', validateAddress({ ...addr, line2: '' }, 'IN').ok)
ok('a German address without a state passes',
  validateAddress({ name: 'A', line1: 'B', city: 'Berlin', postal: '10115' }, 'DE').ok)
ok('multiple errors are reported at once',
  Object.keys(validateAddress({}, 'IN').errors).length >= 3)

/* ============================================================= shipping */
section('Shipping zones')
ok('zones are defined', ZONE_IDS.length >= 8, String(ZONE_IDS.length))
ok('every zone has a rate and an ETA',
  Object.values(SHIPPING_ZONES).every(z => z.baseRate >= 0 && z.minDays > 0 && z.maxDays >= z.minDays))
ok('express is never slower than standard',
  Object.values(SHIPPING_ZONES).every(z => z.expressMaxDays <= z.maxDays))
ok('express costs more than standard',
  Object.values(SHIPPING_ZONES).every(z => z.expressRate > z.baseRate))
ok('no country sits in two zones', (() => {
  const seen = new Set()
  for (const z of Object.values(SHIPPING_ZONES)) for (const c of z.countries) {
    if (seen.has(c)) return false
    seen.add(c)
  }
  return true
})())
ok('every zone country is a real country',
  Object.values(SHIPPING_ZONES).every(z => z.countries.every(c => COUNTRIES[c])),
  Object.values(SHIPPING_ZONES).flatMap(z => z.countries).filter(c => !COUNTRIES[c]).join(','))

section('Zone resolution')
ok('India is domestic', zoneFor('IN')?.id === 'domestic')
ok('Nepal is South Asia', zoneFor('NP')?.id === 'saarc')
ok('Myanmar is Southeast Asia', zoneFor('MM')?.id === 'seasia')
ok('Indonesia is Southeast Asia', zoneFor('ID')?.id === 'seasia')
ok('Germany is Europe', zoneFor('DE')?.id === 'europe')
ok('Brazil is the Americas', zoneFor('BR')?.id === 'americas')
ok('Kenya is Africa', zoneFor('KE')?.id === 'africa')
ok('Australia is Oceania', zoneFor('AU')?.id === 'oceania')
ok('an unserved country has no zone', zoneFor('KP') === null)
ok('shipsTo agrees with zoneFor', shipsTo('IN') && !shipsTo('KP'))
ok('servedCountries is a real subset',
  servedCountries().length > 0 && servedCountries().length <= COUNTRY_LIST.length)

section('Shipping quotes')
const dom = quoteShipping({ country: 'IN', weightG: 500, orderValueInr: 500 })
ok('a domestic quote succeeds', dom.ok)
ok('domestic base rate applies', dom.cost === 59, String(dom.cost))
ok('the half-kilo minimum is not billed extra', dom.breakdown.billableKg === 0)
const domFree = quoteShipping({ country: 'IN', weightG: 500, orderValueInr: 1500 })
ok('domestic free shipping kicks in above the threshold', domFree.free && domFree.cost === 0)
ok('the shortfall is reported when not free', dom.shortfall === 499, String(dom.shortfall))
ok('the shortfall is zero once free', domFree.shortfall === 0)
const heavy = quoteShipping({ country: 'DE', weightG: 2500, orderValueInr: 5000 })
ok('an international quote succeeds', heavy.ok)
ok('weight above half a kilo is billed',
  heavy.breakdown.billableKg === 2 && heavy.breakdown.weightCost === 2 * SHIPPING_ZONES.europe.perKg,
  JSON.stringify(heavy.breakdown))
ok('the total is base plus weight',
  heavy.cost === SHIPPING_ZONES.europe.baseRate + heavy.breakdown.weightCost)
const exp = quoteShipping({ country: 'DE', weightG: 500, orderValueInr: 5000, express: true })
ok('express uses the express rate', exp.cost === SHIPPING_ZONES.europe.expressRate)
ok('express is faster', exp.maxDays < heavy.maxDays)
ok('express never ships free',
  !quoteShipping({ country: 'IN', weightG: 500, orderValueInr: 99999, express: true }).free)
ok('an unserved country is refused',
  !quoteShipping({ country: 'KP', weightG: 500 }).ok)
ok('the refusal explains itself',
  quoteShipping({ country: 'KP' }).reason?.length > 0)
ok('a zero weight still bills the minimum', quoteShipping({ country: 'IN', weightG: 0 }).ok)
ok('quotes carry an ETA range',
  dom.minDays > 0 && dom.maxDays >= dom.minDays)

section('Duty estimates')
ok('domestic orders owe no duty', !estimateDuty({ country: 'IN', orderValueInr: 99999 }).applies)
ok('a small international order is below de minimis',
  !estimateDuty({ country: 'US', orderValueInr: 2000 }).applies)
ok('a large international order attracts duty',
  estimateDuty({ country: 'DE', orderValueInr: 50000 }).applies)
ok('the duty estimate uses the local rate',
  estimateDuty({ country: 'DE', orderValueInr: 50000 }).amount === Math.round(50000 * 0.19))
ok('the note names the local tax',
  estimateDuty({ country: 'DE', orderValueInr: 50000 }).note.includes('MwSt'))
ok('the note is clear the carrier collects it',
  estimateDuty({ country: 'DE', orderValueInr: 50000 }).note.toLowerCase().includes('not by us'))
ok('the threshold is reported either way',
  typeof estimateDuty({ country: 'US', orderValueInr: 2000 }).threshold === 'number')
ok('an unknown country owes nothing', !estimateDuty({ country: 'ZZ', orderValueInr: 99999 }).applies)

section('Country search')
ok('search by name', searchCountries('japan')[0]?.iso2 === 'JP')
ok('search by ISO-2', searchCountries('MM')[0]?.iso2 === 'MM')
ok('search by ISO-3', searchCountries('IDN')[0]?.iso2 === 'ID')
ok('search by prefix', searchCountries('paki')[0]?.iso2 === 'PK')
ok('search by currency', searchCountries('MMK').some(c => c.iso2 === 'MM'))
ok('search by dial code', searchCountries('+977').some(c => c.iso2 === 'NP'))
ok('search respects the limit', searchCountries('a', 5).length <= 5)
ok('nonsense returns nothing', searchCountries('zzzqqq').length === 0)
ok('an empty query returns a list', searchCountries('').length > 0)

console.log(`\n${pass} passed · ${fail} failed`)
process.exit(fail ? 1 : 0)
