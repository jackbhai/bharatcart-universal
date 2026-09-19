import bus from '../events/EventBus.js'
import T from '../events/topics.js'
import storage from '../persist/storage.js'
import { migrate, envelope, SCHEMA_VERSION } from '../persist/migrations.js'

const STORAGE_KEY = 'bharatcart:state:v1'
const SYNC_KEY = 'bharatcart:sync'

/**
 * Lightweight slice store. Zero dependencies.
 *  - slices: { name: { initial, actions, persist? } }
 *  - actions are (state, payload) => partialState
 *  - persisted to localStorage (debounced) and synced across tabs
 */
export function createStore(slices, opts = {}) {
  const {
    storageKey = STORAGE_KEY,
    persist = true,
    crossTab = true,
    debounceMs = 180,
  } = opts

  const tabId = Math.random().toString(36).slice(2, 10)
  const listeners = new Set()
  const sliceListeners = new Map()
  let state = {}
  const persistedSlices = new Set()

  // ---- build initial state
  for (const [name, slice] of Object.entries(slices)) {
    state[name] = typeof slice.initial === 'function' ? slice.initial() : structuredCloneSafe(slice.initial)
    if (slice.persist !== false) persistedSlices.add(name)
  }

  // ---- hydrate
  if (persist) {
    const stored = storage.getJSON(storageKey)
    const data = migrate(stored, SCHEMA_VERSION)
    if (data) {
      for (const name of Object.keys(state)) {
        if (data[name] != null && persistedSlices.has(name)) {
          state[name] = mergeSlice(state[name], data[name])
        }
      }
      bus.emit(T.STORE_HYDRATED, { keys: Object.keys(data) })
    }
  }

  // ---- persistence (debounced)
  let flushTimer = null
  function schedulePersist() {
    if (!persist) return
    clearTimeout(flushTimer)
    flushTimer = setTimeout(flush, debounceMs)
  }

  function flush() {
    if (!persist) return
    const out = {}
    for (const name of persistedSlices) out[name] = state[name]
    storage.setJSON(storageKey, envelope(out))
    if (crossTab) {
      // notify other tabs; value must change to fire the storage event
      storage.set(SYNC_KEY, JSON.stringify({ tabId, at: Date.now() }))
    }
  }

  // ---- cross-tab sync
  if (crossTab && typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== SYNC_KEY || !e.newValue) return
      let msg
      try { msg = JSON.parse(e.newValue) } catch { return }
      if (msg.tabId === tabId) return

      const stored = storage.getJSON(storageKey)
      const data = migrate(stored, SCHEMA_VERSION)
      if (!data) return

      const changed = []
      for (const name of Object.keys(state)) {
        if (data[name] != null && persistedSlices.has(name)) {
          if (!shallowEqualJSON(state[name], data[name])) {
            state[name] = data[name]
            changed.push(name)
          }
        }
      }
      if (changed.length) {
        bus.emit(T.CROSS_TAB_SYNC, { slices: changed })
        changed.forEach(n => notifySlice(n))
        notifyAll()
      }
    })
  }

  // ---- notify
  function notifyAll() { for (const l of [...listeners]) safe(l, state) }
  function notifySlice(name) {
    const set = sliceListeners.get(name)
    if (set) for (const l of [...set]) safe(l, state[name])
  }

  // ---- api
  const api = {
    tabId,

    getState: () => state,
    get: (name) => state[name],

    /** dispatch('slice/action', payload) */
    dispatch(type, payload) {
      const [sliceName, actionName] = String(type).split('/')
      const slice = slices[sliceName]
      if (!slice) throw new Error(`[store] unknown slice "${sliceName}"`)
      const action = slice.actions?.[actionName]
      if (!action) throw new Error(`[store] unknown action "${type}"`)

      const prev = state[sliceName]
      const result = action(prev, payload, { getState: api.getState, dispatch: api.dispatch })
      if (result === undefined) return state[sliceName]

      const next = result === prev ? prev : { ...prev, ...result }
      if (next === prev) return prev

      state = { ...state, [sliceName]: next }
      notifySlice(sliceName)
      notifyAll()
      bus.emit(T.SLICE_CHANGED, { slice: sliceName, action: actionName, payload })
      if (persistedSlices.has(sliceName)) schedulePersist()
      return next
    },

    /** direct setter, mainly for bulk imports */
    setSlice(name, value) {
      if (!(name in state)) throw new Error(`[store] unknown slice "${name}"`)
      state = { ...state, [name]: value }
      notifySlice(name)
      notifyAll()
      if (persistedSlices.has(name)) schedulePersist()
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    subscribeSlice(name, listener) {
      if (!sliceListeners.has(name)) sliceListeners.set(name, new Set())
      sliceListeners.get(name).add(listener)
      return () => sliceListeners.get(name)?.delete(listener)
    },

    reset(sliceName) {
      if (sliceName) {
        const s = slices[sliceName]
        state = { ...state, [sliceName]: typeof s.initial === 'function' ? s.initial() : structuredCloneSafe(s.initial) }
        notifySlice(sliceName)
      } else {
        for (const [name, s] of Object.entries(slices)) {
          state[name] = typeof s.initial === 'function' ? s.initial() : structuredCloneSafe(s.initial)
        }
        state = { ...state }
      }
      notifyAll()
      flush()
      bus.emit(T.STORE_RESET, { slice: sliceName || 'all' })
    },

    export() { return JSON.parse(JSON.stringify(state)) },

    import(data, { merge = true } = {}) {
      for (const name of Object.keys(state)) {
        if (data?.[name] != null) {
          state[name] = merge ? mergeSlice(state[name], data[name]) : data[name]
        }
      }
      state = { ...state }
      for (const n of Object.keys(state)) notifySlice(n)
      notifyAll()
      flush()
    },

    flush,
    storageUsage: () => storage.usage('bharatcart:'),
  }

  bus.emit(T.STORE_READY, { slices: Object.keys(slices) })
  return api
}

// ---- helpers
function safe(fn, arg) {
  try { fn(arg) } catch (e) { console.error('[store] listener failed', e) }
}

function structuredCloneSafe(v) {
  if (v == null || typeof v !== 'object') return v
  try { return structuredClone(v) } catch { return JSON.parse(JSON.stringify(v)) }
}

/** shallow merge so new default keys appear for returning users */
function mergeSlice(defaults, stored) {
  if (Array.isArray(stored)) return stored
  if (stored == null || typeof stored !== 'object') return stored
  if (defaults == null || typeof defaults !== 'object' || Array.isArray(defaults)) return stored
  return { ...defaults, ...stored }
}

function shallowEqualJSON(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}

export default createStore
