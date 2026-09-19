import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import useAuth from '../hooks/useAuth.js'
import useToast from '../hooks/useToast.js'
import { useSlice } from '../hooks/useStore.js'
import { Aurora, Noise, Magnetic } from '../ui/fx.jsx'
import { cx } from '../ui/kit.jsx'
import backend from '../backend/index.js'
import { oauthProvidersFor, readEnabled, PROVIDERS_BY_ID } from './providers.js'
import AuthProviderBadge from './AuthProviderBadge.jsx'

const MODES = {
  signin: { title: 'Welcome back', sub: 'Sign in to continue', cta: 'Sign in' },
  signup: { title: 'Create your account', sub: 'Start shopping in seconds', cta: 'Create account' },
  otp:    { title: 'Sign in with a code', sub: 'We will email you a one-time code', cta: 'Send code' },
  reset:  { title: 'Reset your password', sub: 'We will email you a reset link', cta: 'Send reset link' },
}

/**
 * The social buttons are no longer a hardcoded three. They come from the
 * provider registry, filtered twice: by what the ACTIVE BACKEND can actually
 * perform, and by what the operator has switched on in Settings. A button is
 * never shown for a flow that would fail.
 */
function useOauthButtons() {
  return React.useMemo(() => {
    const backendId = backend.id
    const enabled = readEnabled(backendId)
    return oauthProvidersFor(backendId).filter(p => enabled.includes(p.id))
  }, [])
}

