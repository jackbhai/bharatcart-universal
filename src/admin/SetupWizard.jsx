import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import useAuth from '../hooks/useAuth.js'
import store from '../core/store/index.js'
import { ROLES } from '../backend/types.js'

const SETUP_FLAG = 'bharatcart_setup_done'

const STEPS = ['Account', 'Store profile', 'Backend', 'First product']

const CURRENCIES = [
  { code: 'INR', label: 'Indian Rupee (₹)' },
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'AED', label: 'UAE Dirham (د.إ)' },
  { code: 'SGD', label: 'Singapore Dollar (S$)' },
]

export function markSetupDone() {
  try { localStorage.setItem(SETUP_FLAG, '1') } catch { /* storage unavailable */ }
}

/**
 * First-run setup wizard (public route: /admin/setup).
 *
 * 1. Create your account — name/email/password via backend auth.signUp. The
 *    wizard account is created with the OWNER role so the new merchant can
 *    actually administer the store. Already signed in as staff? The step is
 *    skipped automatically.
 * 2. Store profile — store name + currency, persisted to the settings slice.
 * 3. Connect your backend — explains the local/demo backend and links to
 *    the integrations screen (rebuilt separately).
 * 4. Add your first product — deep-links into the catalogue product editor.
 *
 * Finish (or "Skip for now") sets the bharatcart_setup_done flag and lands on
 * the dashboard. Settings has a "Replay setup wizard" button that clears the
 * flag and returns here.
 */
export default function SetupWizard() {
  const nav = useNavigate()
  const auth = useAuth()

  const staffAuthed = auth.isAuthed && auth.isStaff
  const [step, setStep] = useState(staffAuthed ? 1 : 0)

  // Auth boots async — if the operator signs in (or the session restores)
  // while sitting on step 1, move past the account step on their behalf.
  useEffect(() => {
    if (staffAuthed) setStep(s => (s === 0 ? 1 : s))
  }, [staffAuthed])

  const finish = () => {
    markSetupDone()
    nav('/admin/dashboard')
  }
  const skip = () => finish()

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'var(--c-bg)' }}>
      {/* cinematic backdrop */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="aurora-wash absolute inset-x-0 top-0 h-80 opacity-80" />
        <div className="orb orb-a w-96 h-96 -top-24 -left-24 opacity-50" />
        <div className="orb orb-c w-80 h-80 top-1/3 -right-24 opacity-40" />
        <div className="orb orb-b w-72 h-72 -bottom-24 left-1/4 opacity-40" />
      </div>

      <div className="relative w-full max-w-xl">
        <div className="flex items-center justify-between mb-6 anim-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="float-slow w-9 h-9 rounded-xl grid place-items-center font-bold text-white shadow-lg glow-primary"
              style={{ background: 'linear-gradient(135deg, var(--c-primary), var(--c-secondary))' }}>
              B
            </div>
            <div>
              <p className="font-bold text-[15px] leading-tight" style={{ color: 'var(--c-text)' }}>BharatCart</p>
              <p className="text-[11px] leading-tight" style={{ color: 'var(--c-text-muted)' }}>Store setup</p>
            </div>
          </div>
          <button type="button" onClick={skip}
            className="pressable text-[13px] font-medium hover:underline" style={{ color: 'var(--c-text-muted)' }}>
            Skip for now
          </button>
        </div>

        {/* cinematic step progress: orbs joined by a gradient rail */}
        <div className="flex items-start mb-6 anim-fade-up" aria-hidden="true">
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 && (
                <div className="flex-1 mt-[14px] h-[3px] rounded-full overflow-hidden mx-0.5"
                  style={{ background: 'color-mix(in srgb, var(--c-text) 10%, transparent)' }}>
                  <motion.div className="h-full w-full rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, var(--c-primary), var(--c-secondary))',
                      transformOrigin: 'left',
                    }}
                    initial={false}
                    animate={{ scaleX: i <= step ? 1 : 0 }}
                    transition={{ duration: .45, ease: 'easeOut' }} />
                </div>
              )}
              <div className="flex flex-col items-center w-[72px] shrink-0">
                <motion.div
                  initial={false}
                  animate={i < step ? { scale: 1 } : i === step ? { scale: [1, 1.14, 1] } : { scale: 1 }}
                  transition={{ duration: .45 }}
                  className="w-[30px] h-[30px] rounded-full grid place-items-center text-[12px] font-bold"
                  style={i <= step
                    ? {
                        background: 'linear-gradient(135deg, var(--c-primary), var(--c-secondary))',
                        color: '#fff',
                        boxShadow: '0 0 18px var(--c-primary-ring)',
                      }
                    : {
                        background: 'color-mix(in srgb, var(--c-text) 8%, transparent)',
                        color: 'var(--c-text-muted)',
                      }}>
                  {i < step ? '✓' : i + 1}
                </motion.div>
                <p className="text-[9px] mt-1.5 font-semibold uppercase tracking-wide text-center leading-tight"
                  style={{ color: i === step ? 'var(--c-text)' : 'var(--c-text-muted)' }}>
                  {label}
                </p>
              </div>
            </React.Fragment>
          ))}
        </div>

        <div className="glass-pop elev-3 rounded-2xl p-6 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div key={step}
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
              transition={{ duration: .22 }}>
              {step === 0 && <AccountStep onDone={() => setStep(1)} />}
              {step === 1 && <StoreStep onBack={() => setStep(staffAuthed ? 1 : 0)} onDone={() => setStep(2)} showBack={!staffAuthed} />}
              {step === 2 && <BackendStep onBack={() => setStep(1)} onDone={() => setStep(3)} nav={nav} />}
              {step === 3 && <ProductStep onBack={() => setStep(2)} onFinish={finish} nav={nav} />}
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="text-center text-[11.5px] mt-4" style={{ color: 'var(--c-text-muted)' }}>
          You can change any of this later in Settings.
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ step 1 */

