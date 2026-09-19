import React from 'react'
import useAuth from '../hooks/useAuth.js'
import { can as roleCan, PERMISSIONS, ROLE_TEMPLATES } from '../engines/people/peopleEngine.js'
import { logTamper } from '../core/security/integrity.js'

/**
 * Permission enforcement.
 *
 * The project already defined 38 permissions and 7 role templates, and had a
 * working `can(role, permission)` function — but nothing in the interface ever
 * called it. A support agent saw the same panel as the owner, including the
 * payout screen and the staff editor. The permissions were documentation, not
 * access control.
 *
 * This module connects them to the UI. Three levels of enforcement, because
 * hiding a control and refusing an action are different jobs:
 *
 *   usePermission()  — ask a question, decide what to render
 *   <Can>            — hide or disable a control
 *   <RequirePermission> — block a whole screen
 *
 * The honest caveat, same as everywhere else in this app: with the local
 * backend none of this is enforceable. The role lives in localStorage and the
 * user can edit it. What the checks give you in demo mode is a correct,
 * reviewable permission model and an interface that behaves properly per role.
 * Connect a backend and the same model is enforced server-side, where it
 * counts. `src/core/security/integrity.js` explains the reasoning in full.
 */

/** Read the effective role, defaulting to the least privilege available. */
function effectiveRole(user) {
  const role = String(user?.role || 'customer').toLowerCase()
  // An unknown role must never be treated as privileged. If someone edits
  // localStorage to "superadmin", they get customer access, not everything.
  return ROLE_TEMPLATES[role] ? role : 'customer'
}

/**
 * The core check. Accepts a single permission or an array.
 *
 * `mode` decides how an array is treated: 'all' (default) requires every
 * permission, 'any' requires at least one. Defaulting to 'all' is the safer
 * choice — a caller who passes a list and forgets the mode gets the stricter
 * interpretation.
 */
export function checkPermission(user, permission, { mode = 'all' } = {}) {
  if (!permission) return true
  const role = effectiveRole(user)
  const list = Array.isArray(permission) ? permission : [permission]

  // A permission key that does not exist is almost always a typo, and a typo
  // must fail closed rather than silently granting access.
  const unknown = list.filter(p => p !== '*' && !PERMISSIONS[p])
  if (unknown.length) {
    console.error(`[rbac] unknown permission key(s): ${unknown.join(', ')} — denying access`)
    return false
  }

  return mode === 'any'
    ? list.some(p => roleCan(role, p))
    : list.every(p => roleCan(role, p))
}

/** Hook form. */
export function usePermission(permission, opts) {
  const auth = useAuth()
  const allowed = checkPermission(auth.user, permission, opts)
  return {
    allowed,
    role: effectiveRole(auth.user),
    // Handy for tooltips: which specific permission is missing.
    missing: Array.isArray(permission)
      ? permission.filter(p => !checkPermission(auth.user, p))
      : (allowed ? [] : [permission]),
  }
}

/** All permissions for the signed-in user, for the settings/profile screens. */
export function useMyPermissions() {
  const auth = useAuth()
  const role = effectiveRole(auth.user)
  const template = ROLE_TEMPLATES[role]
  const granted = template?.permissions.includes('*')
    ? Object.keys(PERMISSIONS)
    : Object.keys(PERMISSIONS).filter(p => roleCan(role, p))
  return { role, template, granted, denied: Object.keys(PERMISSIONS).filter(p => !granted.includes(p)) }
}

/**
 * Conditional rendering for a control.
 *
 * Prefer `disabled` over hiding for actions the user can see the effect of —
 * an operator who cannot find a button assumes the app is broken, whereas a
 * disabled button with a reason teaches them the permission model. Hide things
 * that would be confusing or sensitive to even know about.
 */
