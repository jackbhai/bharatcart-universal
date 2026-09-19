/**
 * Complete ISO 4217 currency table — every circulating national currency.
 *
 * Generated rather than hand-typed: 157 currencies each need a code, numeric
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


export const CURRENCIES = {
  INR: { code: 'INR', numeric: '356', symbol: '₹', name: 'Indian Rupee', decimals: 2, locale: 'en-IN', flag: '🇮🇳', region: 'South Asia', countries: ['India', 'Bhutan'] },
  PKR: { code: 'PKR', numeric: '586', symbol: '₨', name: 'Pakistani Rupee', decimals: 2, locale: 'ur-PK', flag: '🇵🇰', region: 'South Asia', countries: ['Pakistan'] },
  BDT: { code: 'BDT', numeric: '050', symbol: '৳', name: 'Bangladeshi Taka', decimals: 2, locale: 'bn-BD', flag: '🇧🇩', region: 'South Asia', countries: ['Bangladesh'] },
  LKR: { code: 'LKR', numeric: '144', symbol: 'Rs', name: 'Sri Lankan Rupee', decimals: 2, locale: 'si-LK', flag: '🇱🇰', region: 'South Asia', countries: ['Sri Lanka'] },
  NPR: { code: 'NPR', numeric: '524', symbol: 'रू', name: 'Nepalese Rupee', decimals: 2, locale: 'ne-NP', flag: '🇳🇵', region: 'South Asia', countries: ['Nepal'] },
  BTN: { code: 'BTN', numeric: '064', symbol: 'Nu.', name: 'Bhutanese Ngultrum', decimals: 2, locale: 'dz-BT', flag: '🇧🇹', region: 'South Asia', countries: ['Bhutan'] },
  MVR: { code: 'MVR', numeric: '462', symbol: 'ރ.', name: 'Maldivian Rufiyaa', decimals: 2, locale: 'dv-MV', flag: '🇲🇻', region: 'South Asia', countries: ['Maldives'] },
  AFN: { code: 'AFN', numeric: '971', symbol: '؋', name: 'Afghan Afghani', decimals: 2, locale: 'fa-AF', flag: '🇦🇫', region: 'South Asia', countries: ['Afghanistan'] },
  MMK: { code: 'MMK', numeric: '104', symbol: 'K', name: 'Myanmar Kyat', decimals: 2, locale: 'my-MM', flag: '🇲🇲', region: 'Southeast Asia', countries: ['Myanmar'] },
  THB: { code: 'THB', numeric: '764', symbol: '฿', name: 'Thai Baht', decimals: 2, locale: 'th-TH', flag: '🇹🇭', region: 'Southeast Asia', countries: ['Thailand'] },
  VND: { code: 'VND', numeric: '704', symbol: '₫', name: 'Vietnamese Dong', decimals: 0, locale: 'vi-VN', flag: '🇻🇳', region: 'Southeast Asia', countries: ['Vietnam'] },
  IDR: { code: 'IDR', numeric: '360', symbol: 'Rp', name: 'Indonesian Rupiah', decimals: 2, locale: 'id-ID', flag: '🇮🇩', region: 'Southeast Asia', countries: ['Indonesia'] },
  MYR: { code: 'MYR', numeric: '458', symbol: 'RM', name: 'Malaysian Ringgit', decimals: 2, locale: 'ms-MY', flag: '🇲🇾', region: 'Southeast Asia', countries: ['Malaysia'] },
  SGD: { code: 'SGD', numeric: '702', symbol: 'S$', name: 'Singapore Dollar', decimals: 2, locale: 'en-SG', flag: '🇸🇬', region: 'Southeast Asia', countries: ['Singapore'] },
  PHP: { code: 'PHP', numeric: '608', symbol: '₱', name: 'Philippine Peso', decimals: 2, locale: 'en-PH', flag: '🇵🇭', region: 'Southeast Asia', countries: ['Philippines'] },
  KHR: { code: 'KHR', numeric: '116', symbol: '៛', name: 'Cambodian Riel', decimals: 2, locale: 'km-KH', flag: '🇰🇭', region: 'Southeast Asia', countries: ['Cambodia'] },
  LAK: { code: 'LAK', numeric: '418', symbol: '₭', name: 'Lao Kip', decimals: 2, locale: 'lo-LA', flag: '🇱🇦', region: 'Southeast Asia', countries: ['Laos'] },
  BND: { code: 'BND', numeric: '096', symbol: 'B$', name: 'Brunei Dollar', decimals: 2, locale: 'ms-BN', flag: '🇧🇳', region: 'Southeast Asia', countries: ['Brunei'] },
  TLS: { code: 'TLS', numeric: '000', symbol: 'US$', name: 'Timorese (uses USD)', decimals: 2, locale: 'pt-TL', flag: '🇹🇱', region: 'Southeast Asia', countries: ['Timor-Leste'] },
  CNY: { code: 'CNY', numeric: '156', symbol: '¥', name: 'Chinese Yuan Renminbi', decimals: 2, locale: 'zh-CN', flag: '🇨🇳', region: 'East Asia', countries: ['China'] },
  JPY: { code: 'JPY', numeric: '392', symbol: '¥', name: 'Japanese Yen', decimals: 0, locale: 'ja-JP', flag: '🇯🇵', region: 'East Asia', countries: ['Japan'] },
  KRW: { code: 'KRW', numeric: '410', symbol: '₩', name: 'South Korean Won', decimals: 0, locale: 'ko-KR', flag: '🇰🇷', region: 'East Asia', countries: ['South Korea'] },
  KPW: { code: 'KPW', numeric: '408', symbol: '₩', name: 'North Korean Won', decimals: 2, locale: 'ko-KP', flag: '🇰🇵', region: 'East Asia', countries: ['North Korea'] },
  TWD: { code: 'TWD', numeric: '901', symbol: 'NT$', name: 'New Taiwan Dollar', decimals: 2, locale: 'zh-TW', flag: '🇹🇼', region: 'East Asia', countries: ['Taiwan'] },
  HKD: { code: 'HKD', numeric: '344', symbol: 'HK$', name: 'Hong Kong Dollar', decimals: 2, locale: 'zh-HK', flag: '🇭🇰', region: 'East Asia', countries: ['Hong Kong'] },
  MOP: { code: 'MOP', numeric: '446', symbol: 'MOP$', name: 'Macanese Pataca', decimals: 2, locale: 'zh-MO', flag: '🇲🇴', region: 'East Asia', countries: ['Macau'] },
  MNT: { code: 'MNT', numeric: '496', symbol: '₮', name: 'Mongolian Tugrik', decimals: 2, locale: 'mn-MN', flag: '🇲🇳', region: 'East Asia', countries: ['Mongolia'] },
  KZT: { code: 'KZT', numeric: '398', symbol: '₸', name: 'Kazakhstani Tenge', decimals: 2, locale: 'kk-KZ', flag: '🇰🇿', region: 'Central Asia', countries: ['Kazakhstan'] },
  UZS: { code: 'UZS', numeric: '860', symbol: 'so\'m', name: 'Uzbekistani Som', decimals: 2, locale: 'uz-UZ', flag: '🇺🇿', region: 'Central Asia', countries: ['Uzbekistan'] },
  KGS: { code: 'KGS', numeric: '417', symbol: 'с', name: 'Kyrgyzstani Som', decimals: 2, locale: 'ky-KG', flag: '🇰🇬', region: 'Central Asia', countries: ['Kyrgyzstan'] },
  TJS: { code: 'TJS', numeric: '972', symbol: 'SM', name: 'Tajikistani Somoni', decimals: 2, locale: 'tg-TJ', flag: '🇹🇯', region: 'Central Asia', countries: ['Tajikistan'] },
  TMT: { code: 'TMT', numeric: '934', symbol: 'm', name: 'Turkmenistani Manat', decimals: 2, locale: 'tk-TM', flag: '🇹🇲', region: 'Central Asia', countries: ['Turkmenistan'] },
  AED: { code: 'AED', numeric: '784', symbol: 'د.إ', name: 'UAE Dirham', decimals: 2, locale: 'ar-AE', flag: '🇦🇪', region: 'Middle East', countries: ['United Arab Emirates'] },
  SAR: { code: 'SAR', numeric: '682', symbol: '﷼', name: 'Saudi Riyal', decimals: 2, locale: 'ar-SA', flag: '🇸🇦', region: 'Middle East', countries: ['Saudi Arabia'] },
  QAR: { code: 'QAR', numeric: '634', symbol: '﷼', name: 'Qatari Riyal', decimals: 2, locale: 'ar-QA', flag: '🇶🇦', region: 'Middle East', countries: ['Qatar'] },
  KWD: { code: 'KWD', numeric: '414', symbol: 'د.ك', name: 'Kuwaiti Dinar', decimals: 3, locale: 'ar-KW', flag: '🇰🇼', region: 'Middle East', countries: ['Kuwait'] },
  BHD: { code: 'BHD', numeric: '048', symbol: 'ب.د', name: 'Bahraini Dinar', decimals: 3, locale: 'ar-BH', flag: '🇧🇭', region: 'Middle East', countries: ['Bahrain'] },
  OMR: { code: 'OMR', numeric: '512', symbol: '﷼', name: 'Omani Rial', decimals: 3, locale: 'ar-OM', flag: '🇴🇲', region: 'Middle East', countries: ['Oman'] },
  JOD: { code: 'JOD', numeric: '400', symbol: 'د.ا', name: 'Jordanian Dinar', decimals: 3, locale: 'ar-JO', flag: '🇯🇴', region: 'Middle East', countries: ['Jordan'] },
  ILS: { code: 'ILS', numeric: '376', symbol: '₪', name: 'Israeli New Shekel', decimals: 2, locale: 'he-IL', flag: '🇮🇱', region: 'Middle East', countries: ['Israel'] },
  LBP: { code: 'LBP', numeric: '422', symbol: 'ل.ل', name: 'Lebanese Pound', decimals: 2, locale: 'ar-LB', flag: '🇱🇧', region: 'Middle East', countries: ['Lebanon'] },
  SYP: { code: 'SYP', numeric: '760', symbol: '£S', name: 'Syrian Pound', decimals: 2, locale: 'ar-SY', flag: '🇸🇾', region: 'Middle East', countries: ['Syria'] },
  IQD: { code: 'IQD', numeric: '368', symbol: 'ع.د', name: 'Iraqi Dinar', decimals: 3, locale: 'ar-IQ', flag: '🇮🇶', region: 'Middle East', countries: ['Iraq'] },
  IRR: { code: 'IRR', numeric: '364', symbol: '﷼', name: 'Iranian Rial', decimals: 2, locale: 'fa-IR', flag: '🇮🇷', region: 'Middle East', countries: ['Iran'] },
  YER: { code: 'YER', numeric: '886', symbol: '﷼', name: 'Yemeni Rial', decimals: 2, locale: 'ar-YE', flag: '🇾🇪', region: 'Middle East', countries: ['Yemen'] },
  TRY: { code: 'TRY', numeric: '949', symbol: '₺', name: 'Turkish Lira', decimals: 2, locale: 'tr-TR', flag: '🇹🇷', region: 'Middle East', countries: ['Turkey'] },
  EUR: { code: 'EUR', numeric: '978', symbol: '€', name: 'Euro', decimals: 2, locale: 'de-DE', flag: '🇪🇺', region: 'Europe', countries: ['Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Austria', 'Portugal', 'Ireland', 'Finland', 'Greece', 'Slovakia', 'Slovenia', 'Estonia', 'Latvia', 'Lithuania', 'Luxembourg', 'Cyprus', 'Malta', 'Croatia'] },
  GBP: { code: 'GBP', numeric: '826', symbol: '£', name: 'Pound Sterling', decimals: 2, locale: 'en-GB', flag: '🇬🇧', region: 'Europe', countries: ['United Kingdom'] },
  CHF: { code: 'CHF', numeric: '756', symbol: 'CHF', name: 'Swiss Franc', decimals: 2, locale: 'de-CH', flag: '🇨🇭', region: 'Europe', countries: ['Switzerland', 'Liechtenstein'] },
  NOK: { code: 'NOK', numeric: '578', symbol: 'kr', name: 'Norwegian Krone', decimals: 2, locale: 'nb-NO', flag: '🇳🇴', region: 'Europe', countries: ['Norway'] },
  SEK: { code: 'SEK', numeric: '752', symbol: 'kr', name: 'Swedish Krona', decimals: 2, locale: 'sv-SE', flag: '🇸🇪', region: 'Europe', countries: ['Sweden'] },
  DKK: { code: 'DKK', numeric: '208', symbol: 'kr', name: 'Danish Krone', decimals: 2, locale: 'da-DK', flag: '🇩🇰', region: 'Europe', countries: ['Denmark', 'Greenland', 'Faroe Islands'] },
  ISK: { code: 'ISK', numeric: '352', symbol: 'kr', name: 'Icelandic Krona', decimals: 0, locale: 'is-IS', flag: '🇮🇸', region: 'Europe', countries: ['Iceland'] },
  PLN: { code: 'PLN', numeric: '985', symbol: 'zł', name: 'Polish Zloty', decimals: 2, locale: 'pl-PL', flag: '🇵🇱', region: 'Europe', countries: ['Poland'] },
  CZK: { code: 'CZK', numeric: '203', symbol: 'Kč', name: 'Czech Koruna', decimals: 2, locale: 'cs-CZ', flag: '🇨🇿', region: 'Europe', countries: ['Czechia'] },
  HUF: { code: 'HUF', numeric: '348', symbol: 'Ft', name: 'Hungarian Forint', decimals: 2, locale: 'hu-HU', flag: '🇭🇺', region: 'Europe', countries: ['Hungary'] },
  RON: { code: 'RON', numeric: '946', symbol: 'lei', name: 'Romanian Leu', decimals: 2, locale: 'ro-RO', flag: '🇷🇴', region: 'Europe', countries: ['Romania'] },
  BGN: { code: 'BGN', numeric: '975', symbol: 'лв', name: 'Bulgarian Lev', decimals: 2, locale: 'bg-BG', flag: '🇧🇬', region: 'Europe', countries: ['Bulgaria'] },
  RSD: { code: 'RSD', numeric: '941', symbol: 'дин', name: 'Serbian Dinar', decimals: 2, locale: 'sr-RS', flag: '🇷🇸', region: 'Europe', countries: ['Serbia'] },
  MKD: { code: 'MKD', numeric: '807', symbol: 'ден', name: 'Macedonian Denar', decimals: 2, locale: 'mk-MK', flag: '🇲🇰', region: 'Europe', countries: ['North Macedonia'] },
  ALL: { code: 'ALL', numeric: '008', symbol: 'L', name: 'Albanian Lek', decimals: 2, locale: 'sq-AL', flag: '🇦🇱', region: 'Europe', countries: ['Albania'] },
  BAM: { code: 'BAM', numeric: '977', symbol: 'KM', name: 'Bosnia-Herzegovina Mark', decimals: 2, locale: 'bs-BA', flag: '🇧🇦', region: 'Europe', countries: ['Bosnia and Herzegovina'] },
  MDL: { code: 'MDL', numeric: '498', symbol: 'L', name: 'Moldovan Leu', decimals: 2, locale: 'ro-MD', flag: '🇲🇩', region: 'Europe', countries: ['Moldova'] },
  UAH: { code: 'UAH', numeric: '980', symbol: '₴', name: 'Ukrainian Hryvnia', decimals: 2, locale: 'uk-UA', flag: '🇺🇦', region: 'Europe', countries: ['Ukraine'] },
  BYN: { code: 'BYN', numeric: '933', symbol: 'Br', name: 'Belarusian Ruble', decimals: 2, locale: 'be-BY', flag: '🇧🇾', region: 'Europe', countries: ['Belarus'] },
  RUB: { code: 'RUB', numeric: '643', symbol: '₽', name: 'Russian Ruble', decimals: 2, locale: 'ru-RU', flag: '🇷🇺', region: 'Europe', countries: ['Russia'] },
  GEL: { code: 'GEL', numeric: '981', symbol: '₾', name: 'Georgian Lari', decimals: 2, locale: 'ka-GE', flag: '🇬🇪', region: 'Europe', countries: ['Georgia'] },
  AMD: { code: 'AMD', numeric: '051', symbol: '֏', name: 'Armenian Dram', decimals: 2, locale: 'hy-AM', flag: '🇦🇲', region: 'Europe', countries: ['Armenia'] },
  AZN: { code: 'AZN', numeric: '944', symbol: '₼', name: 'Azerbaijani Manat', decimals: 2, locale: 'az-AZ', flag: '🇦🇿', region: 'Europe', countries: ['Azerbaijan'] },
  GIP: { code: 'GIP', numeric: '292', symbol: '£', name: 'Gibraltar Pound', decimals: 2, locale: 'en-GI', flag: '🇬🇮', region: 'Europe', countries: ['Gibraltar'] },
  USD: { code: 'USD', numeric: '840', symbol: '$', name: 'US Dollar', decimals: 2, locale: 'en-US', flag: '🇺🇸', region: 'Americas', countries: ['United States', 'Ecuador', 'El Salvador', 'Panama', 'Puerto Rico', 'Timor-Leste', 'Zimbabwe'] },
  CAD: { code: 'CAD', numeric: '124', symbol: 'C$', name: 'Canadian Dollar', decimals: 2, locale: 'en-CA', flag: '🇨🇦', region: 'Americas', countries: ['Canada'] },
  MXN: { code: 'MXN', numeric: '484', symbol: 'Mex$', name: 'Mexican Peso', decimals: 2, locale: 'es-MX', flag: '🇲🇽', region: 'Americas', countries: ['Mexico'] },
  BRL: { code: 'BRL', numeric: '986', symbol: 'R$', name: 'Brazilian Real', decimals: 2, locale: 'pt-BR', flag: '🇧🇷', region: 'Americas', countries: ['Brazil'] },
  ARS: { code: 'ARS', numeric: '032', symbol: '$', name: 'Argentine Peso', decimals: 2, locale: 'es-AR', flag: '🇦🇷', region: 'Americas', countries: ['Argentina'] },
  CLP: { code: 'CLP', numeric: '152', symbol: '$', name: 'Chilean Peso', decimals: 0, locale: 'es-CL', flag: '🇨🇱', region: 'Americas', countries: ['Chile'] },
  COP: { code: 'COP', numeric: '170', symbol: '$', name: 'Colombian Peso', decimals: 2, locale: 'es-CO', flag: '🇨🇴', region: 'Americas', countries: ['Colombia'] },
  PEN: { code: 'PEN', numeric: '604', symbol: 'S/', name: 'Peruvian Sol', decimals: 2, locale: 'es-PE', flag: '🇵🇪', region: 'Americas', countries: ['Peru'] },
  UYU: { code: 'UYU', numeric: '858', symbol: '$U', name: 'Uruguayan Peso', decimals: 2, locale: 'es-UY', flag: '🇺🇾', region: 'Americas', countries: ['Uruguay'] },
  PYG: { code: 'PYG', numeric: '600', symbol: '₲', name: 'Paraguayan Guarani', decimals: 0, locale: 'es-PY', flag: '🇵🇾', region: 'Americas', countries: ['Paraguay'] },
  BOB: { code: 'BOB', numeric: '068', symbol: 'Bs.', name: 'Bolivian Boliviano', decimals: 2, locale: 'es-BO', flag: '🇧🇴', region: 'Americas', countries: ['Bolivia'] },
  VES: { code: 'VES', numeric: '928', symbol: 'Bs.', name: 'Venezuelan Bolivar', decimals: 2, locale: 'es-VE', flag: '🇻🇪', region: 'Americas', countries: ['Venezuela'] },
  GYD: { code: 'GYD', numeric: '328', symbol: 'G$', name: 'Guyanese Dollar', decimals: 2, locale: 'en-GY', flag: '🇬🇾', region: 'Americas', countries: ['Guyana'] },
  SRD: { code: 'SRD', numeric: '968', symbol: '$', name: 'Surinamese Dollar', decimals: 2, locale: 'nl-SR', flag: '🇸🇷', region: 'Americas', countries: ['Suriname'] },
  CRC: { code: 'CRC', numeric: '188', symbol: '₡', name: 'Costa Rican Colon', decimals: 2, locale: 'es-CR', flag: '🇨🇷', region: 'Americas', countries: ['Costa Rica'] },
  GTQ: { code: 'GTQ', numeric: '320', symbol: 'Q', name: 'Guatemalan Quetzal', decimals: 2, locale: 'es-GT', flag: '🇬🇹', region: 'Americas', countries: ['Guatemala'] },
  HNL: { code: 'HNL', numeric: '340', symbol: 'L', name: 'Honduran Lempira', decimals: 2, locale: 'es-HN', flag: '🇭🇳', region: 'Americas', countries: ['Honduras'] },
  NIO: { code: 'NIO', numeric: '558', symbol: 'C$', name: 'Nicaraguan Cordoba', decimals: 2, locale: 'es-NI', flag: '🇳🇮', region: 'Americas', countries: ['Nicaragua'] },
  PAB: { code: 'PAB', numeric: '590', symbol: 'B/.', name: 'Panamanian Balboa', decimals: 2, locale: 'es-PA', flag: '🇵🇦', region: 'Americas', countries: ['Panama'] },
  DOP: { code: 'DOP', numeric: '214', symbol: 'RD$', name: 'Dominican Peso', decimals: 2, locale: 'es-DO', flag: '🇩🇴', region: 'Americas', countries: ['Dominican Republic'] },
  CUP: { code: 'CUP', numeric: '192', symbol: '$', name: 'Cuban Peso', decimals: 2, locale: 'es-CU', flag: '🇨🇺', region: 'Americas', countries: ['Cuba'] },
  HTG: { code: 'HTG', numeric: '332', symbol: 'G', name: 'Haitian Gourde', decimals: 2, locale: 'fr-HT', flag: '🇭🇹', region: 'Americas', countries: ['Haiti'] },
  JMD: { code: 'JMD', numeric: '388', symbol: 'J$', name: 'Jamaican Dollar', decimals: 2, locale: 'en-JM', flag: '🇯🇲', region: 'Americas', countries: ['Jamaica'] },
  TTD: { code: 'TTD', numeric: '780', symbol: 'TT$', name: 'Trinidad & Tobago Dollar', decimals: 2, locale: 'en-TT', flag: '🇹🇹', region: 'Americas', countries: ['Trinidad and Tobago'] },
  BBD: { code: 'BBD', numeric: '052', symbol: 'Bds$', name: 'Barbadian Dollar', decimals: 2, locale: 'en-BB', flag: '🇧🇧', region: 'Americas', countries: ['Barbados'] },
  BSD: { code: 'BSD', numeric: '044', symbol: 'B$', name: 'Bahamian Dollar', decimals: 2, locale: 'en-BS', flag: '🇧🇸', region: 'Americas', countries: ['Bahamas'] },
  BZD: { code: 'BZD', numeric: '084', symbol: 'BZ$', name: 'Belize Dollar', decimals: 2, locale: 'en-BZ', flag: '🇧🇿', region: 'Americas', countries: ['Belize'] },
  XCD: { code: 'XCD', numeric: '951', symbol: 'EC$', name: 'East Caribbean Dollar', decimals: 2, locale: 'en-AG', flag: '🇦🇬', region: 'Americas', countries: ['Antigua and Barbuda', 'Dominica', 'Grenada', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Anguilla', 'Montserrat'] },
  KYD: { code: 'KYD', numeric: '136', symbol: 'CI$', name: 'Cayman Islands Dollar', decimals: 2, locale: 'en-KY', flag: '🇰🇾', region: 'Americas', countries: ['Cayman Islands'] },
  BMD: { code: 'BMD', numeric: '060', symbol: 'BD$', name: 'Bermudian Dollar', decimals: 2, locale: 'en-BM', flag: '🇧🇲', region: 'Americas', countries: ['Bermuda'] },
  AWG: { code: 'AWG', numeric: '533', symbol: 'ƒ', name: 'Aruban Florin', decimals: 2, locale: 'nl-AW', flag: '🇦🇼', region: 'Americas', countries: ['Aruba'] },
  ANG: { code: 'ANG', numeric: '532', symbol: 'ƒ', name: 'Netherlands Antillean Guilder', decimals: 2, locale: 'nl-CW', flag: '🇨🇼', region: 'Americas', countries: ['Curaçao', 'Sint Maarten'] },
  XPF: { code: 'XPF', numeric: '953', symbol: '₣', name: 'CFP Franc', decimals: 0, locale: 'fr-PF', flag: '🇵🇫', region: 'Oceania', countries: ['French Polynesia', 'New Caledonia', 'Wallis and Futuna'] },
  AUD: { code: 'AUD', numeric: '036', symbol: 'A$', name: 'Australian Dollar', decimals: 2, locale: 'en-AU', flag: '🇦🇺', region: 'Oceania', countries: ['Australia', 'Kiribati', 'Nauru', 'Tuvalu'] },
  NZD: { code: 'NZD', numeric: '554', symbol: 'NZ$', name: 'New Zealand Dollar', decimals: 2, locale: 'en-NZ', flag: '🇳🇿', region: 'Oceania', countries: ['New Zealand', 'Cook Islands', 'Niue', 'Tokelau'] },
  FJD: { code: 'FJD', numeric: '242', symbol: 'FJ$', name: 'Fijian Dollar', decimals: 2, locale: 'en-FJ', flag: '🇫🇯', region: 'Oceania', countries: ['Fiji'] },
  PGK: { code: 'PGK', numeric: '598', symbol: 'K', name: 'Papua New Guinean Kina', decimals: 2, locale: 'en-PG', flag: '🇵🇬', region: 'Oceania', countries: ['Papua New Guinea'] },
  SBD: { code: 'SBD', numeric: '090', symbol: 'SI$', name: 'Solomon Islands Dollar', decimals: 2, locale: 'en-SB', flag: '🇸🇧', region: 'Oceania', countries: ['Solomon Islands'] },
  VUV: { code: 'VUV', numeric: '548', symbol: 'VT', name: 'Vanuatu Vatu', decimals: 0, locale: 'bi-VU', flag: '🇻🇺', region: 'Oceania', countries: ['Vanuatu'] },
  WST: { code: 'WST', numeric: '882', symbol: 'T', name: 'Samoan Tala', decimals: 2, locale: 'sm-WS', flag: '🇼🇸', region: 'Oceania', countries: ['Samoa'] },
  TOP: { code: 'TOP', numeric: '776', symbol: 'T$', name: 'Tongan Paanga', decimals: 2, locale: 'to-TO', flag: '🇹🇴', region: 'Oceania', countries: ['Tonga'] },
  ZAR: { code: 'ZAR', numeric: '710', symbol: 'R', name: 'South African Rand', decimals: 2, locale: 'en-ZA', flag: '🇿🇦', region: 'Africa', countries: ['South Africa', 'Lesotho', 'Namibia', 'Eswatini'] },
  NGN: { code: 'NGN', numeric: '566', symbol: '₦', name: 'Nigerian Naira', decimals: 2, locale: 'en-NG', flag: '🇳🇬', region: 'Africa', countries: ['Nigeria'] },
  EGP: { code: 'EGP', numeric: '818', symbol: '£', name: 'Egyptian Pound', decimals: 2, locale: 'ar-EG', flag: '🇪🇬', region: 'Africa', countries: ['Egypt'] },
  KES: { code: 'KES', numeric: '404', symbol: 'KSh', name: 'Kenyan Shilling', decimals: 2, locale: 'sw-KE', flag: '🇰🇪', region: 'Africa', countries: ['Kenya'] },
  GHS: { code: 'GHS', numeric: '936', symbol: '₵', name: 'Ghanaian Cedi', decimals: 2, locale: 'en-GH', flag: '🇬🇭', region: 'Africa', countries: ['Ghana'] },
  MAD: { code: 'MAD', numeric: '504', symbol: 'د.م.', name: 'Moroccan Dirham', decimals: 2, locale: 'ar-MA', flag: '🇲🇦', region: 'Africa', countries: ['Morocco', 'Western Sahara'] },
  TZS: { code: 'TZS', numeric: '834', symbol: 'TSh', name: 'Tanzanian Shilling', decimals: 2, locale: 'sw-TZ', flag: '🇹🇿', region: 'Africa', countries: ['Tanzania'] },
  UGX: { code: 'UGX', numeric: '800', symbol: 'USh', name: 'Ugandan Shilling', decimals: 0, locale: 'en-UG', flag: '🇺🇬', region: 'Africa', countries: ['Uganda'] },
  ETB: { code: 'ETB', numeric: '230', symbol: 'Br', name: 'Ethiopian Birr', decimals: 2, locale: 'am-ET', flag: '🇪🇹', region: 'Africa', countries: ['Ethiopia'] },
  DZD: { code: 'DZD', numeric: '012', symbol: 'د.ج', name: 'Algerian Dinar', decimals: 2, locale: 'ar-DZ', flag: '🇩🇿', region: 'Africa', countries: ['Algeria'] },
  TND: { code: 'TND', numeric: '788', symbol: 'د.ت', name: 'Tunisian Dinar', decimals: 3, locale: 'ar-TN', flag: '🇹🇳', region: 'Africa', countries: ['Tunisia'] },
  LYD: { code: 'LYD', numeric: '434', symbol: 'ل.د', name: 'Libyan Dinar', decimals: 3, locale: 'ar-LY', flag: '🇱🇾', region: 'Africa', countries: ['Libya'] },
  SDG: { code: 'SDG', numeric: '938', symbol: 'ج.س.', name: 'Sudanese Pound', decimals: 2, locale: 'ar-SD', flag: '🇸🇩', region: 'Africa', countries: ['Sudan'] },
  SSP: { code: 'SSP', numeric: '728', symbol: '£', name: 'South Sudanese Pound', decimals: 2, locale: 'en-SS', flag: '🇸🇸', region: 'Africa', countries: ['South Sudan'] },
  ZMW: { code: 'ZMW', numeric: '967', symbol: 'ZK', name: 'Zambian Kwacha', decimals: 2, locale: 'en-ZM', flag: '🇿🇲', region: 'Africa', countries: ['Zambia'] },
  ZWG: { code: 'ZWG', numeric: '924', symbol: 'ZiG', name: 'Zimbabwe Gold', decimals: 2, locale: 'en-ZW', flag: '🇿🇼', region: 'Africa', countries: ['Zimbabwe'] },
  MWK: { code: 'MWK', numeric: '454', symbol: 'MK', name: 'Malawian Kwacha', decimals: 2, locale: 'en-MW', flag: '🇲🇼', region: 'Africa', countries: ['Malawi'] },
  MZN: { code: 'MZN', numeric: '943', symbol: 'MT', name: 'Mozambican Metical', decimals: 2, locale: 'pt-MZ', flag: '🇲🇿', region: 'Africa', countries: ['Mozambique'] },
  AOA: { code: 'AOA', numeric: '973', symbol: 'Kz', name: 'Angolan Kwanza', decimals: 2, locale: 'pt-AO', flag: '🇦🇴', region: 'Africa', countries: ['Angola'] },
  BWP: { code: 'BWP', numeric: '072', symbol: 'P', name: 'Botswana Pula', decimals: 2, locale: 'en-BW', flag: '🇧🇼', region: 'Africa', countries: ['Botswana'] },
  NAD: { code: 'NAD', numeric: '516', symbol: 'N$', name: 'Namibian Dollar', decimals: 2, locale: 'en-NA', flag: '🇳🇦', region: 'Africa', countries: ['Namibia'] },
  LSL: { code: 'LSL', numeric: '426', symbol: 'L', name: 'Lesotho Loti', decimals: 2, locale: 'en-LS', flag: '🇱🇸', region: 'Africa', countries: ['Lesotho'] },
  SZL: { code: 'SZL', numeric: '748', symbol: 'E', name: 'Eswatini Lilangeni', decimals: 2, locale: 'en-SZ', flag: '🇸🇿', region: 'Africa', countries: ['Eswatini'] },
  MUR: { code: 'MUR', numeric: '480', symbol: '₨', name: 'Mauritian Rupee', decimals: 2, locale: 'en-MU', flag: '🇲🇺', region: 'Africa', countries: ['Mauritius'] },
  SCR: { code: 'SCR', numeric: '690', symbol: '₨', name: 'Seychellois Rupee', decimals: 2, locale: 'en-SC', flag: '🇸🇨', region: 'Africa', countries: ['Seychelles'] },
  MGA: { code: 'MGA', numeric: '969', symbol: 'Ar', name: 'Malagasy Ariary', decimals: 2, locale: 'mg-MG', flag: '🇲🇬', region: 'Africa', countries: ['Madagascar'] },
  KMF: { code: 'KMF', numeric: '174', symbol: 'CF', name: 'Comorian Franc', decimals: 0, locale: 'fr-KM', flag: '🇰🇲', region: 'Africa', countries: ['Comoros'] },
  DJF: { code: 'DJF', numeric: '262', symbol: 'Fdj', name: 'Djiboutian Franc', decimals: 0, locale: 'fr-DJ', flag: '🇩🇯', region: 'Africa', countries: ['Djibouti'] },
  SOS: { code: 'SOS', numeric: '706', symbol: 'Sh', name: 'Somali Shilling', decimals: 2, locale: 'so-SO', flag: '🇸🇴', region: 'Africa', countries: ['Somalia'] },
  ERN: { code: 'ERN', numeric: '232', symbol: 'Nfk', name: 'Eritrean Nakfa', decimals: 2, locale: 'ti-ER', flag: '🇪🇷', region: 'Africa', countries: ['Eritrea'] },
  RWF: { code: 'RWF', numeric: '646', symbol: 'FRw', name: 'Rwandan Franc', decimals: 0, locale: 'rw-RW', flag: '🇷🇼', region: 'Africa', countries: ['Rwanda'] },
  BIF: { code: 'BIF', numeric: '108', symbol: 'FBu', name: 'Burundian Franc', decimals: 0, locale: 'fr-BI', flag: '🇧🇮', region: 'Africa', countries: ['Burundi'] },
  CDF: { code: 'CDF', numeric: '976', symbol: 'FC', name: 'Congolese Franc', decimals: 2, locale: 'fr-CD', flag: '🇨🇩', region: 'Africa', countries: ['DR Congo'] },
  XAF: { code: 'XAF', numeric: '950', symbol: 'FCFA', name: 'Central African CFA Franc', decimals: 0, locale: 'fr-CM', flag: '🇨🇲', region: 'Africa', countries: ['Cameroon', 'Central African Republic', 'Chad', 'Republic of the Congo', 'Equatorial Guinea', 'Gabon'] },
  XOF: { code: 'XOF', numeric: '952', symbol: 'CFA', name: 'West African CFA Franc', decimals: 0, locale: 'fr-SN', flag: '🇸🇳', region: 'Africa', countries: ['Benin', 'Burkina Faso', 'Ivory Coast', 'Guinea-Bissau', 'Mali', 'Niger', 'Senegal', 'Togo'] },
  GNF: { code: 'GNF', numeric: '324', symbol: 'FG', name: 'Guinean Franc', decimals: 0, locale: 'fr-GN', flag: '🇬🇳', region: 'Africa', countries: ['Guinea'] },
  GMD: { code: 'GMD', numeric: '270', symbol: 'D', name: 'Gambian Dalasi', decimals: 2, locale: 'en-GM', flag: '🇬🇲', region: 'Africa', countries: ['Gambia'] },
  SLE: { code: 'SLE', numeric: '925', symbol: 'Le', name: 'Sierra Leonean Leone', decimals: 2, locale: 'en-SL', flag: '🇸🇱', region: 'Africa', countries: ['Sierra Leone'] },
  LRD: { code: 'LRD', numeric: '430', symbol: 'L$', name: 'Liberian Dollar', decimals: 2, locale: 'en-LR', flag: '🇱🇷', region: 'Africa', countries: ['Liberia'] },
  CVE: { code: 'CVE', numeric: '132', symbol: '$', name: 'Cape Verdean Escudo', decimals: 2, locale: 'pt-CV', flag: '🇨🇻', region: 'Africa', countries: ['Cape Verde'] },
  STN: { code: 'STN', numeric: '930', symbol: 'Db', name: 'Sao Tome & Principe Dobra', decimals: 2, locale: 'pt-ST', flag: '🇸🇹', region: 'Africa', countries: ['Sao Tome and Principe'] },
  MRU: { code: 'MRU', numeric: '929', symbol: 'UM', name: 'Mauritanian Ouguiya', decimals: 2, locale: 'ar-MR', flag: '🇲🇷', region: 'Africa', countries: ['Mauritania'] },
  SHP: { code: 'SHP', numeric: '654', symbol: '£', name: 'Saint Helena Pound', decimals: 2, locale: 'en-SH', flag: '🇸🇭', region: 'Africa', countries: ['Saint Helena'] },
  XAU: { code: 'XAU', numeric: '959', symbol: 'Au', name: 'Gold (troy ounce)', decimals: 2, locale: 'en-US', flag: '🥇', region: 'Metals', countries: ['—'] },
  XAG: { code: 'XAG', numeric: '961', symbol: 'Ag', name: 'Silver (troy ounce)', decimals: 2, locale: 'en-US', flag: '🥈', region: 'Metals', countries: ['—'] },
  XDR: { code: 'XDR', numeric: '960', symbol: 'SDR', name: 'IMF Special Drawing Rights', decimals: 2, locale: 'en-US', flag: '🏦', region: 'Metals', countries: ['IMF'] },
}

export const CURRENCY_CODES = Object.keys(CURRENCIES)

export const CURRENCY_REGIONS = ['South Asia', 'Southeast Asia', 'East Asia', 'Central Asia', 'Middle East', 'Europe', 'Americas', 'Oceania', 'Africa', 'Metals']

/** Currencies bucketed by region, in the declared region order. */
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
      if (country === '\u2014') continue
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
