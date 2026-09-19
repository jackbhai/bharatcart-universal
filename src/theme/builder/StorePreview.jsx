import React from 'react'
import { motion } from 'framer-motion'
import { cx } from '../../ui/kit.jsx'
import { loop } from '../../ui/useDeviceProfile.js'

const DEVICES = {
  desktop: { w: '100%', label: 'Desktop', icon: '🖥' },
  tablet: { w: 768, label: 'Tablet', icon: '▭' },
  mobile: { w: 390, label: 'Mobile', icon: '▯' },
}

const DEMO = [
  { name: 'Banarasi Silk Saree', price: 8499, mrp: 11999, tag: 'GI Tag' },
  { name: 'Chikankari Kurta', price: 2299, mrp: 3199, tag: 'Handmade' },
  { name: 'Kundan Jhumka', price: 1899, mrp: 2599, tag: 'Bestseller' },
]

/**
 * Live, in-page mock of the storefront. Reads the same CSS variables the
 * real store uses, so it's a true preview rather than a picture.
 */
export default function StorePreview({ theme }) {
  const t = theme.tokens
  const h = theme.header
  const f = theme.footer
  const device = theme.previewDevice
  const width = DEVICES[device].w

  return (
    <div className="space-y-2.5">
      {/* device switch */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {Object.entries(DEVICES).map(([id, d]) => (
            <button key={id} onClick={() => theme.setPreviewDevice(id)}
              className="relative px-2.5 py-1.5 text-[11px] font-semibold rounded-lg flex items-center gap-1.5"
              style={device === id ? { color: 'var(--c-primary-fg)' } : { color: 'var(--c-text-muted)' }}>
              {device === id && (
                <motion.div layoutId="devtab" transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute inset-0 rounded-lg" style={{ background: 'var(--c-primary)' }} />
              )}
              <span className="relative">{d.icon}</span>
              <span className="relative hidden sm:inline">{d.label}</span>
            </button>
          ))}
        </div>
        <span className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
          Live preview · {theme.template?.name}
        </span>
      </div>

      {/* frame */}
      <div className="rounded-2xl overflow-hidden border p-3 flex justify-center"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface-alt)' }}>
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          className="overflow-hidden shadow-2xl"
          style={{
            width, maxWidth: '100%',
            background: t.bg,
            borderRadius: Math.min(t.radius ?? 12, 18),
            fontFamily: t.fontBody,
            color: t.text,
          }}
        >
          {/* announcement */}
          {h.announcement.enabled && (
            <div className="overflow-hidden py-1.5 text-center"
              style={{ background: t.primary, color: t.primaryFg }}>
              <motion.p
                animate={{ x: ['10%', '-60%'] }}
                transition={loop({ duration: Math.max(60 - h.announcement.speed, 8), ease: 'linear' })}
                className="text-[10px] font-semibold whitespace-nowrap">
                {h.announcement.text}
              </motion.p>
            </div>
          )}

          {/* header */}
          <div className="flex items-center gap-3 px-3 py-2.5"
            style={{
              background: t.surface,
              borderBottom: `${t.borderWidth ?? 1}px solid ${t.border}`,
              justifyContent: h.layout === 'centered' ? 'center' : 'space-between',
            }}>
            {h.layout === 'split' && (
              <nav className="hidden sm:flex gap-2.5">
                {h.nav.slice(0, 2).map(n => (
                  <span key={n.id} className="text-[10px]" style={{ color: t.textMuted }}>{n.label}</span>
                ))}
              </nav>
            )}

            <div className="flex items-center gap-1.5">
              {t.logoUrl
                ? <img src={t.logoUrl} alt="" style={{ height: Math.min(t.logoHeight ?? 28, 26) }} className="object-contain" />
                : <div className="grid place-items-center font-bold shrink-0"
                    style={{
                      width: 24, height: 24, background: t.primary, color: t.primaryFg,
                      borderRadius: Math.min(t.radiusSm ?? 6, 8), fontSize: 12, fontFamily: t.fontHeading,
                    }}>
                    {t.logoText || 'B'}
                  </div>}
              <div className="leading-none">
                <p className="font-bold" style={{ fontSize: 12, fontFamily: t.fontHeading, color: t.text,
                  textTransform: t.headingCase === 'none' ? 'none' : t.headingCase }}>
                  {t.storeName}
                </p>
                {t.tagline && <p style={{ fontSize: 7.5, color: t.textMuted }}>{t.tagline}</p>}
              </div>
            </div>

            {h.layout !== 'centered' && (
              <div className="flex items-center gap-2">
                {h.layout === 'logo-left' && (
                  <nav className="hidden sm:flex gap-2.5 mr-1">
                    {h.nav.slice(0, 4).map(n => (
                      <span key={n.id} style={{ fontSize: 10, color: t.textMuted }}>{n.label}</span>
                    ))}
                  </nav>
                )}
                {h.search === 'inline' && (
                  <div className="hidden sm:block px-2 py-1"
                    style={{
                      background: t.surfaceAlt, borderRadius: t.radiusFull >= 99 ? 99 : t.radiusSm,
                      fontSize: 9, color: t.textMuted, minWidth: 70,
                    }}>
                    Search…
                  </div>
                )}
                <div className="flex gap-1.5" style={{ fontSize: 11, color: t.textMuted }}>
                  {h.showWishlist && <span>♡</span>}
                  {h.showAccount && <span>◉</span>}
                  {h.showCart && (
                    <span className="relative">
                      ▤
                      <span className="absolute -top-1 -right-1.5 grid place-items-center font-bold"
                        style={{ width: 10, height: 10, background: t.primary, color: t.primaryFg, borderRadius: 99, fontSize: 6.5 }}>
                        2
                      </span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* hero */}
          <div className="relative overflow-hidden m-2.5"
            style={{
              borderRadius: Math.min(t.radius ?? 12, 14),
              background: `linear-gradient(120deg, ${t.primary}, ${t.secondary})`,
              minHeight: device === 'mobile' ? 96 : 120,
            }}>
            <div className="absolute inset-0 opacity-25"
              style={{ background: `radial-gradient(70% 90% at 80% 10%, ${t.accent}, transparent)` }} />
            <div className="relative p-3.5">
              <p className="font-bold leading-tight"
                style={{
                  fontFamily: t.fontHeading, fontSize: device === 'mobile' ? 15 : 20,
                  color: t.primaryFg, fontWeight: t.headingWeight,
                  textTransform: t.headingCase === 'none' ? 'none' : t.headingCase,
                  letterSpacing: `${t.letterSpacing ?? 0}px`,
                }}>
                Festive Collection
              </p>
              <p style={{ fontSize: 9.5, color: t.primaryFg, opacity: .82, marginTop: 2 }}>
                Handwoven by artisans across India
              </p>
              <button className="mt-2.5 font-semibold"
                style={{
                  background: t.surface, color: t.primary,
                  padding: '5px 12px', fontSize: 10,
                  borderRadius: t.buttonStyle === 'pill' ? 99 : Math.min(t.radiusSm ?? 6, 10),
                  border: t.buttonStyle === 'outline' ? `1.5px solid ${t.surface}` : 'none',
                  boxShadow: t.shadowIntensity === 'brutal' ? `2px 2px 0 ${t.text}` : 'none',
                }}>
                Shop Now
              </button>
            </div>
          </div>

          {/* products */}
          <div className="px-2.5 pb-2.5">
            <div className="flex items-baseline justify-between mb-1.5">
              <p className="font-bold" style={{
                fontFamily: t.fontHeading, fontSize: 11, color: t.text,
                textTransform: t.headingCase === 'none' ? 'none' : t.headingCase,
              }}>
                Trending Now
              </p>
              <span style={{ fontSize: 9, color: t.primary }}>View all →</span>
            </div>

            <div className="grid" style={{
              gridTemplateColumns: `repeat(${device === 'mobile' ? 2 : 3}, minmax(0,1fr))`,
              gap: Math.min(t.gridGap ?? 10, 10),
            }}>
              {DEMO.slice(0, device === 'mobile' ? 2 : 3).map((p, i) => (
                <div key={i} style={{
                  background: t.cardStyle === 'glass' ? `${t.surface}B8` : t.surface,
                  borderRadius: Math.min(t.radius ?? 10, 12),
                  border: t.cardStyle === 'flat' ? `${t.borderWidth ?? 1}px solid ${t.border}`
                        : t.cardStyle === 'outlined' ? `${(t.borderWidth ?? 1) * 2}px solid ${t.border}`
                        : `${t.borderWidth ?? 1}px solid ${t.border}`,
                  boxShadow: t.shadowIntensity === 'brutal' ? `3px 3px 0 ${t.text}`
                           : t.shadowIntensity === 'none' ? 'none'
                           : '0 2px 8px -3px rgba(0,0,0,.14)',
                  overflow: 'hidden',
                }}>
                  <div className="relative" style={{
                    aspectRatio: t.imageRatio || '3/4',
                    background: `linear-gradient(135deg, ${t.surfaceAlt}, ${t.accent}38)`,
                  }}>
                    <span className="absolute top-1 left-1 font-bold"
                      style={{
                        fontSize: 6.5, padding: '1.5px 4px', background: t.primary, color: t.primaryFg,
                        borderRadius: t.buttonStyle === 'pill' ? 99 : 3,
                      }}>
                      {p.tag}
                    </span>
                  </div>
                  <div style={{ padding: 5 }}>
                    <p className="line-clamp-2 leading-tight" style={{ fontSize: 8.5, color: t.text }}>{p.name}</p>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-bold" style={{ fontSize: 9.5, color: t.text }}>₹{p.price.toLocaleString('en-IN')}</span>
                      <span style={{ fontSize: 7, color: t.textMuted, textDecoration: 'line-through' }}>
                        ₹{p.mrp.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="mt-1 text-center font-semibold"
                      style={{
                        background: t.buttonStyle === 'outline' ? 'transparent' : t.primary,
                        color: t.buttonStyle === 'outline' ? t.primary : t.primaryFg,
                        border: t.buttonStyle === 'outline' ? `1px solid ${t.primary}` : 'none',
                        fontSize: 8, padding: '3px 0',
                        borderRadius: t.buttonStyle === 'pill' ? 99 : Math.min(t.radiusSm ?? 4, 8),
                      }}>
                      Add to Cart
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* footer */}
          <div style={{ background: t.surfaceAlt, borderTop: `${t.borderWidth ?? 1}px solid ${t.border}`, padding: 10 }}>
            <div className="grid" style={{
              gridTemplateColumns: `repeat(${Math.min(f.columns.length || 1, device === 'mobile' ? 2 : 4)}, minmax(0,1fr))`,
              gap: 8,
            }}>
              {f.columns.slice(0, 4).map(c => (
                <div key={c.id}>
                  <p className="font-bold mb-1" style={{ fontSize: 8, color: t.text, fontFamily: t.fontHeading }}>
                    {c.title}
                  </p>
                  {c.links.slice(0, 3).map(l => (
                    <p key={l.id} style={{ fontSize: 7.5, color: t.textMuted, lineHeight: 1.7 }}>{l.label}</p>
                  ))}
                </div>
              ))}
              {f.newsletter && (
                <div>
                  <p className="font-bold mb-1" style={{ fontSize: 8, color: t.text, fontFamily: t.fontHeading }}>
                    {f.newsletterTitle}
                  </p>
                  <div style={{
                    background: t.surface, border: `1px solid ${t.border}`,
                    borderRadius: t.buttonStyle === 'pill' ? 99 : 4,
                    fontSize: 7, color: t.textMuted, padding: '3px 5px',
                  }}>
                    your@email.com
                  </div>
                </div>
              )}
            </div>

            {f.paymentBadges && (
              <div className="flex gap-1 mt-2">
                {['UPI', 'VISA', 'RuPay', 'COD'].map(b => (
                  <span key={b} style={{
                    fontSize: 6, padding: '1.5px 4px', background: t.surface,
                    border: `1px solid ${t.border}`, borderRadius: 3, color: t.textMuted,
                  }}>{b}</span>
                ))}
              </div>
            )}

            <p className="mt-2 pt-1.5" style={{
              fontSize: 6.5, color: t.textMuted, borderTop: `1px solid ${t.border}`,
            }}>
              {f.copyright}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