export function Can({ permission, mode, children, fallback = null, disabled = false }) {
  const { allowed, missing } = usePermission(permission, { mode })
  if (allowed) return children

  if (disabled && React.isValidElement(children)) {
    const reason = `Requires: ${missing.map(p => PERMISSIONS[p]?.label || p).join(', ')}`
    return React.cloneElement(children, {
      disabled: true,
      title: reason,
      'aria-disabled': 'true',
      onClick: undefined,
      style: { ...(children.props.style || {}), opacity: 0.45, cursor: 'not-allowed' },
    })
  }
  return fallback
}

/** Inverse, for "you do not have access" messaging. */
export function Cannot({ permission, mode, children }) {
  const { allowed } = usePermission(permission, { mode })
  return allowed ? null : children
}

/**
 * Screen-level guard.
 *
 * An attempt to reach a screen the role cannot use is logged. In demo mode
 * that log is the only consequence, but it makes a deliberate escalation
 * attempt visible rather than silent, and it is the hook a real backend uses
 * to alert on the same event.
 */
export function RequirePermission({ permission, mode, children, label }) {
  const auth = useAuth()
  const { allowed, role, missing } = usePermission(permission, { mode })

  React.useEffect(() => {
    if (!allowed) {
      logTamper('permission_denied', {
        screen: label || 'unknown',
        role,
        required: Array.isArray(permission) ? permission : [permission],
        user: auth.user?.email || auth.user?.id || null,
      })
    }
  }, [allowed, label, role, permission, auth.user])

  if (allowed) return children

  return (
    <div role="alert" className="grid place-items-center p-6 min-h-[50vh]">
      <div className="t-card p-8 max-w-md text-center">
        <p className="text-3xl mb-3" aria-hidden="true">🔒</p>
        <h2 className="font-bold text-lg" style={{ color: 'var(--c-text)' }}>
          You do not have access to this screen
        </h2>
        <p className="text-sm mt-2" style={{ color: 'var(--c-text-muted)' }}>
          {label ? `"${label}" requires ` : 'This screen requires '}
          <strong>{missing.map(p => PERMISSIONS[p]?.label || p).join(', ')}</strong>.
          You are signed in as <strong>{ROLE_TEMPLATES[role]?.name || role}</strong>.
        </p>
        <p className="text-[12px] mt-3" style={{ color: 'var(--c-text-muted)' }}>
          Ask an owner to change your role in People → Roles.
        </p>
        <button
          type="button"
          onClick={() => { window.location.hash = '#/admin/dashboard' }}
          className="t-btn t-btn-primary mt-5 px-4 py-2.5 text-sm min-h-[44px]"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  )
}

/**
 * Which permission each admin screen needs.
 *
 * Kept as data next to the check rather than scattered through route
 * definitions, so the whole access model can be reviewed — and tested — in one
 * place. A screen missing from this map is treated as requiring no permission,
 * which the test suite asserts against so a new screen cannot be added without
 * a deliberate decision.
 */
export const SCREEN_PERMISSIONS = {
  dashboard: null, // every staff member needs a landing page
  analytics: 'analytics.view',
  reports: 'analytics.view',
  customers: 'customers.view',
  finance: 'finance.view',
  orders: 'orders.view',
  catalogue: 'catalogue.view',
  inventory: 'inventory.view',
  returns: 'orders.view',
  shipping: 'orders.view',
  vendors: 'vendors.view',
  support: 'support.view',
  operations: 'inventory.view',
  // There is no dedicated marketing permission; campaigns are promotional
  // work, so they share the promotions grant.
  marketing: 'promotions.view',
  promotions: 'promotions.view',
  loyalty: 'loyalty.config',
  content: 'content.edit',
  theme: 'theme.edit',
  localisation: 'settings.view',
  integrations: 'settings.view',
  people: 'people.view',
  settings: 'settings.view',
}

/** Nav filtering, so the sidebar only offers reachable screens. */
export function visibleNav(navItems, user) {
  return navItems.filter(item => {
    const required = SCREEN_PERMISSIONS[item.id]
    return !required || checkPermission(user, required)
  })
}

export default { usePermission, Can, Cannot, RequirePermission, checkPermission, visibleNav, SCREEN_PERMISSIONS }
