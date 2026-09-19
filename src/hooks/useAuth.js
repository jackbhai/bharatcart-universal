import { useEffect, useCallback, useRef } from 'react'
import store from '../core/store/index.js'
import { useSlice } from './useStore.js'
import { getAuth, getAuthInfo, refreshAuth, AuthError } from '../engines/auth/index.js'
import bus from '../core/events/EventBus.js'
import T from '../core/events/topics.js'
import { hasRole, isStaff, isAdmin, isOwner } from '../core/store/slices/authSlice.js'
import { ROLES } from '../backend/types.js'
import backend from '../backend/index.js'

let initialised = false

function toAuthError(err) {
  return err instanceof AuthError ? err : new AuthError(err?.message || 'Something went wrong. Please try again.', 'unknown')
}

function signedInPayload(user) {
  return { user, session: { user, providerId: getAuthInfo().providerId } }
}

/** Wire the active auth provider's events into the store exactly once. */
export function initAuth() {
  if (initialised) return
  initialised = true

  const p = getAuth()
  p.getSession().then((user) => {
    if (user) {
      store.dispatch('auth/signedIn', signedInPayload(user))
      bus.emit(T.AUTH_SESSION_RESTORED, { user })
    } else {
      store.dispatch('auth/initialised')
    }
  }).catch(() => store.dispatch('auth/initialised'))

  p.onAuthChange((user) => {
    if (!user) {
      store.dispatch('auth/signedOut')
      bus.emit(T.AUTH_SIGNED_OUT)
    } else {
      store.dispatch('auth/signedIn', signedInPayload(user))
      bus.emit(T.AUTH_SIGNED_IN, { user })
    }
  })
}

/** The merchant changed the auth provider in Integrations — pick it up. */
export function reinitAuth() {
  refreshAuth()
  initialised = false
  initAuth()
}

function unsupported(what) {
  const info = getAuthInfo()
  return new AuthError(
    `${what} is not available with ${info.providerName}. ` +
    (info.isCloud
      ? 'Sign in with email and password, or switch to Local development in Integrations → Auth for the dev-only flows.'
      : 'This flow is only implemented for local dev auth.'),
    'unsupported'
  )
}

function optional(p, name) {
  const a = getAuth()
  if (typeof a[name] === 'function') return a[name](p)
  throw unsupported({ signInWithOAuth: 'Social sign-in', signInWithOtp: 'One-time codes', signInAnonymously: 'Guest sign-in' }[name] || name)
}

export function useAuth() {
  const auth = useSlice('auth')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    initAuth()
    // Provider switched in the Integrations hub (this tab or another).
    const onStorage = (e) => { if (e.key === 'bc.integrations.v1') reinitAuth() }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  /** For flows that end in a signed-in user. */
  const run = useCallback(async (fn) => {
    store.dispatch('auth/loading')
    try {
      const user = await fn()
      if (user) {
        store.dispatch('auth/signedIn', signedInPayload(user))
        bus.emit(T.AUTH_SIGNED_IN, { user })
      } else {
        store.dispatch('auth/initialised')
      }
      return { ok: true, user }
    } catch (err) {
      const error = toAuthError(err)
      store.dispatch('auth/error', error)
      bus.emit(T.AUTH_ERROR, error)
      return { ok: false, error }
    }
  }, [])

  /** For side-effect flows (send code, reset link) that return data, not a user. */
  const runRaw = useCallback(async (fn) => {
    try {
      const data = await fn()
      return { ok: true, data }
    } catch (err) {
      const error = toAuthError(err)
      return { ok: false, error }
    }
  }, [])

  return {
    ...auth,
    isAuthed: auth.status === 'authenticated' && Boolean(auth.user),
    isStaff: isStaff(auth.user),
    isAdmin: isAdmin(auth.user),
    isOwner: isOwner(auth.user),
    can: (role) => hasRole(auth.user, role),
    backendId: backend.id,
    /** Which identity provider backs sign-in right now (for the UI badge). */
    authProvider: getAuthInfo(),

    signUp:  (p) => run(() => getAuth().signUp(p)),
    signIn:  (p) => run(() => getAuth().signIn(p)),
    signInWithOAuth: (p) => run(() => optional(p, 'signInWithOAuth')),
    signInWithOtp:   (p) => runRaw(() => optional(p, 'signInWithOtp')),
    verifyOtp: (p) => run(() => optional(p, 'verifyOtp')),
    resetPassword: (p) => runRaw(() => optional(p, 'resetPassword')),

    signInAnonymously: () => run(() => optional(undefined, 'signInAnonymously')),

    updateUser: async (p) => {
      const a = getAuth()
      if (typeof a.updateUser !== 'function') {
        return { ok: false, error: unsupported('Profile updates') }
      }
      try {
        const user = await a.updateUser(p)
        if (user) store.dispatch('auth/patchUser', user)
        return { ok: true, user }
      } catch (err) {
        return { ok: false, error: toAuthError(err) }
      }
    },

    signOut: async () => {
      await getAuth().signOut()
      store.dispatch('auth/signedOut')
      bus.emit(T.AUTH_SIGNED_OUT)
    },

    clearError: () => store.dispatch('auth/clearError'),
  }
}

export { ROLES }
export default useAuth
