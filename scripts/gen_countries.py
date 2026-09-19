# -*- coding: utf-8 -*-
"""
Generate the country data layer.

A store that quotes prices in 157 currencies has to know more than the currency:
what tax applies, which payment methods actually exist there, how an address is
shaped, and what a phone number looks like. Hard-coding India's GST and PIN-code
rules everywhere was fine when the store only shipped domestically; it is wrong
the moment someone checks out from Jakarta.
"""

# (iso2, iso3, name, currency, dial, region, subregion, tax_name, tax_rate,
#  postal_label, postal_regex, phone_digits, addr_order, methods)
#
# tax_rate is the standard/headline consumption-tax rate as a decimal.
# methods are payment rails that genuinely operate in that market.
C = [
("IN","IND","India","INR","91","Asia","South Asia","GST",0.18,"PIN code",r"^\d{6}$",10,"name,line1,line2,city,state,postal","upi,card,netbanking,wallet,emi,cod"),
("PK","PAK","Pakistan","PKR","92","Asia","South Asia","GST",0.18,"Postal code",r"^\d{5}$",10,"name,line1,line2,city,state,postal","card,banktransfer,wallet,cod"),
("BD","BGD","Bangladesh","BDT","880","Asia","South Asia","VAT",0.15,"Post code",r"^\d{4}$",10,"name,line1,line2,city,postal","card,wallet,banktransfer,cod"),
("LK","LKA","Sri Lanka","LKR","94","Asia","South Asia","VAT",0.18,"Postal code",r"^\d{5}$",9,"name,line1,line2,city,postal","card,banktransfer,cod"),
("NP","NPL","Nepal","NPR","977","Asia","South Asia","VAT",0.13,"Postal code",r"^\d{5}$",10,"name,line1,line2,city,postal","card,wallet,banktransfer,cod"),
("BT","BTN","Bhutan","BTN","975","Asia","South Asia","Sales tax",0.07,"Postal code",r"^\d{5}$",8,"name,line1,city,postal","banktransfer,cod"),
("MV","MDV","Maldives","MVR","960","Asia","South Asia","GST",0.08,"Postal code",r"^\d{5}$",7,"name,line1,city,postal","card,banktransfer"),
("AF","AFG","Afghanistan","AFN","93","Asia","South Asia","BRT",0.04,"Postal code",r"^\d{4}$",9,"name,line1,city,postal","banktransfer,cod"),
("MM","MMR","Myanmar","MMK","95","Asia","Southeast Asia","Commercial tax",0.05,"Postal code",r"^\d{5}$",9,"name,line1,line2,city,state,postal","banktransfer,wallet,cod"),
("TH","THA","Thailand","THB","66","Asia","Southeast Asia","VAT",0.07,"Postal code",r"^\d{5}$",9,"name,line1,line2,city,state,postal","card,promptpay,banktransfer,wallet,cod"),
("VN","VNM","Vietnam","VND","84","Asia","Southeast Asia","VAT",0.10,"Postal code",r"^\d{6}$",9,"name,line1,line2,city,state,postal","card,banktransfer,wallet,cod"),
("ID","IDN","Indonesia","IDR","62","Asia","Southeast Asia","PPN",0.11,"Kode pos",r"^\d{5}$",10,"name,line1,line2,city,state,postal","card,banktransfer,wallet,qris,cod"),
("MY","MYS","Malaysia","MYR","60","Asia","Southeast Asia","SST",0.06,"Postcode",r"^\d{5}$",9,"name,line1,line2,city,state,postal","card,fpx,banktransfer,wallet,cod"),
("SG","SGP","Singapore","SGD","65","Asia","Southeast Asia","GST",0.09,"Postal code",r"^\d{6}$",8,"name,line1,line2,postal","card,paynow,banktransfer,wallet"),
("PH","PHL","Philippines","PHP","63","Asia","Southeast Asia","VAT",0.12,"ZIP code",r"^\d{4}$",10,"name,line1,line2,city,state,postal","card,gcash,banktransfer,wallet,cod"),
("KH","KHM","Cambodia","KHR","855","Asia","Southeast Asia","VAT",0.10,"Postal code",r"^\d{5,6}$",9,"name,line1,city,postal","card,banktransfer,wallet,cod"),
("LA","LAO","Laos","LAK","856","Asia","Southeast Asia","VAT",0.10,"Postal code",r"^\d{5}$",9,"name,line1,city,postal","banktransfer,cod"),
("BN","BRN","Brunei","BND","673","Asia","Southeast Asia","None",0.00,"Postal code",r"^[A-Z]{2}\d{4}$",7,"name,line1,city,postal","card,banktransfer"),
("CN","CHN","China","CNY","86","Asia","East Asia","VAT",0.13,"Postal code",r"^\d{6}$",11,"name,line1,line2,city,state,postal","alipay,wechat,card,banktransfer"),
("JP","JPN","Japan","JPY","81","Asia","East Asia","Consumption tax",0.10,"Postal code",r"^\d{3}-?\d{4}$",10,"name,postal,state,city,line1,line2","card,konbini,banktransfer,wallet"),
("KR","KOR","South Korea","KRW","82","Asia","East Asia","VAT",0.10,"Postal code",r"^\d{5}$",10,"name,postal,state,city,line1,line2","card,banktransfer,wallet"),
("TW","TWN","Taiwan","TWD","886","Asia","East Asia","VAT",0.05,"Postal code",r"^\d{3,5}$",9,"name,postal,city,line1","card,banktransfer,convenience"),
("HK","HKG","Hong Kong","HKD","852","Asia","East Asia","None",0.00,"",r"",8,"name,line1,line2,city","card,fps,wallet,banktransfer"),
("MO","MAC","Macau","MOP","853","Asia","East Asia","None",0.00,"",r"",8,"name,line1,line2","card,banktransfer"),
("MN","MNG","Mongolia","MNT","976","Asia","East Asia","VAT",0.10,"Postal code",r"^\d{5}$",8,"name,line1,city,postal","card,banktransfer"),
("KZ","KAZ","Kazakhstan","KZT","7","Asia","Central Asia","VAT",0.12,"Postal code",r"^\d{6}$",10,"name,line1,city,state,postal","card,banktransfer"),
("UZ","UZB","Uzbekistan","UZS","998","Asia","Central Asia","VAT",0.12,"Postal code",r"^\d{6}$",9,"name,line1,city,postal","card,banktransfer"),
("AE","ARE","United Arab Emirates","AED","971","Asia","Middle East","VAT",0.05,"",r"",9,"name,line1,line2,city,state","card,applepay,banktransfer,cod"),
("SA","SAU","Saudi Arabia","SAR","966","Asia","Middle East","VAT",0.15,"Postal code",r"^\d{5}$",9,"name,line1,line2,city,postal","card,mada,applepay,banktransfer,cod"),
("QA","QAT","Qatar","QAR","974","Asia","Middle East","VAT",0.00,"",r"",8,"name,line1,city","card,banktransfer,cod"),
("KW","KWT","Kuwait","KWD","965","Asia","Middle East","None",0.00,"Postal code",r"^\d{5}$",8,"name,line1,city,postal","card,knet,banktransfer,cod"),
("BH","BHR","Bahrain","BHD","973","Asia","Middle East","VAT",0.10,"",r"^\d{3,4}$",8,"name,line1,city","card,benefit,banktransfer"),
("OM","OMN","Oman","OMR","968","Asia","Middle East","VAT",0.05,"Postal code",r"^\d{3}$",8,"name,line1,city,postal","card,banktransfer,cod"),
("JO","JOR","Jordan","JOD","962","Asia","Middle East","GST",0.16,"Postal code",r"^\d{5}$",9,"name,line1,city,postal","card,banktransfer,cod"),
("IL","ISR","Israel","ILS","972","Asia","Middle East","VAT",0.17,"Postal code",r"^\d{5,7}$",9,"name,line1,city,postal","card,bit,banktransfer"),
("TR","TUR","Turkey","TRY","90","Asia","Middle East","KDV",0.20,"Posta kodu",r"^\d{5}$",10,"name,line1,line2,city,state,postal","card,banktransfer,wallet,cod"),
("IQ","IRQ","Iraq","IQD","964","Asia","Middle East","Sales tax",0.00,"Postal code",r"^\d{5}$",10,"name,line1,city,postal","banktransfer,cod"),
("LB","LBN","Lebanon","LBP","961","Asia","Middle East","VAT",0.11,"Postal code",r"^\d{4}\s?\d{4}$",8,"name,line1,city,postal","card,banktransfer,cod"),
("DE","DEU","Germany","EUR","49","Europe","Western Europe","MwSt",0.19,"PLZ",r"^\d{5}$",11,"name,line1,line2,postal,city","card,sepa,paypal,klarna,sofort"),
("FR","FRA","France","EUR","33","Europe","Western Europe","TVA",0.20,"Code postal",r"^\d{5}$",9,"name,line1,line2,postal,city","card,sepa,paypal,banktransfer"),
("IT","ITA","Italy","EUR","39","Europe","Southern Europe","IVA",0.22,"CAP",r"^\d{5}$",10,"name,line1,line2,postal,city,state","card,sepa,paypal,banktransfer"),
("ES","ESP","Spain","EUR","34","Europe","Southern Europe","IVA",0.21,"Código postal",r"^\d{5}$",9,"name,line1,line2,postal,city,state","card,sepa,paypal,bizum"),
("NL","NLD","Netherlands","EUR","31","Europe","Western Europe","BTW",0.21,"Postcode",r"^\d{4}\s?[A-Z]{2}$",9,"name,line1,line2,postal,city","ideal,card,sepa,paypal"),
("BE","BEL","Belgium","EUR","32","Europe","Western Europe","BTW",0.21,"Code postal",r"^\d{4}$",9,"name,line1,postal,city","card,bancontact,sepa,paypal"),
("AT","AUT","Austria","EUR","43","Europe","Western Europe","USt",0.20,"PLZ",r"^\d{4}$",10,"name,line1,postal,city","card,sepa,eps,klarna"),
("PT","PRT","Portugal","EUR","351","Europe","Southern Europe","IVA",0.23,"Código postal",r"^\d{4}-\d{3}$",9,"name,line1,postal,city","card,multibanco,mbway,sepa"),
("IE","IRL","Ireland","EUR","353","Europe","Western Europe","VAT",0.23,"Eircode",r"^[A-Z]\d{2}\s?[A-Z0-9]{4}$",9,"name,line1,line2,city,postal","card,sepa,paypal"),
("FI","FIN","Finland","EUR","358","Europe","Northern Europe","ALV",0.255,"Postinumero",r"^\d{5}$",9,"name,line1,postal,city","card,sepa,paypal,klarna"),
("GR","GRC","Greece","EUR","30","Europe","Southern Europe","FPA",0.24,"Postal code",r"^\d{5}$",10,"name,line1,postal,city","card,sepa,paypal,cod"),
("GB","GBR","United Kingdom","GBP","44","Europe","Northern Europe","VAT",0.20,"Postcode",r"^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$",10,"name,line1,line2,city,postal","card,paypal,klarna,banktransfer"),
("CH","CHE","Switzerland","CHF","41","Europe","Western Europe","MwSt",0.081,"PLZ",r"^\d{4}$",9,"name,line1,postal,city","card,twint,sepa,paypal"),
("NO","NOR","Norway","NOK","47","Europe","Northern Europe","MVA",0.25,"Postnummer",r"^\d{4}$",8,"name,line1,postal,city","card,vipps,klarna,banktransfer"),
("SE","SWE","Sweden","SEK","46","Europe","Northern Europe","Moms",0.25,"Postnummer",r"^\d{3}\s?\d{2}$",9,"name,line1,postal,city","card,swish,klarna,banktransfer"),
("DK","DNK","Denmark","DKK","45","Europe","Northern Europe","Moms",0.25,"Postnummer",r"^\d{4}$",8,"name,line1,postal,city","card,mobilepay,klarna,banktransfer"),
("IS","ISL","Iceland","ISK","354","Europe","Northern Europe","VSK",0.24,"Postnúmer",r"^\d{3}$",7,"name,line1,postal,city","card,banktransfer"),
("PL","POL","Poland","PLN","48","Europe","Eastern Europe","VAT",0.23,"Kod pocztowy",r"^\d{2}-\d{3}$",9,"name,line1,postal,city","card,blik,przelewy24,banktransfer,cod"),
("CZ","CZE","Czechia","CZK","420","Europe","Eastern Europe","DPH",0.21,"PSČ",r"^\d{3}\s?\d{2}$",9,"name,line1,postal,city","card,banktransfer,cod"),
("HU","HUN","Hungary","HUF","36","Europe","Eastern Europe","AFA",0.27,"Irányítószám",r"^\d{4}$",9,"name,postal,city,line1","card,banktransfer,cod"),
("RO","ROU","Romania","RON","40","Europe","Eastern Europe","TVA",0.19,"Cod poștal",r"^\d{6}$",9,"name,line1,city,state,postal","card,banktransfer,cod"),
("BG","BGR","Bulgaria","BGN","359","Europe","Eastern Europe","DDS",0.20,"Пощенски код",r"^\d{4}$",9,"name,line1,city,postal","card,banktransfer,cod"),
("RS","SRB","Serbia","RSD","381","Europe","Eastern Europe","PDV",0.20,"Poštanski broj",r"^\d{5}$",9,"name,line1,postal,city","card,banktransfer,cod"),
("UA","UKR","Ukraine","UAH","380","Europe","Eastern Europe","PDV",0.20,"Поштовий індекс",r"^\d{5}$",9,"name,line1,city,state,postal","card,banktransfer,cod"),
("RU","RUS","Russia","RUB","7","Europe","Eastern Europe","NDS",0.20,"Почтовый индекс",r"^\d{6}$",10,"name,postal,state,city,line1","card,mir,sbp,banktransfer,cod"),
("BY","BLR","Belarus","BYN","375","Europe","Eastern Europe","PDV",0.20,"Postal code",r"^\d{6}$",9,"name,postal,city,line1","card,banktransfer,cod"),
("GE","GEO","Georgia","GEL","995","Europe","Eastern Europe","VAT",0.18,"Postal code",r"^\d{4}$",9,"name,line1,city,postal","card,banktransfer"),
("US","USA","United States","USD","1","Americas","North America","Sales tax",0.00,"ZIP code",r"^\d{5}(-\d{4})?$",10,"name,line1,line2,city,state,postal","card,applepay,googlepay,paypal,klarna,banktransfer"),
("CA","CAN","Canada","CAD","1","Americas","North America","GST/HST",0.05,"Postal code",r"^[A-Z]\d[A-Z]\s?\d[A-Z]\d$",10,"name,line1,line2,city,state,postal","card,interac,paypal,applepay"),
("MX","MEX","Mexico","MXN","52","Americas","North America","IVA",0.16,"Código postal",r"^\d{5}$",10,"name,line1,line2,city,state,postal","card,oxxo,spei,paypal,cod"),
("BR","BRA","Brazil","BRL","55","Americas","South America","ICMS",0.17,"CEP",r"^\d{5}-?\d{3}$",11,"name,line1,line2,city,state,postal","pix,card,boleto,banktransfer"),
("AR","ARG","Argentina","ARS","54","Americas","South America","IVA",0.21,"Código postal",r"^[A-Z]?\d{4}[A-Z]{0,3}$",10,"name,line1,city,state,postal","card,mercadopago,banktransfer,cod"),
("CL","CHL","Chile","CLP","56","Americas","South America","IVA",0.19,"Código postal",r"^\d{7}$",9,"name,line1,city,state,postal","card,webpay,banktransfer"),
("CO","COL","Colombia","COP","57","Americas","South America","IVA",0.19,"Código postal",r"^\d{6}$",10,"name,line1,city,state,postal","card,pse,nequi,banktransfer,cod"),
("PE","PER","Peru","PEN","51","Americas","South America","IGV",0.18,"Código postal",r"^\d{5}$",9,"name,line1,city,state,postal","card,yape,banktransfer,cod"),
("UY","URY","Uruguay","UYU","598","Americas","South America","IVA",0.22,"Código postal",r"^\d{5}$",8,"name,line1,city,postal","card,banktransfer"),
("EC","ECU","Ecuador","USD","593","Americas","South America","IVA",0.15,"Código postal",r"^\d{6}$",9,"name,line1,city,postal","card,banktransfer,cod"),
("ZA","ZAF","South Africa","ZAR","27","Africa","Southern Africa","VAT",0.15,"Postal code",r"^\d{4}$",9,"name,line1,line2,city,postal","card,eft,snapscan,banktransfer,cod"),
("NG","NGA","Nigeria","NGN","234","Africa","West Africa","VAT",0.075,"Postal code",r"^\d{6}$",10,"name,line1,line2,city,state,postal","card,banktransfer,ussd,cod"),
("EG","EGY","Egypt","EGP","20","Africa","North Africa","VAT",0.14,"Postal code",r"^\d{5}$",10,"name,line1,city,state,postal","card,fawry,banktransfer,cod"),
("KE","KEN","Kenya","KES","254","Africa","East Africa","VAT",0.16,"Postal code",r"^\d{5}$",9,"name,line1,city,postal","mpesa,card,banktransfer,cod"),
("GH","GHA","Ghana","GHS","233","Africa","West Africa","VAT",0.15,"Postal code",r"^[A-Z]{2}\d{3,4}$",9,"name,line1,city","momo,card,banktransfer,cod"),
("MA","MAR","Morocco","MAD","212","Africa","North Africa","TVA",0.20,"Code postal",r"^\d{5}$",9,"name,line1,city,postal","card,banktransfer,cod"),
("TZ","TZA","Tanzania","TZS","255","Africa","East Africa","VAT",0.18,"Postal code",r"^\d{5}$",9,"name,line1,city,postal","mpesa,card,banktransfer,cod"),
("UG","UGA","Uganda","UGX","256","Africa","East Africa","VAT",0.18,"Postal code",r"",9,"name,line1,city","momo,card,banktransfer,cod"),
("ET","ETH","Ethiopia","ETB","251","Africa","East Africa","VAT",0.15,"Postal code",r"^\d{4}$",9,"name,line1,city,postal","banktransfer,cod"),
("DZ","DZA","Algeria","DZD","213","Africa","North Africa","TVA",0.19,"Code postal",r"^\d{5}$",9,"name,line1,city,postal","banktransfer,cod"),
("TN","TUN","Tunisia","TND","216","Africa","North Africa","TVA",0.19,"Code postal",r"^\d{4}$",8,"name,line1,city,postal","card,banktransfer,cod"),
("AU","AUS","Australia","AUD","61","Oceania","Australasia","GST",0.10,"Postcode",r"^\d{4}$",9,"name,line1,line2,city,state,postal","card,payid,paypal,afterpay,banktransfer"),
("NZ","NZL","New Zealand","NZD","64","Oceania","Australasia","GST",0.15,"Postcode",r"^\d{4}$",9,"name,line1,line2,city,postal","card,paypal,afterpay,banktransfer"),
("FJ","FJI","Fiji","FJD","679","Oceania","Melanesia","VAT",0.15,"",r"",7,"name,line1,city","card,banktransfer"),
("PG","PNG","Papua New Guinea","PGK","675","Oceania","Melanesia","GST",0.10,"Postal code",r"^\d{3}$",8,"name,line1,city,postal","banktransfer,cod"),
]

