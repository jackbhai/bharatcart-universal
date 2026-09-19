# -*- coding: utf-8 -*-
"""
Generate the full ISO 4217 currency table.

Columns: code, numeric, symbol, name, decimals, locale, flag, region,
         countries[], rate (units per 1 USD -> converted to per 1 INR)

Rates are units-per-USD from a 2026-09 snapshot; the generator converts them to
units-per-INR because the whole app prices in INR.
"""
INR_PER_USD = 83.47  # 1 USD = 83.47 INR; INR rate then divides to exactly 1

# (code, numeric, symbol, name, decimals, locale, flag, region, usd_rate, [countries])
C = [
# ---------------------------------------------------------------- South Asia
("INR","356","₹","Indian Rupee",2,"en-IN","🇮🇳","South Asia",83.47,["India","Bhutan"]),
("PKR","586","₨","Pakistani Rupee",2,"ur-PK","🇵🇰","South Asia",278.50,["Pakistan"]),
("BDT","050","৳","Bangladeshi Taka",2,"bn-BD","🇧🇩","South Asia",119.80,["Bangladesh"]),
("LKR","144","Rs","Sri Lankan Rupee",2,"si-LK","🇱🇰","South Asia",296.40,["Sri Lanka"]),
("NPR","524","रू","Nepalese Rupee",2,"ne-NP","🇳🇵","South Asia",133.55,["Nepal"]),
("BTN","064","Nu.","Bhutanese Ngultrum",2,"dz-BT","🇧🇹","South Asia",83.47,["Bhutan"]),
("MVR","462","ރ.","Maldivian Rufiyaa",2,"dv-MV","🇲🇻","South Asia",15.42,["Maldives"]),
("AFN","971","؋","Afghan Afghani",2,"fa-AF","🇦🇫","South Asia",68.90,["Afghanistan"]),
# ------------------------------------------------------------- Southeast Asia
("MMK","104","K","Myanmar Kyat",2,"my-MM","🇲🇲","Southeast Asia",2100.00,["Myanmar"]),
("THB","764","฿","Thai Baht",2,"th-TH","🇹🇭","Southeast Asia",34.20,["Thailand"]),
("VND","704","₫","Vietnamese Dong",0,"vi-VN","🇻🇳","Southeast Asia",25380.0,["Vietnam"]),
("IDR","360","Rp","Indonesian Rupiah",2,"id-ID","🇮🇩","Southeast Asia",16250.0,["Indonesia"]),
("MYR","458","RM","Malaysian Ringgit",2,"ms-MY","🇲🇾","Southeast Asia",4.42,["Malaysia"]),
("SGD","702","S$","Singapore Dollar",2,"en-SG","🇸🇬","Southeast Asia",1.31,["Singapore"]),
("PHP","608","₱","Philippine Peso",2,"en-PH","🇵🇭","Southeast Asia",58.10,["Philippines"]),
("KHR","116","៛","Cambodian Riel",2,"km-KH","🇰🇭","Southeast Asia",4080.0,["Cambodia"]),
("LAK","418","₭","Lao Kip",2,"lo-LA","🇱🇦","Southeast Asia",21900.0,["Laos"]),
("BND","096","B$","Brunei Dollar",2,"ms-BN","🇧🇳","Southeast Asia",1.31,["Brunei"]),
("TLS","000","US$","Timorese (uses USD)",2,"pt-TL","🇹🇱","Southeast Asia",1.00,["Timor-Leste"]),
# ------------------------------------------------------------------ East Asia
("CNY","156","¥","Chinese Yuan Renminbi",2,"zh-CN","🇨🇳","East Asia",7.12,["China"]),
("JPY","392","¥","Japanese Yen",0,"ja-JP","🇯🇵","East Asia",148.70,["Japan"]),
("KRW","410","₩","South Korean Won",0,"ko-KR","🇰🇷","East Asia",1345.0,["South Korea"]),
("KPW","408","₩","North Korean Won",2,"ko-KP","🇰🇵","East Asia",900.00,["North Korea"]),
("TWD","901","NT$","New Taiwan Dollar",2,"zh-TW","🇹🇼","East Asia",31.90,["Taiwan"]),
("HKD","344","HK$","Hong Kong Dollar",2,"zh-HK","🇭🇰","East Asia",7.79,["Hong Kong"]),
("MOP","446","MOP$","Macanese Pataca",2,"zh-MO","🇲🇴","East Asia",8.02,["Macau"]),
("MNT","496","₮","Mongolian Tugrik",2,"mn-MN","🇲🇳","East Asia",3400.0,["Mongolia"]),
# ---------------------------------------------------------------- Central Asia
("KZT","398","₸","Kazakhstani Tenge",2,"kk-KZ","🇰🇿","Central Asia",478.00,["Kazakhstan"]),
("UZS","860","so'm","Uzbekistani Som",2,"uz-UZ","🇺🇿","Central Asia",12700.0,["Uzbekistan"]),
("KGS","417","с","Kyrgyzstani Som",2,"ky-KG","🇰🇬","Central Asia",85.20,["Kyrgyzstan"]),
("TJS","972","SM","Tajikistani Somoni",2,"tg-TJ","🇹🇯","Central Asia",10.65,["Tajikistan"]),
("TMT","934","m","Turkmenistani Manat",2,"tk-TM","🇹🇲","Central Asia",3.50,["Turkmenistan"]),
# ---------------------------------------------------------------- Middle East
("AED","784","د.إ","UAE Dirham",2,"ar-AE","🇦🇪","Middle East",3.6725,["United Arab Emirates"]),
("SAR","682","﷼","Saudi Riyal",2,"ar-SA","🇸🇦","Middle East",3.75,["Saudi Arabia"]),
("QAR","634","﷼","Qatari Riyal",2,"ar-QA","🇶🇦","Middle East",3.64,["Qatar"]),
("KWD","414","د.ك","Kuwaiti Dinar",3,"ar-KW","🇰🇼","Middle East",0.3065,["Kuwait"]),
("BHD","048","ب.د","Bahraini Dinar",3,"ar-BH","🇧🇭","Middle East",0.376,["Bahrain"]),
("OMR","512","﷼","Omani Rial",3,"ar-OM","🇴🇲","Middle East",0.3845,["Oman"]),
("JOD","400","د.ا","Jordanian Dinar",3,"ar-JO","🇯🇴","Middle East",0.709,["Jordan"]),
("ILS","376","₪","Israeli New Shekel",2,"he-IL","🇮🇱","Middle East",3.72,["Israel"]),
("LBP","422","ل.ل","Lebanese Pound",2,"ar-LB","🇱🇧","Middle East",89500.0,["Lebanon"]),
("SYP","760","£S","Syrian Pound",2,"ar-SY","🇸🇾","Middle East",13000.0,["Syria"]),
("IQD","368","ع.د","Iraqi Dinar",3,"ar-IQ","🇮🇶","Middle East",1310.0,["Iraq"]),
("IRR","364","﷼","Iranian Rial",2,"fa-IR","🇮🇷","Middle East",42000.0,["Iran"]),
("YER","886","﷼","Yemeni Rial",2,"ar-YE","🇾🇪","Middle East",250.00,["Yemen"]),
("TRY","949","₺","Turkish Lira",2,"tr-TR","🇹🇷","Middle East",34.15,["Turkey"]),
# -------------------------------------------------------------- Europe (euro)
("EUR","978","€","Euro",2,"de-DE","🇪🇺","Europe",0.9215,["Germany","France","Italy","Spain","Netherlands","Belgium","Austria","Portugal","Ireland","Finland","Greece","Slovakia","Slovenia","Estonia","Latvia","Lithuania","Luxembourg","Cyprus","Malta","Croatia"]),
("GBP","826","£","Pound Sterling",2,"en-GB","🇬🇧","Europe",0.7745,["United Kingdom"]),
("CHF","756","CHF","Swiss Franc",2,"de-CH","🇨🇭","Europe",0.8620,["Switzerland","Liechtenstein"]),
("NOK","578","kr","Norwegian Krone",2,"nb-NO","🇳🇴","Europe",10.72,["Norway"]),
("SEK","752","kr","Swedish Krona",2,"sv-SE","🇸🇪","Europe",10.48,["Sweden"]),
("DKK","208","kr","Danish Krone",2,"da-DK","🇩🇰","Europe",6.87,["Denmark","Greenland","Faroe Islands"]),
("ISK","352","kr","Icelandic Krona",0,"is-IS","🇮🇸","Europe",137.50,["Iceland"]),
("PLN","985","zł","Polish Zloty",2,"pl-PL","🇵🇱","Europe",3.94,["Poland"]),
("CZK","203","Kč","Czech Koruna",2,"cs-CZ","🇨🇿","Europe",23.15,["Czechia"]),
("HUF","348","Ft","Hungarian Forint",2,"hu-HU","🇭🇺","Europe",366.00,["Hungary"]),
("RON","946","lei","Romanian Leu",2,"ro-RO","🇷🇴","Europe",4.585,["Romania"]),
("BGN","975","лв","Bulgarian Lev",2,"bg-BG","🇧🇬","Europe",1.8025,["Bulgaria"]),
("RSD","941","дин","Serbian Dinar",2,"sr-RS","🇷🇸","Europe",107.90,["Serbia"]),
("MKD","807","ден","Macedonian Denar",2,"mk-MK","🇲🇰","Europe",56.70,["North Macedonia"]),
("ALL","008","L","Albanian Lek",2,"sq-AL","🇦🇱","Europe",89.50,["Albania"]),
("BAM","977","KM","Bosnia-Herzegovina Mark",2,"bs-BA","🇧🇦","Europe",1.8025,["Bosnia and Herzegovina"]),
("MDL","498","L","Moldovan Leu",2,"ro-MD","🇲🇩","Europe",17.70,["Moldova"]),
("UAH","980","₴","Ukrainian Hryvnia",2,"uk-UA","🇺🇦","Europe",41.30,["Ukraine"]),
("BYN","933","Br","Belarusian Ruble",2,"be-BY","🇧🇾","Europe",3.27,["Belarus"]),
("RUB","643","₽","Russian Ruble",2,"ru-RU","🇷🇺","Europe",89.60,["Russia"]),
("GEL","981","₾","Georgian Lari",2,"ka-GE","🇬🇪","Europe",2.71,["Georgia"]),
("AMD","051","֏","Armenian Dram",2,"hy-AM","🇦🇲","Europe",387.00,["Armenia"]),
("AZN","944","₼","Azerbaijani Manat",2,"az-AZ","🇦🇿","Europe",1.70,["Azerbaijan"]),
("GIP","292","£","Gibraltar Pound",2,"en-GI","🇬🇮","Europe",0.7745,["Gibraltar"]),
# ---------------------------------------------------------------- Americas
("USD","840","$","US Dollar",2,"en-US","🇺🇸","Americas",1.00,["United States","Ecuador","El Salvador","Panama","Puerto Rico","Timor-Leste","Zimbabwe"]),
("CAD","124","C$","Canadian Dollar",2,"en-CA","🇨🇦","Americas",1.355,["Canada"]),
("MXN","484","Mex$","Mexican Peso",2,"es-MX","🇲🇽","Americas",19.65,["Mexico"]),
("BRL","986","R$","Brazilian Real",2,"pt-BR","🇧🇷","Americas",5.42,["Brazil"]),
("ARS","032","$","Argentine Peso",2,"es-AR","🇦🇷","Americas",965.00,["Argentina"]),
("CLP","152","$","Chilean Peso",0,"es-CL","🇨🇱","Americas",935.00,["Chile"]),
("COP","170","$","Colombian Peso",2,"es-CO","🇨🇴","Americas",4180.0,["Colombia"]),
("PEN","604","S/","Peruvian Sol",2,"es-PE","🇵🇪","Americas",3.75,["Peru"]),
("UYU","858","$U","Uruguayan Peso",2,"es-UY","🇺🇾","Americas",40.50,["Uruguay"]),
("PYG","600","₲","Paraguayan Guarani",0,"es-PY","🇵🇾","Americas",7700.0,["Paraguay"]),
("BOB","068","Bs.","Bolivian Boliviano",2,"es-BO","🇧🇴","Americas",6.91,["Bolivia"]),
("VES","928","Bs.","Venezuelan Bolivar",2,"es-VE","🇻🇪","Americas",40.00,["Venezuela"]),
("GYD","328","G$","Guyanese Dollar",2,"en-GY","🇬🇾","Americas",209.00,["Guyana"]),
("SRD","968","$","Surinamese Dollar",2,"nl-SR","🇸🇷","Americas",28.50,["Suriname"]),
("CRC","188","₡","Costa Rican Colon",2,"es-CR","🇨🇷","Americas",520.00,["Costa Rica"]),
("GTQ","320","Q","Guatemalan Quetzal",2,"es-GT","🇬🇹","Americas",7.72,["Guatemala"]),
("HNL","340","L","Honduran Lempira",2,"es-HN","🇭🇳","Americas",24.85,["Honduras"]),
("NIO","558","C$","Nicaraguan Cordoba",2,"es-NI","🇳🇮","Americas",36.80,["Nicaragua"]),
("PAB","590","B/.","Panamanian Balboa",2,"es-PA","🇵🇦","Americas",1.00,["Panama"]),
("DOP","214","RD$","Dominican Peso",2,"es-DO","🇩🇴","Americas",60.20,["Dominican Republic"]),
("CUP","192","$","Cuban Peso",2,"es-CU","🇨🇺","Americas",24.00,["Cuba"]),
("HTG","332","G","Haitian Gourde",2,"fr-HT","🇭🇹","Americas",131.50,["Haiti"]),
("JMD","388","J$","Jamaican Dollar",2,"en-JM","🇯🇲","Americas",157.00,["Jamaica"]),
("TTD","780","TT$","Trinidad & Tobago Dollar",2,"en-TT","🇹🇹","Americas",6.78,["Trinidad and Tobago"]),
("BBD","052","Bds$","Barbadian Dollar",2,"en-BB","🇧🇧","Americas",2.00,["Barbados"]),
("BSD","044","B$","Bahamian Dollar",2,"en-BS","🇧🇸","Americas",1.00,["Bahamas"]),
("BZD","084","BZ$","Belize Dollar",2,"en-BZ","🇧🇿","Americas",2.01,["Belize"]),
("XCD","951","EC$","East Caribbean Dollar",2,"en-AG","🇦🇬","Americas",2.70,["Antigua and Barbuda","Dominica","Grenada","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Anguilla","Montserrat"]),
("KYD","136","CI$","Cayman Islands Dollar",2,"en-KY","🇰🇾","Americas",0.833,["Cayman Islands"]),
("BMD","060","BD$","Bermudian Dollar",2,"en-BM","🇧🇲","Americas",1.00,["Bermuda"]),
("AWG","533","ƒ","Aruban Florin",2,"nl-AW","🇦🇼","Americas",1.79,["Aruba"]),
("ANG","532","ƒ","Netherlands Antillean Guilder",2,"nl-CW","🇨🇼","Americas",1.79,["Curaçao","Sint Maarten"]),
("XPF","953","₣","CFP Franc",0,"fr-PF","🇵🇫","Oceania",110.00,["French Polynesia","New Caledonia","Wallis and Futuna"]),
# ------------------------------------------------------------------- Oceania
("AUD","036","A$","Australian Dollar",2,"en-AU","🇦🇺","Oceania",1.485,["Australia","Kiribati","Nauru","Tuvalu"]),
("NZD","554","NZ$","New Zealand Dollar",2,"en-NZ","🇳🇿","Oceania",1.625,["New Zealand","Cook Islands","Niue","Tokelau"]),
("FJD","242","FJ$","Fijian Dollar",2,"en-FJ","🇫🇯","Oceania",2.24,["Fiji"]),
("PGK","598","K","Papua New Guinean Kina",2,"en-PG","🇵🇬","Oceania",3.92,["Papua New Guinea"]),
("SBD","090","SI$","Solomon Islands Dollar",2,"en-SB","🇸🇧","Oceania",8.45,["Solomon Islands"]),
("VUV","548","VT","Vanuatu Vatu",0,"bi-VU","🇻🇺","Oceania",119.00,["Vanuatu"]),
("WST","882","T","Samoan Tala",2,"sm-WS","🇼🇸","Oceania",2.74,["Samoa"]),
("TOP","776","T$","Tongan Paanga",2,"to-TO","🇹🇴","Oceania",2.36,["Tonga"]),
# -------------------------------------------------------------------- Africa
("ZAR","710","R","South African Rand",2,"en-ZA","🇿🇦","Africa",17.65,["South Africa","Lesotho","Namibia","Eswatini"]),
("NGN","566","₦","Nigerian Naira",2,"en-NG","🇳🇬","Africa",1580.0,["Nigeria"]),
("EGP","818","£","Egyptian Pound",2,"ar-EG","🇪🇬","Africa",48.60,["Egypt"]),
("KES","404","KSh","Kenyan Shilling",2,"sw-KE","🇰🇪","Africa",129.00,["Kenya"]),
("GHS","936","₵","Ghanaian Cedi",2,"en-GH","🇬🇭","Africa",15.75,["Ghana"]),
("MAD","504","د.م.","Moroccan Dirham",2,"ar-MA","🇲🇦","Africa",9.78,["Morocco","Western Sahara"]),
("TZS","834","TSh","Tanzanian Shilling",2,"sw-TZ","🇹🇿","Africa",2720.0,["Tanzania"]),
("UGX","800","USh","Ugandan Shilling",0,"en-UG","🇺🇬","Africa",3700.0,["Uganda"]),
("ETB","230","Br","Ethiopian Birr",2,"am-ET","🇪🇹","Africa",118.00,["Ethiopia"]),
("DZD","012","د.ج","Algerian Dinar",2,"ar-DZ","🇩🇿","Africa",133.50,["Algeria"]),
("TND","788","د.ت","Tunisian Dinar",3,"ar-TN","🇹🇳","Africa",3.09,["Tunisia"]),
("LYD","434","ل.د","Libyan Dinar",3,"ar-LY","🇱🇾","Africa",4.83,["Libya"]),
("SDG","938","ج.س.","Sudanese Pound",2,"ar-SD","🇸🇩","Africa",601.00,["Sudan"]),
("SSP","728","£","South Sudanese Pound",2,"en-SS","🇸🇸","Africa",2800.0,["South Sudan"]),
("ZMW","967","ZK","Zambian Kwacha",2,"en-ZM","🇿🇲","Africa",26.40,["Zambia"]),
("ZWG","924","ZiG","Zimbabwe Gold",2,"en-ZW","🇿🇼","Africa",13.50,["Zimbabwe"]),
("MWK","454","MK","Malawian Kwacha",2,"en-MW","🇲🇼","Africa",1735.0,["Malawi"]),
("MZN","943","MT","Mozambican Metical",2,"pt-MZ","🇲🇿","Africa",63.90,["Mozambique"]),
("AOA","973","Kz","Angolan Kwanza",2,"pt-AO","🇦🇴","Africa",915.00,["Angola"]),
("BWP","072","P","Botswana Pula",2,"en-BW","🇧🇼","Africa",13.35,["Botswana"]),
("NAD","516","N$","Namibian Dollar",2,"en-NA","🇳🇦","Africa",17.65,["Namibia"]),
("LSL","426","L","Lesotho Loti",2,"en-LS","🇱🇸","Africa",17.65,["Lesotho"]),
("SZL","748","E","Eswatini Lilangeni",2,"en-SZ","🇸🇿","Africa",17.65,["Eswatini"]),
("MUR","480","₨","Mauritian Rupee",2,"en-MU","🇲🇺","Africa",46.20,["Mauritius"]),
("SCR","690","₨","Seychellois Rupee",2,"en-SC","🇸🇨","Africa",13.60,["Seychelles"]),
("MGA","969","Ar","Malagasy Ariary",2,"mg-MG","🇲🇬","Africa",4560.0,["Madagascar"]),
("KMF","174","CF","Comorian Franc",0,"fr-KM","🇰🇲","Africa",453.00,["Comoros"]),
("DJF","262","Fdj","Djiboutian Franc",0,"fr-DJ","🇩🇯","Africa",177.70,["Djibouti"]),
("SOS","706","Sh","Somali Shilling",2,"so-SO","🇸🇴","Africa",571.00,["Somalia"]),
("ERN","232","Nfk","Eritrean Nakfa",2,"ti-ER","🇪🇷","Africa",15.00,["Eritrea"]),
("RWF","646","FRw","Rwandan Franc",0,"rw-RW","🇷🇼","Africa",1345.0,["Rwanda"]),
("BIF","108","FBu","Burundian Franc",0,"fr-BI","🇧🇮","Africa",2915.0,["Burundi"]),
("CDF","976","FC","Congolese Franc",2,"fr-CD","🇨🇩","Africa",2850.0,["DR Congo"]),
("XAF","950","FCFA","Central African CFA Franc",0,"fr-CM","🇨🇲","Africa",604.50,["Cameroon","Central African Republic","Chad","Republic of the Congo","Equatorial Guinea","Gabon"]),
("XOF","952","CFA","West African CFA Franc",0,"fr-SN","🇸🇳","Africa",604.50,["Benin","Burkina Faso","Ivory Coast","Guinea-Bissau","Mali","Niger","Senegal","Togo"]),
("GNF","324","FG","Guinean Franc",0,"fr-GN","🇬🇳","Africa",8630.0,["Guinea"]),
("GMD","270","D","Gambian Dalasi",2,"en-GM","🇬🇲","Africa",70.50,["Gambia"]),
("SLE","925","Le","Sierra Leonean Leone",2,"en-SL","🇸🇱","Africa",22.60,["Sierra Leone"]),
("LRD","430","L$","Liberian Dollar",2,"en-LR","🇱🇷","Africa",193.00,["Liberia"]),
("CVE","132","$","Cape Verdean Escudo",2,"pt-CV","🇨🇻","Africa",101.60,["Cape Verde"]),
("STN","930","Db","Sao Tome & Principe Dobra",2,"pt-ST","🇸🇹","Africa",22.60,["Sao Tome and Principe"]),
("MRU","929","UM","Mauritanian Ouguiya",2,"ar-MR","🇲🇷","Africa",39.80,["Mauritania"]),
("SHP","654","£","Saint Helena Pound",2,"en-SH","🇸🇭","Africa",0.7745,["Saint Helena"]),
# ------------------------------------------------------------------ Metals
("XAU","959","Au","Gold (troy ounce)",2,"en-US","🥇","Metals",0.000385,["—"]),
("XAG","961","Ag","Silver (troy ounce)",2,"en-US","🥈","Metals",0.0323,["—"]),
("XDR","960","SDR","IMF Special Drawing Rights",2,"en-US","🏦","Metals",0.742,["IMF"]),
]