function AccountStep({ onDone }) {
  const auth = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    // The wizard account owns the store: create it with the OWNER role so the
    // new merchant lands with full admin rights, whatever the backend's
    // default signup role is.
    const r = await auth.signUp({ email: email.trim(), password, name: name.trim(), role: ROLES.OWNER })
    setBusy(false)
    if (r.ok) onDone()
    else setError(r.error)
  }

  return (
    <form onSubmit={submit} className="stagger">
      <h2 style={{ '--i': 0, color: 'var(--c-text)' }} className="text-xl font-bold">Create your account</h2>
      <p style={{ '--i': 1, color: 'var(--c-text-muted)' }} className="text-[13.5px] mt-1 mb-5">
        This becomes the store owner's login — the first account holds full admin rights.
      </p>

      <div style={{ '--i': 2 }} className="space-y-3 stagger">
        <div style={{ '--i': 0 }}>
          <Field label="Your name">
            <input value={name} onChange={e => setName(e.target.value)} required autoComplete="name"
              placeholder="Priya Sharma" className="t-input focus-ring" />
          </Field>
        </div>
        <div style={{ '--i': 1 }}>
          <Field label="Email">
            <input value={email} onChange={e => setEmail(e.target.value)} required type="email" autoComplete="email"
              placeholder="you@yourstore.in" className="t-input focus-ring" />
          </Field>
        </div>
        <div style={{ '--i': 2 }}>
          <Field label="Password">
            <input value={password} onChange={e => setPassword(e.target.value)} required type="password"
              minLength={6} autoComplete="new-password" placeholder="At least 6 characters" className="t-input focus-ring" />
          </Field>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl text-[13px] border"
          style={{ '--i': 3, borderColor: 'var(--c-danger)', color: 'var(--c-danger)', background: 'color-mix(in srgb, var(--c-danger) 7%, transparent)' }}>
          {error.message || 'Could not create the account.'}
          {error.code === 'user_exists' && (
            <span> <Link to="/auth" className="font-semibold underline">Sign in instead</Link>.</span>
          )}
        </div>
      )}

      <div style={{ '--i': 4 }}>
        <button type="submit" disabled={busy} className="t-btn t-btn-primary pressable glow-primary w-full mt-5">
          {busy ? 'Creating account…' : 'Create account & continue'}
        </button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------ step 2 */

