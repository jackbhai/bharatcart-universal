/**
 * Geo layer entry point.
 *
 * Re-exports the generated country table plus the higher-level helpers that
 * combine it with the currency and tax layers. Import from here, not from
 * `countries.js` directly, so the generated file can be regenerated freely.
 */
export * from './countries.js'
export * from './shipping.js'
export * from './addressFormat.js'
export { default as COUNTRIES } from './countries.js'
