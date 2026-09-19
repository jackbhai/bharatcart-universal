import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import backend, { adapters, setActive, getActiveId } from '../../backend/index.js'
import useToast from '../../hooks/useToast.js'
import useAuth from '../../hooks/useAuth.js'
import { cx } from '../../ui/kit.jsx'

export default function BackendSettings() {
  const { success, error, info } = useToast()
  const auth = useAuth()
  const [activeId, setActiveIdState] = useState(getActiveId())
  const [testing, setTesting] = useState(null)
  const [result, setResult] = useState(null)
  const [showSql, setShowSql] = useState(false)

  const [sb, setSb] = useState(adapters.supabase.getConfig())
  const [fb, setFb] = useState(adapters.firebase.getConfig())

  const choose = (id) => {
    setActive(id)
    setActiveIdState(id)
    setResult(null)
    success(`Switched to ${adapters[id].label}`)
  }

  const saveSupabase = () => {
    adapters.supabase.setConfig(sb)
    success('Supabase credentials saved')
    setResult(null)
  }

  const saveFirebase = () => {
    adapters.firebase.setConfig(fb)
    success('Firebase credentials saved')
    setResult(null)
  }

  const test = async (id) => {
    setTesting(id)
    setResult(null)
    const fn = adapters[id].testConnection
    if (!fn) { setTesting(null); info('Local mode needs no connection test — it always works.'); return }
    const res = await fn()
    setTesting(null)
    setResult({ id, ok: !res.error, message: res.error?.message || res.data?.message })
    res.error ? error(res.error.message) : success(res.data.message)
  }

  const copy = (text, what) => {
    navigator.clipboard?.writeText(text)
    info(`${what} copied to clipboard`)
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--c-text)' }}>Backend</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
          Choose where accounts and data live. Switch any time — the app code never changes.
        </p>
      </div>

      {/* current status */}
      <div className="t-card p-4 flex flex-wrap items-center gap-3">
        <span className="w-2 h-2 rounded-full" style={{ background: 'var(--c-success)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold" style={{ color: 'var(--c-text)' }}>
            Active: {backend.label}
          </p>
          <p className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
            {auth.isAuthed ? `Signed in as ${auth.user.email} (${auth.user.role})` : 'Not signed in'}
            {backend.isFallback && ' · selected backend is unconfigured, using Local as fallback'}
          </p>
        </div>
      </div>

      {/* adapter cards */}
      <div className="grid sm:grid-cols-3 gap-3">
        {Object.values(adapters).map((a, i) => {
          const active = activeId === a.id
          const configured = a.isConfigured()
          return (
            <motion.button key={a.id} onClick={() => choose(a.id)}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * .06 }}
              whileHover={{ y: -2 }}
              className="t-card t-card-hover p-4 text-left relative overflow-hidden"
              style={active ? { borderColor: 'var(--c-primary)', borderWidth: 2 } : undefined}>
              {active && (
                <motion.span layoutId="backend-active"
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: 'var(--c-primary)' }} />
              )}
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-[14px]" style={{ color: 'var(--c-text)' }}>{a.label}</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0"
                  style={configured
                    ? { background: 'color-mix(in srgb, var(--c-success) 14%, transparent)', color: 'var(--c-success)' }
                    : { background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}>
                  {configured ? 'READY' : 'NEEDS KEYS'}
                </span>
              </div>
              <p className="text-[11.5px] mt-1.5 leading-snug" style={{ color: 'var(--c-text-muted)' }}>
                {a.description}
              </p>
            </motion.button>
          )
        })}
      </div>

      {/* result banner */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="t-card p-3 border-l-4"
              style={{ borderLeftColor: result.ok ? 'var(--c-success)' : 'var(--c-danger)' }}>
              <p className="text-[12.5px]" style={{ color: 'var(--c-text)' }}>{result.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------ local */}
      {activeId === 'local' && (
        <Panel title="Local mode" subtitle="Nothing to configure">
          <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--c-text-muted)' }}>
            Accounts and data are stored in this browser. This is what makes the app deployable to
            GitHub Pages, Netlify Drop, Vercel or any static host with zero setup and zero cost.
            Data is per-browser and per-device — connect Supabase or Firebase when you need real
            multi-user accounts.
          </p>
          <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--c-surface-alt)' }}>
            <p className="text-[11.5px] font-semibold mb-1" style={{ color: 'var(--c-text)' }}>Demo account</p>
            <p className="text-[11.5px] font-mono" style={{ color: 'var(--c-text-muted)' }}>
              owner@bharatcart.in · no password needed
            </p>
          </div>
        </Panel>
      )}

      {/* --------------------------------------------------- supabase */}
      {activeId === 'supabase' && (
        <Panel title="Supabase" subtitle="Free tier: 50k monthly users, 500 MB Postgres"
          action={<TestBtn onClick={() => test('supabase')} busy={testing === 'supabase'} />}>
          <div className="space-y-3">
            <Field label="Project URL" value={sb.url} placeholder="https://xxxxx.supabase.co"
              onChange={v => setSb(s => ({ ...s, url: v }))} />
            <Field label="Anon public key" value={sb.anonKey} placeholder="eyJhbGciOi…" mono
              onChange={v => setSb(s => ({ ...s, anonKey: v }))} />
            <button onClick={saveSupabase} className="t-btn t-btn-primary px-4 py-2 text-[13px]">
              Save credentials
            </button>

            <Steps items={[
              'Create a free project at supabase.com',
              'Project Settings → API → copy the URL and anon key',
              'Paste them above and save',
              'Run the setup SQL below in the SQL Editor',
              'Authentication → Providers → enable Email (and Google for OAuth)',
            ]} />

            <div>
              <button onClick={() => setShowSql(s => !s)}
                className="text-[12px] font-semibold" style={{ color: 'var(--c-primary)' }}>
                {showSql ? '▴ Hide' : '▾ Show'} setup SQL
              </button>
              <AnimatePresence>
                {showSql && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden">
                    <pre className="mt-2 p-3 rounded-lg text-[10.5px] overflow-x-auto leading-relaxed"
                      style={{ background: 'var(--c-text)', color: 'var(--c-surface)' }}>
                      {adapters.supabase.SETUP_SQL}
                    </pre>
                    <button onClick={() => copy(adapters.supabase.SETUP_SQL, 'SQL')}
                      className="mt-1.5 text-[11px] font-semibold" style={{ color: 'var(--c-primary)' }}>
                      Copy SQL
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Panel>
      )}

      {/* --------------------------------------------------- firebase */}
      {activeId === 'firebase' && (
        <Panel title="Firebase" subtitle="Free Spark plan: unlimited auth users, 1 GiB Firestore"
          action={<TestBtn onClick={() => test('firebase')} busy={testing === 'firebase'} />}>
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="API key" value={fb.apiKey} mono onChange={v => setFb(s => ({ ...s, apiKey: v }))} />
              <Field label="Auth domain" value={fb.authDomain} placeholder="proj.firebaseapp.com"
                onChange={v => setFb(s => ({ ...s, authDomain: v }))} />
              <Field label="Project ID" value={fb.projectId} onChange={v => setFb(s => ({ ...s, projectId: v }))} />
              <Field label="Storage bucket" value={fb.storageBucket} placeholder="proj.appspot.com"
                onChange={v => setFb(s => ({ ...s, storageBucket: v }))} />
              <Field label="App ID" value={fb.appId} mono onChange={v => setFb(s => ({ ...s, appId: v }))} />
            </div>
            <button onClick={saveFirebase} className="t-btn t-btn-primary px-4 py-2 text-[13px]">
              Save credentials
            </button>

            <Steps items={[
              'Create a project at console.firebase.google.com',
              'Build → Authentication → enable Email/Password (and Google)',
              'Build → Firestore Database → create database',
              'Project settings → Your apps → Web → copy the config',
              'Paste the values above and save',
            ]} />
          </div>
        </Panel>
      )}

      {/* deploy note */}
      <Panel title="Deploying" subtitle="Works on any static host">
        <div className="space-y-2 text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          <p>
            The app is a pure static bundle with <strong>split routing</strong>: the storefront
            uses clean history-API URLs (<code>/shop</code>, <code>/product/…</code>) served
            through a <code>404.html</code> fallback, while the admin panel stays on hash
            routing (<code>#/admin/…</code>). Deep links and refreshes work everywhere
            without server rewrites — GitHub Pages, Netlify, Vercel,
            Cloudflare Pages, S3, even opened from disk.
          </p>
          <pre className="p-3 rounded-lg text-[11px] overflow-x-auto"
            style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text)' }}>
{`npm run build          # outputs dist/

# GitHub Pages
npx gh-pages -d dist

# Netlify / Vercel / Cloudflare Pages
drag the dist folder onto their dashboard`}
          </pre>
          <p>
            Optional build-time env: <code className="font-mono text-[11px]">VITE_BACKEND=supabase</code> plus
            {' '}<code className="font-mono text-[11px]">VITE_SUPABASE_URL</code> and
            {' '}<code className="font-mono text-[11px]">VITE_SUPABASE_ANON_KEY</code>.
          </p>
        </div>
      </Panel>
    </div>
  )
}