function StoreStep({ onBack, onDone, showBack }) {
  const current = store.get('settings')?.store ?? {}
  const [name, setName] = useState(current.name && current.name !== 'BharatCart' ? current.name : '')
  const [currency, setCurrency] = useState(current.currency || 'INR')

  const submit = (e) => {
    e?.preventDefault()
    if (!name.trim()) return
    store.dispatch('settings/setStore', { name: name.trim(), currency })
    try { localStorage.setItem('bharatcart_store_name', name.trim()) } catch { /* noop */ }
    onDone()
  }

  return (
    <form onSubmit={submit} className="stagger">
      <h2 style={{ '--i': 0, color: 'var(--c-text)' }} className="text-xl font-bold">Name your store</h2>
      <p style={{ '--i': 1, color: 'var(--c-text-muted)' }} className="text-[13.5px] mt-1 mb-5">
        This appears on the storefront, invoices and emails. The currency sets how prices display.
      </p>

      <div style={{ '--i': 2 }} className="space-y-3 stagger">
        <div style={{ '--i': 0 }}>
          <Field label="Store name">
            <input value={name} onChange={e => setName(e.target.value)} required
              placeholder="e.g. Jaipur Handloom House" className="t-input focus-ring" />
          </Field>
        </div>
        <div style={{ '--i': 1 }}>
          <Field label="Currency">
            <select value={currency} onChange={e => setCurrency(e.target.value)} className="t-input focus-ring">
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div style={{ '--i': 3 }} className="flex gap-2 mt-5">
        {showBack && <button type="button" onClick={onBack} className="t-btn pressable">Back</button>}
        <button type="submit" className="t-btn t-btn-primary pressable glow-primary flex-1">Save & continue</button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------ step 3 */

function BackendStep({ onBack, onDone, nav }) {
  return (
    <div className="stagger">
      <h2 style={{ '--i': 0, color: 'var(--c-text)' }} className="text-xl font-bold">Connect your backend</h2>
      <p style={{ '--i': 1, color: 'var(--c-text-muted)' }} className="text-[13.5px] mt-1 mb-4 leading-relaxed">
        Right now BharatCart runs on its built-in local backend — your data stays in this
        browser, which is perfect for trying things out. When you are ready for a real
        database, APIs and team logins, connect a production backend from the integrations screen.
      </p>
      <div style={{ '--i': 2 }} className="glass-tint rounded-xl p-4 mb-5 flex gap-3">
        <span className="text-xl" aria-hidden="true">⛁</span>
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--c-text)' }}>
          Nothing to configure yet — the local backend is already running. Open integrations
          to see what is available, or continue and add your first product.
        </p>
      </div>
      <div style={{ '--i': 3 }} className="flex flex-wrap gap-2">
        <button type="button" onClick={onBack} className="t-btn pressable">Back</button>
        <button type="button" onClick={() => nav('/admin/integrations')} className="t-btn t-btn-primary pressable glow-primary flex-1">
          Open integrations
        </button>
        <button type="button" onClick={onDone} className="t-btn pressable w-full">
          Continue without connecting
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ step 4 */

function ProductStep({ onBack, onFinish, nav }) {
  return (
    <div className="stagger">
      <h2 style={{ '--i': 0, color: 'var(--c-text)' }} className="text-xl font-bold">Add your first product</h2>
      <p style={{ '--i': 1, color: 'var(--c-text-muted)' }} className="text-[13.5px] mt-1 mb-5 leading-relaxed">
        A store with one product is already a store. Add photos, variants and pricing —
        it goes live on the storefront the moment you publish it.
      </p>
      <div style={{ '--i': 2 }} className="flex flex-wrap gap-2">
        <button type="button" onClick={onBack} className="t-btn pressable">Back</button>
        <button type="button" onClick={() => nav('/admin/catalogue', { state: { newProduct: true } })}
          className="t-btn t-btn-primary pressable glow-primary flex-1">
          Add your first product
        </button>
        <button type="button" onClick={onFinish} className="t-btn pressable w-full">
          Finish — take me to the dashboard
        </button>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- bits */

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--c-text)' }}>{label}</span>
      {children}
    </label>
  )
}
