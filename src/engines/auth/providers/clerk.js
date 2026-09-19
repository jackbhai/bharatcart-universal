/**
 * Clerk provider — real @clerk/clerk-js, loaded lazily from a CDN.
 *
 * The SDK is NOT a build dependency: it loads from esm.sh only when the
 * merchant actually selects Clerk in Admin → Integrations → Auth. Only the
 * publishable key (pk_test_/pk_live_) is used — safe for browsers; the
 * secret key stays on the merchant's backend.
 *
 * Roles: read from clerk.user.publicMetadata.role, set by the merchant in
 * the Clerk dashboard. Mapped with mapCloudRole().
 *
 * Multi-step sign-ins (MFA / email-code verification) are reported honestly:
 * instead of pretending they completed, we throw an AuthError explaining
 * what the user must do. The merchant's own hosted Clerk components handle
 * those flows fully; this provider covers the standard email+password flow.
 */
import { AuthError, normaliseAuthUser, mapCloudRole, assertAuthProvider } from '../AuthProvider.js'

const CDN = 'https://esm.sh/@clerk/clerk-js@5'

let clerkInstance = null
let clerkKey = null
let loadPromise = null

/** Test hook: inject a fake Clerk module so tests never touch the network. */
export function __setClerkModule(mockInstance) {
  clerkInstance = mockInstance || null
  // '*' = explicitly injected by a test; it wins regardless of the key.
  clerkKey = mockInstance ? '*' : null
  loadPromise = null
}

async function loadClerk(publishableKey) {
  if (clerkInstance && (clerkKey === '*' || clerkKey === publishableKey)) return clerkInstance
  if (loadPromise && clerkKey === publishableKey) return loadPromise
  clerkKey = publishableKey
  loadPromise = (async () => {
    let mod
    try {
      mod = await import(/* @vite-ignore */ CDN)
    } catch {
      throw new AuthError('Could not load the Clerk SDK from the CDN. Check your network connection and try again.', 'sdk_load_failed')
    }
    const inst = new mod.Clerk(publishableKey)
    await inst.load()
    clerkInstance = inst
    return inst
  })()
  return loadPromise
}

function userFromClerk(cu) {
  if (!cu) return null
  const email = cu.primaryEmailAddress?.emailAddress || cu.emailAddresses?.[0]?.emailAddress || null
  return normaliseAuthUser({
    id: cu.id,
    email,
    name: cu.fullName || [cu.firstName, cu.lastName].filter(Boolean).join(' ') || email,
    role: mapCloudRole(cu.publicMetadata?.role || cu.unsafeMetadata?.role),
    emailVerified: Boolean(cu.primaryEmailAddress?.verification?.status === 'verified'),
  })
}

/** Factory. */
export function createClerkProvider({ publishableKey } = {}) {
  publishableKey = String(publishableKey || '').trim()

  function needConfig() {
    if (!publishableKey) {
      throw new AuthError(
        'Clerk is selected but not configured. Add your publishable key in Admin → Integrations → Auth (or set VITE_CLERK_PUBLISHABLE_KEY).',
        'not_configured'
      )
    }
    if (!/^pk_(test|live)_/.test(publishableKey)) {
      throw new AuthError('The Clerk publishable key does not look right — it should start with pk_test_ or pk_live_.', 'bad_key')
    }
  }

  const listeners = new Set()
  function emit(user) {
    for (const cb of [...listeners]) {
      try { cb(user) } catch (e) { console.error('[auth:clerk]', e) }
    }
  }
  function attach(clerk) {
    if (clerk.__bcAttached) return
    clerk.__bcAttached = true
    clerk.addListener(({ session }) => {
      emit(session ? userFromClerk(clerk.user) : null)
    })
  }

  const provider = {
    id: 'clerk',
    label: 'Clerk',

    async signUp({ name, email, password } = {}) {
      needConfig()
      const clerk = await loadClerk(publishableKey)
      attach(clerk)
      const [firstName, ...rest] = String(name || '').split(' ')
      let attempt
      try {
        attempt = await clerk.client.signUp.create({
          emailAddress: email, password, firstName, lastName: rest.join(' ') || undefined,
        })
      } catch (e) {
        throw new AuthError(e?.errors?.[0]?.message || e?.message || 'Sign up failed', 'clerk_signup_failed')
      }
      if (attempt.status !== 'complete') {
        throw new AuthError(
          'Account created — finish email verification in the step Clerk sent you, then sign in.',
          'verification_required'
        )
      }
      await clerk.setActive({ session: attempt.createdSessionId })
      const user = userFromClerk(clerk.user)
      emit(user)
      return user
    },

    async signIn({ email, password } = {}) {
      needConfig()
      const clerk = await loadClerk(publishableKey)
      attach(clerk)
      let attempt
      try {
        attempt = await clerk.client.signIn.create({ identifier: email, password })
      } catch (e) {
        throw new AuthError(e?.errors?.[0]?.message || e?.message || 'Sign in failed', 'clerk_signin_failed')
      }
      if (attempt.status !== 'complete') {
        // e.g. second factor required — say so instead of faking a session.
        throw new AuthError(
          'Clerk needs an extra verification step (e.g. a code or second factor). Complete it in your Clerk-hosted sign-in, then continue here.',
          'verification_required'
        )
      }
      await clerk.setActive({ session: attempt.createdSessionId })
      const user = userFromClerk(clerk.user)
      emit(user)
      return user
    },

    async signOut() {
      needConfig()
      const clerk = await loadClerk(publishableKey)
      await clerk.signOut()
      emit(null)
    },

    async getSession() {
      needConfig()
      const clerk = await loadClerk(publishableKey)
      attach(clerk)
      return clerk.session ? userFromClerk(clerk.user) : null
    },

    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }

  assertAuthProvider(provider, 'clerk')
  return provider
}
