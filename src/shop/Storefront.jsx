/**
 * Storefront building blocks — the customer-facing panel's shared pieces.
 *
 * ProductCard, Hero, Shelf, Facets, BrowseEmpty and PDP are route-agnostic:
 * the page components in ./pages.jsx compose them under clean URLs, and the
 * shared chrome (header / footer / mobile nav) lives in ./ShopLayout.jsx.
 *
 * Every number, rule and toggle on this screen comes from the admin panel via
 * `shopState`. There is deliberately no hard-coded price, tax rate, shipping
 * threshold or feature switch here: if the admin changes it, the shopper sees
 * the change on the next render.
 */
import React, { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Reveal, Tilt, Counter, Spotlight, Aurora } from '../ui/fx.jsx'
import { useShop } from './shopState.jsx'
import VerticalPicker, { AttributeSections, priceStrikeInfo } from './verticalPickers.jsx'
import { resolveVerticalPrice, expiryStatus, useEngineVersion } from './verticalEngines.js'
import useToast from '../hooks/useToast.js'
import EmptyState from '../ui/EmptyState.jsx'
import Button from '../ui/primitives/Button.jsx'
import { Input } from '../ui/primitives/Input.jsx'
import { Badge, Progress, Tabs } from '../ui/primitives/Display.jsx'
import { similarProducts, frequentlyBoughtTogether, trending } from '../engines/analytics/recoEngine.js'
import { checkServiceability } from '../engines/shipping/shippingEngine.js'
import { ordersForReco } from '../lib/salesHistory.js'
import { inr } from '../lib/analytics.js'
import { useI18n } from '../hooks/useI18n.js'

/* --------------------------------------------------------- product card */

/**
 * ProductCard — CSS-driven 3D card.
 *
 * The entrance stagger is owned by the parent grid (`.stagger` with a
 * `--i` custom property per card), so the same component animates
 * identically on the home shelves, the browse grid and the cross-sell
 * rail. Hover lift/lean comes from `.card-3d` + `.scene-3d` on the grid;
 * the quick-add bar slides up over the media on pointer devices and is
 * always reachable on touch (pointer: coarse).
 */
