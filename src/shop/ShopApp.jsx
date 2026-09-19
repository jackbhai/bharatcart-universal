/**
 * ShopApp — the storefront (user panel) under clean history-API URLs.
 *
 * Mounted by App at `/*` inside a BrowserRouter. Zero `#` in any
 * user-facing URL: /, /shop, /category/:slug, /search, /product/:id,
 * /cart, /checkout, /account, /account/login and the info pages.
 */
import React, { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ShopProvider } from './shopState.jsx'
import ShopLayout from './ShopLayout.jsx'
import {
  HomePage, CataloguePage, CategoryPage, ProductPage, CartPage,
  CheckoutPage, AccountPage, InfoPage, ShopNotFound, CustomerLoginPage,
} from './pages.jsx'
import { resolveLegacyHash, shopUrl } from '../lib/siteUrls.js'

function setupDone() {
  try { return localStorage.getItem('bharatcart_setup_done') === '1' } catch { return false }
}

/**
 * Old bookmarked storefront hashes (#/shop, #/account/orders, …) redirect
 * once to their clean URL — no extra history entry. Skipped until setup is
 * done so the first-run wizard always wins the race, and admin hashes are
 * never touched.
 *
 * The `redirect` prop is injectable so tests can observe the target without
 * performing a real navigation.
 */
export function LegacyHashRedirect({ redirect = (url) => window.location.replace(url) }) {
  useEffect(() => {
    if (!setupDone()) return
    const target = resolveLegacyHash(window.location.hash)
    if (target) {
      try { redirect(shopUrl(target)) } catch { /* non-browser env */ }
    }
  }, [redirect])
  return null
}

const INFO_ROUTES = ['help', 'terms', 'privacy', 'about', 'contact', 'careers']

export default function ShopApp() {
  return (
    <ShopProvider>
      <LegacyHashRedirect />
      <Routes>
        <Route element={<ShopLayout />}>
          <Route index element={<HomePage />} />
          <Route path="shop" element={<CataloguePage />} />
          <Route path="category/:slug" element={<CategoryPage />} />
          <Route path="search" element={<CataloguePage />} />
          <Route path="product/:id" element={<ProductPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="account/login" element={<CustomerLoginPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="account/:tab" element={<AccountPage />} />
          {INFO_ROUTES.map(p => (
            <Route key={p} path={p} element={<InfoPage page={p} />} />
          ))}
          {/* Unknown clean paths (including guessed /admin/…) land on a real
              shop 404 — the admin panel is never revealed from here. */}
          <Route path="*" element={<ShopNotFound />} />
        </Route>
      </Routes>
    </ShopProvider>
  )
}
