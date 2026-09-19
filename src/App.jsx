import React, { lazy, Suspense, useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom'
import { cx, Avatar } from './ui/kit.jsx'
import { Magnetic, Aurora, Noise, Counter, Spotlight } from './ui/fx.jsx'
import RouteTransition from './ui/RouteTransition.jsx'
import { RequirePermission, visibleNav, SCREEN_PERMISSIONS } from './auth/rbac.jsx'
import IdleGuard from './auth/IdleGuard.jsx'
import { SkeletonScreen } from './ui/feedback/Skeleton.jsx'
import { press, pressIcon, lift } from './ui/motion/interactions.js'

import { useThemeEffect } from './hooks/useTheme.js'
import useAuth from './hooks/useAuth.js'
import { useSlice } from './hooks/useStore.js'
import store from './core/store/index.js'
import ToastHost from './ui/feedback/ToastHost.jsx'
import AuthScreen from './auth/AuthScreen.jsx'
import RequireAuth from './auth/RequireAuth.jsx'
import { ROLES } from './backend/types.js'
import backend from './backend/index.js'

import Dashboard from './admin/Dashboard.jsx'
import SetupWizard from './admin/SetupWizard.jsx'
import BackendStatus from './admin/BackendStatus.jsx'
import NotFound from './ui/NotFound.jsx'
import { loop, useDeviceProfile } from './ui/useDeviceProfile.js'

/* Route-level code splitting — each admin module ships as its own chunk. */
const Customers = lazy(() => import('./admin/customers/index.jsx'))
const Orders = lazy(() => import('./admin/orders/index.jsx'))
const Returns = lazy(() => import('./admin/returns/index.jsx'))
const Operations = lazy(() => import('./admin/operations/index.jsx'))
const Loyalty = lazy(() => import('./admin/loyalty/index.jsx'))
const Promotions = lazy(() => import('./admin/promotions/index.jsx'))
const Marketing = lazy(() => import('./admin/marketing/index.jsx'))
const Analytics = lazy(() => import('./admin/analytics/index.jsx'))
const Finance = lazy(() => import('./admin/finance/index.jsx'))
const Settings = lazy(() => import('./admin/settings/index.jsx'))
const Localisation = lazy(() => import('./admin/localisation/Localisation.jsx'))
const Catalogue = lazy(() => import('./admin/catalogue/index.jsx'))
const Vendors = lazy(() => import('./admin/vendors/index.jsx'))
const Inventory = lazy(() => import('./admin/inventory/index.jsx'))
const Shipping = lazy(() => import('./admin/shipping/index.jsx'))
const Support = lazy(() => import('./admin/support/index.jsx'))
const Content = lazy(() => import('./admin/content/index.jsx'))
const Reports = lazy(() => import('./admin/reports/index.jsx'))
const People = lazy(() => import('./admin/people/index.jsx'))
const Integrations = lazy(() => import('./admin/integrations/index.jsx'))
const ThemeStudio = lazy(() => import('./admin/theme/ThemeStudio.jsx'))
/* The whole storefront ships as one chunk behind /* — admin never downloads it. */
const ShopApp = lazy(() => import('./shop/ShopApp.jsx'))



import { ALERTS, num, inrShort, kpis } from './lib/analytics.js'
import { CUSTOMERS, ORDERS } from './data/seed.js'
import { RETURNS } from './data/returnsSeed.js'
import { selectProducts } from './core/store/slices/catalogueSlice.js'
import LocaleBar from './ui/locale/LocaleBar.jsx'
import { goShop, goAdminSetup } from './lib/siteUrls.js'

const NAV = [
  // Analyse — what happened and why.
  { id: 'dashboard', label: 'Dashboard', icon: '◈', group: 'Analyse' },
  { id: 'analytics', label: 'Analytics', icon: '◲', group: 'Analyse' },
  { id: 'reports', label: 'Reports', icon: '⌸', group: 'Analyse' },
  { id: 'customers', label: 'Customers', icon: '◉', group: 'Analyse', badge: CUSTOMERS.length ? num(CUSTOMERS.length) : null },
  { id: 'finance', label: 'Finance', icon: '₹', group: 'Analyse' },

  // Operate — the work of actually running the shop today.
  { id: 'orders', label: 'Orders', icon: '▤', group: 'Operate', badge: ORDERS.length ? num(ORDERS.length) : null },
  { id: 'catalogue', label: 'Catalogue', icon: '▦', group: 'Operate' },
  { id: 'inventory', label: 'Inventory', icon: '⬓', group: 'Operate' },
  { id: 'returns', label: 'Returns', icon: '↩', group: 'Operate', badge: RETURNS.length ? num(RETURNS.length) : null },
  { id: 'shipping', label: 'Shipping', icon: '⇥', group: 'Operate' },
  { id: 'vendors', label: 'Vendors', icon: '⌂', group: 'Operate' },
  { id: 'support', label: 'Support', icon: '☏', group: 'Operate' },
  { id: 'operations', label: 'Operations', icon: '◆', group: 'Operate' },

  // Grow — everything that brings customers back.
  { id: 'marketing', label: 'Growth', icon: '◐', group: 'Grow' },
  { id: 'promotions', label: 'Promotions', icon: '％', group: 'Grow' },
  { id: 'loyalty', label: 'Loyalty', icon: '★', group: 'Grow' },
  { id: 'content', label: 'Content', icon: '✎', group: 'Grow' },

  // Customise — how the shop looks, speaks and connects.
  { id: 'theme', label: 'Theme Studio', icon: '✦', group: 'Customise' },
  { id: 'localisation', label: 'Localisation', icon: '🌐', group: 'Customise' },
  { id: 'integrations', label: 'Integrations', icon: '⊞', group: 'Customise' },
  { id: 'people', label: 'People', icon: '☺', group: 'Customise' },
  { id: 'settings', label: 'Settings', icon: '⚙', group: 'Customise' },
]

const GROUPS = ['Analyse', 'Operate', 'Grow', 'Customise']

/* ============================================================
   Admin -> Storefront link

   Deliberately one-way. There is no button anywhere in the shop that
   leads to the admin panel: the only way in is to type the /#/admin
   URL. A visible "Admin" control on a public storefront advertises the
   back office to every shopper and every crawler, which is exactly the
   wrong default. Staff who need it know the URL.
============================================================ */
function PanelSwitch() {
  const label = 'Storefront'
  const icon = '🛍'
  return (
    <Magnetic strength={0.2}>
      <motion.button
        // Full navigation, not router nav: the storefront lives under a
        // different router (BrowserRouter, clean URLs) than the admin tree.
        onClick={() => goShop('/shop')}
        whileHover={{ scale: 1.04 }} whileTap={{ scale: .96 }}
        className="group relative overflow-hidden rounded-full pl-4 pr-3 py-2.5 flex items-center gap-2.5
                   text-[13px] font-semibold shadow-2xl border border-white/10"
        style={{ background: 'var(--c-text)', color: 'var(--c-surface)' }}>
        <Aurora colors={['var(--c-primary)', 'var(--c-secondary)']} opacity={0.5} blobs={2} />
        <span className="relative">{icon}</span>
        <span className="relative">Switch to {label}</span>
        <motion.span className="relative opacity-50" animate={{ x: [0, 4, 0] }} transition={loop({ duration: 1.4 })}>→</motion.span>
      </motion.button>
    </Magnetic>
  )
}

/* ============================================================
   Admin shell
============================================================ */

/**
 * Shown while a lazy admin route loads.
 *
 * This was a centred spinner on an otherwise empty page. A skeleton that
 * mirrors the real layout feels faster for the same wait, because the eye
 * already knows where the content will land and nothing jumps when it does.
 */
function RouteLoading() {
  return <SkeletonScreen />
}

/**
 * Loud, admin-visible warning when a production backend was selected but has
 * no credentials, so the app is silently running on the local demo backend.
 * Links straight to Settings → Backend where it can be fixed.
 */
function BackendWarningBanner({ go }) {
  const [warnings, setWarnings] = useState(() => backend.warnings)
  useEffect(() => {
    // Re-check when the operator changes the backend in Settings.
    const id = setInterval(() => {
      const next = backend.warnings
      setWarnings(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    }, 2000)
    return () => clearInterval(id)
  }, [])
  if (!warnings.length) return null
  return (
    <div role="alert" className="mb-4 p-3 rounded-xl border flex items-start gap-3"
      style={{ borderColor: 'var(--c-danger)', background: 'color-mix(in srgb, var(--c-danger) 8%, transparent)' }}>
      <span aria-hidden="true" className="text-lg leading-none mt-0.5">⚠️</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold" style={{ color: 'var(--c-text)' }}>
          Backend not configured — running on local demo storage
        </p>
        {warnings.map(w => (
          <p key={w.id} className="text-[12px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
            {w.message}
          </p>
        ))}
      </div>
      <button onClick={() => go('settings')}
        className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-semibold border"
        style={{ borderColor: 'var(--c-danger)', color: 'var(--c-danger)' }}>
        Fix in Settings
      </button>
    </div>
  )
}

function AdminView() {
  const nav = useNavigate()
  const loc = useLocation()
  const auth = useAuth()
  const theme = useSlice('theme')
  const page = loc.pathname.split('/')[2] || 'dashboard'
  const device = useDeviceProfile()
  // The sidebar must only offer screens this role can actually open, otherwise
  // it advertises doors that answer with a permission wall.
  const allowedNav = useMemo(() => visibleNav(NAV, auth.user), [auth.user])
  const [focusCustomer, setFocusCustomer] = useState(null)
  const [sidebar, setSidebar] = useState(false)
  const alerts = ALERTS()
  const k = kpis(30)

  const go = (p, id) => {
    setFocusCustomer(id || null)
    nav('/admin/' + p)
    setSidebar(false)
  }

  useEffect(() => { setSidebar(false) }, [loc.pathname])

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--c-bg)' }}>
      {/* First focusable element on the page. Without it a keyboard user tabs
          through all 22 sidebar links before reaching the content, on every
          navigation. Hidden until focused, so nothing changes visually. */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Signs an unattended admin session out after 30 minutes, with a
          two-minute warning. Only active inside the admin panel. */}
      <IdleGuard />

      <AnimatePresence>
        {sidebar && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSidebar(false)}
            aria-hidden="true"
            className="fixed inset-0 backdrop-blur-sm z-40 lg:hidden"
            style={{ background: 'rgba(8,12,26,.5)' }} />
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------- sidebar */}
      <aside aria-label="Sidebar" className={cx(
        'glass-dark elev-3 fixed lg:sticky top-0 left-0 h-screen w-64 z-50 flex flex-col transition-transform duration-300 lg:translate-x-0',
        'text-slate-300',
        sidebar ? 'translate-x-0' : '-translate-x-full'
      )} style={{ background: '#080C1A' }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <Aurora colors={['var(--c-primary)', 'var(--c-secondary)']} opacity={0.16} blobs={2} />
          <Noise opacity={0.03} />
        </div>

        <div className="relative p-4 flex items-center gap-2.5 border-b border-white/[0.07]">
          <motion.div whileHover={{ rotate: [0, -12, 12, 0], scale: 1.06 }} transition={{ duration: .5 }}
            className="w-9 h-9 rounded-xl grid place-items-center font-bold shrink-0 shadow-lg overflow-hidden"
            style={{ background: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}>
            {theme.tokens.logoUrl
              ? <img src={theme.tokens.logoUrl} alt="" className="w-full h-full object-contain" />
              : (theme.tokens.logoText || 'B')}
          </motion.div>
          <div className="min-w-0">
            <p className="font-bold text-white text-[14px] leading-tight tracking-tight truncate">
              {theme.tokens.storeName}
            </p>
            <p className="text-[10px] text-slate-500 leading-tight">Commerce OS</p>
          </div>
        </div>

        <div className="relative px-3 pt-3">
          <div className="glow-hover rounded-xl bg-white/[0.05] border border-white/[0.07] p-3 relative overflow-hidden">
            <Spotlight color="rgba(249,115,22,.18)" size={200} />
            <p className="relative text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Revenue · 30d</p>
            <p className="relative text-lg font-bold text-white tabular-nums mt-0.5">
              <Counter value={k.revenue} format={v => inrShort(v)} />
            </p>
            <p className={cx('relative text-[10px] font-medium mt-0.5', k.revenueGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
              {k.revenueGrowth >= 0 ? '▲' : '▼'} {Math.abs(k.revenueGrowth).toFixed(1)}% vs prev
            </p>
          </div>
        </div>

        <nav aria-label="Admin sections" className="relative flex-1 overflow-y-auto p-3 space-y-4 mt-1 no-scrollbar">
          {GROUPS.filter(g => allowedNav.some(n => n.group === g)).map(group => (
            <div key={group}>
              <p className="text-[9px] uppercase tracking-[0.12em] text-slate-600 font-bold px-3 mb-1.5">{group}</p>
              <div className="space-y-0.5">
                {allowedNav.filter(n => n.group === group).map(n => (
                  <motion.button key={n.id} onClick={() => go(n.id)}
                    whileHover={{ x: 3 }} whileTap={{ scale: .975 }}
                    transition={{ duration: .18, ease: [0.22, 1, 0.36, 1] }}
                    type="button"
                    aria-current={page === n.id ? 'page' : undefined}
                    className={cx('pressable w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors relative',
                      page === n.id ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]')}>
                    {page === n.id && (
                      <motion.div layoutId="navpill"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        className="absolute inset-0 rounded-xl border border-white/10 bg-gradient-to-r from-[color-mix(in_srgb,var(--c-primary)_24%,transparent)] via-white/[0.10] to-white/[0.04]" />
                    )}
                    {page === n.id && <motion.span layoutId="navbar-accent"
                      className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                      style={{ background: 'var(--c-primary)' }} />}
                    <span className="relative text-[15px]">{n.icon}</span>
                    <span className="relative flex-1 text-left">{n.label}</span>
                    {n.badge && <span className="relative text-[10px] text-slate-500 tabular-nums">{n.badge}</span>}
                  </motion.button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {alerts.length > 0 && (
          <div className="relative p-3 border-t border-white/[0.07]">
            <p className="text-[9px] uppercase tracking-[0.12em] text-slate-600 font-bold px-1 mb-2">Alerts</p>
            {alerts.slice(0, 2).map((a, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .1 }}
                className="px-2.5 py-2 rounded-lg bg-white/[0.04] mb-1.5 border border-white/[0.05]">
                <div className="flex items-start gap-2">
                  <motion.span animate={{ opacity: [1, .35, 1] }} transition={loop({ duration: 2 })}
                    style={{ color: a.sev === 'high' ? '#fb7185' : a.sev === 'warn' ? '#fbbf24' : '#38bdf8' }}
                    className={cx('pulse-dot w-1.5 h-1.5 rounded-full mt-1 shrink-0',
                      a.sev === 'high' ? 'bg-rose-400' : a.sev === 'warn' ? 'bg-amber-400' : 'bg-sky-400')} />
                  <p className="text-[11px] text-slate-300 leading-snug">{a.t}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="relative p-3 border-t border-white/[0.07] space-y-3">
          {/* Language + currency live on the rail so they are reachable from
              every admin screen, not just Settings. */}
          <LocaleBar align="left" className="justify-start" />
          {/* Live database state: which backend the store's data actually
              lives in, with a shortcut to Integrations → Database. */}
          <BackendStatus />
          <PanelSwitch />
          <div className="flex items-center gap-2.5 px-1">
            <Avatar name={auth.user?.name || 'Guest'} size={30} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-white font-medium truncate">{auth.user?.name || 'Guest'}</p>
              <p className="text-[10px] text-slate-500 capitalize">{auth.user?.role || 'visitor'}</p>
              {auth.isAuthed && auth.authProvider && (
                <p className="text-[10px] text-slate-600 truncate" title="Identity provider">
                  via {auth.authProvider.providerName}
                </p>
              )}
            </div>
            {auth.isAuthed && (
              <button onClick={() => { auth.signOut(); nav('/admin/login') }}
                className="text-[10px] text-slate-500 hover:text-white transition-colors">
                exit
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------- main */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 backdrop-blur-2xl border-b lg:hidden"
          style={{ background: 'color-mix(in srgb, var(--c-surface) 78%, transparent)', borderColor: 'var(--c-border)' }}>
          <div className="px-4 h-14 flex items-center justify-between">
            <button onClick={() => setSidebar(true)}
              className="w-9 h-9 rounded-lg grid place-items-center" style={{ color: 'var(--c-text-muted)' }}>☰</button>
            <p className="font-bold text-sm tracking-tight" style={{ color: 'var(--c-text)' }}>
              {theme.tokens.storeName}
            </p>
            <div className="flex items-center gap-1.5">
              <LocaleBar compact tone="light" />
              <button onClick={() => goShop('/shop')} className="text-[12px] font-semibold"
                style={{ color: 'var(--c-primary)' }}>Shop →</button>
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="p-4 sm:p-6 max-w-[1600px]">
          <BackendWarningBanner go={go} />
          {/*
            Suspense MUST sit outside PageFade, and PageFade must be keyed on a
            route that has actually loaded.

            With <PageFade><Suspense>…</Suspense></PageFade>, opening any admin
            screen left it permanently blank until a manual refresh. The reason:
            AnimatePresence mode="wait" holds the incoming child at its `initial`
            state (opacity 0) until the outgoing one finishes exiting. When the
            lazy chunk suspended, React swapped in the fallback, and the new
            child never received its `animate` state — so the page sat at
            opacity 0 with a blur filter forever. The content was in the DOM the
            whole time, which is why every existing test passed: they asserted
            on textContent and never on visibility.
          */}
          <RouteTransition routeKey={page} fallback={<RouteLoading />} animate={device.motion}>
            {/* One guard for every screen rather than one per <Route>: a new
                route cannot be added without a permission decision, because
                SCREEN_PERMISSIONS is the lookup and the test suite asserts
                that every NAV id appears in it. */}
            {/* Unknown admin paths render a real 404 instead of a permission
                wall: every route has a NAV entry, so a page id with none is
                not a screen at all. */}
            {!NAV.some(n => n.id === page) ? (
              <NotFound context="admin" title="Admin screen not found"
                onDashboard={() => go('dashboard')} onShop={() => goShop('/shop')} />
            ) : (
            <RequirePermission
              permission={SCREEN_PERMISSIONS[page]}
              label={NAV.find(n => n.id === page)?.label || page}
            >
            <Routes>
              <Route path="dashboard" element={<Dashboard go={go} />} />
              <Route path="customers" element={<Customers />} />
              <Route path="orders" element={<Orders />} />
              <Route path="catalogue" element={<Catalogue />} />
              <Route path="marketing" element={<Marketing />} />
              <Route path="promotions" element={<Promotions />} />
              <Route path="loyalty" element={<Loyalty />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="finance" element={<Finance />} />
              <Route path="returns" element={<Returns />} />
              <Route path="operations" element={<Operations />} />
              <Route path="theme" element={<ThemeStudio />} />
              <Route path="localisation" element={<Localisation />} />
              <Route path="settings" element={<Settings />} />
              <Route path="vendors" element={<Vendors />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="shipping" element={<Shipping />} />
              <Route path="support" element={<Support />} />
              <Route path="content" element={<Content />} />
              <Route path="reports" element={<Reports />} />
              <Route path="people" element={<People />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
            </Routes>
            </RequirePermission>
            )}
          </RouteTransition>
        </main>
      </div>
    </div>
  )
}

/* ============================================================
   First-run setup gate

   Sends a fresh store (no setup flag + zero products) to the setup wizard.
   The wizard lives in the admin tree, so from the storefront the gate flips
   the hash to #/admin/setup and the boot switch mounts the admin panel —
   no reload, no trap: the wizard itself has "Skip for now".
============================================================ */
function SetupGate({ mode }) {
  const loc = useLocation()
  const nav = useNavigate()
  const cat = useSlice('catalogue')
  const productCount = useMemo(() => selectProducts({ catalogue: cat }).length, [cat])

  useEffect(() => {
    let done = false
    try { done = localStorage.getItem('bharatcart_setup_done') === '1' } catch { /* storage unavailable */ }
    if (done || productCount !== 0) return
    const p = loc.pathname
    if (mode === 'shop') {
      if (p !== '/account/login') goAdminSetup()
    } else if (p !== '/admin/setup') {
      nav('/admin/setup', { replace: true })
    }
  }, [loc.pathname, productCount, nav, mode])

  return null
}

/* ============================================================
   Root — split routing

   mode="admin"  → HashRouter in main.jsx; only the admin tree exists.
                   `#/admin/...` never appears in the server-visible URL.
   mode="shop"   → BrowserRouter in main.jsx; only the storefront exists,
                   with clean history-API URLs and zero `#`.
   mode unset    → legacy combined tree (tests and embeds): both sets of
                   routes, exactly like the old app.
============================================================ */
export default function App({ mode } = {}) {
  useThemeEffect()
  useAuth() // boots the session listener once

  const adminOnly = mode === 'admin'
  const shopOnly = mode === 'shop'

  return (
    <>
      <SetupGate mode={mode} />
      <Routes>
        {!shopOnly && (
          <>
            <Route path="/admin/setup" element={<SetupWizard />} />
            {/* Staff sign-in stays on hash routing: #/admin/login. */}
            <Route path="/admin/login" element={<AuthScreen intent="admin" />} />
            {/*
              * The admin panel needs a STAFF-level role, not merely a signed-in
              * session. Without this guard any customer who typed the admin
              * hash landed inside the shell and then hit a permission wall on
              * all 21 screens that are not the dashboard - which reads as "the
              * panel is broken" rather than "you are signed in as a shopper".
              *
              * Guarding the whole area means a shopper is redirected to sign in as
              * staff instead, which is an answerable situation.
              */}
            <Route path="/admin/*" element={
              <RequireAuth role={ROLES.STAFF} redirect="/admin/login">
                <AdminView />
              </RequireAuth>
            } />
          </>
        )}
        {!adminOnly && (
          <>
            {/* Legacy customer-auth path; the canonical URL is /account/login. */}
            {shopOnly
              ? <Route path="/auth" element={<Navigate to="/account/login" replace />} />
              : <Route path="/auth" element={<AuthScreen intent="shop" />} />}
            <Route path="/*" element={
              <Suspense fallback={<RouteLoading />}>
                <ShopApp />
                {/* No admin entry point here by design - see PanelSwitch. */}
              </Suspense>
            } />
          </>
        )}
        {adminOnly && <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />}
      </Routes>
      <ToastHost />
    </>
  )
}
