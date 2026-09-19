/**
 * Backend contract. Every adapter (local / supabase / firebase) implements
 * this exact shape, so the app never knows which backend is active.
 *
 * All methods are async and return { data, error } — never throw.
 */

export const AUTH_PROVIDERS = ['google', 'github', 'facebook', 'apple']

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  CUSTOMER: 'customer',
}

/**
 * Coarse rank, used only for "may this person open the back office at all".
 * Fine-grained access is decided per screen by src/auth/rbac.jsx against the
 * permission templates in engines/people/peopleEngine.js.
 *
 * Those templates define seven job roles — ops, support, merchandiser,
 * finance, viewer alongside owner and manager — and this table originally
 * listed none of them. Anything absent scored 0, so five perfectly valid staff
 * roles were ranked below a customer and locked out of the admin area
 * entirely. Every role that exists anywhere in the app must appear here.
 *
 * Ranks are grouped rather than unique: the job roles are all "staff-level"
 * and differ from one another by permission, not by seniority.
 */
export const ROLE_RANK = {
  [ROLES.OWNER]: 100,
  [ROLES.ADMIN]: 80,
  [ROLES.MANAGER]: 60,

  // Job roles from the permission templates. All staff-level.
  manager: 60,
  finance: 50,
  merchandiser: 45,
  ops: 45,
  support: 45,
  viewer: 42,

  [ROLES.STAFF]: 40,
  [ROLES.CUSTOMER]: 10,
  guest: 5,
}

/** Shape reference — adapters should satisfy this. */
export const BackendContract = {
  id: 'string',
  label: 'string',
  isConfigured: '() => boolean',

  auth: {
    signUp: '({ email, password, name, meta }) => { data:{user,session}, error }',
    signIn: '({ email, password }) => { data:{user,session}, error }',
    signInWithOAuth: '({ provider, redirectTo }) => { data, error }',
    signInWithOtp: '({ email, phone }) => { data, error }',
    verifyOtp: '({ email, phone, token }) => { data, error }',
    signOut: '() => { error }',
    getSession: '() => { data:{session}, error }',
    getUser: '() => { data:{user}, error }',
    onAuthStateChange: '(cb) => unsubscribe',
    resetPassword: '({ email, redirectTo }) => { error }',
    updateUser: '({ email, password, data }) => { data:{user}, error }',
  },

  db: {
    list: '(table, { filter, sort, limit, offset }) => { data:[], count, error }',
    get: '(table, id) => { data, error }',
    insert: '(table, row) => { data, error }',
    update: '(table, id, patch) => { data, error }',
    remove: '(table, id) => { error }',
    upsert: '(table, rows) => { data, error }',
    count: '(table, filter) => { count, error }',
  },

  storage: {
    upload: '(bucket, path, file) => { data:{path,url}, error }',
    getUrl: '(bucket, path) => string',
    remove: '(bucket, path) => { error }',
  },

  realtime: {
    subscribe: '(table, cb) => unsubscribe',
  },
}

export function ok(data, extra = {}) { return { data, error: null, ...extra } }
export function fail(message, code = 'error') {
  return { data: null, error: { message: String(message), code } }
}

export function normaliseUser(raw, { role = ROLES.CUSTOMER } = {}) {
  if (!raw) return null
  return {
    id: raw.id || raw.uid || raw.user_id,
    email: raw.email ?? null,
    phone: raw.phone ?? raw.phoneNumber ?? null,
    name: raw.name ?? raw.displayName ?? raw.user_metadata?.name ?? (raw.email || '').split('@')[0] ?? 'User',
    avatar: raw.avatar ?? raw.photoURL ?? raw.user_metadata?.avatar_url ?? null,
    role: raw.role ?? raw.user_metadata?.role ?? role,
    emailVerified: Boolean(raw.emailVerified ?? raw.email_confirmed_at ?? false),
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    meta: raw.user_metadata ?? raw.meta ?? {},
  }
}

export default BackendContract
