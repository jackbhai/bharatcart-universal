/**
 * Backend registry. The app imports `backend` and never cares which
 * adapter is behind it. Switch at runtime from Settings → Backend,
 * or at build time with VITE_BACKEND.
 */
import local from './adapters/local.js'
import supabase from './adapters/supabase.js'
import firebase from './adapters/firebase.js'
import cloudflare from './adapters/cloudflare.js'
import storage from '../core/persist/storage.js'
import bus from '../core/events/EventBus.js'
import T from '../core/events/topics.js'

const ACTIVE_KEY = 'bharatcart:backend:active'

export const adapters = { local, supabase, firebase, cloudflare }
export const adapterList = [local, supabase, firebase, cloudflare]

function envDefault() {
  const v = (import.meta.env?.VITE_BACKEND || '').toLowerCase()
  return adapters[v] ? v : 'local'
}

export function getActiveId() {
  const saved = storage.get(ACTIVE_KEY)
  if (saved && adapters[saved]) return saved
  return envDefault()
}

/**
 * Production adapters that were selected but cannot run because their
 * configuration is missing. Shown in the admin panel and logged loudly —
 * silently falling back to local demo mode is how stores lose orders.
 */
export function configWarnings() {
  const id = getActiveId()
  if (id === 'local') return []
  const a = adapters[id]
  if (!a) return [{ id, label: id, message: `Unknown backend "${id}" — check VITE_BACKEND.` }]
  if (!a.isConfigured()) {
    return [{
      id,
      label: a.label,
      message: `"${a.label}" is selected but not configured. ` +
        'Add its credentials in Settings → Backend (or the matching VITE_* env vars) ' +
        'or switch back to Local. Running on the Local fallback in the meantime.',
    }]
  }
  return []
}

let fallbackLogged = false

export function getActive() {
  const id = getActiveId()
  const a = adapters[id]
  // never leave the user stranded: fall back to local if unconfigured
  if (!a.isConfigured()) {
    if (id !== 'local') {
      if (!fallbackLogged) {
        fallbackLogged = true
        console.error(
          `[backend] MISCONFIGURED: "${id}" was selected via ${storage.get(ACTIVE_KEY) ? 'Settings → Backend' : 'VITE_BACKEND'} ` +
          `but has no credentials. Falling back to the local demo backend — ` +
          `orders and customers are stored in this browser only. ` +
          `Fix it in Settings → Backend or set the ${id.toUpperCase()} env vars (see .env.example).`
        )
      }
      return local
    }
  }
  return a
}

export function setActive(id) {
  if (!adapters[id]) throw new Error(`Unknown backend "${id}"`)
  storage.set(ACTIVE_KEY, id)
  bus.emit(T.AUTH_BACKEND_CHANGED, { backend: id })
  return adapters[id]
}

/** Live proxy — always routes to whichever adapter is active right now. */
function route(section) {
  return new Proxy({}, {
    get(_, prop) {
      const a = getActive()
      const target = a[section]
      const val = target?.[prop]
      return typeof val === 'function' ? val.bind(target) : val
    },
  })
}

export const backend = {
  get id() { return getActive().id },
  get label() { return getActive().label },
  get adapter() { return getActive() },
  get isFallback() { return getActiveId() !== getActive().id },

  auth: route('auth'),
  db: route('db'),
  storage: route('storage'),
  realtime: route('realtime'),

  list: adapterList.map(a => ({
    id: a.id, label: a.label, description: a.description,
    configured: a.isConfigured(),
  })),

  setActive, getActiveId, adapters,

  /** Selected-but-unconfigured production adapters (admin-visible). */
  get warnings() { return configWarnings() },
}

export default backend