codes = [x[0] for x in C]
assert len(codes) == len(set(codes)), "duplicate code: " + str([c for c in codes if codes.count(c)>1])

regions = []
for x in C:
    if x[7] not in regions: regions.append(x[7])

def esc(s): return s.replace("\\", "\\\\").replace("'", "\\'")

lines = []
lines.append('''/**
 * Complete ISO 4217 currency table — every circulating national currency.
 *
 * Generated rather than hand-typed: %d currencies each need a code, numeric
 * code, symbol, correct minor-unit count, a locale for Intl grouping, a flag
 * and the list of countries that actually use it. Typing that by hand is how
 * you end up with JPY showing two decimals.
 *
 * `decimals` is the ISO 4217 minor unit and is NOT cosmetic — it decides how
 * many digits a price is rounded and stored to. Getting it wrong means a
 * Kuwaiti price silently loses a digit of precision, or a yen price invents
 * fractions of a yen that do not exist.
 *
 * `countries` matters because shoppers think in countries, not currency codes.
 * Someone in Yangon searches "Myanmar", not "MMK".
 */

''' % len(C))

lines.append("export const CURRENCIES = {")
for code,num,sym,name,dec,loc,flag,reg,rate,countries in C:
    cl = ", ".join("'" + esc(c) + "'" for c in countries)
    lines.append(
        "  %s: { code: '%s', numeric: '%s', symbol: '%s', name: '%s', decimals: %d, locale: '%s', flag: '%s', region: '%s', countries: [%s] },"
        % (code, code, num, esc(sym), esc(name), dec, loc, flag, reg, cl))
