/**
 * Firebase adapter (Auth + Firestore + Storage).
 *
 * Like the Supabase adapter, the SDK is lazily imported from a CDN so it is
 * never a build dependency. Configure in Settings → Backend, or via env:
 * VITE_BACKEND=firebase, VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN,
 * VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_APP_ID
 */
import { ok, fail, normaliseUser } from '../types.js'
import storage from '../../core/persist/storage.js'

const CFG_KEY = 'bharatcart:backend:firebase'
const V = '11.1.0'
const CDN = {
  app: `https://esm.sh/firebase@${V}/app`,
  auth: `https://esm.sh/firebase@${V}/auth`,
  firestore: `https://esm.sh/firebase@${V}/firestore`,
  storage: `https://esm.sh/firebase@${V}/storage`,
}

let sdk = null
let loading = null

export function getConfig() {
  const s = storage.getJSON(CFG_KEY, {})
  const e = import.meta.env || {}
  return {
    apiKey: s.apiKey || e.VITE_FIREBASE_API_KEY || '',
    authDomain: s.authDomain || e.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: s.projectId || e.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: s.storageBucket || e.VITE_FIREBASE_STORAGE_BUCKET || '',
    appId: s.appId || e.VITE_FIREBASE_APP_ID || '',
  }
}

export function setConfig(cfg) {
  storage.setJSON(CFG_KEY, cfg)
  sdk = null; loading = null
}

function isConfigured() {
  const c = getConfig()
  return Boolean(c.apiKey && c.projectId)
}

async function getSdk() {
  if (sdk) return sdk
  if (!isConfigured()) throw new Error('Firebase is not configured. Add your project keys in Settings → Backend.')
  if (!loading) {
    loading = (async () => {
      const [appMod, authMod, fsMod, stMod] = await Promise.all([
        import(/* @vite-ignore */ CDN.app),
        import(/* @vite-ignore */ CDN.auth),
        import(/* @vite-ignore */ CDN.firestore),
        import(/* @vite-ignore */ CDN.storage),
      ])
      const app = appMod.getApps?.().length ? appMod.getApp() : appMod.initializeApp(getConfig())
      sdk = {
        app,
        auth: authMod.getAuth(app),
        dbi: fsMod.getFirestore(app),
        st: stMod.getStorage(app),
        A: authMod, F: fsMod, S: stMod,
      }
      return sdk
    })()
  }
  return loading
}

async function guard(fn) {
  try {
    const s = await getSdk()
    return await fn(s)
  } catch (err) {
    return fail(prettyError(err), err?.code || 'firebase_error')
  }
}

function prettyError(err) {
  const c = err?.code || ''
  const map = {
    'auth/email-already-in-use': 'An account with this email already exists',
    'auth/invalid-email': 'Please enter a valid email address',
    'auth/weak-password': 'Password must be at least 6 characters',
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/invalid-credential': 'Incorrect email or password',
    'auth/too-many-requests': 'Too many attempts. Please try again later',
    'auth/popup-closed-by-user': 'Sign-in popup was closed',
  }
  return map[c] || err?.message || 'Firebase request failed'
}

const fbUser = (u) => u ? normaliseUser({
  id: u.uid, email: u.email, phone: u.phoneNumber,
  name: u.displayName, avatar: u.photoURL, emailVerified: u.emailVerified,
  meta: {},
}) : null

/** Held between sendOtp and verifyOtp for the phone flow. */
let phoneConfirmation = null