iso2 = [x[0] for x in C]
assert len(iso2) == len(set(iso2)), "dup"

VALID_ADDR = {"name","line1","line2","city","state","postal"}
for row in C:
    toks = row[12].split(",")
    bad = [t for t in toks if t not in VALID_ADDR]
    assert not bad, "%s: bad address tokens %s" % (row[0], bad)
    assert "name" in toks and "line1" in toks, "%s: address missing name/line1" % row[0]

def esc(s): return s.replace("\\","\\\\").replace("'","\\'")

L = []
L.append('''/**
 * Country data — tax, payments, addresses and phone formats.
 *
 * Generated, because %d countries × nine fields is not something to hand-type.
 * Source of truth for anything that must change when a shopper is not in India.
 *
 * Why each field exists:
 *  - `taxRate` / `taxName`: the checkout showed "GST 18%%" to everyone. A German
 *    buyer pays 19%% MwSt and a Singaporean 9%% GST; quoting Indian GST to them is
 *    simply a wrong invoice.
 *  - `methods`: payment rails are intensely local. Offering UPI in Brazil or
 *    omitting PIX there loses the sale. These lists are the rails that actually
 *    operate in each market.
 *  - `addressOrder`: Japan writes postal code first and Britain writes it last.
 *    Rendering an Indian address form to a Japanese buyer looks broken.
 *  - `postalRegex`: validating a UK postcode with India's ^\\d{6}$ rejects every
 *    real address.
 */

''' % len(C))

