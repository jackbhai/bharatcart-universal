/**
 * Storefront content: pages, banners, navigation, blog posts and SEO.
 *
 * The theme layer controlled how the shop looks. This controls what it says —
 * the part a shop owner edits weekly without touching a component.
 */
import { CATEGORIES, PRODUCTS, NOW } from '../../data/seed.js'

const DAY = 86400000

export const CONTENT_STATUS = ['Published', 'Draft', 'Scheduled', 'Archived']

/** Start empty — the store owner creates their own pages. */
export const PAGES = []

/** Start empty — the store owner creates their own banners. */
export const BANNERS = []

export const BANNER_SLOTS = [
  { id: 'top-strip', label: 'Top announcement strip', description: 'Thin bar above the header. Best for one short promise.' },
  { id: 'home-hero', label: 'Home hero', description: 'The first thing a visitor sees. One banner shows at a time, highest priority wins.' },
  { id: 'home-secondary', label: 'Home secondary rail', description: 'Below the featured products.' },
  { id: 'cart-sidebar', label: 'Cart sidebar', description: 'Shown next to the cart summary. Good for loyalty and shipping nudges.' },
  { id: 'pdp-below-price', label: 'Product page, below price', description: 'Shown on every product page under the price.' },
]

/** Start empty — the store owner creates their own blog_posts. */
export const BLOG_POSTS = []

/** Storefront navigation, editable as a tree. */
export const NAVIGATION = {
  header: [
    { id: 'N1', label: 'New in', href: '/shop?sort=newest', children: [] },
    { id: 'N2', label: 'Sarees', href: '/shop?category=Sarees', children: [
      { id: 'N2a', label: 'Kanjivaram', href: '/shop?category=Sarees&weave=kanjivaram' },
      { id: 'N2b', label: 'Banarasi', href: '/shop?category=Sarees&weave=banarasi' },
      { id: 'N2c', label: 'Cotton', href: '/shop?category=Sarees&fabric=cotton' },
    ] },
    { id: 'N3', label: 'Kurtas', href: '/shop?category=Kurtas', children: [] },
    { id: 'N4', label: 'Jewellery', href: '/shop?category=Jewellery', children: [] },
    { id: 'N5', label: 'Gifting', href: '/shop?tag=gifting', children: [] },
    { id: 'N6', label: 'Journal', href: '/blog', children: [] },
  ],
  footer: [
    { id: 'F1', label: 'Help', href: '', children: [
      { id: 'F1a', label: 'Shipping', href: '/pages/shipping' },
      { id: 'F1b', label: 'Returns', href: '/pages/returns' },
      { id: 'F1c', label: 'Size guide', href: '/pages/size-guide' },
      { id: 'F1d', label: 'Contact', href: '/pages/contact' },
    ] },
    { id: 'F2', label: 'About', href: '', children: [
      { id: 'F2a', label: 'Our story', href: '/pages/about' },
      { id: 'F2b', label: 'Our weavers', href: '/pages/weavers' },
      { id: 'F2c', label: 'Bulk orders', href: '/pages/bulk-orders' },
    ] },
    { id: 'F3', label: 'Legal', href: '', children: [
      { id: 'F3a', label: 'Privacy', href: '/pages/privacy' },
      { id: 'F3b', label: 'Terms', href: '/pages/terms' },
    ] },
  ],
}

/** Content KPIs. */
export function contentKpis(pages = PAGES, banners = BANNERS, posts = BLOG_POSTS) {
  const live = banners.filter(b => b.status === 'Published')
  const impressions = live.reduce((n, b) => n + b.impressions, 0)
  const clicks = live.reduce((n, b) => n + b.clicks, 0)
  return {
    pages: pages.length,
    published: pages.filter(p => p.status === 'Published').length,
    drafts: pages.filter(p => p.status === 'Draft').length,
    scheduled: pages.filter(p => p.status === 'Scheduled').length + banners.filter(b => b.status === 'Scheduled').length,
    banners: banners.length,
    liveBanners: live.length,
    bannerCtr: impressions ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
    posts: posts.length,
    publishedPosts: posts.filter(p => p.status === 'Published').length,
    totalViews: pages.reduce((n, p) => n + p.views, 0) + posts.reduce((n, p) => n + p.views, 0),
  }
}

