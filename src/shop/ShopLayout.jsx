/**
 * ShopLayout — shared storefront chrome under clean URLs.
 *
 * Sticky glass header (logo, live search, account, cart), the announcements
 * marquee, the footer and the mobile bottom nav wrap every shop page via
 * <Outlet/>. Navigation is router-first: no hash links anywhere in the
 * user-facing panel.
 */
import React, { useState, useEffect, useMemo } from 'react'
import { Outlet, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Marquee, Aurora } from '../ui/fx.jsx'
import { useShop } from './shopState.jsx'
import { Input } from '../ui/primitives/Input.jsx'
import { Avatar } from '../ui/primitives/Display.jsx'
import LocaleBar from '../ui/locale/LocaleBar.jsx'
import { useI18n } from '../hooks/useI18n.js'
import { suggest } from '../engines/search/searchEngine.js'
import { inr } from '../lib/analytics.js'

function SearchBox() {
  const { t } = useI18n()
  const nav = useNavigate()
  const loc = useLocation()
  const [params] = useSearchParams()
  const shop = useShop()

  const urlQ = loc.pathname === '/search' ? (params.get('q') || '') : ''
  const [q, setQ] = useState(urlQ)
  // Follow the URL when the shopper navigates between searches (back/forward,
  // suggestion clicks) — the box is shared chrome, not remounted per page.
  useEffect(() => { setQ(urlQ) }, [urlQ])

  const suggestions = useMemo(() => {
    if (q.length <= 1) return []
    const out = suggest(shop.products, q)
    return (Array.isArray(out) ? out : out?.suggestions ?? []).slice(0, 5)
  }, [shop.products, q])

  const go = (value, replace) => {
    const v = value.trim()
    setQ(value)
    nav(v ? `/search?q=${encodeURIComponent(v)}` : '/shop', replace ? { replace: true } : undefined)
  }

  return (
    <div className="flex-1 relative max-w-xl">
      <Input size="sm" value={q} placeholder={t('shop.searchPlaceholder')} className="focus-ring"
        onChange={e => go(e.target.value, true)} />
      {suggestions.length > 0 && q && (
        <div className="absolute top-full left-0 right-0 mt-2 glass-pop rounded-xl p-1.5 z-40 anim-scale-in">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => go(s.text ?? s, false)}
              className="w-full text-left px-3 py-2 text-[12.5px] rounded-lg transition-colors hover:opacity-100 pressable"
              style={{ color: 'var(--c-text)', background: 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--c-primary) 8%, transparent)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ color: 'var(--c-text-muted)' }}>⌕ </span>{s.text ?? s}
            </button>
          ))}
          <div className="px-3 pt-1.5 pb-1 text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>
            press Enter to browse
          </div>
        </div>
      )}
    </div>
  )
}

