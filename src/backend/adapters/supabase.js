/**
 * Supabase adapter.
 *
 * The SDK is loaded lazily from a CDN so it is NOT a build dependency —
 * the app still builds and deploys with zero extra packages. It only loads
 * if the user actually selects Supabase and provides credentials.
 *
 * Setup: Settings -> Backend -> Supabase, paste Project URL + anon key.
 * Or env: VITE_BACKEND=supabase, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 */
import { ok, fail, normaliseUser } from '../types.js'
import storage from '../../core/persist/storage.js'

const CFG_KEY = 'bharatcart:backend:supabase'
const CDN = 'https://esm.sh/@supabase/supabase-js@2'

let client = null
let loading = null

export function getConfig() {
  const saved = storage.getJSON(CFG_KEY, {})
  return {
    url: saved.url || import.meta.env?.VITE_SUPABASE_URL || '',
    anonKey: saved.anonKey || import.meta.env?.VITE_SUPABASE_ANON_KEY || '',
  }
}

export function setConfig(cfg) {
  storage.setJSON(CFG_KEY, { url: cfg.url?.trim(), anonKey: cfg.anonKey?.trim() })
  client = null
  loading = null
}

function isConfigured() {
  const { url, anonKey } = getConfig()
  return Boolean(url && anonKey)
}

async function getClient() {
  if (client) return client
  if (!isConfigured()) throw new Error('Supabase is not configured. Add your Project URL and anon key in Settings → Backend.')
  if (!loading) {
    loading = (async () => {
      const { createClient } = await import(/* @vite-ignore */ CDN)
      const { url, anonKey } = getConfig()
      client = createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
      return client
    })()
  }
  return loading
}

async function guard(fn) {
  try {
    const sb = await getClient()
    return await fn(sb)
  } catch (err) {
    return fail(err?.message || 'Supabase request failed', err?.code || 'supabase_error')
  }
}

const auth = {
  signUp: ({ email, password, name, meta = {} }) => guard(async (sb) => {
    const { data, error } = await sb.auth.signUp({
      email, password, options: { data: { name, ...meta } },
    })
    if (error) return fail(error.message, error.code)
    return ok({ user: normaliseUser(data.user), session: data.session })
  }),

  signIn: ({ email, password }) => guard(async (sb) => {
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) return fail(error.message, error.code)
    return ok({ user: normaliseUser(data.user), session: data.session })
  }),

  signInWithOAuth: ({ provider = 'google', redirectTo }) => guard(async (sb) => {
    const { data, error } = await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo || (typeof window !== 'undefined' ? window.location.origin : undefined) },
    })
    if (error) return fail(error.message, error.code)
    return ok(data)
  }),

  /** Guest session. Free, and linkable to a real identity later. */
  signInAnonymously: () => guard(async (sb) => {
    if (!sb.auth.signInAnonymously) {
      return fail('This Supabase SDK build has no anonymous sign-in. Update to v2.43 or newer.', 'unsupported')
    }
    const { data, error } = await sb.auth.signInAnonymously()
    if (error) return fail(error.message, error.code)
    return ok({ user: normaliseUser(data.user), session: data.session, anonymous: true })
  }),

  /**
   * Phone OTP. Supabase does not send SMS itself — you connect your own
   * Twilio / MessageBird / Vonage account, which is a paid service. The call
   * works, but the cost is the operator's, so say so when it is not set up.
   */
  signInWithPhone: ({ phone }) => guard(async (sb) => {
    const { data, error } = await sb.auth.signInWithOtp({ phone })
    if (error) {
      if (/provider|disabled|sms/i.test(error.message || '')) {
        return fail('Phone sign-in needs an SMS provider configured in Supabase (Auth → Providers → Phone). SMS is billed by that provider, not Supabase.', 'sms_not_configured')
      }
      return fail(error.message, error.code)
    }
    return ok({ sent: true, ...data })
  }),

  signInWithOtp: ({ email, phone }) => guard(async (sb) => {
    const { data, error } = await sb.auth.signInWithOtp(email ? { email } : { phone })
    if (error) return fail(error.message, error.code)
    return ok({ sent: true, ...data })
  }),

  verifyOtp: ({ email, phone, token }) => guard(async (sb) => {
    const { data, error } = await sb.auth.verifyOtp(
      email ? { email, token, type: 'email' } : { phone, token, type: 'sms' }
    )
    if (error) return fail(error.message, error.code)
    return ok({ user: normaliseUser(data.user), session: data.session })
  }),

  signOut: () => guard(async (sb) => {
    const { error } = await sb.auth.signOut()
    return error ? fail(error.message) : { error: null }
  }),

  getSession: () => guard(async (sb) => {
    const { data, error } = await sb.auth.getSession()
    if (error) return fail(error.message)
    return ok({ session: data.session })
  }),

  getUser: () => guard(async (sb) => {
    const { data, error } = await sb.auth.getUser()
    if (error) return fail(error.message)
    return ok({ user: normaliseUser(data.user) })
  }),

  onAuthStateChange(cb) {
    let unsub = () => {}
    getClient().then((sb) => {
      const { data } = sb.auth.onAuthStateChange((event, session) => cb(event, session))
      unsub = () => data?.subscription?.unsubscribe?.()
    }).catch(() => {})
    return () => unsub()
  },

  resetPassword: ({ email, redirectTo }) => guard(async (sb) => {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo })
    return error ? fail(error.message) : ok({ sent: true })
  }),

  updateUser: ({ email, password, data }) => guard(async (sb) => {
    const { data: res, error } = await sb.auth.updateUser({ email, password, data })
    if (error) return fail(error.message)
    return ok({ user: normaliseUser(res.user) })
  }),
}

