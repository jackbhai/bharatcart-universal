import React from 'react'
import Button from './primitives/Button.jsx'

/**
 * Proper 404 page for unknown routes (hash routing included).
 * Never a blank screen: it says what happened and offers a way back.
 */
export default function NotFound({ title = 'Page not found', onShop, onDashboard, context = 'shop' }) {
  return (
    <div className="min-h-[60vh] grid place-items-center p-6">
      <div className="text-center max-w-sm">
        <p className="text-5xl mb-4" aria-hidden="true">🧭</p>
        <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>{title}</h1>
        <p className="text-[13px] mt-2 mb-5" style={{ color: 'var(--c-text-muted)' }}>
          {context === 'admin'
            ? 'This admin screen does not exist. If you followed a link here, it may be outdated.'
            : 'The page you were looking for does not exist or was moved.'}
        </p>
        <div className="flex gap-2 justify-center">
          {onDashboard && (
            <Button variant="outline" onClick={onDashboard}>Back to dashboard</Button>
          )}
          {onShop && (
            <Button onClick={onShop}>Continue shopping</Button>
          )}
        </div>
      </div>
    </div>
  )
}
