/**
 * Storefront pages — one clean URL per screen, no `#` anywhere.
 *
 *   /                  home          /cart            cart
 *   /shop              catalogue     /checkout        checkout
 *   /category/:slug    catalogue     /account[/:tab]  account
 *   /search?q=…        search        /account/login   customer sign-in
 *   /product/:id       product       /help …          info pages
 *
 * Composed from the building blocks in ./Storefront.jsx under the chrome in
 * ./ShopLayout.jsx. CataloguePage serves /shop, /category/:slug and /search:
 * the category comes from the path, the query from ?q=, filters/sort stay as
 * ephemeral page state.
 */
import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useShop } from './shopState.jsx'
import { ProductCard, Hero, Shelf, Facets, BrowseEmpty, PDP } from './Storefront.jsx'
import Cart from './Cart.jsx'
import Checkout from './Checkout.jsx'
import Account from './Account.jsx'
import AuthScreen from '../auth/AuthScreen.jsx'
import NotFound from '../ui/NotFound.jsx'
import EmptyState from '../ui/EmptyState.jsx'
import Button from '../ui/primitives/Button.jsx'
import { Select } from '../ui/primitives/Input.jsx'
import { Modal, Progress, Avatar, Pill } from '../ui/primitives/Display.jsx'
import { Reveal } from '../ui/fx.jsx'
import { search, buildFacets, applyFilters, sortProducts } from '../engines/search/searchEngine.js'
import { personalisedFeed, trending, cartCrossSell } from '../engines/analytics/recoEngine.js'
import { salesHistory, ordersForReco } from '../lib/salesHistory.js'
import { inr } from '../lib/analytics.js'

/** SORTS maps keys to comparators, so the labels live here. */
const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
  { value: 'popularity', label: 'Most popular' },
  { value: 'discount', label: 'Biggest discount' },
]

const openProductUrl = (p) => `/product/${p.id}`

/* ------------------------------------------------------------------ home */