lines.append("}\n")

lines.append("export const CURRENCY_CODES = Object.keys(CURRENCIES)\n")
lines.append("export const CURRENCY_REGIONS = [%s]\n" % ", ".join("'"+r+"'" for r in regions))

lines.append('''/** Currencies bucketed by region, in the declared region order. */
export function currenciesByRegion() {
  const out = {}
  for (const region of CURRENCY_REGIONS) out[region] = []
  for (const c of Object.values(CURRENCIES)) {
    if (!out[c.region]) out[c.region] = []
    out[c.region].push(c)
  }
  return out
}

/** Every country name we know about, mapped to its currency code. */
export const COUNTRY_TO_CURRENCY = (() => {
  const out = {}
  for (const c of Object.values(CURRENCIES)) {
    for (const country of c.countries) {
      if (country === '\\u2014') continue
      // A country's own currency wins over a shared or foreign one. INR lists
      // Bhutan and USD lists Ecuador, but BTN is Bhutan's actual currency, so
      // prefer whichever entry covers the fewest countries.
      const existing = out[country]
      if (!existing || CURRENCIES[existing].countries.length > c.countries.length) {
        out[country] = c.code
      }
    }
  }
  return out
})()

export const COUNTRY_NAMES = Object.keys(COUNTRY_TO_CURRENCY).sort()

/** Resolve a currency for a country name, case- and spacing-insensitive. */
export function currencyForCountry(country) {
  if (!country) return null
  const want = String(country).trim().toLowerCase()
  for (const [name, code] of Object.entries(COUNTRY_TO_CURRENCY)) {
    if (name.toLowerCase() === want) return code
  }
  return null
}

/** Look up a currency, falling back to INR so a bad code never crashes a render. */
export function getCurrency(code) {
  return CURRENCIES[String(code || '').toUpperCase()] || CURRENCIES.INR
}

export function isSupported(code) {
  return Boolean(CURRENCIES[String(code || '').toUpperCase()])
}

/** Free-text search across code, name, country and region. */
export function searchCurrencies(query, limit = 40) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return Object.values(CURRENCIES).slice(0, limit)
  const scored = []
  for (const c of Object.values(CURRENCIES)) {
    let score = 0
    const code = c.code.toLowerCase()
    const name = c.name.toLowerCase()
    if (code === q) score = 100
    else if (code.startsWith(q)) score = 90
    else if (name.startsWith(q)) score = 80
    else if (name.includes(q)) score = 60
    else if (c.countries.some(x => x.toLowerCase().startsWith(q))) score = 70
    else if (c.countries.some(x => x.toLowerCase().includes(q))) score = 50
    else if (c.region.toLowerCase().includes(q)) score = 30
    if (score) scored.push({ c, score })
  }
  return scored.sort((a, b) => b.score - a.score || a.c.code.localeCompare(b.c.code))
    .slice(0, limit).map(x => x.c)
}

/** Currencies whose minor unit is not the usual 2 — the ones that break naive code. */
export const ZERO_DECIMAL_CURRENCIES = CURRENCY_CODES.filter(c => CURRENCIES[c].decimals === 0)
export const THREE_DECIMAL_CURRENCIES = CURRENCY_CODES.filter(c => CURRENCIES[c].decimals === 3)

export default CURRENCIES
''')