/* ------------------------------------------------------------ bits */
function Panel({ title, subtitle, action, children }) {
  return (
    <div className="t-card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-bold text-[15px]" style={{ color: 'var(--c-text)' }}>{title}</h2>
          {subtitle && <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, mono }) {
  return (
    <label className="block">
      <span className="text-[11.5px] font-medium block mb-1" style={{ color: 'var(--c-text)' }}>{label}</span>
      <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        spellCheck={false}
        className={cx('t-input w-full px-2.5 py-2 text-[12px]', mono && 'font-mono text-[11px]')} />
    </label>
  )
}

function TestBtn({ onClick, busy }) {
  return (
    <button onClick={onClick} disabled={busy}
      className="t-btn px-3 py-1.5 text-[12px] font-semibold border shrink-0 disabled:opacity-50"
      style={{ borderColor: 'var(--c-primary)', color: 'var(--c-primary)' }}>
      {busy ? 'Testing…' : 'Test connection'}
    </button>
  )
}

function Steps({ items }) {
  return (
    <ol className="space-y-1.5 mt-1">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2.5 text-[12px]" style={{ color: 'var(--c-text-muted)' }}>
          <span className="w-4 h-4 rounded-full grid place-items-center text-[9px] font-bold shrink-0 mt-0.5"
            style={{ background: 'var(--c-primary-soft)', color: 'var(--c-primary)' }}>
            {i + 1}
          </span>
          {s}
        </li>
      ))}
    </ol>
  )
}
