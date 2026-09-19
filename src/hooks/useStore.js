import { useSyncExternalStore, useCallback, useRef } from 'react'
import store from '../core/store/index.js'

/** Subscribe to one slice. Re-renders only when that slice changes. */
export function useSlice(name) {
  return useSyncExternalStore(
    useCallback((cb) => store.subscribeSlice(name, cb), [name]),
    useCallback(() => store.get(name), [name]),
    useCallback(() => store.get(name), [name]),
  )
}

/** Subscribe with a selector over the whole state. */
export function useSelector(selector, isEqual) {
  const lastRef = useRef({ value: undefined, state: undefined })
  const get = useCallback(() => {
    const state = store.getState()
    if (lastRef.current.state === state) return lastRef.current.value
    const value = selector(state)
    const prev = lastRef.current.value
    const same = isEqual ? isEqual(prev, value) : shallow(prev, value)
    lastRef.current = { state, value: same && prev !== undefined ? prev : value }
    return lastRef.current.value
  }, [selector, isEqual])

  return useSyncExternalStore(store.subscribe, get, get)
}

export function useDispatch() {
  return store.dispatch
}

export function useStore() {
  return store
}

function shallow(a, b) {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  const ka = Object.keys(a), kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every(k => Object.is(a[k], b[k]))
}

export default useSlice