open('src/currency/currencies.js','w',encoding='utf-8').write("\n".join(lines))

# ---- rates.js : units per 1 INR
rl = []
rl.append('''/**
 * Exchange rates, expressed as units of the target currency per 1 INR.
 *
 * INR is the base because every engine in the app — pricing, tax, loyalty,
 * shipping — computes in rupees. Storing rates the other way round would mean
 * a division on every single price render.
 *
 * This is a dated static snapshot, not a live feed. Swap `fetchLiveRates` for a
 * real call when you want live numbers; the shape it returns is already what
 * the store expects.
 */

export const BASE_CURRENCY = 'INR'
export const RATES_UPDATED_AT = '2026-09-01'
export const RATES_SOURCE = 'static snapshot (USD mid-market, converted to INR base)'

export const RATES = {''')
for code,num,sym,name,dec,loc,flag,reg,usd,countries in C:
    per_inr = 1.0 if code == "INR" else usd / INR_PER_USD
    if per_inr >= 1000:   s = "%.2f" % per_inr
    elif per_inr >= 1:    s = "%.4f" % per_inr
    elif per_inr >= 0.01: s = "%.6f" % per_inr
    else:                 s = "%.8f" % per_inr
    s = s.rstrip('0').rstrip('.') if '.' in s else s
    rl.append("  %s: %s," % (code, s))