L.append("export const COUNTRIES = {")
for i2,i3,name,cur,dial,reg,sub,tn,tr,pl,prx,pd,ao,meth in C:
    ms = ", ".join("'"+m+"'" for m in meth.split(","))
    ao_s = ", ".join("'"+a+"'" for a in ao.split(","))
    L.append("  %s: { iso2: '%s', iso3: '%s', name: '%s', currency: '%s', dial: '+%s', region: '%s', subregion: '%s', taxName: '%s', taxRate: %s, postalLabel: '%s', postalRegex: %s, phoneDigits: %d, addressOrder: [%s], methods: [%s] },"
      % (i2,i2,i3,esc(name),cur,dial,reg,sub,esc(tn),tr,esc(pl),
         ("/"+prx+"/") if prx else "null", pd, ao_s, ms))
L.append("}\n")

L.append('''export const COUNTRY_CODES = Object.keys(COUNTRIES)
export const COUNTRY_LIST = Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name))
export const GEO_REGIONS = [...new Set(COUNTRY_LIST.map(c => c.region))]
export const GEO_SUBREGIONS = [...new Set(COUNTRY_LIST.map(c => c.subregion))]

/** Look up by ISO-2, ISO-3 or full name. Returns null rather than guessing. */
export function getCountry(key) {
  if (!key) return null
  const k = String(key).trim().toUpperCase()
  if (COUNTRIES[k]) return COUNTRIES[k]
  const byIso3 = COUNTRY_LIST.find(c => c.iso3 === k)
  if (byIso3) return byIso3
  const lower = String(key).trim().toLowerCase()
  return COUNTRY_LIST.find(c => c.name.toLowerCase() === lower) || null
}

export function countriesByRegion() {
  const out = {}
  for (const c of COUNTRY_LIST) (out[c.region] = out[c.region] || []).push(c)
  return out
}

/** Every country that settles in a given currency. */
export function countriesUsingCurrency(code) {
  const want = String(code || '').toUpperCase()
  return COUNTRY_LIST.filter(c => c.currency === want)
}

/**
 * Validate a postal code for a country.
 * Countries with no postal system (HK, MO, some Gulf states) accept anything,
 * including blank — rejecting an empty field there would block real checkouts.
 */
export function validatePostal(countryKey, value) {
  const country = getCountry(countryKey)
  if (!country) return { ok: false, reason: 'Unknown country' }
  if (!country.postalRegex) return { ok: true, optional: true }
  const v = String(value || '').trim().toUpperCase()
  if (!v) return { ok: false, reason: `${country.postalLabel} is required` }
  return country.postalRegex.test(v)
    ? { ok: true }
    : { ok: false, reason: `That does not look like a ${country.name} ${country.postalLabel.toLowerCase()}` }
}

/** Validate a national phone number by digit count, ignoring formatting. */
export function validatePhone(countryKey, value) {
  const country = getCountry(countryKey)
  if (!country) return { ok: false, reason: 'Unknown country' }
  const digits = String(value || '').replace(/\\D/g, '')
  if (!digits) return { ok: false, reason: 'Phone is required' }
  const local = digits.startsWith(country.dial.slice(1))
    ? digits.slice(country.dial.length - 1)
    : digits
  return local.length === country.phoneDigits
    ? { ok: true, e164: country.dial + local }
    : { ok: false, reason: `Needs ${country.phoneDigits} digits` }
}

/** Consumption tax for a country, as a rate and a label. */
export function taxFor(countryKey) {
  const country = getCountry(countryKey)
  if (!country) return { rate: 0, name: 'Tax', known: false }
  return { rate: country.taxRate, name: country.taxName, known: true }
}

/** Payment rails available in a country, intersected with what the store enables. */
export function methodsFor(countryKey, enabled = null) {
  const country = getCountry(countryKey)
  if (!country) return []
  if (!enabled) return [...country.methods]
  const allow = new Set(enabled)
  return country.methods.filter(m => allow.has(m))
}

/** Does this country support cash on delivery at all? */
export function supportsCod(countryKey) {
  return Boolean(getCountry(countryKey)?.methods.includes('cod'))
}

/** Address field order for a country, so the form matches local convention. */
export function addressFieldsFor(countryKey) {
  const country = getCountry(countryKey)
  return country ? [...country.addressOrder] : ['name', 'line1', 'city', 'postal']
}

/** Free-text country search across name, ISO codes and dial code. */
export function searchCountries(query, limit = 30) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return COUNTRY_LIST.slice(0, limit)
  const scored = []
  for (const c of COUNTRY_LIST) {
    const name = c.name.toLowerCase()
    let score = 0
    if (c.iso2.toLowerCase() === q || c.iso3.toLowerCase() === q) score = 100
    else if (name === q) score = 95
    else if (name.startsWith(q)) score = 85
    else if (name.includes(q)) score = 60
    else if (c.dial.includes(q)) score = 40
    else if (c.currency.toLowerCase() === q) score = 50
    if (score) scored.push({ c, score })
  }
  return scored.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
    .slice(0, limit).map(x => x.c)
}

export default COUNTRIES
''')
open('src/geo/countries.js','w',encoding='utf-8').write("\n".join(L))
print("countries:", len(C))