export default function AuthScreen({ intent: intentProp, successTo }) {
  /*
   * Where should a successful sign-in land?
   *
   * RequireAuth records the page the visitor was trying to reach before it
   * redirected them here. Honouring that is the difference between "sign in
   * and carry on" and "sign in and get dumped on the shop, wondering where the
   * admin panel went".
   */
  const location = useLocation()
  const cameFrom = location.state?.from || ''
  const intent = intentProp || (cameFrom.startsWith('/admin') ? 'admin' : 'shop')
  const auth = useAuth()
  const nav = useNavigate()
  const { success, error: toastError, info } = useToast()
  const theme = useSlice('theme')

  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({ email: '', password: '', name: '', token: '' })
  const [otpSent, setOtpSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const oauthButtons = useOauthButtons()
  const m = MODES[mode]
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const go = () => nav(successTo || (intent === 'admin' ? '/admin/dashboard' : '/shop'))

  const submit = async (e) => {
    e?.preventDefault()
    setBusy(true)
    auth.clearError()

    try {
      if (mode === 'signin') {
        const r = await auth.signIn({ email: form.email, password: form.password })
        if (r.ok) { success('Signed in'); go() } else toastError(r.error.message)
      }

      else if (mode === 'signup') {
        const r = await auth.signUp({ email: form.email, password: form.password, name: form.name })
        if (r.ok) { success('Account created'); go() } else toastError(r.error.message)
      }

      else if (mode === 'otp') {
        if (!otpSent) {
          const r = await auth.signInWithOtp({ email: form.email })
          if (r?.error) toastError(r.error.message)
          else { setOtpSent(true); info(r?.data?.message || 'Code sent to your email') }
        } else {
          const r = await auth.verifyOtp({ email: form.email, token: form.token })
          if (r.ok) { success('Signed in'); go() } else toastError(r.error.message)
        }
      }

      else if (mode === 'reset') {
        const r = await auth.resetPassword({ email: form.email })
        if (r?.error) toastError(r.error.message)
        else info(r?.data?.message || 'Check your email for the reset link')
      }
    } finally {
      setBusy(false)
    }
  }

  const oauth = async (provider) => {
    setBusy(true)
    const r = await auth.signInWithOAuth({ provider })
    setBusy(false)
    const label = PROVIDERS_BY_ID[provider]?.label || provider
    // A redirect-based provider (Cloudflare Access, or a popup-blocked
    // fallback) never resolves to a session here - the page navigates away.
    if (r.ok && r.data?.redirecting) { info(`Redirecting to ${label}…`); return }
    if (r.ok) { success(`Signed in with ${label}`); go() }
    else toastError(r.error.message)
  }

  const guest = async () => {
    setBusy(true)
    const r = await auth.signInAnonymously()
    setBusy(false)
    if (r.ok) { success('Continuing as guest'); go() }
    else toastError(r.error.message)
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2" style={{ background: 'var(--c-bg)' }}>
      {/* ------------------------------------------------- left: brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden"
        style={{ background: 'var(--c-text)' }}>
        <Aurora colors={['var(--c-primary)', 'var(--c-secondary)']} opacity={0.4} blobs={3} />
        <Noise opacity={0.04} />

        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl grid place-items-center font-bold text-lg"
              style={{ background: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}>
              {theme.tokens.logoText || 'B'}
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">{theme.tokens.storeName}</p>
              <p className="text-white/50 text-xs">{theme.tokens.tagline}</p>
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <motion.h2 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: .6, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl font-bold text-white leading-[1.12] tracking-tight">
            One platform.<br />
            <span style={{ color: 'var(--c-primary)' }}>Storefront</span> and{' '}
            <span style={{ color: 'var(--c-secondary)' }}>admin</span>,<br />
            perfectly in sync.
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: .12, duration: .6 }}
            className="text-white/55 mt-4 leading-relaxed">
            Change a theme, a price, a loyalty rule or a coupon in the admin panel
            and watch the storefront update instantly — even in another tab.
          </motion.p>

          <div className="flex gap-6 mt-8">
            {[['960+', 'Features'], ['11', 'UI themes'], ['3', 'Backends']].map(([n, l], i) => (
              <motion.div key={l} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: .2 + i * .08 }}>
                <p className="text-2xl font-bold text-white tabular-nums">{n}</p>
                <p className="text-white/40 text-xs uppercase tracking-wider">{l}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-white/40 text-xs">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--c-success)' }} />
          Backend: {backend.label}
        </div>
      </div>

      {/* ------------------------------------------------------- right: form */}
      <div className="relative flex items-center justify-center p-6 sm:p-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="orb orb-a w-72 h-72 -top-16 -right-16 opacity-50" />
          <div className="orb orb-b w-64 h-64 -bottom-20 -left-12 opacity-40" />
        </div>
        <div className="relative w-full max-w-sm">
          <div className="glass-pop elev-3 rounded-3xl p-6 sm:p-8 anim-fade-up">
            {/* floating brand mark */}
            <div className="flex flex-col items-center text-center mb-5">
              <div className="float-slow w-12 h-12 rounded-2xl grid place-items-center font-bold text-lg glow-primary mb-2.5 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, var(--c-primary), var(--c-secondary))', color: '#fff' }}>
                {theme.tokens.logoUrl
                  ? <img src={theme.tokens.logoUrl} alt="" className="w-full h-full object-contain" />
                  : (theme.tokens.logoText || 'B')}
              </div>
              <p className="lg:hidden font-bold text-[15px]" style={{ color: 'var(--c-text)' }}>{theme.tokens.storeName}</p>
            </div>

          <AnimatePresence mode="wait">
            <motion.div key={mode}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              transition={{ duration: .22 }}>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--c-text)' }}>
                {m.title}
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--c-text-muted)' }}>{m.sub}</p>
              {new URLSearchParams(location.search).get('reason') === 'timeout' && (
                <p className="text-[12.5px] mt-2 px-3 py-2 rounded-lg"
                  style={{ background: 'color-mix(in srgb, var(--c-warn) 12%, transparent)', color: 'var(--c-warn)' }}>
                  You were signed out after 30 minutes of inactivity.
                </p>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-4">
            <AuthProviderBadge info={auth.authProvider} />
          </div>

          <form onSubmit={submit} className="mt-6 space-y-3">
            {mode === 'signup' && (
              <Field label="Full name" value={form.name} onChange={set('name')}
                placeholder="Priya Sharma" autoComplete="name" />
            )}

            <Field label="Email" type="email" value={form.email} onChange={set('email')}
              placeholder="you@example.com" autoComplete="email" required />

            {(mode === 'signin' || mode === 'signup') && (
              <Field label="Password" type="password" value={form.password} onChange={set('password')}
                placeholder="••••••••" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required />
            )}

            {mode === 'otp' && otpSent && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <Field label="6-digit code" value={form.token} onChange={set('token')}
                  placeholder="123456" inputMode="numeric" />
              </motion.div>
            )}

            {auth.error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="text-[12px] px-3 py-2 rounded-lg"
                style={{ background: 'color-mix(in srgb, var(--c-danger) 10%, transparent)', color: 'var(--c-danger)' }}>
                {auth.error.message}
              </motion.p>
            )}

            <Magnetic strength={0.12}>
              <motion.button type="submit" disabled={busy}
                whileTap={{ scale: .98 }}
                className="t-btn t-btn-primary pressable glow-primary w-full py-2.5 text-sm font-semibold disabled:opacity-60">
                {busy ? 'Please wait…' : (mode === 'otp' && otpSent ? 'Verify code' : m.cta)}
              </motion.button>
            </Magnetic>
          </form>

          {(mode === 'signin' || mode === 'signup') && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px" style={{ background: 'var(--c-border)' }} />
                <span className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>or continue with</span>
                <div className="flex-1 h-px" style={{ background: 'var(--c-border)' }} />
              </div>

              {/* Two per row on a phone, three from small tablets up - a
                  five-provider grid at three columns leaves an awkward orphan
                  on narrow screens. */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {oauthButtons.map(p => (
                  <motion.button key={p.id} type="button" onClick={() => oauth(p.id)} disabled={busy}
                    title={p.setup || p.label}
                    whileHover={{ y: -2 }} whileTap={{ scale: .97 }}
                    className="t-btn pressable py-2.5 text-sm font-semibold border flex items-center justify-center gap-1.5 disabled:opacity-50 min-h-[44px]"
                    style={{ borderColor: 'var(--c-border)', color: 'var(--c-text)' }}>
                    <span className="font-bold" style={{ color: p.colour }}>{p.icon}</span>
                    <span className="hidden sm:inline text-[12px]">{p.label}</span>
                  </motion.button>
                ))}
              </div>

              <button type="button" onClick={guest} disabled={busy}
                className="mt-2 w-full py-2.5 text-[12px] underline-offset-2 hover:underline disabled:opacity-50 min-h-[44px]"
                style={{ color: 'var(--c-text-muted)' }}>
                Continue as guest
              </button>
            </>
          )}

          {/* mode switches */}
          <div className="mt-6 space-y-2 text-[12px]" style={{ color: 'var(--c-text-muted)' }}>
            {mode === 'signin' && (
              <>
                <p>
                  New here?{' '}
                  <button onClick={() => setMode('signup')} className="font-semibold hover:underline"
                    style={{ color: 'var(--c-primary)' }}>Create an account</button>
                </p>
                <p className="flex gap-3">
                  <button onClick={() => { setMode('otp'); setOtpSent(false) }} className="hover:underline">
                    Email me a code
                  </button>
                  <button onClick={() => setMode('reset')} className="hover:underline">
                    Forgot password?
                  </button>
                </p>
              </>
            )}
            {mode !== 'signin' && (
              <button onClick={() => { setMode('signin'); setOtpSent(false) }} className="font-semibold hover:underline"
                style={{ color: 'var(--c-primary)' }}>
                ← Back to sign in
              </button>
            )}
          </div>

          {/* browse link (no demo logins — sign in with a real account) */}
          <div className="mt-6 pt-5 border-t" style={{ borderColor: 'var(--c-border)' }}>
            <button onClick={() => nav('/shop')}
              className="t-btn pressable px-3 py-2 text-[12px] font-semibold border"
              style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-muted)' }}>
              Browse storefront
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium block mb-1.5" style={{ color: 'var(--c-text)' }}>{label}</span>
      <input {...props} className="t-input w-full px-3 py-2.5 text-sm focus-ring" />
    </label>
  )
}