rl.append("}\n")

rl.append('''/**
 * Psychological rounding per currency.
 *
 *  - charm  : land on x.99 (most retail markets)
 *  - nearest: round to the nearest N whole units (currencies where the smallest
 *             practical note is large, so x.99 would be meaningless)
 *  - decimal: plain rounding to the given precision (Gulf 3-decimal currencies,
 *             where charm pricing is not a local convention)
 */
export const ROUNDING = {
  default: { mode: 'charm', to: 0.99 },
''')
nearest = {"JPY":10,"KRW":100,"VND":1000,"IDR":1000,"CLP":10,"ISK":10,"HUF":10,"PYG":1000,
           "UGX":100,"RWF":100,"BIF":100,"GNF":500,"LAK":1000,"MMK":100,"KHR":100,"UZS":500,
           "IRR":1000,"LBP":1000,"SYP":500,"COP":100,"CRC":100,"MGA":100,"SOS":100,"STN":10,
           "VUV":10,"XPF":10,"KMF":50,"DJF":10,"XAF":50,"XOF":50,"MNT":100,"KPW":10,"ARS":10,
           "AOA":10,"MWK":10,"SDG":10,"SSP":100,"CDF":100,"ZMW":1,"VES":1,"TZS":100,"KZT":10,
           "NGN":10,"ETB":1,"LRD":10,"AMD":10}
