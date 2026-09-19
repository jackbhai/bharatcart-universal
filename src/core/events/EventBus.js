/**
 * EventBus — tiny pub/sub with wildcard support.
 * Used for cross-module communication without prop drilling.
 */
export class EventBus {
  constructor() {
    this._handlers = new Map()
    this._anyHandlers = new Set()
    this._history = []
    this._maxHistory = 200
  }

  /** Subscribe to an event. Returns unsubscribe fn. */
  on(event, handler) {
    if (typeof handler !== 'function') throw new TypeError('handler must be a function')
    if (!this._handlers.has(event)) this._handlers.set(event, new Set())
    this._handlers.get(event).add(handler)
    return () => this.off(event, handler)
  }

  /** Subscribe once. */
  once(event, handler) {
    const wrapped = (...args) => { this.off(event, wrapped); handler(...args) }
    return this.on(event, wrapped)
  }

  /** Subscribe to every event: handler(eventName, payload). */
  onAny(handler) {
    this._anyHandlers.add(handler)
    return () => this._anyHandlers.delete(handler)
  }

  off(event, handler) {
    const set = this._handlers.get(event)
    if (!set) return
    set.delete(handler)
    if (set.size === 0) this._handlers.delete(event)
  }

  emit(event, payload) {
    this._record(event, payload)
    const set = this._handlers.get(event)
    if (set) for (const h of [...set]) safeCall(h, [payload], event)
    for (const h of [...this._anyHandlers]) safeCall(h, [event, payload], event)
  }

  _record(event, payload) {
    this._history.push({ event, payload, at: Date.now() })
    if (this._history.length > this._maxHistory) this._history.shift()
  }

  history(filter) {
    return filter ? this._history.filter(h => h.event === filter) : [...this._history]
  }

  clear() {
    this._handlers.clear()
    this._anyHandlers.clear()
    this._history = []
  }
}

function safeCall(fn, args, event) {
  try { fn(...args) } catch (err) {
    console.error(`[EventBus] handler failed for "${event}"`, err)
  }
}

export const bus = new EventBus()
export default bus
