/**
 * Module-level "currently displayed currency".
 *
 * Why a mutable module singleton rather than passing currency through props or
 * context: there are ~295 call sites of `inr()` across 28 components, most of
 * them deep inside table column renderers and chart tick formatters that are
 * plain functions with no access to React context. Threading a currency through
 * all of them would mean touching every one of those files and converting many
 * pure helpers into hooks.
 *
 * Instead the store writes the active currency here whenever it changes, and
 * `inr()` reads it. The trade-off is that this value is global — acceptable
 * because the app only ever displays one currency at a time, and a mismatch
 * would be visible immediately across the whole screen rather than subtly in
 * one widget.
 *
 * `subscribe` exists so React can force a re-render after a switch; without it
 * components holding already-formatted strings would keep showing stale ones
 * until some unrelated state change happened to re-render them.
 */
import { BASE_CURRENCY } from './rates.js'
import { isSupported } from './currencies.js'
import { DEFAULT_LANGUAGE, getLanguage } from '../i18n/languages.js'

let activeCurrency = BASE_CURRENCY
let activeLanguage = DEFAULT_LANGUAGE
let activeOverrides = {}
let version = 0

const listeners = new Set()

function emit() {
  version += 1
  for (const fn of listeners) fn(version)
}

export function getActiveCurrency() {
  return activeCurrency
}

export function getActiveLanguage() {
  return activeLanguage
}

export function getActiveLocale() {
  return getLanguage(activeLanguage).locale
}

export function getActiveOverrides() {
  return activeOverrides
}

export function getVersion() {
  return version
}

export function setActiveCurrency(code) {
  if (!isSupported(code) || code === activeCurrency) return activeCurrency
  activeCurrency = code
  emit()
  return activeCurrency
}

export function setActiveLanguage(code) {
  if (code === activeLanguage) return activeLanguage
  activeLanguage = code
  emit()
  return activeLanguage
}

export function setActiveOverrides(overrides) {
  activeOverrides = overrides && typeof overrides === 'object' ? overrides : {}
  emit()
  return activeOverrides
}

/** Apply language + currency + overrides in one go, emitting at most once. */
export function setActiveLocale({ language, currency, rateOverrides } = {}) {
  let changed = false
  if (language != null && language !== activeLanguage) { activeLanguage = language; changed = true }
  if (currency != null && isSupported(currency) && currency !== activeCurrency) { activeCurrency = currency; changed = true }
  if (rateOverrides != null && rateOverrides !== activeOverrides) { activeOverrides = rateOverrides; changed = true }
  if (changed) emit()
  return { language: activeLanguage, currency: activeCurrency, rateOverrides: activeOverrides }
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Restore defaults — used between test cases so one test cannot leak into the next. */
export function resetActive() {
  activeCurrency = BASE_CURRENCY
  activeLanguage = DEFAULT_LANGUAGE
  activeOverrides = {}
  emit()
}

export default getActiveCurrency