for k,v in nearest.items():
    rl.append("  %s: { mode: 'nearest', to: %d }," % (k, v))
for k in ["KWD","BHD","OMR","JOD","IQD","TND","LYD"]:
    rl.append("  %s: { mode: 'decimal', to: 0.001 }," % k)
rl.append("}\n")

rl.append('''/**
 * Rate for `code`, with an optional manual override map.
 * Returns null for an unknown code rather than 1, so callers fall back to
 * identity instead of silently pricing at a bogus 1:1.
 */
export function getRate(code, overrides = {}) {
  const c = String(code || '').toUpperCase()
  const override = overrides[c]
  if (typeof override === 'number' && override > 0) return override
  return RATES[c] ?? null
}

/** Rate between any two currencies, routed through the INR base. */
export function crossRate(from, to, overrides = {}) {
  const a = getRate(from, overrides)
  const b = getRate(to, overrides)
  if (!a || !b) return null
  return b / a
}

/**
 * Swap to a live feed by replacing the body of this function. All of these are
 * free at low volume and need no key: exchangerate.host, frankfurter.app,
 * open.er-api.com. Cache the response — rates move slowly, quotas do not.
 */
export async function fetchLiveRates() {
  return {
    ok: false,
    rates: RATES,
    updatedAt: RATES_UPDATED_AT,
    note: 'Using the bundled snapshot. Point fetchLiveRates() at exchangerate.host, frankfurter.app or open.er-api.com for live numbers.',
  }
}

export default RATES
''')
open('src/currency/rates.js','w',encoding='utf-8').write("\n".join(rl))
print("currencies:", len(C))
print("regions:", regions)
