/**
 * Split-routing URL helpers.
 *
 * The storefront (user panel) uses clean history-API URLs (/shop, /product/123)
 * under a BrowserRouter. The admin panel stays on hash routing (#/admin/...)
 * under a HashRouter, so admin paths never appear in the URL path that the
 * server sees.
 *
 * Pure functions live here so they are unit-testable without a DOM.
 */

/** 'admin' when the boot hash points at the admin panel, 'shop' otherwise. */
export function detectBootMode(hash) {
  const h = hash || ''
  // Exact '#/admin' or a sub-path / query of it — never a longer word like
  // '#/adminfoo', which must boot the shop tree.
  return h === '#/admin' || h.startsWith('#/admin/') || h.startsWith('#/admin?')
    ? 'admin'
    : 'shop'
}

/**
 * Basename the app is served from, e.g. '/bharatcart-universal' on GitHub
 * Pages project sites. Read from VITE_APP_BASENAME so the deploy can set it
 * at build time; defaults to '/'.
 */
export function appBasename() {
  const raw = (import.meta.env.VITE_APP_BASENAME || '').trim()
  if (!raw || raw === '/') return '/'
  return '/' + raw.replace(/^\/+|\/+$/g, '')
}

/** Join the basename with an app path: shopUrl('/shop') -> '/bharatcart-universal/shop'. */
export function shopUrl(path = '/') {
  const base = appBasename()
  const p = path.startsWith('/') ? path : '/' + path
  return (base === '/' ? '' : base) + p
}

/**
 * Leave the admin tree for a clean storefront URL. A full navigation (not
 * router nav) because the storefront lives under a different router.
 */
export function goShop(path = '/') {
  window.location.assign(shopUrl(path))
}

/**
 * Enter the admin tree from the storefront. The main.jsx boot switch listens
 * for hash changes and mounts the admin HashRouter when the hash starts with
 * '#/admin' — no reload needed.
 */
export function goAdminSetup() {
  window.location.hash = '#/admin/setup'
}

/**
 * Old bookmarked storefront hashes and the clean URL they map to.
 * '#/admin/*' is deliberately absent: admin hashes must NEVER redirect.
 */
export const LEGACY_STORE_HASHES = {
  '#/shop': '/shop',
  '#/help': '/help',
  '#/terms': '/terms',
  '#/privacy': '/privacy',
  '#/about': '/about',
  '#/contact': '/contact',
  '#/careers': '/careers',
  '#/account/orders': '/account/orders',
  '#/auth': '/account/login',
}

/**
 * Map a boot-time location.hash to a clean storefront path, or null when no
 * redirect applies. Admin hashes always return null — they are handled by the
 * admin tree, never rewritten.
 */
export function resolveLegacyHash(hash) {
  if (!hash || hash.startsWith('#/admin')) return null
  const key = hash.split('?')[0]
  if (LEGACY_STORE_HASHES[key]) return LEGACY_STORE_HASHES[key]
  const m = /^#\/product\/([^/?#]+)/.exec(key)
  if (m) return '/product/' + m[1]
  return null
}
