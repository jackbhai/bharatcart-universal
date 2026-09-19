/**
 * Safe storage wrapper. Falls back to in-memory when localStorage is
 * unavailable (SSR, private mode, sandboxed iframe, opaque origin).
 */
const memory = new Map()

function probe() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false
    const k = '__bc_probe__'
    window.localStorage.setItem(k, '1')
    window.localStorage.removeItem(k)
    return true
  } catch { return false }
}

export const hasLocalStorage = probe()

export const storage = {
  available: hasLocalStorage,

  get(key) {
    try {
      return hasLocalStorage ? window.localStorage.getItem(key) : (memory.get(key) ?? null)
    } catch { return memory.get(key) ?? null }
  },

  set(key, value) {
    try {
      if (hasLocalStorage) window.localStorage.setItem(key, value)
      else memory.set(key, value)
      return true
    } catch (err) {
      // quota exceeded -> keep it in memory so the session still works
      memory.set(key, value)
      console.warn('[storage] write failed, using memory', err?.name)
      return false
    }
  },

  remove(key) {
    try { if (hasLocalStorage) window.localStorage.removeItem(key) } catch {}
    memory.delete(key)
  },

  keys(prefix = '') {
    const out = []
    try {
      if (hasLocalStorage) {
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i)
          if (k && k.startsWith(prefix)) out.push(k)
        }
        return out
      }
    } catch {}
    for (const k of memory.keys()) if (k.startsWith(prefix)) out.push(k)
    return out
  },

  getJSON(key, fallback = null) {
    const raw = this.get(key)
    if (raw == null) return fallback
    try { return JSON.parse(raw) } catch { return fallback }
  },

  setJSON(key, value) {
    try { return this.set(key, JSON.stringify(value)) } catch { return false }
  },

  /** Approximate bytes used by our namespace. */
  usage(prefix = '') {
    let bytes = 0
    for (const k of this.keys(prefix)) bytes += (this.get(k) || '').length + k.length
    return bytes
  },
}

export default storage
