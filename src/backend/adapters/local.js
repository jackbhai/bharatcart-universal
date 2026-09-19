/**
 * Local adapter — zero setup, zero cost, works on any static host
 * (GitHub Pages, Netlify, Vercel, S3, file://).
 *
 * Auth is simulated but behaves realistically: hashed passwords, sessions
 * with expiry, OAuth simulation, OTP, password reset, auth-state events.
 */
import { ok, fail, normaliseUser, ROLES } from '../types.js'
import storage from '../../core/persist/storage.js'

const K = {
  users: 'bharatcart:auth:users',
  session: 'bharatcart:auth:session',
  otp: 'bharatcart:auth:otp',
  db: 'bharatcart:db:',
}

const SESSION_MS = 1000 * 60 * 60 * 24 * 30 // 30 days
const listeners = new Set()

/* ------------------------------------------------------------------ utils */
async function hash(str) {
  try {
    if (globalThis.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str + '::bharatcart'))
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
    }
  } catch {}
  // deterministic fallback
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return 'fb' + (h >>> 0).toString(16)
}

const uid = (p = 'usr') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
const readUsers = () => storage.getJSON(K.users, [])
const writeUsers = (u) => storage.setJSON(K.users, u)
const delay = (ms = 220) => new Promise(r => setTimeout(r, ms))

function emit(event, session) {
  for (const cb of [...listeners]) {
    try { cb(event, session) } catch (e) { console.error('[local-auth]', e) }
  }
}

function makeSession(user) {
  const session = {
    access_token: 'local_' + Math.random().toString(36).slice(2) + Date.now().toString(36),
    expires_at: Date.now() + SESSION_MS,
    user: publicUser(user),
  }
  storage.setJSON(K.session, session)
  return session
}

function publicUser(u) {
  if (!u) return null
  const { password, ...rest } = u
  return normaliseUser(rest)
}

function currentSession() {
  const s = storage.getJSON(K.session)
  if (!s) return null
  if (s.expires_at && s.expires_at < Date.now()) { storage.remove(K.session); return null }
  return s
}