/** Banner performance, best click-through first. */
export function bannerPerformance(banners = BANNERS) {
  return banners
    .map(b => ({
      ...b,
      ctr: b.impressions ? Number(((b.clicks / b.impressions) * 100).toFixed(2)) : 0,
      live: b.status === 'Published' && b.startsAt <= NOW && b.endsAt >= NOW,
    }))
    .sort((a, b) => b.ctr - a.ctr)
}

/**
 * SEO audit across pages and products.
 * Checks the handful of things that actually move rankings and are easy to get
 * wrong: missing titles, titles that get truncated, thin descriptions.
 */
export function seoAudit(pages = PAGES) {
  const issues = []
  for (const p of pages) {
    if (p.status === 'Archived') continue
    if (!p.seoTitle) issues.push({ id: p.id, title: p.title, field: 'SEO title', level: 'high', note: 'Missing. Search engines will invent one from the page content.' })
    else if (p.seoTitle.length > 60) issues.push({ id: p.id, title: p.title, field: 'SEO title', level: 'warn', note: `${p.seoTitle.length} characters — Google truncates around 60.` })
    if (!p.seoDescription) issues.push({ id: p.id, title: p.title, field: 'Meta description', level: 'high', note: 'Missing. You lose control of the snippet shown in results.' })
    else if (p.seoDescription.length > 160) issues.push({ id: p.id, title: p.title, field: 'Meta description', level: 'warn', note: `${p.seoDescription.length} characters — truncated around 160.` })
    if (p.words < 300 && p.type !== 'Page') issues.push({ id: p.id, title: p.title, field: 'Content length', level: 'info', note: `${p.words} words is thin for a ${p.type.toLowerCase()}.` })
  }
  const score = Math.max(0, 100 - issues.reduce((n, i) => n + (i.level === 'high' ? 8 : i.level === 'warn' ? 3 : 1), 0))
  return { issues, score, high: issues.filter(i => i.level === 'high').length, warn: issues.filter(i => i.level === 'warn').length }
}

/** Every URL the storefront exposes, for a sitemap preview. */
export function sitemap(pages = PAGES, posts = BLOG_POSTS, products = PRODUCTS, cats = CATEGORIES) {
  const entries = [
    { loc: '/', priority: 1.0, changefreq: 'daily', type: 'Home' },
    { loc: '/shop', priority: 0.9, changefreq: 'daily', type: 'Catalogue' },
    // A seeded category is { cat, subs[], hsn, gst, m } — reading `.name` here
    // silently produced "/shop?category=%5Bobject%20Object%5D" for every one.
    ...cats.map(c => ({ loc: `/shop?category=${encodeURIComponent(c.cat ?? c)}`, priority: 0.8, changefreq: 'daily', type: 'Category' })),
    ...cats.flatMap(c => (c.subs ?? []).map(sub => ({
      loc: `/shop?category=${encodeURIComponent(c.cat)}&sub=${encodeURIComponent(sub)}`,
      priority: 0.7, changefreq: 'weekly', type: 'Subcategory',
    }))),
    ...products.slice(0, 200).map(p => ({ loc: `/product/${p.id}`, priority: 0.7, changefreq: 'weekly', type: 'Product' })),
    ...pages.filter(p => p.status === 'Published').map(p => ({ loc: `/pages/${p.slug}`, priority: 0.5, changefreq: 'monthly', type: 'Page' })),
    ...posts.filter(p => p.status === 'Published').map(p => ({ loc: `/blog/${p.slug}`, priority: 0.6, changefreq: 'monthly', type: 'Post' })),
  ]
  const byType = {}
  for (const e of entries) byType[e.type] = (byType[e.type] ?? 0) + 1
  return { entries, total: entries.length, byType }
}

export default contentKpis