export default function ShopLayout() {
  const { t } = useI18n()
  const shop = useShop()
  const nav = useNavigate()
  const loc = useLocation()

  // Route changes start at the top — the old state-driven shop never moved
  // the viewport, but a real URL change should behave like a page load.
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])

  // Maintenance mode is an admin switch that must actually stop the storefront.
  if (shop.settings.maintenanceMode) {
    return (
      <div className="min-h-[70vh] grid place-items-center px-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <div className="text-5xl mb-4">🛠</div>
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--c-text)' }}>
            {shop.settings.store.name} is briefly offline
          </h1>
          <p className="text-[13px]" style={{ color: 'var(--c-text-muted)' }}>
            {shop.settings.maintenanceMessage}
          </p>
        </motion.div>
      </div>
    )
  }

  const tabs = [
    ['/', '⌂', 'Home'],
    ['/shop', '⌕', 'Shop'],
    ['/cart', '▤', 'Cart'],
    ['/account', '◉', 'Account'],
  ]
  const activeTab = loc.pathname === '/' ? '/'
    : tabs.find(([p]) => p !== '/' && loc.pathname.startsWith(p))?.[0]

  return (
    <div className="pb-20 lg:pb-6">
      {/* ---------------------------------------------------------- header */}
      <div className="sticky top-0 z-30 glass-nav">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => nav('/')} className="font-bold text-[16px] shrink-0 pressable tracking-tight"
            style={{ color: 'var(--c-text)' }}>
            {shop.settings.store.name.split(' ').slice(0, -1).join(' ')}{' '}
            <span className="text-gradient">{shop.settings.store.name.split(' ').slice(-1)}</span>
          </button>

          <SearchBox />

          <LocaleBar compact tone="light" className="shrink-0" />

          <button onClick={() => nav('/account')}
            className="hidden sm:grid place-items-center shrink-0 pressable"
            aria-label="Account">
            <Avatar name={shop.me.name} size={26} />
          </button>

          <button onClick={() => nav('/cart')} className="relative shrink-0 px-2 py-1.5 pressable" aria-label="Open cart">
            <span className="text-[17px]" style={{ color: 'var(--c-text)' }}>▤</span>
            {shop.cartCount > 0 && (
              <motion.span key={shop.cartCount} initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full grid place-items-center text-[9.5px] font-bold"
                style={{ background: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}>
                {shop.cartCount}
              </motion.span>
            )}
          </button>
        </div>

        {/* rolling announcements, driven by live settings */}
        <div className="border-t" style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-muted)' }}>
          <Marquee className="py-1.5 px-3" speed={32} items={[
            t('shop.freeShippingAbove', { amount: inr(shop.checkout.freeShippingAbove) }),
            ...(shop.flags.cod && shop.settings.payments.cod?.enabled ? [t('shop.codAvailable')] : []),
            ...(shop.flags.loyalty ? [`★ ${t('shop.earnPoints', { points: Math.round(shop.loyaltyConfig.earnPerRupee * 100) })}`] : []),
            shop.settings.store.phone,
          ]} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4">
        <AnimatePresence mode="wait">
          <motion.div key={loc.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: .18 }}>
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ------------------------------------------------------------ footer */}
      <footer className="relative overflow-hidden mt-10">
        <div aria-hidden="true" className="h-[3px] w-full"
          style={{ background: 'linear-gradient(90deg, var(--c-primary), var(--c-accent), var(--c-primary))' }} />
        <div className="glass-dark relative">
          <span aria-hidden="true" className="orb orb-a" style={{ width: 220, height: 220, left: '-60px', bottom: '-80px', opacity: .35 }} />
          <span aria-hidden="true" className="orb orb-b" style={{ width: 180, height: 180, right: '-40px', top: '-60px', opacity: .3 }} />
          <div className="relative max-w-7xl mx-auto px-3 sm:px-4 py-8 grid sm:grid-cols-3 gap-6">
            <div>
              <p className="font-bold text-[16px] tracking-tight text-gradient">{shop.settings.store.name}</p>
              <p className="text-[11.5px] mt-1.5" style={{ color: 'rgba(241,245,249,.65)' }}>
                {shop.settings.seo.description}
              </p>
            </div>
            <div>
              <p className="eyebrow mb-2" style={{ color: 'rgba(241,245,249,.8)' }}>Shop</p>
              <div className="flex flex-col items-start gap-1.5">
                {[
                  ['Home', '/'],
                  ['Browse all', '/shop'],
                  ['My account', '/account'],
                  ['My cart', '/cart'],
                ].map(([label, to]) => (
                  <button key={label} onClick={() => nav(to)} className="text-[12.5px] pressable"
                    style={{ color: 'rgba(241,245,249,.75)' }}>{label}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="eyebrow mb-2" style={{ color: 'rgba(241,245,249,.8)' }}>Reach us</p>
              <p className="text-[12.5px]" style={{ color: 'rgba(241,245,249,.75)' }}>{shop.settings.store.phone}</p>
              <p className="text-[11.5px] mt-2" style={{ color: 'rgba(241,245,249,.55)' }}>
                Prices include GST · {t('shop.codAvailable')}
              </p>
            </div>
          </div>
          <div className="relative max-w-7xl mx-auto px-3 sm:px-4 pb-5 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[10.5px]" style={{ color: 'rgba(241,245,249,.45)' }}>
              © {new Date().getFullYear()} {shop.settings.store.name}
            </p>
            <p className="text-[10.5px]" style={{ color: 'rgba(241,245,249,.45)' }}>
              Secure checkout · Easy returns
            </p>
          </div>
        </div>
      </footer>

      {/* ------------------------------------------------------ mobile nav */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 glass-nav">
        <div className="grid grid-cols-4">
          {tabs.map(([to, icon, label]) => (
            <button key={to}
              onClick={() => nav(to)}
              className="py-2 flex flex-col items-center gap-0.5 relative pressable">
              <span className="text-[16px]"
                style={{ color: activeTab === to ? 'var(--c-primary)' : 'var(--c-text-muted)' }}>{icon}</span>
              <span className="text-[9.5px] font-medium"
                style={{ color: activeTab === to ? 'var(--c-primary)' : 'var(--c-text-muted)' }}>{label}</span>
              {to === '/cart' && shop.cartCount > 0 && (
                <span className="absolute top-1 right-[26%] min-w-[14px] h-3.5 px-1 rounded-full grid place-items-center text-[8.5px] font-bold"
                  style={{ background: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}>{shop.cartCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
