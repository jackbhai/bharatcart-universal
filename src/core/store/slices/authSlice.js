import { ROLES, ROLE_RANK } from '../../../backend/types.js'

export const authSlice = {
  persist: false, // the backend adapter owns session persistence
  initial: () => ({
    user: null,
    session: null,
    status: 'idle',      // idle | loading | authenticated | error
    error: null,
    initialised: false,
    lastEvent: null,
  }),
  actions: {
    loading: () => ({ status: 'loading', error: null }),

    signedIn: (_s, { user, session }) => ({
      user, session, status: 'authenticated', error: null, initialised: true, lastEvent: 'SIGNED_IN',
    }),

    signedOut: () => ({
      user: null, session: null, status: 'idle', error: null, initialised: true, lastEvent: 'SIGNED_OUT',
    }),

    error: (_s, error) => ({ status: 'error', error, initialised: true }),

    clearError: () => ({ error: null, status: 'idle' }),

    initialised: (s) => ({ initialised: true, status: s.user ? 'authenticated' : 'idle' }),

    patchUser: (s, patch) => ({ user: s.user ? { ...s.user, ...patch } : null }),
  },
}

/* ------------------------------------------------------------ selectors */
export const selectUser = (s) => s.auth.user
export const selectIsAuthed = (s) => s.auth.status === 'authenticated' && Boolean(s.auth.user)
export const selectRole = (s) => s.auth.user?.role ?? null

export function hasRole(user, required) {
  if (!user) return false
  const have = ROLE_RANK[user.role] ?? 0
  const need = ROLE_RANK[required] ?? 0
  return have >= need
}

export const isStaff = (user) => hasRole(user, ROLES.STAFF)
export const isAdmin = (user) => hasRole(user, ROLES.ADMIN)
export const isOwner = (user) => hasRole(user, ROLES.OWNER)

export default authSlice
