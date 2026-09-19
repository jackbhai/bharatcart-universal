/**
 * Backend selector — the single place the app asks "which database is active?".
 *
 *   import { getBackend } from 'src/engines/backend/index.js'
 *   const { rows } = await getBackend().listProducts({ limit: 20 })
 *
 * The choice comes from the Integrations hub (Admin → Integrations →
 * Database), read through the integrations store contract:
 *   getIntegrationConfig('database') → { providerId, config }
 * Secrets are resolved from VITE_ env vars first (getEffectiveValue) and are
 * only ever held in memory — this module never persists or logs them.
 *
 * If nothing is configured — or the selected provider is missing required
 * values — the app falls back to the local development adapter with a loud
 * console warning, so the storefront never breaks, but the operator is told
 * exactly what is wrong and where to fix it.
 *
 * NOTE: this is the DATA layer (products, orders, customers, settings).
 * Auth/session/file-storage still live in src/backend/*, whose adapters
 * expose auth, storage and realtime alongside their own db access. The two
 * layers are documented together in docs/16-BACKEND.md.
 */
import {
  getIntegrationConfig, getProvider, getEffectiveValue,
} from '../integrations/store.js'
import { assertConforms } from './BackendAdapter.js'
import { createLocalAdapter } from './adapters/local.js'
import { createSupabaseAdapter } from './adapters/supabase.js'
import { createFirebaseAdapter } from './adapters/firebase.js'
import { createNeonAdapter } from './adapters/neon.js'
import { createRestAdapter } from './adapters/rest.js'

const FACTORIES = {
  supabase: createSupabaseAdapter,
  firebase: createFirebaseAdapter,
  neon: createNeonAdapter,
  rest: createRestAdapter,
}

const LABELS = {
  supabase: 'Supabase',
  firebase: 'Firebase',
  neon: 'Neon',
  rest: 'Custom REST API',
  'local-dev': 'Local development',
}

/** Resolve the provider choice + effective (env-first) field values. */
export function resolveDatabaseConfig() {
  const { providerId, config } = getIntegrationConfig('database')
  const provider = providerId ? getProvider('database', providerId) : null
  const values = {}
  for (const field of provider?.fields ?? []) {
    values[field.key] = getEffectiveValue(field, config)
  }
  return { providerId: providerId || null, provider, values }
}

function requiredPresent(provider, values) {
  return (provider?.fields ?? []).every(f => {
    if (!f.required) return true
    const v = values[f.key]
    return v !== '' && v !== undefined && v !== null
  })
}

let cached = null
let fallbackWarned = false

/**
 * The active backend adapter. Cached after the first call — call
 * resetBackend() after changing the database configuration (the admin
 * Integrations hub does this on save).
 */
export function getBackend() {
  if (cached) return cached
  const { providerId, provider, values } = resolveDatabaseConfig()
  const factory = FACTORIES[providerId]
  if (factory && provider && requiredPresent(provider, values)) {
    try {
      const adapter = factory(values)
      assertConforms(adapter)
      cached = adapter
      return cached
    } catch (err) {
      // Never leave the storefront stranded on a broken backend.
      console.error(
        `[backend] "${providerId}" database failed to initialise (${err?.message || err}). ` +
        'Falling back to local development storage — data stays in this browser only.'
      )
    }
  } else if (providerId && providerId !== 'local-dev') {
    if (!fallbackWarned) {
      fallbackWarned = true
      console.warn(
        `[backend] "${LABELS[providerId] || providerId}" is selected as the database but is not fully ` +
        'configured. Connect it in Admin → Integrations → Database (or set the matching VITE_ variables ' +
        'from .env.example). Using local development storage in the meantime — data stays in this browser only.'
      )
    }
  }
  cached = createLocalAdapter()
  return cached
}

/** Drop the cached adapter so the next getBackend() re-reads the config. */
export function resetBackend() {
  cached = null
}

/**
 * Honest description of the active backend, for the admin UI. Never includes
 * credential values — only whether the backend is real, dev-only, or
 * misconfigured.
 */
export function backendInfo() {
  const { providerId, provider, values } = resolveDatabaseConfig()
  const configured = Boolean(provider) && requiredPresent(provider, values)

  if (providerId && FACTORIES[providerId] && configured) {
    return {
      id: providerId,
      label: LABELS[providerId],
      providerName: provider.name,
      isDevOnly: false,
      configured: true,
      misconfigured: false,
      detail:
        `Data lives in ${provider.name}. Credentials resolve from environment variables ` +
        '(never shown here).',
    }
  }
  if (providerId && providerId !== 'local-dev') {
    return {
      id: 'local',
      label: 'Local development',
      providerName: 'Local',
      isDevOnly: true,
      configured: false,
      misconfigured: true,
      selectedProvider: providerId,
      selectedLabel: LABELS[providerId] || providerId,
      detail:
        `"${LABELS[providerId] || providerId}" is selected but not fully configured — ` +
        'data is in this browser only. Connect it in Admin → Integrations → Database.',
    }
  }
  return {
    id: 'local',
    label: 'Local development',
    providerName: 'Local',
    isDevOnly: true,
    configured: true,
    misconfigured: false,
    detail:
      'Development only — products, orders and customers live in this browser\u2019s localStorage ' +
      'and do not sync across devices. Connect a cloud database in Admin → Integrations → Database ' +
      'before taking real orders.',
  }
}

/** True when product/order/customer data lives in a real cloud database. */
export function isCloudBackend() {
  return backendInfo().id !== 'local'
}

export default { getBackend, resetBackend, backendInfo, isCloudBackend, resolveDatabaseConfig }
