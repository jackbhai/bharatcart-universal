import React from 'react'
import { Link } from 'react-router-dom'

/**
 * Honest provider indicator for the sign-in screen.
 *
 * Shows exactly which identity service backs sign-in right now:
 * "Signed in via Supabase Auth", "Local dev auth", etc. When the local
 * development provider is active we say so plainly — development auth is
 * never dressed up as production. A "change provider" link goes straight
 * to the Integrations hub.
 */
export default function AuthProviderBadge({ info }) {
  if (!info) return null
  const { providerName, isCloud, isConfigured, misconfigured, providerId } = info

  const dot = misconfigured
    ? 'var(--c-danger)'
    : isConfigured ? 'var(--c-success)' : 'var(--c-warning, #f59e0b)'
  const glow = misconfigured ? 'glow-err' : isConfigured ? 'glow-ok' : 'glow-warn'

  return (
    <div
      className={`glass flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-[12px] leading-snug ${glow}`}
      style={{ color: 'var(--c-text-muted)' }}
      role="status"
    >
      <span className="pulse-dot mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: dot, color: dot }} />
      <div className="min-w-0">
        {misconfigured ? (
          <p>
            <strong style={{ color: 'var(--c-text)' }}>{providerName}</strong> is selected
            but not configured — sign-in is using <strong>local dev auth</strong> until
            you add its credentials.
          </p>
        ) : providerId === 'local-dev' ? (
          <p>
            <strong style={{ color: 'var(--c-text)' }}>Local dev auth</strong> — accounts
            live in this browser only. Not for production.
          </p>
        ) : (
          <p>
            Signing in via <strong style={{ color: 'var(--c-text)' }}>{providerName}</strong>.
          </p>
        )}
        <Link
          to="/admin/integrations"
          className="font-semibold hover:underline"
          style={{ color: 'var(--c-primary)' }}
        >
          Change provider in Integrations →
        </Link>
      </div>
    </div>
  )
}
