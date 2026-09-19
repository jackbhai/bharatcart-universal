import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, BrowserRouter } from 'react-router-dom'
import './index.css'
import './ui/design/premium.css' /* premium design system: glass, 3D, motion */
import App from './App.jsx'
import ErrorBoundary from './core/errors/ErrorBoundary.jsx'
import { detectBootMode, appBasename } from './lib/siteUrls.js'

/**
 * Split-routing boot switch.
 *
 * - `#/admin/...` → the admin panel, mounted in a HashRouter. The hash
 *   fragment never reaches the server, so admin paths stay out of server
 *   logs and out of the clean-URL space. There is deliberately no visible
 *   link from the storefront to the admin panel.
 * - everything else → the storefront (user panel), mounted in a
 *   BrowserRouter with clean history-API URLs and no `#` anywhere.
 *
 * The switch listens for hash changes so crossing between the trees never
 * needs a reload: the setup wizard flips the shop to `#/admin/setup`, and
 * an old `#/shop` bookmark is converted to its clean URL by
 * LegacyHashRedirect inside the shop tree. Admin hashes are never rewritten.
 */
function Root() {
  const [mode, setMode] = useState(() => detectBootMode(window.location.hash))

  useEffect(() => {
    const onHashChange = () => setMode(detectBootMode(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Identical state values bail out of rendering, so ordinary admin
  // navigation (#/admin/a → #/admin/b) does not remount anything.
  return mode === 'admin'
    ? <HashRouter><App mode="admin" /></HashRouter>
    : <BrowserRouter basename={appBasename()}><App mode="shop" /></BrowserRouter>
}

/**
 * Last-resort boundary. Route-level and widget-level boundaries catch almost
 * everything; this one exists for failures outside any route — the shell, the
 * store, the theme provider — where the alternative is a white page.
 */
createRoot(document.getElementById('root')).render(
  <ErrorBoundary level="app" label="application">
    <Root />
  </ErrorBoundary>
)
