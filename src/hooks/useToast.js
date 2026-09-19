import { useCallback } from 'react'
import store from '../core/store/index.js'

export function useToast() {
  const push = useCallback((t) => {
    const payload = typeof t === 'string' ? { message: t } : t
    store.dispatch('ui/toast', payload)
  }, [])

  return {
    toast: push,
    success: useCallback((message, extra) => push({ message, type: 'success', ...extra }), [push]),
    error:   useCallback((message, extra) => push({ message, type: 'error', duration: 5000, ...extra }), [push]),
    info:    useCallback((message, extra) => push({ message, type: 'info', ...extra }), [push]),
    warn:    useCallback((message, extra) => push({ message, type: 'warning', ...extra }), [push]),
  }
}
export default useToast