/* ------------------------------------------------------------------ auth  */
const auth = {
  async signUp({ email, password, name, meta = {}, role = ROLES.CUSTOMER }) {
    await delay()
    email = String(email || '').trim().toLowerCase()
    if (!email.includes('@')) return fail('Please enter a valid email address', 'invalid_email')
    if (!password || password.length < 6) return fail('Password must be at least 6 characters', 'weak_password')

    const users = readUsers()
    if (users.some(u => u.email === email)) return fail('An account with this email already exists', 'user_exists')

    const user = {
      id: uid(),
      email,
      password: await hash(password),
      name: name || email.split('@')[0],
      // First-ever account becomes the store owner, so the setup wizard can
      // create the admin without a pre-seeded demo user. Everyone after that
      // is a customer: the requested role is deliberately ignored here so a
      // public signup can never self-promote to staff/owner.
      role: users.length === 0 ? ROLES.OWNER : ROLES.CUSTOMER,
      emailVerified: false,
      createdAt: new Date().toISOString(),
      meta,
    }
    users.push(user)
    writeUsers(users)

    const session = makeSession(user)
    emit('SIGNED_IN', session)
    return ok({ user: publicUser(user), session })
  },

  async signIn({ email, password }) {
    await delay()
    email = String(email || '').trim().toLowerCase()
    const users = readUsers()
    const user = users.find(u => u.email === email)
    if (!user) return fail('No account found with this email', 'user_not_found')

    if (user.demo && !user.password) {
      const session = makeSession(user)
      emit('SIGNED_IN', session)
      return ok({ user: publicUser(user), session })
    }
    if (user.password !== await hash(password || '')) {
      return fail('Incorrect password', 'invalid_credentials')
    }
    const session = makeSession(user)
    emit('SIGNED_IN', session)
    return ok({ user: publicUser(user), session })
  },

  async signInWithOAuth({ provider = 'google' }) {
    await delay(400)
    const email = `${provider}.user@bharatcart.in`
    const users = readUsers()
    let user = users.find(u => u.email === email)
    if (!user) {
      user = {
        id: uid(),
        email,
        password: null,
        oauth: provider,
        name: provider[0].toUpperCase() + provider.slice(1) + ' User',
        role: ROLES.CUSTOMER,
        emailVerified: true,
        createdAt: new Date().toISOString(),
        meta: { provider },
      }
      users.push(user); writeUsers(users)
    }
    const session = makeSession(user)
    emit('SIGNED_IN', session)
    return ok({ user: publicUser(user), session, provider })
  },

  /**
   * Guest session. The local adapter is the demo backend, so this mints a
   * throwaway user that behaves exactly like the real thing — including being
   * upgradeable — with no keys required.
   */
  async signInAnonymously() {
    await delay(250)
    const users = readUsers()
    const user = {
      id: uid(),
      email: null,
      password: null,
      anonymous: true,
      name: 'Guest',
      role: ROLES.CUSTOMER,
      emailVerified: false,
      createdAt: new Date().toISOString(),
      meta: { provider: 'anonymous' },
    }
    users.push(user); writeUsers(users)
    const session = makeSession(user)
    emit('SIGNED_IN', session)
    return ok({ user: publicUser(user), session, anonymous: true })
  },

  /** Simulated SMS. Real SMS costs money on every provider - see providers.js. */
  async signInWithPhone({ phone }) {
    return this.signInWithOtp({ phone })
  },

  async signInWithOtp({ email, phone }) {
    await delay()
    const token = String(Math.floor(100000 + Math.random() * 900000))
    storage.setJSON(K.otp, { id: email || phone, token, expires: Date.now() + 5 * 60 * 1000 })
    // in local mode we surface the code so the flow is testable
    return ok({ sent: true, devToken: token, message: `OTP sent. Demo code: ${token}` })
  },

  async verifyOtp({ email, phone, token }) {
    await delay()
    const rec = storage.getJSON(K.otp)
    if (!rec || rec.id !== (email || phone)) return fail('No OTP requested for this address', 'otp_missing')
    if (rec.expires < Date.now()) return fail('OTP expired, please request a new one', 'otp_expired')
    if (String(rec.token) !== String(token)) return fail('Incorrect OTP', 'otp_invalid')

    const id = email || phone
    const users = readUsers()
    let user = users.find(u => u.email === id || u.phone === id)
    if (!user) {
      user = {
        id: uid(),
        email: email || null,
        phone: phone || null,
        password: null,
        name: String(id).split('@')[0],
        role: ROLES.CUSTOMER,
        emailVerified: Boolean(email),
        createdAt: new Date().toISOString(),
        meta: {},
      }
      users.push(user); writeUsers(users)
    }
    storage.remove(K.otp)
    const session = makeSession(user)
    emit('SIGNED_IN', session)
    return ok({ user: publicUser(user), session })
  },

  async signOut() {
    await delay(120)
    storage.remove(K.session)
    emit('SIGNED_OUT', null)
    return { error: null }
  },

  async getSession() {
    return ok({ session: currentSession() })
  },

  async getUser() {
    const s = currentSession()
    return ok({ user: s?.user ?? null })
  },

  onAuthStateChange(cb) {
    listeners.add(cb)
    const s = currentSession()
    if (s) queueMicrotask(() => cb('SESSION_RESTORED', s))
    return () => listeners.delete(cb)
  },

  async resetPassword({ email }) {
    await delay()
    const users = readUsers()
    if (!users.some(u => u.email === String(email).toLowerCase())) {
      // don't leak account existence
      return ok({ sent: true })
    }
    const token = Math.random().toString(36).slice(2, 10)
    storage.setJSON('bharatcart:auth:reset', { email, token, expires: Date.now() + 30 * 60 * 1000 })
    return ok({ sent: true, devToken: token, message: `Reset link generated. Demo token: ${token}` })
  },

  async updateUser({ email, password, data }) {
    await delay()
    const s = currentSession()
    if (!s) return fail('Not signed in', 'no_session')
    const users = readUsers()
    const i = users.findIndex(u => u.id === s.user.id)
    if (i === -1) return fail('Account not found', 'user_not_found')

    if (email) users[i].email = String(email).toLowerCase()
    if (password) users[i].password = await hash(password)
    if (data) users[i] = { ...users[i], ...data, meta: { ...users[i].meta, ...(data.meta || {}) } }
    writeUsers(users)

    const session = makeSession(users[i])
    emit('USER_UPDATED', session)
    return ok({ user: publicUser(users[i]) })
  },

  async listUsers() {
    return ok(readUsers().map(publicUser))
  },
}

/* -------------------------------------------------------------------- db  */
const tbl = (t) => storage.getJSON(K.db + t, [])
const saveTbl = (t, rows) => storage.setJSON(K.db + t, rows)

