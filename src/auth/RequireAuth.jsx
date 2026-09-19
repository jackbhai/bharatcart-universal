import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import useAuth from '../hooks/useAuth.js'
import { hasRole } from '../core/store/slices/authSlice.js'
import { goShop } from '../lib/siteUrls.js'

/** Route guard. Redirects to /admin/login when signed out or under-privileged. */
export default function RequireAuth({ children, role, redirect = '/admin/login' }) {
  const auth = useAuth()
  const loc = useLocation()

  if (!auth.initialised) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: 'var(--c-bg)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--c-primary)', borderTopColor: 'transparent' }} />
          <p className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>Loading…</p>
        </div>
      </div>
    )
  }

  if (!auth.isAuthed) {
    return <Navigate to={redirect} state={{ from: loc.pathname }} replace />
  }

  if (role && !hasRole(auth.user, role)) {
    return (
      <div className="min-h-screen grid place-items-center p-6" style={{ background: 'var(--c-bg)' }}>
        <div className="t-card p-8 max-w-sm text-center">
          <p className="text-3xl mb-3">🔒</p>
          <h2 className="font-bold text-lg" style={{ color: 'var(--c-text)' }}>Not enough access</h2>
          <p className="text-sm mt-1.5" style={{ color: 'var(--c-text-muted)' }}>
            This area needs the <strong>{role}</strong> role. You are signed in as <strong>{auth.user.role}</strong>.
          </p>
          <button onClick={() => goShop('/shop')}
            className="t-btn t-btn-primary mt-5 px-4 py-2 text-sm">
            Go to storefront
          </button>
        </div>
      </div>
    )
  }

  return children
}