export function HomePage() {
  const nav = useNavigate()
  const shop = useShop()
  const products = shop.products
  const recoOrders = useMemo(() => ordersForReco(), [])

  const recs = useMemo(
    () => personalisedFeed(shop.me, products, { limit: 8, recentlyViewed: shop.recent }),
    [shop.me, products, shop.recent]
  )
  const hot = useMemo(() => trending(products, recoOrders, { limit: 8 }), [products, recoOrders])
  const searched = products
  const facets = useMemo(() => buildFacets(searched), [searched])

  const openProduct = (p) => { shop.track(p); nav(openProductUrl(p)) }

  // "Browse categories" from an empty state: the category tiles live on this
  // page, so scroll to them when they mounted. Safe no-op when empty.
  const scrollToCategories = () => {
    setTimeout(() => {
      document.getElementById('shop-categories')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 90)
  }

  return (
    <div className="space-y-6">
      <Hero onBrowse={() => nav('/shop')} />

      {shop.flags.loyalty && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass-tint rounded-2xl p-3.5 flex items-center gap-3 flex-wrap glow-hover">
          <Avatar name={shop.me.name} size={40} ring />
          <div className="flex-1 min-w-[180px]">
            <p className="text-[13px] font-semibold" style={{ color: 'var(--c-text)' }}>
              Namaste, {shop.me.name.split(' ')[0]}
            </p>
            <p className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
              <span style={{ color: shop.tier?.colour }}>{shop.tier?.name}</span> member ·{' '}
              <strong style={{ color: 'var(--c-primary)' }}>{shop.myPoints.toLocaleString('en-IN')}</strong> points
              {' '}worth {inr(Math.round(shop.myPoints * shop.loyaltyConfig.pointValue))}
            </p>
          </div>
          {shop.tierProg?.next && (
            <div className="w-full sm:w-40">
              <p className="text-[10px] mb-1" style={{ color: 'var(--c-text-muted)' }}>
                {inr(shop.tierProg.toNext)} to {shop.tierProg.next.name}
              </p>
              <Progress value={shop.tierProg.percent} height={5} />
            </div>
          )}
          <Button size="xs" variant="outline" onClick={() => nav('/account/rewards')}>View rewards</Button>
        </motion.div>
      )}

      <Shelf title="Picked for you" subtitle="Based on what you have browsed and bought"
        items={recs} onOpen={openProduct} />
      <Shelf title="Trending now" subtitle="Moving fastest this week" items={hot} onOpen={openProduct} />

      {/* Zero products: the category tiles are built from facet
          counts, so there is nothing to show here yet. */}
      {(facets.category ?? []).length > 0 && (
        <Reveal>
          <div id="shop-categories">
            <p className="eyebrow mb-1">Browse</p>
            <h3 className="display-2" style={{ color: 'var(--c-text)' }}>Shop by category</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 scene-3d stagger">
              {(facets.category ?? []).slice(0, 8).map((c, i) => (
                <button key={c.value} style={{ '--i': i }}
                  onClick={() => nav(`/category/${encodeURIComponent(c.value)}`)}
                  className="glass card-3d pressable glow-hover p-4 text-left rounded-xl group">
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--c-text)' }}>{c.value}</p>
                  <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{c.count} products</p>
                  <p className="text-[11px] mt-1.5 font-semibold opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                    style={{ color: 'var(--c-primary)' }}>Shop now →</p>
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {products.length === 0 && (
        <EmptyState compact icon="◌" title="No products yet"
          message="This store is getting ready — check back soon."
          actionLabel="Browse categories" onAction={scrollToCategories} />
      )}

      {shop.recent.length > 0 && (
        <Shelf title="Recently viewed"
          items={shop.recent.map(id => shop.productById.get(id)).filter(Boolean)}
          onOpen={openProduct} />
      )}
    </div>
  )
}

/* -------------------------------------------------------------- catalogue */

export function CataloguePage({ category: categoryProp }) {
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const shop = useShop()

  const [filters, setFilters] = useState(() => categoryProp ? { category: [categoryProp] } : {})
  const [sort, setSort] = useState('relevance')
  const [mobileFilters, setMobileFilters] = useState(false)
  // Brief skeleton shimmer while search / filters / sort settle, so the
  // grid never flashes half-rendered rows on slower devices.
  const [filtering, setFiltering] = useState(false)
  useEffect(() => {
    setFiltering(true)
    const t = setTimeout(() => setFiltering(false), 260)
    return () => clearTimeout(t)
  }, [q, filters, sort])

  const products = shop.products

  /* search → filter → sort, all through the engines */
  // `search()` returns { results, tokens, corrected, total } — not a bare array.
  const searchResult = useMemo(
    () => q.trim() ? search(products, q) : null,
    [products, q]
  )
  const searched = searchResult ? searchResult.results : products
  const facets = useMemo(() => buildFacets(searched), [searched])
  const filtered = useMemo(() => applyFilters(searched, filters), [searched, filters])
  const rows = useMemo(() => sortProducts(filtered, sort), [filtered, sort])

  const openProduct = (p) => { shop.track(p); nav(openProductUrl(p)) }

  return (
    <div className="grid lg:grid-cols-[220px_1fr] gap-4">
      <div className="hidden lg:block">
        <Facets facets={facets} filters={filters} setFilters={setFilters} />
      </div>

      <div>
        {/* refined catalogue header */}
        <div className="mb-3 anim-fade-up">
          <p className="eyebrow mb-1">
            {filters.category?.length === 1 ? 'Category' : q ? 'Search' : 'The catalogue'}
          </p>
          <h2 className="display-2" style={{ color: 'var(--c-text)' }}>
            {filters.category?.length === 1 ? filters.category[0]
              : q ? <>Results for <span className="text-gradient">“{q}”</span></>
              : 'Everything'}
          </h2>
          <p className="text-[12.5px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
            {rows.length} product{rows.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* quick category filter pills */}
        {(facets.category ?? []).length > 1 && (
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scroll-slim">
            {(facets.category ?? []).slice(0, 10).map(c => {
              const on = (filters.category ?? []).includes(c.value)
              return (
                <Pill key={c.value} active={on} count={c.count}
                  onClick={() => setFilters(f => {
                    const next = { ...f }
                    if (on) {
                      const arr = (next.category ?? []).filter(x => x !== c.value)
                      if (arr.length) next.category = arr; else delete next.category
                    } else next.category = [c.value]
                    return next
                  })}>
                  {c.value}
                </Pill>
              )
            })}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mb-3">
          <Button size="xs" variant="outline" className="lg:hidden"
            onClick={() => setMobileFilters(true)}>Filters</Button>
          <Select size="sm" value={sort} onChange={e => setSort(e.target.value)} className="!w-auto focus-ring"
            options={SORT_OPTIONS} />
        </div>

        {Object.keys(filters).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {Object.entries(filters).flatMap(([k, vals]) =>
              (Array.isArray(vals) ? vals : [vals]).map(v => (
                <button key={k + v} onClick={() => setFilters(f => {
                  const next = { ...f }
                  const arr = (Array.isArray(next[k]) ? next[k] : [next[k]]).filter(x => x !== v)
                  if (arr.length) next[k] = arr; else delete next[k]
                  return next
                })}
                  className="px-2 py-0.5 text-[10.5px] rounded-full border"
                  style={{ borderColor: 'var(--c-primary)', color: 'var(--c-primary)' }}>
                  {String(v)} ×
                </button>
              )))}
            <button onClick={() => setFilters({})} className="text-[10.5px] underline"
              style={{ color: 'var(--c-text-muted)' }}>Clear all</button>
          </div>
        )}

        {filtering ? (
          /* skeleton shimmer while the engines settle */
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass rounded-xl overflow-hidden">
                <div className="shimmer aspect-[4/5]" />
                <div className="p-2.5 space-y-1.5">
                  <div className="shimmer h-3 rounded" style={{ width: '40%' }} />
                  <div className="shimmer h-3.5 rounded" style={{ width: '85%' }} />
                  <div className="shimmer h-4 rounded-full" style={{ width: '45%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : rows.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 scene-3d stagger">
            {rows.slice(0, 48).map((p, i) => (
              <ProductCard key={p.id} p={p} i={i} onOpen={openProduct} />
            ))}
          </div>
        ) : (
          <BrowseEmpty q={q} filters={filters}
            onClearSearch={() => nav('/shop')}
            onClearFilters={() => setFilters({})}
            onBrowseCategories={() => nav('/')} />
        )}
      </div>

      <Modal open={mobileFilters} onClose={() => setMobileFilters(false)} title="Filters" size="md"
        footer={<Button full size="sm" onClick={() => setMobileFilters(false)}>Show {rows.length} results</Button>}>
        <Facets facets={facets} filters={filters} setFilters={setFilters} />
      </Modal>
    </div>
  )
}

/** Category route: a slug change remounts the catalogue with fresh filters. */
export function CategoryPage() {
  const { slug } = useParams()
  return <CataloguePage key={slug} category={slug} />
}

/* --------------------------------------------------------------- product */

export function ProductPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const shop = useShop()
  const p = id ? shop.productById.get(id) : null

  // Recently-viewed tracking used to happen when the PDP drawer opened;
  // the page mount is the equivalent moment now.
  useEffect(() => { if (p) shop.track(p) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-3xl mx-auto">
      <PDP p={p}
        onOpen={(x) => nav(openProductUrl(x))}
        onClose={() => nav('/shop')}
        onAdded={() => nav('/cart')} />
    </div>
  )
}

/* ------------------------------------------------------------------ cart */

export function CartPage() {
  const nav = useNavigate()
  const shop = useShop()
  const recoOrders = useMemo(() => ordersForReco(), [])
  const crossSell = useMemo(
    () => shop.cart.length ? cartCrossSell(shop.cart, shop.products, recoOrders, 4) : [],
    [shop.cart, shop.products, recoOrders]
  )

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-3 anim-fade-up">
        <p className="eyebrow mb-1">Your bag</p>
        <h2 className="display-2" style={{ color: 'var(--c-text)' }}>
          Cart · {shop.cartCount} item{shop.cartCount !== 1 ? 's' : ''}
        </h2>
      </div>
      <Cart onCheckout={() => nav('/checkout')} onStartShopping={() => nav('/shop')} />
      {crossSell.length > 0 && shop.cart.length > 0 && (
        <div className="mt-6">
          <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--c-text)' }}>Goes well with</p>
          <div className="grid grid-cols-2 gap-2 scene-3d stagger">
            {crossSell.slice(0, 2).map((p, i) => (
              <ProductCard key={(p.product ?? p).id} p={p.product ?? p} i={i}
                onOpen={(x) => { shop.track(x); nav(openProductUrl(x)) }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------- checkout */

export function CheckoutPage() {
  const nav = useNavigate()
  return (
    <div className="max-w-3xl mx-auto">
      <Checkout onClose={() => nav('/cart')} onDone={() => nav('/account')} />
    </div>
  )
}

/* --------------------------------------------------------------- account */

const ACCOUNT_TABS = ['orders', 'subscriptions', 'rewards', 'wishlist', 'returns']

export function AccountPage() {
  const { tab } = useParams()
  const nav = useNavigate()
  const shop = useShop()
  const active = ACCOUNT_TABS.includes(tab) ? tab : 'orders'
  return (
    <div className="max-w-3xl mx-auto">
      <Account tab={active} onTab={(t) => nav(`/account/${t}`)}
        onOpenProduct={(p) => { shop.track(p); nav(openProductUrl(p)) }}
        onBrowse={() => nav('/shop')}
        onLogin={() => nav('/account/login')} />
    </div>
  )
}

/* ------------------------------------------------------------------ info */

const INFO_PAGES = {
  help: {
    title: 'Help & support',
    body: 'Track your order from /account/orders, or write to us and a human will reply within one working day.',
  },
  terms: { title: 'Terms of service', body: 'Fair terms, plain language. The full policy is maintained by the store owner in the admin panel.' },
  privacy: { title: 'Privacy policy', body: 'Your data stays yours. This store only collects what it needs to fulfil your order.' },
  about: { title: 'About us', body: '' },
  contact: { title: 'Contact us', body: '' },
  careers: { title: 'Careers', body: 'We are always looking for people who care about craft. Write to us with the role in the subject line.' },
}

export function InfoPage({ page: pageProp }) {
  const params = useParams()
  const page = pageProp ?? params.page
  const shop = useShop()
  const info = INFO_PAGES[page]
  if (!info) return <ShopNotFound />
  const body = page === 'about'
    ? `${shop.settings.store.name} — ${shop.settings.seo.description}`
    : page === 'contact'
      ? `Call us at ${shop.settings.store.phone}. We reply within one working day.`
      : info.body
  return (
    <div className="max-w-2xl mx-auto anim-fade-up">
      <p className="eyebrow mb-1">{shop.settings.store.name}</p>
      <h2 className="display-2 mb-3" style={{ color: 'var(--c-text)' }}>{info.title}</h2>
      <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--c-text-muted)' }}>{body}</p>
    </div>
  )
}

/* --------------------------------------------------------------- 404 */

export function ShopNotFound() {
  const nav = useNavigate()
  return <NotFound title="Page not found" onShop={() => nav('/')} />
}

/* --------------------------------------------------------- customer auth */

export function CustomerLoginPage() {
  return <AuthScreen intent="shop" successTo="/account" />
}