function applyFilter(rows, filter) {
  if (!filter) return rows
  return rows.filter(r => Object.entries(filter).every(([k, v]) => {
    if (v == null) return true
    if (Array.isArray(v)) return v.includes(r[k])
    if (typeof v === 'object' && v.op) {
      const val = r[k]
      switch (v.op) {
        case 'gt': return val > v.value
        case 'gte': return val >= v.value
        case 'lt': return val < v.value
        case 'lte': return val <= v.value
        case 'ne': return val !== v.value
        case 'like': return String(val ?? '').toLowerCase().includes(String(v.value).toLowerCase())
        case 'in': return v.value.includes(val)
        default: return true
      }
    }
    return r[k] === v
  }))
}

const db = {
  async list(table, { filter, sort, limit, offset = 0 } = {}) {
    let rows = applyFilter(tbl(table), filter)
    const count = rows.length
    if (sort) {
      const [key, dir = 'asc'] = Array.isArray(sort) ? sort : [sort]
      rows = [...rows].sort((a, b) => {
        const x = a[key], y = b[key]
        if (x === y) return 0
        const r = x > y ? 1 : -1
        return dir === 'desc' ? -r : r
      })
    }
    if (limit != null) rows = rows.slice(offset, offset + limit)
    else if (offset) rows = rows.slice(offset)
    return ok(rows, { count })
  },

  async get(table, id) {
    const row = tbl(table).find(r => r.id === id)
    return row ? ok(row) : fail('Record not found', 'not_found')
  },

  async insert(table, row) {
    const rows = tbl(table)
    const rec = { id: row.id || uid('rec'), createdAt: new Date().toISOString(), ...row }
    rows.push(rec); saveTbl(table, rows)
    return ok(rec)
  },

  async update(table, id, patch) {
    const rows = tbl(table)
    const i = rows.findIndex(r => r.id === id)
    if (i === -1) return fail('Record not found', 'not_found')
    rows[i] = { ...rows[i], ...patch, updatedAt: new Date().toISOString() }
    saveTbl(table, rows)
    return ok(rows[i])
  },

  async remove(table, id) {
    saveTbl(table, tbl(table).filter(r => r.id !== id))
    return { error: null }
  },

  async upsert(table, incoming) {
    const arr = Array.isArray(incoming) ? incoming : [incoming]
    const rows = tbl(table)
    const out = []
    for (const row of arr) {
      const i = rows.findIndex(r => r.id === row.id)
      if (i >= 0) { rows[i] = { ...rows[i], ...row }; out.push(rows[i]) }
      else { const rec = { id: row.id || uid('rec'), ...row }; rows.push(rec); out.push(rec) }
    }
    saveTbl(table, rows)
    return ok(out)
  },

  async count(table, filter) {
    return { count: applyFilter(tbl(table), filter).length, error: null }
  },
}

/* --------------------------------------------------------------- storage  */
const files = {
  async upload(bucket, path, file) {
    // store small files as data URLs; reject big ones to protect quota
    if (file && file.size > 1.5 * 1024 * 1024) {
      return fail('File too large for local mode (max 1.5 MB). Connect Supabase or Firebase for bigger uploads.', 'too_large')
    }
    const url = await new Promise((resolve) => {
      try {
        const fr = new FileReader()
        fr.onload = () => resolve(fr.result)
        fr.onerror = () => resolve(null)
        fr.readAsDataURL(file)
      } catch { resolve(null) }
    })
    if (!url) return fail('Could not read file', 'read_error')
    storage.set(`bharatcart:file:${bucket}/${path}`, url)
    return ok({ path: `${bucket}/${path}`, url })
  },

  getUrl(bucket, path) {
    return storage.get(`bharatcart:file:${bucket}/${path}`) || ''
  },

  async remove(bucket, path) {
    storage.remove(`bharatcart:file:${bucket}/${path}`)
    return { error: null }
  },
}

/* -------------------------------------------------------------- realtime  */
const realtime = {
  subscribe(table, cb) {
    // local mode: cross-tab storage events act as realtime
    if (typeof window === 'undefined') return () => {}
    const handler = (e) => { if (e.key === K.db + table) cb({ table, rows: tbl(table) }) }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  },
}

export default {
  id: 'local',
  label: 'Local (no setup)',
  description: 'Runs entirely in the browser. Works on any static host — GitHub Pages, Netlify, Vercel. No account, no keys, no cost.',
  isConfigured: () => true,
  auth, db, storage: files, realtime,
}
