/**
 * Auth engine entry point.
 *
 * getAuth() selects the provider the merchant connected in
 * Admin → Integrations → Auth (src/engines/integrations/store.js), and
 * hands back an AuthProvider (see AuthProvider.js for the contract).
 *
 * Selection rules — honest, never silent:
 * - A configured cloud provider (supabase-auth, firebase-auth, clerk,
 *   custom-jwt) is used as-is.
 * - Nothing configured yet, or "Local development" explicitly chosen:
 *   the local-dev provider. When nothing was configured at all we log a
 *   console warning so a merchant never mistakes dev auth for production.
 * - A cloud provider selected but missing its credentials: LOUD console
 *   error + fall back to local-dev, and getAuthInfo() reports
 *   misconfigured:true so the login UI can show a warning banner.
 *
 * Config resolution: publishable values come from VITE_ env vars first,
 * then the (non-secret) values saved in the Integrations hub. Secrets are
 * never read from localStorage — the integrations store strips them.
 */
import { getIntegrationConfig, getProvider, getEffectiveValue, isConfigured } from '../integrations/store.js'
import { AuthError } from './AuthProvider.js'
import localProvider from './providers/local.js'
import { createSupabaseProvider } from './providers/supabase.js'
import { createFirebaseProvider } from './providers/firebase.js'
import { createClerkProvider } from './providers/clerk.js'
import { createJwtProvider } from './providers/custom-jwt.js'

export { AuthError }
export { mapCloudRole, normaliseAuthUser, assertAuthProvider } from './AuthProvider.js'

/** Resolve a provider's field values: env var wins, then saved non-secret config. */
export function readAuthConfig(providerId) {
  const def = getProvider('auth', providerId)
  const { config } = getIntegrationConfig('auth')
  const out = {}
  for (const f of def?.fields || []) {
    out[f.key] = getEffectiveValue(f, config)
  }
  return out
}

function buildProvider(providerId) {
  switch (providerId) {
    case 'supabase-auth': {
      const { url, anonKey } = readAuthConfig('supabase-auth')
      return createSupabaseProvider({ url, anonKey })
    }
    case 'firebase-auth': {
      const { apiKey } = readAuthConfig('firebase-auth')
      return createFirebaseProvider({ apiKey })
    }
    case 'clerk': {
      const { publishableKey } = readAuthConfig('clerk')
      return createClerkProvider({ publishableKey })
    }
    case 'custom-jwt': {
      const { jwksUrl, issuer } = readAuthConfig('custom-jwt')
      return createJwtProvider({ jwksUrl, issuer })
    }
    case 'local-dev':
    default:
      return localProvider
  }
}

let cache = { key: null, provider: null }
let warnedEmpty = false

/** Force getAuth() to re-read the Integrations config on next call. */
export function refreshAuth() {
  cache = { key: null, provider: null }
}

if (typeof window !== 'undefined') {
  // If the merchant changes the auth provider in the Integrations hub,
  // pick it up without a reload (same-tab writes + other tabs).
  window.addEventListener('storage', (e) => {
    if (e.key === 'bc.integrations.v1') refreshAuth()
  })
}

/**
 * The active AuthProvider. Cached while the selection is unchanged.
 */
export function getAuth() {
  const { providerId, config } = getIntegrationConfig('auth')
  const key = `${providerId || 'none'}:${JSON.stringify(config || {})}`
  if (cache.key === key && cache.provider) return cache.provider

  let selected = providerId || 'local-dev'

  if (!providerId) {
    if (!warnedEmpty) {
      warnedEmpty = true
      console.warn(
        '[auth] No auth provider is configured (Admin → Integrations → Auth). ' +
        'Using LOCAL DEV auth: accounts live in this browser only. ' +
        'Connect Supabase Auth, Firebase Auth, Clerk or your own JWT issuer before going live.'
      )
    }
  } else if (selected !== 'local-dev' && !isConfigured('auth')) {
    console.error(
      `[auth] MISCONFIGURED: "${selected}" is selected in Integrations → Auth but its credentials are missing. ` +
      'Falling back to local dev auth — nobody can sign in with the cloud provider until it is configured.'
    )
    selected = 'local-dev'
  }

  const provider = buildProvider(selected)
  cache = { key, provider }
  return provider
}

/**
 * UI-facing status: which provider is behind sign-in right now.
 * { providerId, providerName, isCloud, isConfigured, misconfigured }
 */
export function getAuthInfo() {
  const { providerId } = getIntegrationConfig('auth')
  const def = providerId ? getProvider('auth', providerId) : null
  const cloud = Boolean(providerId && providerId !== 'local-dev')
  return {
    providerId: providerId || 'local-dev',
    providerName: def?.name || 'Local development',
    isCloud: cloud,
    isConfigured: isConfigured('auth'),
    misconfigured: cloud && !isConfigured('auth'),
  }
}