function applyFilter(q, filter) {
  if (!filter) return q
  for (const [k, v] of Object.entries(filter)) {
    if (v == null) continue
    if (Array.isArray(v)) q = q.in(k, v)
    else if (typeof v === 'object' && v.op) {
      const m = { gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte', ne: 'neq', in: 'in' }
      if (v.op === 'like') q = q.ilike(k, `%${v.value}%`)
      else if (m[v.op]) q = q[m[v.op]](k, v.value)
    } else q = q.eq(k, v)
  }
  return q
}

const db = {
  list: (table, { filter, sort, limit, offset = 0 } = {}) => guard(async (sb) => {
    let q = sb.from(table).select('*', { count: 'exact' })
    q = applyFilter(q, filter)
    if (sort) {
      const [key, dir = 'asc'] = Array.isArray(sort) ? sort : [sort]
      q = q.order(key, { ascending: dir !== 'desc' })
    }
    if (limit != null) q = q.range(offset, offset + limit - 1)
    const { data, error, count } = await q
    if (error) return fail(error.message)
    return ok(data || [], { count: count ?? data?.length ?? 0 })
  }),

  get: (table, id) => guard(async (sb) => {
    const { data, error } = await sb.from(table).select('*').eq('id', id).single()
    return error ? fail(error.message) : ok(data)
  }),

  insert: (table, row) => guard(async (sb) => {
    const { data, error } = await sb.from(table).insert(row).select().single()
    return error ? fail(error.message) : ok(data)
  }),

  update: (table, id, patch) => guard(async (sb) => {
    const { data, error } = await sb.from(table).update(patch).eq('id', id).select().single()
    return error ? fail(error.message) : ok(data)
  }),

  remove: (table, id) => guard(async (sb) => {
    const { error } = await sb.from(table).delete().eq('id', id)
    return error ? fail(error.message) : { error: null }
  }),

  upsert: (table, rows) => guard(async (sb) => {
    const { data, error } = await sb.from(table).upsert(rows).select()
    return error ? fail(error.message) : ok(data)
  }),

  count: (table, filter) => guard(async (sb) => {
    let q = sb.from(table).select('*', { count: 'exact', head: true })
    q = applyFilter(q, filter)
    const { count, error } = await q
    return error ? fail(error.message) : { count: count ?? 0, error: null }
  }),
}

const files = {
  upload: (bucket, path, file) => guard(async (sb) => {
    const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: true })
    if (error) return fail(error.message)
    const { data } = sb.storage.from(bucket).getPublicUrl(path)
    return ok({ path, url: data.publicUrl })
  }),

  getUrl(bucket, path) {
    if (!client) return ''
    return client.storage.from(bucket).getPublicUrl(path)?.data?.publicUrl || ''
  },

  remove: (bucket, path) => guard(async (sb) => {
    const { error } = await sb.storage.from(bucket).remove([path])
    return error ? fail(error.message) : { error: null }
  }),
}

const realtime = {
  subscribe(table, cb) {
    let channel = null
    getClient().then((sb) => {
      channel = sb.channel(`public:${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (p) => cb(p))
        .subscribe()
    }).catch(() => {})
    return () => { try { channel?.unsubscribe() } catch {} }
  },
}

export async function testConnection() {
  try {
    const sb = await getClient()
    const { error } = await sb.auth.getSession()
    if (error) throw error
    return ok({ connected: true, message: 'Connected to Supabase successfully.' })
  } catch (err) {
    return fail(err?.message || 'Could not reach Supabase')
  }
}

/** SQL the user runs once in the Supabase SQL editor. */
export const SETUP_SQL = `-- BharatCart — Supabase setup
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  name text, avatar text, role text default 'customer',
  phone text, meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "own profile read"  on profiles for select using (auth.uid() = id);
create policy "own profile write" on profiles for update using (auth.uid() = id);
create policy "own profile insert" on profiles for insert with check (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), 'customer');
  return new;
end; $$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();`

export default {
  id: 'supabase',
  label: 'Supabase',
  description: 'Free tier: 50k monthly active users, 500 MB Postgres, 1 GB storage. Email + OAuth + magic links out of the box.',
  isConfigured,
  getConfig, setConfig, testConnection, SETUP_SQL,
  auth, db, storage: files, realtime,
}