export function ProductCard({ p, onOpen, i = 0 }) {
  const shop = useShop()
  const saved = shop.wish.includes(p.id)
  const out = p.stock === 0

  const quickAdd = (e) => {
    e.stopPropagation()
    if (out) return
    shop.add(p, (p.variants || [])[0], 1)
  }

  return (
    <div
      style={{ '--i': Math.min(i * 1, 12) }}
      className="card-3d sheen glass group overflow-hidden cursor-pointer flex flex-col rounded-xl"
      onClick={() => onOpen(p)}>

      <div className="relative aspect-[4/5] grid place-items-center text-5xl overflow-hidden"
        style={{ background: 'color-mix(in srgb, var(--c-primary) 5%, var(--c-surface-alt))' }}>
        <span aria-hidden="true" className="orb orb-a" style={{ width: 120, height: 120, left: '-30px', top: '-30px', opacity: .35 }} />
        <span aria-hidden="true" className="orb orb-b" style={{ width: 110, height: 110, right: '-25px', bottom: '-25px', opacity: .3 }} />

        {/* hover zoom on the product art — pure transform, GPU only */}
        <span className="relative transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-3 pop-3d-sm">
          {p.emoji ?? '▦'}
        </span>

        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
          {p.discountPct > 0 && <Badge size="sm" tone="danger">{p.discountPct}% off</Badge>}
          {p.gi && <Badge size="sm" tone="success">GI tagged</Badge>}
          {p.tags?.includes('bestseller') && <Badge size="sm" tone="warning">Bestseller</Badge>}
          {out && <Badge size="sm" tone="neutral">Out of stock</Badge>}
        </div>

        {shop.flags.wishlist && (
          <motion.button
            whileHover={{ scale: 1.12 }}
            /* Overshoot then settle: the heart should feel like it "pops"
               when saved, which is the only bit of delight this control gets. */
            whileTap={{ scale: 1.45 }}
            animate={saved ? { scale: [1, 1.35, 1] } : { scale: 1 }}
            transition={{ duration: .32, ease: [0.22, 1, 0.36, 1] }}
            aria-label={saved ? `Remove ${p.name} from wishlist` : `Save ${p.name} to wishlist`}
            aria-pressed={saved}
            onClick={e => { e.stopPropagation(); shop.toggleWish(p.id) }}
            className="absolute top-2 right-2 w-7 h-7 rounded-full grid place-items-center text-[13px] backdrop-blur pressable"
            style={{ background: 'color-mix(in srgb, var(--c-surface) 82%, transparent)' }}>
            <span style={{ color: saved ? 'var(--c-danger)' : 'var(--c-text-muted)' }}>{saved ? '♥' : '♡'}</span>
          </motion.button>
        )}

        {p.lowStock && !out && (
          <div className="absolute bottom-0 inset-x-0 py-1 text-center text-[10px] font-medium backdrop-blur z-10"
            style={{ background: 'color-mix(in srgb, var(--c-warning) 88%, transparent)', color: '#fff' }}>
            Only {p.stock} left
          </div>
        )}

        {/* quick add — slides up on hover, always visible on touch devices */}
        {!out && (
          <div className="absolute bottom-0 inset-x-0 z-10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out [@media(pointer:coarse)]:translate-y-0">
            <button onClick={quickAdd}
              className="w-full py-2 text-[12px] font-semibold backdrop-blur-xl pressable"
              style={{
                background: 'color-mix(in srgb, var(--c-primary) 88%, transparent)',
                color: 'var(--c-primary-fg)',
              }}>
              Quick add · {inr(p.price)}
            </button>
          </div>
        )}
      </div>

      <div className="p-2.5 flex-1 flex flex-col">
        <p className="text-[9.5px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>
          {p.brand}
        </p>
        <p className="text-[12.5px] font-medium leading-tight line-clamp-2 mt-0.5 flex-1"
          style={{ color: 'var(--c-text)' }}>{p.name}</p>

        {/* glass price badge */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="glass px-2 py-0.5 rounded-full text-[13.5px] font-bold tabular-nums"
            style={{ color: 'var(--c-text)' }}>{inr(p.price)}</span>
          {p.mrp > p.price && (
            <span className="text-[11px] line-through" style={{ color: 'var(--c-text-muted)' }}>{inr(p.mrp)}</span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10.5px] px-1.5 py-0.5 rounded font-medium"
            style={{ background: 'var(--c-success)', color: '#fff' }}>★ {p.rating}</span>
          <span className="text-[10px]" style={{ color: 'var(--c-text-muted)' }}>{p.reviews} reviews</span>
        </div>
      </div>
    </div>
  )
}


/* ------------------------------------------------------------- pieces */

export function Hero({ onBrowse }) {
  const shop = useShop()
  // A few trending products become the floating 3D showcase pieces.
  const showcase = useMemo(() => trending(shop.products, ordersForReco(), { limit: 4 }), [shop.products])
  const words = (shop.settings.seo.title ?? '').trim().split(/\s+/)
  const headMain = words.slice(0, -1).join(' ')
  const headAccent = words.length > 1 ? words[words.length - 1] : ''

  return (
    <div className="relative overflow-hidden rounded-2xl glass-deep">
      {/* animated gradient wash + drifting orbs (all theme-aware) */}
      <div aria-hidden="true" className="absolute inset-0 aurora-wash" />
      <span aria-hidden="true" className="orb orb-a" style={{ width: 320, height: 320, left: '-90px', top: '-110px', opacity: .55 }} />
      <span aria-hidden="true" className="orb orb-b" style={{ width: 280, height: 280, right: '-70px', bottom: '-120px', opacity: .5 }} />
      <span aria-hidden="true" className="orb orb-c" style={{ width: 200, height: 200, left: '42%', top: '58%', opacity: .4 }} />
      <Aurora opacity={0.22} blobs={2} className="rounded-2xl" />

      <div className="relative grid lg:grid-cols-[1.15fr_.85fr] gap-6 items-center p-6 sm:p-10 min-h-[300px]">
        {/* copy — staggered entrance */}
        <div className="stagger max-w-xl">
          <p className="eyebrow mb-3" style={{ '--i': 0 }}>
            {shop.settings.seo.keywords?.split(',')[0] ?? 'Handcrafted in India'}
          </p>
          <h1 className="display-1 mb-3" style={{ color: 'var(--c-text)', '--i': 1 }}>
            {words.length > 1 ? <>{headMain}{' '}<span className="text-gradient">{headAccent}</span></>
              : (shop.settings.seo.title ?? '')}
          </h1>
          <p className="text-[14px] mb-6" style={{ color: 'var(--c-text-muted)', '--i': 2 }}>
            {shop.settings.seo.description}
          </p>
          <div className="flex gap-2.5 flex-wrap" style={{ '--i': 3 }}>
            <button onClick={onBrowse}
              className="pressable sheen glow-primary px-6 py-3 rounded-xl text-[13.5px] font-bold"
              style={{ background: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}>
              Explore the collection →
            </button>
            {showcase.length > 0 && (
              <button onClick={onBrowse}
                className="pressable glass px-6 py-3 rounded-xl text-[13.5px] font-semibold"
                style={{ color: 'var(--c-text)' }}>
                Trending now
              </button>
            )}
          </div>
        </div>

        {/* layered 3D product showcase */}
        {showcase.length > 0 && (
          <div className="relative hidden md:block h-[280px]" aria-hidden="true">
            <Tilt max={10} scale={1.03} className="absolute inset-x-8 top-4">
              <div className="glass-pop rounded-2xl p-5 elev-3 glow-hover">
                <Spotlight color="color-mix(in srgb, var(--c-primary) 18%, transparent)" />
                <p className="eyebrow mb-3">This week's stars</p>
                <div className="space-y-2.5">
                  {showcase.slice(0, 3).map((x, j) => {
                    const p = x.product ?? x
                    return (
                      <div key={p.id} className="flex items-center gap-3 pop-3d-sm">
                        <span className="w-11 h-11 rounded-xl grid place-items-center text-xl shrink-0 float-slow"
                          style={{ background: 'color-mix(in srgb, var(--c-primary) 10%, var(--c-surface-alt))', animationDelay: `${j * 0.9}s` }}>
                          {p.emoji ?? '▦'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--c-text)' }}>{p.name}</p>
                          <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>★ {p.rating}</p>
                        </div>
                        <span className="glass px-2 py-0.5 rounded-full text-[12px] font-bold tabular-nums"
                          style={{ color: 'var(--c-text)' }}>{inr(p.price)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Tilt>
            {/* floating satellite chip */}
            <div className="absolute -right-2 bottom-2 glass rounded-2xl px-3.5 py-2.5 elev-2 float-slower">
              <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>
                Free shipping
              </p>
              <p className="text-[12px] font-bold tabular-nums" style={{ color: 'var(--c-text)' }}>
                above {inr(shop.checkout.freeShippingAbove)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------- browse empty */

export function BrowseEmpty({ q, filters, onClearSearch, onClearFilters, onBrowseCategories }) {
  if (q.trim()) {
    return (
      <EmptyState icon="⌕" title={`No results for "${q.trim()}"`}
        message="Try a different spelling, or browse the full collection."
        actionLabel="Clear search" onAction={onClearSearch} />
    )
  }
  if (Object.keys(filters).length > 0) {
    return (
      <EmptyState icon="▤" title="No products in this category"
        message="This category is still getting ready — try removing some filters."
        actionLabel="Clear filters" onAction={onClearFilters} />
    )
  }
  return (
    <EmptyState icon="◌" title="No products yet"
      message="This store is getting ready."
      actionLabel="Browse categories" onAction={onBrowseCategories} />
  )
}

export function Shelf({ title, subtitle, items, onOpen }) {
  if (!items?.length) return null
  /*
   * Reveal was written months ago and never imported anywhere.
   *
   * A shelf is exactly what it is for: below the fold, arrives as the shopper
   * scrolls to it. `once: true` inside Reveal means it plays a single time —
   * a section that re-animates every time it scrolls back into view is the
   * fastest way to make a storefront feel cheap.
   */
  return (
    <Reveal>
      <h3 className="text-[15px] font-bold" style={{ color: 'var(--c-text)' }}>{title}</h3>
      {subtitle && <p className="text-[11.5px] mb-2" style={{ color: 'var(--c-text-muted)' }}>{subtitle}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 mt-2 scene-3d stagger">
        {items.slice(0, 8).map((x, i) => {
          const p = x.product ?? x
          return <ProductCard key={p.id} p={p} i={i} onOpen={onOpen} />
        })}
      </div>
    </Reveal>
  )
}

export function Facets({ facets, filters, setFilters }) {
  const toggle = (key, value) => setFilters(f => {
    const cur = Array.isArray(f[key]) ? f[key] : f[key] ? [f[key]] : []
    const next = cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value]
    const out = { ...f }
    if (next.length) out[key] = next; else delete out[key]
    return out
  })

  const GROUPS = [
    ['category', 'Category'], ['brand', 'Brand'], ['fabric', 'Fabric'],
    ['craft', 'Craft'], ['origin', 'Origin'],
  ]

  return (
    <div className="space-y-4">
      {GROUPS.filter(([k]) => facets[k]?.length).map(([key, label]) => (
        <div key={key}>
          <p className="text-[11px] uppercase tracking-wider font-semibold mb-1.5"
            style={{ color: 'var(--c-text-muted)' }}>{label}</p>
          <div className="space-y-1 max-h-44 overflow-y-auto">
            {facets[key].slice(0, 12).map(f => {
              const on = (filters[key] ?? []).includes(f.value)
              return (
                <button key={f.value} onClick={() => toggle(key, f.value)}
                  className="w-full flex items-center gap-2 text-left text-[11.5px] py-0.5">
                  <span className="w-3.5 h-3.5 rounded border grid place-items-center text-[8px] shrink-0"
                    style={on
                      ? { background: 'var(--c-primary)', borderColor: 'var(--c-primary)', color: 'var(--c-primary-fg)' }
                      : { borderColor: 'var(--c-border)' }}>{on ? '✓' : ''}</span>
                  <span className="flex-1 truncate" style={{ color: 'var(--c-text)' }}>{f.value}</span>
                  <span style={{ color: 'var(--c-text-muted)' }}>{f.count}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div>
        <p className="text-[11px] uppercase tracking-wider font-semibold mb-1.5"
          style={{ color: 'var(--c-text-muted)' }}>Other</p>
        {[['gi', 'GI tagged only'], ['handmade', 'Handmade only'], ['inStock', 'In stock only']].map(([k, label]) => (
          <button key={k} onClick={() => setFilters(f => {
            const out = { ...f }
            if (out[k]) delete out[k]; else out[k] = true
            return out
          })}
            className="w-full flex items-center gap-2 text-left text-[11.5px] py-0.5">
            <span className="w-3.5 h-3.5 rounded border grid place-items-center text-[8px] shrink-0"
              style={filters[k]
                ? { background: 'var(--c-primary)', borderColor: 'var(--c-primary)', color: 'var(--c-primary-fg)' }
                : { borderColor: 'var(--c-border)' }}>{filters[k] ? '✓' : ''}</span>
            <span style={{ color: 'var(--c-text)' }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- PDP */

export function PDP({ p, onOpen, onClose, onAdded }) {
  // Product-not-found: a stale deep link or a product removed while its PDP
  // is open must never render raw undefined fields.
  if (!p || !p.id) {
    return (
      <EmptyState icon="▦" title="Product not found"
        message="This product is no longer available in the store."
        actionLabel="Back to shop" onAction={onClose} compact />
    )
  }
  const { t } = useI18n()
  const shop = useShop()
  const { success, error } = useToast()
  const [variant, setVariant] = useState((p.variants || [])[0] ?? null)
  const [qty, setQty] = useState(1)
  const [extras, setExtras] = useState({})
  const [pin, setPin] = useState(shop.pincode)
  const [tab, setTab] = useState('details')
  const engineVersion = useEngineVersion()

  useEffect(() => { setVariant((p.variants || [])[0] ?? null); setQty(1); setExtras({}) }, [p.id])

  const recoOrders = useMemo(() => ordersForReco(), [])
  // similarProducts(product, catalogue, limit) · frequentlyBoughtTogether(productId, orders, catalogue, limit)
  const similar = useMemo(() => similarProducts(p, shop.products, 4), [p, shop.products])
  const fbt = useMemo(
    () => frequentlyBoughtTogether(p.id, recoOrders, shop.products, 3),
    [p.id, shop.products, recoOrders]
  )

  const serv = useMemo(() => pin.length === 6 ? checkServiceability(pin) : null, [pin])
  const outOfStock = !variant || variant.stock === 0

  // Engine price for the selected option — gold rates, pack pricing and
  // near-expiry discounts all resolve here; the PDP never computes a price.
  const pricing = useMemo(
    () => resolveVerticalPrice(p, variant, {
      qty, customer: shop.me, purity: extras?.purity, weightG: extras?.weightG,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p, variant, qty, extras, engineVersion]
  )
  const expiry = useMemo(
    () => expiryStatus(p, Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p, engineVersion]
  )
  // Near-expiry (or any engine) discount shows as a strike-through on the
  // pre-discount price; otherwise the classic MRP strike-through applies.
  const { strikePrice, badge: offerBadgeText } = useMemo(
    () => priceStrikeInfo(pricing, p),
    [pricing, p]
  )
  const showExpiryBadge = expiry && (expiry.status === 'expired' || expiry.status === 'near-expiry')

  const addToCart = () => {
    if (outOfStock) { error('That option is out of stock'); return }
    shop.add(p, variant, qty, extras)
    success(`${p.name} added to cart`)
    onAdded?.()
  }

  return (
    <div className="space-y-4">
      {/* gallery with hover zoom */}
      <div className="group relative aspect-[5/4] rounded-2xl grid place-items-center text-6xl overflow-hidden"
        style={{ background: 'color-mix(in srgb, var(--c-primary) 6%, var(--c-surface-alt))' }}>
        <span aria-hidden="true" className="orb orb-a" style={{ width: 200, height: 200, left: '-50px', top: '-60px', opacity: .5 }} />
        <span aria-hidden="true" className="orb orb-b" style={{ width: 180, height: 180, right: '-40px', bottom: '-50px', opacity: .45 }} />
        <motion.span initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="relative float-slow transition-transform duration-500 ease-out group-hover:scale-125 group-hover:rotate-3">
          {p.emoji ?? '▦'}
        </motion.span>
        {p.discountPct > 0 && (
          <div className="absolute top-3 left-3">
            <Badge tone="danger" size="sm">{p.discountPct}% off</Badge>
          </div>
        )}
      </div>

      <div className="anim-fade-up">
        <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>
          {p.brand} · {p.category}
        </p>
        <h2 className="text-lg font-bold leading-tight" style={{ color: 'var(--c-text)' }}>{p.name}</h2>

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-[10.5px] px-1.5 py-0.5 rounded font-medium"
            style={{ background: 'var(--c-success)', color: '#fff' }}>★ {p.rating}</span>
          <span className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{p.reviews} reviews</span>
          {p.gi && <Badge size="sm" tone="success">GI tagged</Badge>}
          {p.handmade && <Badge size="sm">Handmade</Badge>}
        </div>

        <div className="flex items-baseline gap-2 mt-2 flex-wrap">
          <Counter value={pricing.price} format={v => inr(Math.round(v))}
            className="text-2xl font-bold tabular-nums" />
          {pricing.unitLabel && (
            <span className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>{pricing.unitLabel}</span>
          )}
          {strikePrice != null && (
            <span className="text-[13px] line-through" style={{ color: 'var(--c-text-muted)' }}>{inr(strikePrice)}</span>
          )}
          {offerBadgeText
            ? <Badge tone="danger" size="sm">{offerBadgeText}</Badge>
            : (p.mrp > pricing.price && <Badge tone="danger" size="sm">{p.discountPct}% off</Badge>)}
          {showExpiryBadge && (
            <Badge size="sm" tone={expiry.status === 'expired' ? 'danger' : 'warning'}>{expiry.label}</Badge>
          )}
        </div>
        <p className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>
          Inclusive of all taxes · GST {p.gst}%
        </p>
      </div>

      {/* vertical-aware option picker (size/color, packs, purity, slots…) */}
      <VerticalPicker
        product={p}
        value={{ variant, extras }}
        onChange={({ variant: v, extras: e }) => { setVariant(v); setExtras(e ?? {}) }} />
      {variant && variant.stock > 0 && variant.stock < 8 && (
        <p className="text-[11px] mt-1" style={{ color: 'var(--c-warning)' }}>
          Only {variant.stock} left in this option
        </p>
      )}

      {/* sticky glass buy panel */}
      <div className="sticky bottom-2 z-10 glass-pop rounded-2xl p-2.5 elev-3 anim-fade-up">
        <div className="flex items-center justify-between gap-2 mb-2 px-1">
          <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>
            {variant ? [variant.size, variant.color].filter(Boolean).join(' · ') || 'Selected option' : 'Choose an option'}
          </span>
          <Counter value={pricing.price * qty} format={v => inr(Math.round(v))}
            className="text-[15px] font-bold tabular-nums" />
        </div>
        <div className="flex gap-2">
          <div className="flex items-center rounded-xl border pressable" style={{ borderColor: 'var(--c-border)' }}>
            <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-3 py-2 focus-ring"
              style={{ color: 'var(--c-text-muted)' }} aria-label="Decrease quantity">−</button>
            <span className="px-2 text-[13px] tabular-nums min-w-[2ch] text-center" style={{ color: 'var(--c-text)' }}>{qty}</span>
            <button onClick={() => setQty(q => q + 1)} className="px-3 py-2 focus-ring"
              style={{ color: 'var(--c-text-muted)' }} aria-label="Increase quantity">+</button>
          </div>
          <button onClick={addToCart} disabled={outOfStock}
            className="pressable sheen glow-primary flex-1 rounded-xl text-[13.5px] font-bold disabled:opacity-50"
            style={{ background: 'var(--c-primary)', color: 'var(--c-primary-fg)' }}>
            {outOfStock ? 'Out of stock' : `Add to cart · ${inr(pricing.price * qty)}`}
          </button>
          {shop.flags.wishlist && (
            <Button variant="outline" onClick={() => shop.toggleWish(p.id)}>
              {shop.wish.includes(p.id) ? '♥' : '♡'}
            </Button>
          )}
        </div>
      </div>

      {/* delivery check */}
      <div className="glass rounded-2xl p-3">
        <p className="text-[11px] uppercase tracking-wider font-semibold mb-1.5"
          style={{ color: 'var(--c-text-muted)' }}>Delivery</p>
        <div className="flex gap-2">
          <Input size="sm" value={pin} maxLength={6} placeholder={t('shop.enterPin')} className="focus-ring"
            onChange={e => {
              const v = e.target.value.replace(/\D/g, '')
              setPin(v)
              if (v.length === 6) shop.setPincode(v)
            }} className="flex-1" />
        </div>
        {serv && (
          <p className="text-[11.5px] mt-1.5"
            style={{ color: serv.ok ? 'var(--c-success)' : 'var(--c-danger)' }}>
            {serv.ok
              ? [t('shop.deliversIn', { days: serv.days }),
                 serv.express ? t('shop.expressAvailable') : null,
                 serv.cod && p.codEligible ? t('shop.codAvailable') : t('shop.prepaidOnly')]
                .filter(Boolean).join(' · ')
              : (serv.reason ?? t('shop.notServiceable'))}
          </p>
        )}
        <div className="flex gap-3 mt-2 text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>
          <span>{t('shop.freeShippingAbove', { amount: inr(shop.checkout.freeShippingAbove) })}</span>
          <span>{shop.loyaltyConfig ? '' : ''}Easy returns</span>
        </div>
      </div>

      {/* details */}
      <Tabs size="sm" value={tab} onChange={setTab}
        tabs={[{ id: 'details', label: t('common.details') }, { id: 'reviews', label: t('shop.reviews'), count: p.reviews }]} />

      {tab === 'details' && <AttributeSections product={p} />}

      {tab === 'reviews' && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold" style={{ color: 'var(--c-text)' }}>{p.rating}</span>
            <div className="flex-1">
              <Progress value={p.rating} max={5} height={6} tone="success" />
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                {p.reviews} verified reviews
              </p>
            </div>
          </div>
          {p.returnRate > 18 && (
            <p className="text-[11px] p-2 rounded-lg"
              style={{ background: 'color-mix(in srgb, var(--c-warning) 10%, transparent)', color: 'var(--c-warning)' }}>
              Some customers found the fit different from expected — check the size chart.
            </p>
          )}
        </div>
      )}

      {fbt.length > 0 && (
        <Shelf title="Frequently bought together" items={fbt} onOpen={onOpen} />
      )}
      {similar.length > 0 && (
        <Shelf title="Similar products" items={similar} onOpen={onOpen} />
      )}
    </div>
  )
}