const auth = {
  signUp: ({ email, password, name }) => guard(async ({ auth: a, A }) => {
    const cred = await A.createUserWithEmailAndPassword(a, email, password)
    if (name) await A.updateProfile(cred.user, { displayName: name })
    return ok({ user: fbUser(cred.user), session: { user: fbUser(cred.user) } })
  }),

  signIn: ({ email, password }) => guard(async ({ auth: a, A }) => {
    const cred = await A.signInWithEmailAndPassword(a, email, password)
    return ok({ user: fbUser(cred.user), session: { user: fbUser(cred.user) } })
  }),

  /**
   * Firebase ships dedicated classes for a handful of providers and expects
   * everything else to go through the generic OAuthProvider with a provider
   * id string. Mapping both here means the caller just passes a name from the
   * provider registry and never has to know which style Firebase wants.
   */
  signInWithOAuth: ({ provider = 'google', scopes, oidcProviderId }) => guard(async ({ auth: a, A }) => {
    const DEDICATED = {
      google: A.GoogleAuthProvider,
      github: A.GithubAuthProvider,
      facebook: A.FacebookAuthProvider,
      twitter: A.TwitterAuthProvider,
    }
    // Providers Firebase addresses by id through the generic class.
    const GENERIC = {
      apple: 'apple.com',
      microsoft: 'microsoft.com',
      yahoo: 'yahoo.com',
      // Anything configured as a custom OIDC provider in Identity Platform.
      oidc: oidcProviderId || 'oidc.default',
    }

    let p
    if (DEDICATED[provider]) {
      p = new DEDICATED[provider]()
    } else if (GENERIC[provider]) {
      p = new A.OAuthProvider(GENERIC[provider])
    } else {
      return fail(
        `Firebase cannot sign in with "${provider}". Supported here: `
        + `${[...Object.keys(DEDICATED), ...Object.keys(GENERIC)].join(', ')}. `
        + `Switch the backend to Supabase for the wider provider list.`,
        'provider_unsupported'
      )
    }
    if (scopes?.length && p.addScope) scopes.forEach(sc => p.addScope(sc))

    // Popups are blocked in some embedded browsers; fall back to a redirect
    // rather than leaving the user staring at a button that does nothing.
    try {
      const cred = await A.signInWithPopup(a, p)
      return ok({ user: fbUser(cred.user), session: { user: fbUser(cred.user) } })
    } catch (err) {
      const code = err?.code || ''
      if (code.includes('popup-blocked') || code.includes('popup-closed') || code.includes('operation-not-supported')) {
        await A.signInWithRedirect(a, p)
        return ok({ redirecting: true })
      }
      throw err
    }
  }),

  /** Guest sessions. Free on Spark, and upgradeable to a real account. */
  signInAnonymously: () => guard(async ({ auth: a, A }) => {
    if (!A.signInAnonymously) return fail('Anonymous sign-in is not available in this Firebase build', 'unsupported')
    const cred = await A.signInAnonymously(a)
    return ok({ user: fbUser(cred.user), session: { user: fbUser(cred.user) }, anonymous: true })
  }),

  /**
   * Phone OTP. Firebase requires a reCAPTCHA verifier and, since September
   * 2024, a Blaze (paid) billing account — there is no SMS allowance on the
   * free Spark plan. The error below says so explicitly so the failure is
   * self-explanatory instead of a raw Firebase code.
   */
  signInWithPhone: ({ phone, recaptchaContainerId = 'recaptcha-container' }) => guard(async ({ auth: a, A }) => {
    if (!A.RecaptchaVerifier) return fail('Phone sign-in is not available in this Firebase build', 'unsupported')
    try {
      const verifier = new A.RecaptchaVerifier(a, recaptchaContainerId, { size: 'invisible' })
      const confirmation = await A.signInWithPhoneNumber(a, phone, verifier)
      // Stash the confirmation so verifyOtp can complete the flow.
      phoneConfirmation = confirmation
      return ok({ sent: true, message: 'OTP sent to ' + phone })
    } catch (err) {
      if (String(err?.code || '').includes('billing-not-enabled')) {
        return fail('Firebase phone sign-in needs the Blaze plan — SMS is not included in the free tier.', 'billing_required')
      }
      throw err
    }
  }),

  signInWithOtp: ({ email }) => guard(async ({ auth: a, A }) => {
    await A.sendSignInLinkToEmail(a, email, {
      url: typeof window !== 'undefined' ? window.location.href : '',
      handleCodeInApp: true,
    })
    storage.set('bharatcart:fb:emailForSignIn', email)
    return ok({ sent: true, message: 'Sign-in link sent to your email.' })
  }),

  verifyOtp: ({ token }) => guard(async () => {
    // Email sign-in on Firebase is a link, not a code; phone is a real code.
    if (!phoneConfirmation) {
      return fail('Firebase uses email links rather than OTP codes. Check your inbox for the sign-in link.', 'use_email_link')
    }
    const cred = await phoneConfirmation.confirm(String(token))
    phoneConfirmation = null
    return ok({ user: fbUser(cred.user), session: { user: fbUser(cred.user) } })
  }),

  signOut: () => guard(async ({ auth: a, A }) => {
    await A.signOut(a)
    return { error: null }
  }),

  getSession: () => guard(async ({ auth: a }) => {
    const u = a.currentUser
    return ok({ session: u ? { user: fbUser(u) } : null })
  }),

  getUser: () => guard(async ({ auth: a }) => ok({ user: fbUser(a.currentUser) })),

  onAuthStateChange(cb) {
    let unsub = () => {}
    getSdk().then(({ auth: a, A }) => {
      unsub = A.onAuthStateChanged(a, (u) => {
        cb(u ? 'SIGNED_IN' : 'SIGNED_OUT', u ? { user: fbUser(u) } : null)
      })
    }).catch(() => {})
    return () => unsub()
  },

  resetPassword: ({ email }) => guard(async ({ auth: a, A }) => {
    await A.sendPasswordResetEmail(a, email)
    return ok({ sent: true })
  }),

  updateUser: ({ email, password, data }) => guard(async ({ auth: a, A }) => {
    const u = a.currentUser
    if (!u) return fail('Not signed in', 'no_session')
    if (email) await A.updateEmail(u, email)
    if (password) await A.updatePassword(u, password)
    if (data?.name || data?.avatar) {
      await A.updateProfile(u, { displayName: data.name ?? u.displayName, photoURL: data.avatar ?? u.photoURL })
    }
    return ok({ user: fbUser(a.currentUser) })
  }),
}

