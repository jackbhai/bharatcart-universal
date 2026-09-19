/**
 * Integration configuration store.
 *
 * Persists per-category provider choice + NON-SECRET field values in
 * localStorage (via the safe storage wrapper, which falls back to memory
 * when localStorage is unavailable).
 *
 * SECURITY RULE — enforced here, not just documented:
 *   Secrets are NEVER written to localStorage by this module.
 *   setIntegrationConfig() strips every field marked secret (or with
 *   type 'password') before persisting. Secrets live ONLY in VITE_ env
 *   vars, which the merchant sets in their .env file or host dashboard
 *   (Vercel/Netlify → Environment Variables). The admin UI shows only
 *   presence ("Set"/"Missing") via getEnvStatus(), never values.
 *
 * CONTRACT (other agents depend on these exact exports):
 *   getProviders(category)            -> provider defs for the category
 *   getProvider(category, providerId) -> def or null
 *   getIntegrationConfig(category)    -> { providerId: string|null, config: object }
 *   setIntegrationConfig(category, providerId, config) -> void
 *   clearIntegration(category)        -> void
 *   isConfigured(category)            -> boolean
 *   getEnvStatus(envVar)              -> 'set' | 'missing'
 *   getEffectiveValue(field, config)  -> import.meta.env[field.envVar] ?? config[field.key] ?? ''
 */
import { storage } from '../../core/persist/storage.js'
import {
  PROVIDER_CATEGORIES,
  PROVIDERS,
  getProviders as _getProviders,
  getProvider as _getProvider,
} from './providers.js'

export { PROVIDER_CATEGORIES, PROVIDERS }
export const getProviders = _getProviders
export const getProvider = _getProvider

const LS_KEY = 'bc.integrations.v1'
const WH_KEY = 'bc.webhooks.v1'

function readAll() {
  const all = storage.getJSON(LS_KEY, {})
  return all && typeof all === 'object' ? all : {}
}

function writeAll(all) {
  storage.setJSON(LS_KEY, all)
}

function isSecretField(field) {
  return field?.secret === true || field?.type === 'password'
}

/** { providerId: string|null, config: object } — config holds NON-SECRET values only. */
export function getIntegrationConfig(category) {
  const entry = readAll()[category]
  if (!entry || typeof entry !== 'object') return { providerId: null, config: {} }
  return {
    providerId: entry.providerId ?? null,
    config: entry.config && typeof entry.config === 'object' ? entry.config : {},
  }
}

/**
 * Persist the provider choice + non-secret field values.
 * Secret fields (secret: true or type 'password') are STRIPPED — they must
 * come from VITE_ env vars instead. Pass providerId null to only clear.
 */
export function setIntegrationConfig(category, providerId, config = {}) {
  const def = providerId ? getProvider(category, providerId) : null
  const safe = {}
  for (const [k, v] of Object.entries(config ?? {})) {
    const field = def?.fields?.find(f => f.key === k)
    if (field && isSecretField(field)) continue // never persist secrets
    safe[k] = v
  }
  const all = readAll()
  all[category] = { providerId, config: safe }
  writeAll(all)
}

/** Remove the whole category configuration. */
export function clearIntegration(category) {
  const all = readAll()
  delete all[category]
  writeAll(all)
}

/** Env value wins, then the saved (non-secret) form value, then ''. Never reveals anything beyond the value itself. */
export function getEffectiveValue(field, config = {}) {
  if (!field) return ''
  if (field.envVar) {
    const env = import.meta.env[field.envVar]
    if (env !== undefined && env !== null && env !== '') return env
  }
  const saved = (config ?? {})[field.key]
  return saved ?? ''
}

/** Presence of an env var — 'set' | 'missing'. Values are never exposed. */
export function getEnvStatus(envVar) {
  if (!envVar) return 'missing'
  const v = import.meta.env[envVar]
  return v ? 'set' : 'missing'
}

/**
 * True when a provider is chosen AND every required field resolves to a
 * non-empty value (from env or from the saved non-secret config).
 */
export function isConfigured(category) {
  const { providerId, config } = getIntegrationConfig(category)
  if (!providerId) return false
  const def = getProvider(category, providerId)
  if (!def) return false
  return (def.fields ?? []).every(f => {
    if (!f.required) return true
    const v = getEffectiveValue(f, config)
    return v !== '' && v !== undefined && v !== null
  })
}

/* ------------------------------------------------------------------ */
/* Real user-owned webhooks (no fake delivery stats anywhere)           */
/* ------------------------------------------------------------------ */

function readWebhooks() {
  const list = storage.getJSON(WH_KEY, [])
  return Array.isArray(list) ? list : []
}

function writeWebhooks(list) {
  storage.setJSON(WH_KEY, list)
}

function randomSecret() {
  const bytes = new Uint8Array(24)
  const c = globalThis.crypto
  if (c?.getRandomValues) c.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/** The merchant's own webhook endpoints. Starts empty — nothing fake. */
export function getWebhooks() {
  return readWebhooks()
}

/** Add an endpoint. Returns the created webhook (with a signing secret). */
export function addWebhook({ url, events }) {
  const clean = String(url || '').trim()
  if (!/^https?:\/\/.+/.test(clean)) throw new Error('Enter a valid http(s) URL.')
  const list = readWebhooks()
  const hook = {
    id: 'wh_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    url: clean,
    events: Array.isArray(events) ? [...new Set(events)] : [],
    secret: randomSecret(),
    createdAt: Date.now(),
    lastTestAt: null,
    lastTest: null, // { ok, httpStatus|null, error|null } — real results only
  }
  list.push(hook)
  writeWebhooks(list)
  return hook
}

export function removeWebhook(id) {
  writeWebhooks(readWebhooks().filter(w => w.id !== id))
}

/** Record the REAL outcome of a test delivery (called after the POST). */
export function recordWebhookTest(id, result) {
  const list = readWebhooks()
  const hook = list.find(w => w.id === id)
  if (!hook) return
  hook.lastTestAt = Date.now()
  hook.lastTest = {
    ok: Boolean(result?.ok),
    httpStatus: result?.httpStatus ?? null,
    error: result?.error ?? null,
  }
  writeWebhooks(list)
}

export default {
  getProviders, getProvider, getIntegrationConfig, setIntegrationConfig,
  clearIntegration, isConfigured, getEnvStatus, getEffectiveValue,
  getWebhooks, addWebhook, removeWebhook, recordWebhookTest,
}
