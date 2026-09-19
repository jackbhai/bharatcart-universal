/**
 * Country data — tax, payments, addresses and phone formats.
 *
 * Generated, because 90 countries × nine fields is not something to hand-type.
 * Source of truth for anything that must change when a shopper is not in India.
 *
 * Why each field exists:
 *  - `taxRate` / `taxName`: the checkout showed "GST 18%" to everyone. A German
 *    buyer pays 19% MwSt and a Singaporean 9% GST; quoting Indian GST to them is
 *    simply a wrong invoice.
 *  - `methods`: payment rails are intensely local. Offering UPI in Brazil or
 *    omitting PIX there loses the sale. These lists are the rails that actually
 *    operate in each market.
 *  - `addressOrder`: Japan writes postal code first and Britain writes it last.
 *    Rendering an Indian address form to a Japanese buyer looks broken.
 *  - `postalRegex`: validating a UK postcode with India's ^\d{6}$ rejects every
 *    real address.
 */


export const COUNTRIES = {
  IN: { iso2: 'IN', iso3: 'IND', name: 'India', currency: 'INR', dial: '+91', region: 'Asia', subregion: 'South Asia', taxName: 'GST', taxRate: 0.18, postalLabel: 'PIN code', postalRegex: /^\d{6}$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'line2', 'city', 'state', 'postal'], methods: ['upi', 'card', 'netbanking', 'wallet', 'emi', 'cod'] },
  PK: { iso2: 'PK', iso3: 'PAK', name: 'Pakistan', currency: 'PKR', dial: '+92', region: 'Asia', subregion: 'South Asia', taxName: 'GST', taxRate: 0.18, postalLabel: 'Postal code', postalRegex: /^\d{5}$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'line2', 'city', 'state', 'postal'], methods: ['card', 'banktransfer', 'wallet', 'cod'] },
  BD: { iso2: 'BD', iso3: 'BGD', name: 'Bangladesh', currency: 'BDT', dial: '+880', region: 'Asia', subregion: 'South Asia', taxName: 'VAT', taxRate: 0.15, postalLabel: 'Post code', postalRegex: /^\d{4}$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'line2', 'city', 'postal'], methods: ['card', 'wallet', 'banktransfer', 'cod'] },
  LK: { iso2: 'LK', iso3: 'LKA', name: 'Sri Lanka', currency: 'LKR', dial: '+94', region: 'Asia', subregion: 'South Asia', taxName: 'VAT', taxRate: 0.18, postalLabel: 'Postal code', postalRegex: /^\d{5}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'line2', 'city', 'postal'], methods: ['card', 'banktransfer', 'cod'] },
  NP: { iso2: 'NP', iso3: 'NPL', name: 'Nepal', currency: 'NPR', dial: '+977', region: 'Asia', subregion: 'South Asia', taxName: 'VAT', taxRate: 0.13, postalLabel: 'Postal code', postalRegex: /^\d{5}$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'line2', 'city', 'postal'], methods: ['card', 'wallet', 'banktransfer', 'cod'] },
  BT: { iso2: 'BT', iso3: 'BTN', name: 'Bhutan', currency: 'BTN', dial: '+975', region: 'Asia', subregion: 'South Asia', taxName: 'Sales tax', taxRate: 0.07, postalLabel: 'Postal code', postalRegex: /^\d{5}$/, phoneDigits: 8, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['banktransfer', 'cod'] },
  MV: { iso2: 'MV', iso3: 'MDV', name: 'Maldives', currency: 'MVR', dial: '+960', region: 'Asia', subregion: 'South Asia', taxName: 'GST', taxRate: 0.08, postalLabel: 'Postal code', postalRegex: /^\d{5}$/, phoneDigits: 7, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['card', 'banktransfer'] },
  AF: { iso2: 'AF', iso3: 'AFG', name: 'Afghanistan', currency: 'AFN', dial: '+93', region: 'Asia', subregion: 'South Asia', taxName: 'BRT', taxRate: 0.04, postalLabel: 'Postal code', postalRegex: /^\d{4}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['banktransfer', 'cod'] },
  MM: { iso2: 'MM', iso3: 'MMR', name: 'Myanmar', currency: 'MMK', dial: '+95', region: 'Asia', subregion: 'Southeast Asia', taxName: 'Commercial tax', taxRate: 0.05, postalLabel: 'Postal code', postalRegex: /^\d{5}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'line2', 'city', 'state', 'postal'], methods: ['banktransfer', 'wallet', 'cod'] },
  TH: { iso2: 'TH', iso3: 'THA', name: 'Thailand', currency: 'THB', dial: '+66', region: 'Asia', subregion: 'Southeast Asia', taxName: 'VAT', taxRate: 0.07, postalLabel: 'Postal code', postalRegex: /^\d{5}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'line2', 'city', 'state', 'postal'], methods: ['card', 'promptpay', 'banktransfer', 'wallet', 'cod'] },
  VN: { iso2: 'VN', iso3: 'VNM', name: 'Vietnam', currency: 'VND', dial: '+84', region: 'Asia', subregion: 'Southeast Asia', taxName: 'VAT', taxRate: 0.1, postalLabel: 'Postal code', postalRegex: /^\d{6}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'line2', 'city', 'state', 'postal'], methods: ['card', 'banktransfer', 'wallet', 'cod'] },
  ID: { iso2: 'ID', iso3: 'IDN', name: 'Indonesia', currency: 'IDR', dial: '+62', region: 'Asia', subregion: 'Southeast Asia', taxName: 'PPN', taxRate: 0.11, postalLabel: 'Kode pos', postalRegex: /^\d{5}$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'line2', 'city', 'state', 'postal'], methods: ['card', 'banktransfer', 'wallet', 'qris', 'cod'] },
  MY: { iso2: 'MY', iso3: 'MYS', name: 'Malaysia', currency: 'MYR', dial: '+60', region: 'Asia', subregion: 'Southeast Asia', taxName: 'SST', taxRate: 0.06, postalLabel: 'Postcode', postalRegex: /^\d{5}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'line2', 'city', 'state', 'postal'], methods: ['card', 'fpx', 'banktransfer', 'wallet', 'cod'] },
  SG: { iso2: 'SG', iso3: 'SGP', name: 'Singapore', currency: 'SGD', dial: '+65', region: 'Asia', subregion: 'Southeast Asia', taxName: 'GST', taxRate: 0.09, postalLabel: 'Postal code', postalRegex: /^\d{6}$/, phoneDigits: 8, addressOrder: ['name', 'line1', 'line2', 'postal'], methods: ['card', 'paynow', 'banktransfer', 'wallet'] },
  PH: { iso2: 'PH', iso3: 'PHL', name: 'Philippines', currency: 'PHP', dial: '+63', region: 'Asia', subregion: 'Southeast Asia', taxName: 'VAT', taxRate: 0.12, postalLabel: 'ZIP code', postalRegex: /^\d{4}$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'line2', 'city', 'state', 'postal'], methods: ['card', 'gcash', 'banktransfer', 'wallet', 'cod'] },
  KH: { iso2: 'KH', iso3: 'KHM', name: 'Cambodia', currency: 'KHR', dial: '+855', region: 'Asia', subregion: 'Southeast Asia', taxName: 'VAT', taxRate: 0.1, postalLabel: 'Postal code', postalRegex: /^\d{5,6}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['card', 'banktransfer', 'wallet', 'cod'] },
  LA: { iso2: 'LA', iso3: 'LAO', name: 'Laos', currency: 'LAK', dial: '+856', region: 'Asia', subregion: 'Southeast Asia', taxName: 'VAT', taxRate: 0.1, postalLabel: 'Postal code', postalRegex: /^\d{5}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['banktransfer', 'cod'] },
  BN: { iso2: 'BN', iso3: 'BRN', name: 'Brunei', currency: 'BND', dial: '+673', region: 'Asia', subregion: 'Southeast Asia', taxName: 'None', taxRate: 0.0, postalLabel: 'Postal code', postalRegex: /^[A-Z]{2}\d{4}$/, phoneDigits: 7, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['card', 'banktransfer'] },
  CN: { iso2: 'CN', iso3: 'CHN', name: 'China', currency: 'CNY', dial: '+86', region: 'Asia', subregion: 'East Asia', taxName: 'VAT', taxRate: 0.13, postalLabel: 'Postal code', postalRegex: /^\d{6}$/, phoneDigits: 11, addressOrder: ['name', 'line1', 'line2', 'city', 'state', 'postal'], methods: ['alipay', 'wechat', 'card', 'banktransfer'] },
  JP: { iso2: 'JP', iso3: 'JPN', name: 'Japan', currency: 'JPY', dial: '+81', region: 'Asia', subregion: 'East Asia', taxName: 'Consumption tax', taxRate: 0.1, postalLabel: 'Postal code', postalRegex: /^\d{3}-?\d{4}$/, phoneDigits: 10, addressOrder: ['name', 'postal', 'state', 'city', 'line1', 'line2'], methods: ['card', 'konbini', 'banktransfer', 'wallet'] },
  KR: { iso2: 'KR', iso3: 'KOR', name: 'South Korea', currency: 'KRW', dial: '+82', region: 'Asia', subregion: 'East Asia', taxName: 'VAT', taxRate: 0.1, postalLabel: 'Postal code', postalRegex: /^\d{5}$/, phoneDigits: 10, addressOrder: ['name', 'postal', 'state', 'city', 'line1', 'line2'], methods: ['card', 'banktransfer', 'wallet'] },
  TW: { iso2: 'TW', iso3: 'TWN', name: 'Taiwan', currency: 'TWD', dial: '+886', region: 'Asia', subregion: 'East Asia', taxName: 'VAT', taxRate: 0.05, postalLabel: 'Postal code', postalRegex: /^\d{3,5}$/, phoneDigits: 9, addressOrder: ['name', 'postal', 'city', 'line1'], methods: ['card', 'banktransfer', 'convenience'] },
  HK: { iso2: 'HK', iso3: 'HKG', name: 'Hong Kong', currency: 'HKD', dial: '+852', region: 'Asia', subregion: 'East Asia', taxName: 'None', taxRate: 0.0, postalLabel: '', postalRegex: null, phoneDigits: 8, addressOrder: ['name', 'line1', 'line2', 'city'], methods: ['card', 'fps', 'wallet', 'banktransfer'] },
  MO: { iso2: 'MO', iso3: 'MAC', name: 'Macau', currency: 'MOP', dial: '+853', region: 'Asia', subregion: 'East Asia', taxName: 'None', taxRate: 0.0, postalLabel: '', postalRegex: null, phoneDigits: 8, addressOrder: ['name', 'line1', 'line2'], methods: ['card', 'banktransfer'] },
  MN: { iso2: 'MN', iso3: 'MNG', name: 'Mongolia', currency: 'MNT', dial: '+976', region: 'Asia', subregion: 'East Asia', taxName: 'VAT', taxRate: 0.1, postalLabel: 'Postal code', postalRegex: /^\d{5}$/, phoneDigits: 8, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['card', 'banktransfer'] },
  KZ: { iso2: 'KZ', iso3: 'KAZ', name: 'Kazakhstan', currency: 'KZT', dial: '+7', region: 'Asia', subregion: 'Central Asia', taxName: 'VAT', taxRate: 0.12, postalLabel: 'Postal code', postalRegex: /^\d{6}$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'city', 'state', 'postal'], methods: ['card', 'banktransfer'] },
  UZ: { iso2: 'UZ', iso3: 'UZB', name: 'Uzbekistan', currency: 'UZS', dial: '+998', region: 'Asia', subregion: 'Central Asia', taxName: 'VAT', taxRate: 0.12, postalLabel: 'Postal code', postalRegex: /^\d{6}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['card', 'banktransfer'] },
  AE: { iso2: 'AE', iso3: 'ARE', name: 'United Arab Emirates', currency: 'AED', dial: '+971', region: 'Asia', subregion: 'Middle East', taxName: 'VAT', taxRate: 0.05, postalLabel: '', postalRegex: null, phoneDigits: 9, addressOrder: ['name', 'line1', 'line2', 'city', 'state'], methods: ['card', 'applepay', 'banktransfer', 'cod'] },
  SA: { iso2: 'SA', iso3: 'SAU', name: 'Saudi Arabia', currency: 'SAR', dial: '+966', region: 'Asia', subregion: 'Middle East', taxName: 'VAT', taxRate: 0.15, postalLabel: 'Postal code', postalRegex: /^\d{5}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'line2', 'city', 'postal'], methods: ['card', 'mada', 'applepay', 'banktransfer', 'cod'] },
  QA: { iso2: 'QA', iso3: 'QAT', name: 'Qatar', currency: 'QAR', dial: '+974', region: 'Asia', subregion: 'Middle East', taxName: 'VAT', taxRate: 0.0, postalLabel: '', postalRegex: null, phoneDigits: 8, addressOrder: ['name', 'line1', 'city'], methods: ['card', 'banktransfer', 'cod'] },
  KW: { iso2: 'KW', iso3: 'KWT', name: 'Kuwait', currency: 'KWD', dial: '+965', region: 'Asia', subregion: 'Middle East', taxName: 'None', taxRate: 0.0, postalLabel: 'Postal code', postalRegex: /^\d{5}$/, phoneDigits: 8, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['card', 'knet', 'banktransfer', 'cod'] },
  BH: { iso2: 'BH', iso3: 'BHR', name: 'Bahrain', currency: 'BHD', dial: '+973', region: 'Asia', subregion: 'Middle East', taxName: 'VAT', taxRate: 0.1, postalLabel: '', postalRegex: /^\d{3,4}$/, phoneDigits: 8, addressOrder: ['name', 'line1', 'city'], methods: ['card', 'benefit', 'banktransfer'] },
  OM: { iso2: 'OM', iso3: 'OMN', name: 'Oman', currency: 'OMR', dial: '+968', region: 'Asia', subregion: 'Middle East', taxName: 'VAT', taxRate: 0.05, postalLabel: 'Postal code', postalRegex: /^\d{3}$/, phoneDigits: 8, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['card', 'banktransfer', 'cod'] },
  JO: { iso2: 'JO', iso3: 'JOR', name: 'Jordan', currency: 'JOD', dial: '+962', region: 'Asia', subregion: 'Middle East', taxName: 'GST', taxRate: 0.16, postalLabel: 'Postal code', postalRegex: /^\d{5}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['card', 'banktransfer', 'cod'] },
  IL: { iso2: 'IL', iso3: 'ISR', name: 'Israel', currency: 'ILS', dial: '+972', region: 'Asia', subregion: 'Middle East', taxName: 'VAT', taxRate: 0.17, postalLabel: 'Postal code', postalRegex: /^\d{5,7}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['card', 'bit', 'banktransfer'] },
  TR: { iso2: 'TR', iso3: 'TUR', name: 'Turkey', currency: 'TRY', dial: '+90', region: 'Asia', subregion: 'Middle East', taxName: 'KDV', taxRate: 0.2, postalLabel: 'Posta kodu', postalRegex: /^\d{5}$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'line2', 'city', 'state', 'postal'], methods: ['card', 'banktransfer', 'wallet', 'cod'] },
  IQ: { iso2: 'IQ', iso3: 'IRQ', name: 'Iraq', currency: 'IQD', dial: '+964', region: 'Asia', subregion: 'Middle East', taxName: 'Sales tax', taxRate: 0.0, postalLabel: 'Postal code', postalRegex: /^\d{5}$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['banktransfer', 'cod'] },
  LB: { iso2: 'LB', iso3: 'LBN', name: 'Lebanon', currency: 'LBP', dial: '+961', region: 'Asia', subregion: 'Middle East', taxName: 'VAT', taxRate: 0.11, postalLabel: 'Postal code', postalRegex: /^\d{4}\s?\d{4}$/, phoneDigits: 8, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['card', 'banktransfer', 'cod'] },
  DE: { iso2: 'DE', iso3: 'DEU', name: 'Germany', currency: 'EUR', dial: '+49', region: 'Europe', subregion: 'Western Europe', taxName: 'MwSt', taxRate: 0.19, postalLabel: 'PLZ', postalRegex: /^\d{5}$/, phoneDigits: 11, addressOrder: ['name', 'line1', 'line2', 'postal', 'city'], methods: ['card', 'sepa', 'paypal', 'klarna', 'sofort'] },
  FR: { iso2: 'FR', iso3: 'FRA', name: 'France', currency: 'EUR', dial: '+33', region: 'Europe', subregion: 'Western Europe', taxName: 'TVA', taxRate: 0.2, postalLabel: 'Code postal', postalRegex: /^\d{5}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'line2', 'postal', 'city'], methods: ['card', 'sepa', 'paypal', 'banktransfer'] },
  IT: { iso2: 'IT', iso3: 'ITA', name: 'Italy', currency: 'EUR', dial: '+39', region: 'Europe', subregion: 'Southern Europe', taxName: 'IVA', taxRate: 0.22, postalLabel: 'CAP', postalRegex: /^\d{5}$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'line2', 'postal', 'city', 'state'], methods: ['card', 'sepa', 'paypal', 'banktransfer'] },
  ES: { iso2: 'ES', iso3: 'ESP', name: 'Spain', currency: 'EUR', dial: '+34', region: 'Europe', subregion: 'Southern Europe', taxName: 'IVA', taxRate: 0.21, postalLabel: 'Código postal', postalRegex: /^\d{5}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'line2', 'postal', 'city', 'state'], methods: ['card', 'sepa', 'paypal', 'bizum'] },
  NL: { iso2: 'NL', iso3: 'NLD', name: 'Netherlands', currency: 'EUR', dial: '+31', region: 'Europe', subregion: 'Western Europe', taxName: 'BTW', taxRate: 0.21, postalLabel: 'Postcode', postalRegex: /^\d{4}\s?[A-Z]{2}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'line2', 'postal', 'city'], methods: ['ideal', 'card', 'sepa', 'paypal'] },
  BE: { iso2: 'BE', iso3: 'BEL', name: 'Belgium', currency: 'EUR', dial: '+32', region: 'Europe', subregion: 'Western Europe', taxName: 'BTW', taxRate: 0.21, postalLabel: 'Code postal', postalRegex: /^\d{4}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'postal', 'city'], methods: ['card', 'bancontact', 'sepa', 'paypal'] },
  AT: { iso2: 'AT', iso3: 'AUT', name: 'Austria', currency: 'EUR', dial: '+43', region: 'Europe', subregion: 'Western Europe', taxName: 'USt', taxRate: 0.2, postalLabel: 'PLZ', postalRegex: /^\d{4}$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'postal', 'city'], methods: ['card', 'sepa', 'eps', 'klarna'] },
  PT: { iso2: 'PT', iso3: 'PRT', name: 'Portugal', currency: 'EUR', dial: '+351', region: 'Europe', subregion: 'Southern Europe', taxName: 'IVA', taxRate: 0.23, postalLabel: 'Código postal', postalRegex: /^\d{4}-\d{3}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'postal', 'city'], methods: ['card', 'multibanco', 'mbway', 'sepa'] },
  IE: { iso2: 'IE', iso3: 'IRL', name: 'Ireland', currency: 'EUR', dial: '+353', region: 'Europe', subregion: 'Western Europe', taxName: 'VAT', taxRate: 0.23, postalLabel: 'Eircode', postalRegex: /^[A-Z]\d{2}\s?[A-Z0-9]{4}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'line2', 'city', 'postal'], methods: ['card', 'sepa', 'paypal'] },
  FI: { iso2: 'FI', iso3: 'FIN', name: 'Finland', currency: 'EUR', dial: '+358', region: 'Europe', subregion: 'Northern Europe', taxName: 'ALV', taxRate: 0.255, postalLabel: 'Postinumero', postalRegex: /^\d{5}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'postal', 'city'], methods: ['card', 'sepa', 'paypal', 'klarna'] },
  GR: { iso2: 'GR', iso3: 'GRC', name: 'Greece', currency: 'EUR', dial: '+30', region: 'Europe', subregion: 'Southern Europe', taxName: 'FPA', taxRate: 0.24, postalLabel: 'Postal code', postalRegex: /^\d{5}$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'postal', 'city'], methods: ['card', 'sepa', 'paypal', 'cod'] },
  GB: { iso2: 'GB', iso3: 'GBR', name: 'United Kingdom', currency: 'GBP', dial: '+44', region: 'Europe', subregion: 'Northern Europe', taxName: 'VAT', taxRate: 0.2, postalLabel: 'Postcode', postalRegex: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'line2', 'city', 'postal'], methods: ['card', 'paypal', 'klarna', 'banktransfer'] },
  CH: { iso2: 'CH', iso3: 'CHE', name: 'Switzerland', currency: 'CHF', dial: '+41', region: 'Europe', subregion: 'Western Europe', taxName: 'MwSt', taxRate: 0.081, postalLabel: 'PLZ', postalRegex: /^\d{4}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'postal', 'city'], methods: ['card', 'twint', 'sepa', 'paypal'] },
  NO: { iso2: 'NO', iso3: 'NOR', name: 'Norway', currency: 'NOK', dial: '+47', region: 'Europe', subregion: 'Northern Europe', taxName: 'MVA', taxRate: 0.25, postalLabel: 'Postnummer', postalRegex: /^\d{4}$/, phoneDigits: 8, addressOrder: ['name', 'line1', 'postal', 'city'], methods: ['card', 'vipps', 'klarna', 'banktransfer'] },
  SE: { iso2: 'SE', iso3: 'SWE', name: 'Sweden', currency: 'SEK', dial: '+46', region: 'Europe', subregion: 'Northern Europe', taxName: 'Moms', taxRate: 0.25, postalLabel: 'Postnummer', postalRegex: /^\d{3}\s?\d{2}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'postal', 'city'], methods: ['card', 'swish', 'klarna', 'banktransfer'] },
  DK: { iso2: 'DK', iso3: 'DNK', name: 'Denmark', currency: 'DKK', dial: '+45', region: 'Europe', subregion: 'Northern Europe', taxName: 'Moms', taxRate: 0.25, postalLabel: 'Postnummer', postalRegex: /^\d{4}$/, phoneDigits: 8, addressOrder: ['name', 'line1', 'postal', 'city'], methods: ['card', 'mobilepay', 'klarna', 'banktransfer'] },
  IS: { iso2: 'IS', iso3: 'ISL', name: 'Iceland', currency: 'ISK', dial: '+354', region: 'Europe', subregion: 'Northern Europe', taxName: 'VSK', taxRate: 0.24, postalLabel: 'Postnúmer', postalRegex: /^\d{3}$/, phoneDigits: 7, addressOrder: ['name', 'line1', 'postal', 'city'], methods: ['card', 'banktransfer'] },
  PL: { iso2: 'PL', iso3: 'POL', name: 'Poland', currency: 'PLN', dial: '+48', region: 'Europe', subregion: 'Eastern Europe', taxName: 'VAT', taxRate: 0.23, postalLabel: 'Kod pocztowy', postalRegex: /^\d{2}-\d{3}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'postal', 'city'], methods: ['card', 'blik', 'przelewy24', 'banktransfer', 'cod'] },
  CZ: { iso2: 'CZ', iso3: 'CZE', name: 'Czechia', currency: 'CZK', dial: '+420', region: 'Europe', subregion: 'Eastern Europe', taxName: 'DPH', taxRate: 0.21, postalLabel: 'PSČ', postalRegex: /^\d{3}\s?\d{2}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'postal', 'city'], methods: ['card', 'banktransfer', 'cod'] },
  HU: { iso2: 'HU', iso3: 'HUN', name: 'Hungary', currency: 'HUF', dial: '+36', region: 'Europe', subregion: 'Eastern Europe', taxName: 'AFA', taxRate: 0.27, postalLabel: 'Irányítószám', postalRegex: /^\d{4}$/, phoneDigits: 9, addressOrder: ['name', 'postal', 'city', 'line1'], methods: ['card', 'banktransfer', 'cod'] },
  RO: { iso2: 'RO', iso3: 'ROU', name: 'Romania', currency: 'RON', dial: '+40', region: 'Europe', subregion: 'Eastern Europe', taxName: 'TVA', taxRate: 0.19, postalLabel: 'Cod poștal', postalRegex: /^\d{6}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city', 'state', 'postal'], methods: ['card', 'banktransfer', 'cod'] },
  BG: { iso2: 'BG', iso3: 'BGR', name: 'Bulgaria', currency: 'BGN', dial: '+359', region: 'Europe', subregion: 'Eastern Europe', taxName: 'DDS', taxRate: 0.2, postalLabel: 'Пощенски код', postalRegex: /^\d{4}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['card', 'banktransfer', 'cod'] },
  RS: { iso2: 'RS', iso3: 'SRB', name: 'Serbia', currency: 'RSD', dial: '+381', region: 'Europe', subregion: 'Eastern Europe', taxName: 'PDV', taxRate: 0.2, postalLabel: 'Poštanski broj', postalRegex: /^\d{5}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'postal', 'city'], methods: ['card', 'banktransfer', 'cod'] },
  UA: { iso2: 'UA', iso3: 'UKR', name: 'Ukraine', currency: 'UAH', dial: '+380', region: 'Europe', subregion: 'Eastern Europe', taxName: 'PDV', taxRate: 0.2, postalLabel: 'Поштовий індекс', postalRegex: /^\d{5}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city', 'state', 'postal'], methods: ['card', 'banktransfer', 'cod'] },
  RU: { iso2: 'RU', iso3: 'RUS', name: 'Russia', currency: 'RUB', dial: '+7', region: 'Europe', subregion: 'Eastern Europe', taxName: 'NDS', taxRate: 0.2, postalLabel: 'Почтовый индекс', postalRegex: /^\d{6}$/, phoneDigits: 10, addressOrder: ['name', 'postal', 'state', 'city', 'line1'], methods: ['card', 'mir', 'sbp', 'banktransfer', 'cod'] },
  BY: { iso2: 'BY', iso3: 'BLR', name: 'Belarus', currency: 'BYN', dial: '+375', region: 'Europe', subregion: 'Eastern Europe', taxName: 'PDV', taxRate: 0.2, postalLabel: 'Postal code', postalRegex: /^\d{6}$/, phoneDigits: 9, addressOrder: ['name', 'postal', 'city', 'line1'], methods: ['card', 'banktransfer', 'cod'] },
  GE: { iso2: 'GE', iso3: 'GEO', name: 'Georgia', currency: 'GEL', dial: '+995', region: 'Europe', subregion: 'Eastern Europe', taxName: 'VAT', taxRate: 0.18, postalLabel: 'Postal code', postalRegex: /^\d{4}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['card', 'banktransfer'] },
  US: { iso2: 'US', iso3: 'USA', name: 'United States', currency: 'USD', dial: '+1', region: 'Americas', subregion: 'North America', taxName: 'Sales tax', taxRate: 0.0, postalLabel: 'ZIP code', postalRegex: /^\d{5}(-\d{4})?$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'line2', 'city', 'state', 'postal'], methods: ['card', 'applepay', 'googlepay', 'paypal', 'klarna', 'banktransfer'] },
  CA: { iso2: 'CA', iso3: 'CAN', name: 'Canada', currency: 'CAD', dial: '+1', region: 'Americas', subregion: 'North America', taxName: 'GST/HST', taxRate: 0.05, postalLabel: 'Postal code', postalRegex: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'line2', 'city', 'state', 'postal'], methods: ['card', 'interac', 'paypal', 'applepay'] },
  MX: { iso2: 'MX', iso3: 'MEX', name: 'Mexico', currency: 'MXN', dial: '+52', region: 'Americas', subregion: 'North America', taxName: 'IVA', taxRate: 0.16, postalLabel: 'Código postal', postalRegex: /^\d{5}$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'line2', 'city', 'state', 'postal'], methods: ['card', 'oxxo', 'spei', 'paypal', 'cod'] },
  BR: { iso2: 'BR', iso3: 'BRA', name: 'Brazil', currency: 'BRL', dial: '+55', region: 'Americas', subregion: 'South America', taxName: 'ICMS', taxRate: 0.17, postalLabel: 'CEP', postalRegex: /^\d{5}-?\d{3}$/, phoneDigits: 11, addressOrder: ['name', 'line1', 'line2', 'city', 'state', 'postal'], methods: ['pix', 'card', 'boleto', 'banktransfer'] },
  AR: { iso2: 'AR', iso3: 'ARG', name: 'Argentina', currency: 'ARS', dial: '+54', region: 'Americas', subregion: 'South America', taxName: 'IVA', taxRate: 0.21, postalLabel: 'Código postal', postalRegex: /^[A-Z]?\d{4}[A-Z]{0,3}$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'city', 'state', 'postal'], methods: ['card', 'mercadopago', 'banktransfer', 'cod'] },
  CL: { iso2: 'CL', iso3: 'CHL', name: 'Chile', currency: 'CLP', dial: '+56', region: 'Americas', subregion: 'South America', taxName: 'IVA', taxRate: 0.19, postalLabel: 'Código postal', postalRegex: /^\d{7}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city', 'state', 'postal'], methods: ['card', 'webpay', 'banktransfer'] },
  CO: { iso2: 'CO', iso3: 'COL', name: 'Colombia', currency: 'COP', dial: '+57', region: 'Americas', subregion: 'South America', taxName: 'IVA', taxRate: 0.19, postalLabel: 'Código postal', postalRegex: /^\d{6}$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'city', 'state', 'postal'], methods: ['card', 'pse', 'nequi', 'banktransfer', 'cod'] },
  PE: { iso2: 'PE', iso3: 'PER', name: 'Peru', currency: 'PEN', dial: '+51', region: 'Americas', subregion: 'South America', taxName: 'IGV', taxRate: 0.18, postalLabel: 'Código postal', postalRegex: /^\d{5}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city', 'state', 'postal'], methods: ['card', 'yape', 'banktransfer', 'cod'] },
  UY: { iso2: 'UY', iso3: 'URY', name: 'Uruguay', currency: 'UYU', dial: '+598', region: 'Americas', subregion: 'South America', taxName: 'IVA', taxRate: 0.22, postalLabel: 'Código postal', postalRegex: /^\d{5}$/, phoneDigits: 8, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['card', 'banktransfer'] },
  EC: { iso2: 'EC', iso3: 'ECU', name: 'Ecuador', currency: 'USD', dial: '+593', region: 'Americas', subregion: 'South America', taxName: 'IVA', taxRate: 0.15, postalLabel: 'Código postal', postalRegex: /^\d{6}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['card', 'banktransfer', 'cod'] },
  ZA: { iso2: 'ZA', iso3: 'ZAF', name: 'South Africa', currency: 'ZAR', dial: '+27', region: 'Africa', subregion: 'Southern Africa', taxName: 'VAT', taxRate: 0.15, postalLabel: 'Postal code', postalRegex: /^\d{4}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'line2', 'city', 'postal'], methods: ['card', 'eft', 'snapscan', 'banktransfer', 'cod'] },
  NG: { iso2: 'NG', iso3: 'NGA', name: 'Nigeria', currency: 'NGN', dial: '+234', region: 'Africa', subregion: 'West Africa', taxName: 'VAT', taxRate: 0.075, postalLabel: 'Postal code', postalRegex: /^\d{6}$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'line2', 'city', 'state', 'postal'], methods: ['card', 'banktransfer', 'ussd', 'cod'] },
  EG: { iso2: 'EG', iso3: 'EGY', name: 'Egypt', currency: 'EGP', dial: '+20', region: 'Africa', subregion: 'North Africa', taxName: 'VAT', taxRate: 0.14, postalLabel: 'Postal code', postalRegex: /^\d{5}$/, phoneDigits: 10, addressOrder: ['name', 'line1', 'city', 'state', 'postal'], methods: ['card', 'fawry', 'banktransfer', 'cod'] },
  KE: { iso2: 'KE', iso3: 'KEN', name: 'Kenya', currency: 'KES', dial: '+254', region: 'Africa', subregion: 'East Africa', taxName: 'VAT', taxRate: 0.16, postalLabel: 'Postal code', postalRegex: /^\d{5}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['mpesa', 'card', 'banktransfer', 'cod'] },
  GH: { iso2: 'GH', iso3: 'GHA', name: 'Ghana', currency: 'GHS', dial: '+233', region: 'Africa', subregion: 'West Africa', taxName: 'VAT', taxRate: 0.15, postalLabel: 'Postal code', postalRegex: /^[A-Z]{2}\d{3,4}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city'], methods: ['momo', 'card', 'banktransfer', 'cod'] },
  MA: { iso2: 'MA', iso3: 'MAR', name: 'Morocco', currency: 'MAD', dial: '+212', region: 'Africa', subregion: 'North Africa', taxName: 'TVA', taxRate: 0.2, postalLabel: 'Code postal', postalRegex: /^\d{5}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['card', 'banktransfer', 'cod'] },
  TZ: { iso2: 'TZ', iso3: 'TZA', name: 'Tanzania', currency: 'TZS', dial: '+255', region: 'Africa', subregion: 'East Africa', taxName: 'VAT', taxRate: 0.18, postalLabel: 'Postal code', postalRegex: /^\d{5}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['mpesa', 'card', 'banktransfer', 'cod'] },
  UG: { iso2: 'UG', iso3: 'UGA', name: 'Uganda', currency: 'UGX', dial: '+256', region: 'Africa', subregion: 'East Africa', taxName: 'VAT', taxRate: 0.18, postalLabel: 'Postal code', postalRegex: null, phoneDigits: 9, addressOrder: ['name', 'line1', 'city'], methods: ['momo', 'card', 'banktransfer', 'cod'] },
  ET: { iso2: 'ET', iso3: 'ETH', name: 'Ethiopia', currency: 'ETB', dial: '+251', region: 'Africa', subregion: 'East Africa', taxName: 'VAT', taxRate: 0.15, postalLabel: 'Postal code', postalRegex: /^\d{4}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['banktransfer', 'cod'] },
  DZ: { iso2: 'DZ', iso3: 'DZA', name: 'Algeria', currency: 'DZD', dial: '+213', region: 'Africa', subregion: 'North Africa', taxName: 'TVA', taxRate: 0.19, postalLabel: 'Code postal', postalRegex: /^\d{5}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['banktransfer', 'cod'] },
  TN: { iso2: 'TN', iso3: 'TUN', name: 'Tunisia', currency: 'TND', dial: '+216', region: 'Africa', subregion: 'North Africa', taxName: 'TVA', taxRate: 0.19, postalLabel: 'Code postal', postalRegex: /^\d{4}$/, phoneDigits: 8, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['card', 'banktransfer', 'cod'] },
  AU: { iso2: 'AU', iso3: 'AUS', name: 'Australia', currency: 'AUD', dial: '+61', region: 'Oceania', subregion: 'Australasia', taxName: 'GST', taxRate: 0.1, postalLabel: 'Postcode', postalRegex: /^\d{4}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'line2', 'city', 'state', 'postal'], methods: ['card', 'payid', 'paypal', 'afterpay', 'banktransfer'] },
  NZ: { iso2: 'NZ', iso3: 'NZL', name: 'New Zealand', currency: 'NZD', dial: '+64', region: 'Oceania', subregion: 'Australasia', taxName: 'GST', taxRate: 0.15, postalLabel: 'Postcode', postalRegex: /^\d{4}$/, phoneDigits: 9, addressOrder: ['name', 'line1', 'line2', 'city', 'postal'], methods: ['card', 'paypal', 'afterpay', 'banktransfer'] },
  FJ: { iso2: 'FJ', iso3: 'FJI', name: 'Fiji', currency: 'FJD', dial: '+679', region: 'Oceania', subregion: 'Melanesia', taxName: 'VAT', taxRate: 0.15, postalLabel: '', postalRegex: null, phoneDigits: 7, addressOrder: ['name', 'line1', 'city'], methods: ['card', 'banktransfer'] },
  PG: { iso2: 'PG', iso3: 'PNG', name: 'Papua New Guinea', currency: 'PGK', dial: '+675', region: 'Oceania', subregion: 'Melanesia', taxName: 'GST', taxRate: 0.1, postalLabel: 'Postal code', postalRegex: /^\d{3}$/, phoneDigits: 8, addressOrder: ['name', 'line1', 'city', 'postal'], methods: ['banktransfer', 'cod'] },
}

export const COUNTRY_CODES = Object.keys(COUNTRIES)
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
  const digits = String(value || '').replace(/\D/g, '')
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