const db = {
  list: (table, { filter, sort, limit: lim, offset = 0 } = {}) => guard(async ({ dbi, F }) => {
    const parts = []
    if (filter) {
      for (const [k, v] of Object.entries(filter)) {
        if (v == null) continue
        if (Array.isArray(v)) parts.push(F.where(k, 'in', v.slice(0, 10)))
        else if (typeof v === 'object' && v.op) {
          const m = { gt: '>', gte: '>=', lt: '<', lte: '<=', ne: '!=', in: 'in' }
          if (m[v.op]) parts.push(F.where(k, m[v.op], v.value))
        } else parts.push(F.where(k, '==', v))
      }
    }
    if (sort) {
      const [key, dir = 'asc'] = Array.isArray(sort) ? sort : [sort]
      parts.push(F.orderBy(key, dir))
    }
    if (lim != null) parts.push(F.limit(lim + offset))
    const snap = await F.getDocs(F.query(F.collection(dbi, table), ...parts))
    let rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    if (offset) rows = rows.slice(offset)
    return ok(rows, { count: rows.length })
  }),

  get: (table, id) => guard(async ({ dbi, F }) => {
    const d = await F.getDoc(F.doc(dbi, table, id))
    return d.exists() ? ok({ id: d.id, ...d.data() }) : fail('Record not found', 'not_found')
  }),

  insert: (table, row) => guard(async ({ dbi, F }) => {
    const payload = { createdAt: new Date().toISOString(), ...row }
    if (row.id) {
      await F.setDoc(F.doc(dbi, table, row.id), payload)
      return ok(payload)
    }
    const ref = await F.addDoc(F.collection(dbi, table), payload)
    return ok({ id: ref.id, ...payload })
  }),

  update: (table, id, patch) => guard(async ({ dbi, F }) => {
    await F.updateDoc(F.doc(dbi, table, id), { ...patch, updatedAt: new Date().toISOString() })
    const d = await F.getDoc(F.doc(dbi, table, id))
    return ok({ id: d.id, ...d.data() })
  }),

  remove: (table, id) => guard(async ({ dbi, F }) => {
    await F.deleteDoc(F.doc(dbi, table, id))
    return { error: null }
  }),

  upsert: (table, rows) => guard(async ({ dbi, F }) => {
    const arr = Array.isArray(rows) ? rows : [rows]
    const batch = F.writeBatch(dbi)
    const out = []
    for (const r of arr) {
      const id = r.id || F.doc(F.collection(dbi, table)).id
      batch.set(F.doc(dbi, table, id), { ...r, id }, { merge: true })
      out.push({ ...r, id })
    }
    await batch.commit()
    return ok(out)
  }),

  count: (table, filter) => guard(async () => {
    const r = await db.list(table, { filter })
    return { count: r.data?.length ?? 0, error: null }
  }),
}

const files = {
  upload: (bucket, path, file) => guard(async ({ st, S }) => {
    const ref = S.ref(st, `${bucket}/${path}`)
    await S.uploadBytes(ref, file)
    const url = await S.getDownloadURL(ref)
    return ok({ path: `${bucket}/${path}`, url })
  }),
  getUrl() { return '' }, // async in Firebase; use upload() result
  remove: (bucket, path) => guard(async ({ st, S }) => {
    await S.deleteObject(S.ref(st, `${bucket}/${path}`))
    return { error: null }
  }),
}

const realtime = {
  subscribe(table, cb) {
    let unsub = () => {}
    getSdk().then(({ dbi, F }) => {
      unsub = F.onSnapshot(F.collection(dbi, table), (snap) => {
        cb({ table, rows: snap.docs.map(d => ({ id: d.id, ...d.data() })) })
      })
    }).catch(() => {})
    return () => unsub()
  },
}

export async function testConnection() {
  try {
    await getSdk()
    return ok({ connected: true, message: 'Firebase initialised successfully.' })
  } catch (err) {
    return fail(prettyError(err))
  }
}

export const SETUP_NOTES = `BharatCart — Firebase setup
1. console.firebase.google.com → create project
2. Build → Authentication → Sign-in method → enable Email/Password (and Google if you want OAuth)
3. Build → Firestore Database → Create database → Start in production mode
4. Project settings → General → Your apps → Web app → copy the config values
5. Paste them in Settings → Backend → Firebase

Firestore rules to start with:
  rules_version = '2';
  service cloud.firestore {
    match /databases/{db}/documents {
      match /{doc=**} {
        allow read, write: if request.auth != null;
      }
    }
  }`

export default {
  id: 'firebase',
  label: 'Firebase',
  description: 'Free Spark plan: unlimited auth users, 1 GiB Firestore, 5 GB storage. Google/GitHub/Facebook/Apple sign-in built in.',
  isConfigured,
  getConfig, setConfig, testConnection, SETUP_NOTES,
  auth, db, storage: files, realtime,
}
