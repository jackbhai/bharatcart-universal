/**
 * Staff, roles and permissions.
 *
 * The app had a single `role` string on the auth user and nothing behind it.
 * A store that any real team runs needs to answer "who can refund an order"
 * and "who touched this record", so permissions are explicit and auditable
 * rather than implied by a role name.
 */
import { NOW } from '../../data/seed.js'

const DAY = 86400000

/**
 * Permission catalogue, grouped by the module it guards.
 * Keeping these as data (not scattered `if (role === 'owner')` checks) is what
 * makes the role editor possible at all.
 */
export const PERMISSIONS = {
  'orders.view': { group: 'Orders', label: 'View orders' },
  'orders.edit': { group: 'Orders', label: 'Edit orders' },
  'orders.fulfil': { group: 'Orders', label: 'Fulfil and ship' },
  'orders.cancel': { group: 'Orders', label: 'Cancel orders' },
  'orders.refund': { group: 'Orders', label: 'Issue refunds', sensitive: true },
  'catalogue.view': { group: 'Catalogue', label: 'View catalogue' },
  'catalogue.edit': { group: 'Catalogue', label: 'Create and edit products' },
  'catalogue.price': { group: 'Catalogue', label: 'Change prices', sensitive: true },
  'catalogue.delete': { group: 'Catalogue', label: 'Delete products', sensitive: true },
  'inventory.view': { group: 'Inventory', label: 'View stock' },
  'inventory.adjust': { group: 'Inventory', label: 'Adjust stock levels', sensitive: true },
  'inventory.transfer': { group: 'Inventory', label: 'Transfer between warehouses' },
  'customers.view': { group: 'Customers', label: 'View customers' },
  'customers.edit': { group: 'Customers', label: 'Edit customer records' },
  'customers.pii': { group: 'Customers', label: 'See full contact details', sensitive: true },
  'customers.export': { group: 'Customers', label: 'Export customer data', sensitive: true },
  'promotions.view': { group: 'Promotions', label: 'View promotions' },
  'promotions.edit': { group: 'Promotions', label: 'Create and edit promotions' },
  'loyalty.config': { group: 'Loyalty', label: 'Configure the loyalty programme', sensitive: true },
  'loyalty.adjust': { group: 'Loyalty', label: 'Adjust member points', sensitive: true },
  'finance.view': { group: 'Finance', label: 'View financial reports' },
  'finance.export': { group: 'Finance', label: 'Export financial data', sensitive: true },
  'finance.payouts': { group: 'Finance', label: 'Approve payouts', sensitive: true },
  'vendors.view': { group: 'Vendors', label: 'View vendors' },
  'vendors.edit': { group: 'Vendors', label: 'Manage vendors' },
  'vendors.po': { group: 'Vendors', label: 'Raise purchase orders', sensitive: true },
  'support.view': { group: 'Support', label: 'View tickets' },
  'support.reply': { group: 'Support', label: 'Reply to customers' },
  'support.close': { group: 'Support', label: 'Close tickets' },
  'content.edit': { group: 'Content', label: 'Edit pages and banners' },
  'content.publish': { group: 'Content', label: 'Publish content' },
  'settings.view': { group: 'Settings', label: 'View settings' },
  'settings.edit': { group: 'Settings', label: 'Change store settings', sensitive: true },
  'settings.payments': { group: 'Settings', label: 'Configure payment gateways', sensitive: true },
  'people.view': { group: 'People', label: 'View staff' },
  'people.manage': { group: 'People', label: 'Invite and remove staff', sensitive: true },
  'theme.edit': { group: 'Theme', label: 'Customise the storefront theme' },
  'analytics.view': { group: 'Analytics', label: 'View analytics' },
}

export const PERMISSION_KEYS = Object.keys(PERMISSIONS)
export const PERMISSION_GROUPS = [...new Set(Object.values(PERMISSIONS).map(p => p.group))]

/** Built-in roles. `owner` is deliberately a wildcard so it can never be locked out. */
export const ROLE_TEMPLATES = {
  owner: {
    id: 'owner', name: 'Owner', description: 'Full access to everything, including billing and staff.',
    permissions: ['*'], builtin: true, tone: 'violet',
  },
  manager: {
    id: 'manager', name: 'Store manager', description: 'Runs the shop day to day. No payment-gateway or staff changes.',
    permissions: PERMISSION_KEYS.filter(k => !['settings.payments', 'people.manage', 'finance.payouts'].includes(k)),
    builtin: true, tone: 'blue',
  },
  ops: {
    id: 'ops', name: 'Operations', description: 'Fulfilment, inventory and returns.',
    permissions: ['orders.view', 'orders.edit', 'orders.fulfil', 'orders.cancel', 'catalogue.view',
      'inventory.view', 'inventory.adjust', 'inventory.transfer', 'customers.view', 'vendors.view',
      'support.view', 'analytics.view'],
    builtin: true, tone: 'green',
  },
  support: {
    id: 'support', name: 'Support agent', description: 'Answers customers. Can refund but cannot change prices.',
    permissions: ['orders.view', 'orders.edit', 'orders.refund', 'customers.view', 'customers.pii',
      'catalogue.view', 'support.view', 'support.reply', 'support.close', 'loyalty.adjust'],
    builtin: true, tone: 'amber',
  },
  merchandiser: {
    id: 'merchandiser', name: 'Merchandiser', description: 'Owns the catalogue, pricing and promotions.',
    permissions: ['catalogue.view', 'catalogue.edit', 'catalogue.price', 'inventory.view',
      'promotions.view', 'promotions.edit', 'content.edit', 'content.publish', 'analytics.view'],
    builtin: true, tone: 'saffron',
  },
  finance: {
    id: 'finance', name: 'Finance', description: 'Reporting, reconciliation and payouts.',
    permissions: ['finance.view', 'finance.export', 'finance.payouts', 'orders.view',
      'vendors.view', 'vendors.po', 'analytics.view', 'settings.view'],
    builtin: true, tone: 'gray',
  },
  viewer: {
    id: 'viewer', name: 'Read only', description: 'Can look, cannot touch. Useful for accountants and advisors.',
    permissions: PERMISSION_KEYS.filter(k => k.endsWith('.view')),
    builtin: true, tone: 'gray',
  },
}

export const ROLE_IDS = Object.keys(ROLE_TEMPLATES)

/**
 * Does a role grant a permission?
 * The `*` wildcard exists only for owner; everything else is explicit so that
 * reading a role tells you exactly what it can do.
 */
export function can(role, permission) {
  const r = typeof role === 'string' ? ROLE_TEMPLATES[role] : role
  if (!r) return false
  if (r.permissions.includes('*')) return true
  return r.permissions.includes(permission)
}

/** Permissions a role holds, grouped for the editor UI. */
export function permissionsByGroup(role) {
  const r = typeof role === 'string' ? ROLE_TEMPLATES[role] : role
  const out = {}
  for (const [key, meta] of Object.entries(PERMISSIONS)) {
    if (!out[meta.group]) out[meta.group] = []
    out[meta.group].push({ key, ...meta, granted: r ? can(r, key) : false })
  }
  return out
}

/** Compare two roles — what the higher one can do that the lower cannot. */
export function roleDiff(a, b) {
  const ra = typeof a === 'string' ? ROLE_TEMPLATES[a] : a
  const rb = typeof b === 'string' ? ROLE_TEMPLATES[b] : b
  const onlyA = PERMISSION_KEYS.filter(k => can(ra, k) && !can(rb, k))
  const onlyB = PERMISSION_KEYS.filter(k => can(rb, k) && !can(ra, k))
  return { onlyA, onlyB, shared: PERMISSION_KEYS.filter(k => can(ra, k) && can(rb, k)).length }
}

/** Team members — start empty on a clean install (no demo staff). */
export const STAFF = []

/** Staff KPIs for the People module. */
export function staffKpis(staff = STAFF) {
  return {
    total: staff.length,
    active: staff.filter(s => s.status === 'Active').length,
    invited: staff.filter(s => s.status === 'Invited').length,
    suspended: staff.filter(s => s.status === 'Suspended').length,
    withoutTwoFactor: staff.filter(s => s.status === 'Active' && !s.twoFactor).length,
    owners: staff.filter(s => s.role === 'owner').length,
    byRole: ROLE_IDS.map(id => ({ role: id, name: ROLE_TEMPLATES[id].name, count: staff.filter(s => s.role === id).length })),
  }
}

/**
 * Security observations worth surfacing.
 * Framed as advice rather than blocking rules: a small shop may legitimately
 * have one owner and no 2FA, but they should be told.
 */
export function securityReview(staff = STAFF) {
  const notes = []
  const owners = staff.filter(s => s.role === 'owner' && s.status === 'Active')
  if (owners.length === 1) {
    notes.push({ level: 'warn', text: 'Only one active owner. If they lose access, nobody can recover the store.' })
  }
  const no2fa = staff.filter(s => s.status === 'Active' && !s.twoFactor)
  if (no2fa.length) {
    notes.push({ level: no2fa.length > 2 ? 'high' : 'warn', text: `${no2fa.length} active staff have no two-factor authentication.` })
  }
  const stale = staff.filter(s => s.status === 'Active' && Date.now() - s.lastActiveAt > 60 * DAY)
  if (stale.length) {
    notes.push({ level: 'info', text: `${stale.length} accounts have been idle for over 60 days. Consider suspending them.` })
  }
  const sensitive = staff.filter(s => s.status === 'Active' && can(s.role, 'finance.payouts'))
  notes.push({ level: 'info', text: `${sensitive.length} people can approve payouts.` })
  if (!notes.some(n => n.level === 'high' || n.level === 'warn')) {
    notes.unshift({ level: 'ok', text: 'No obvious access risks.' })
  }
  return notes
}

/** Deterministic audit trail so the log screen has something real to show. */
export function auditLog({ limit = 120 } = {}) {
  // With no staff there is no audit trail — stop synthesizing demo records.
  if (!STAFF.length) return []
  const actions = [
    ['orders.refund', 'Refunded order', 'ORD'], ['catalogue.price', 'Changed price on', 'P'],
    ['inventory.adjust', 'Adjusted stock for', 'P'], ['promotions.edit', 'Edited promotion', 'PROMO'],
    ['settings.edit', 'Updated setting', 'store.name'], ['people.manage', 'Invited', 'staff'],
    ['orders.cancel', 'Cancelled order', 'ORD'], ['customers.export', 'Exported customers', 'segment'],
    ['vendors.po', 'Raised purchase order', 'PO'], ['loyalty.adjust', 'Adjusted points for', 'CUST'],
  ]
  const out = []
  for (let i = 0; i < limit; i++) {
    const actor = STAFF[i % STAFF.length]
    const [permission, verb, prefix] = actions[(i * 7) % actions.length]
    out.push({
      id: 'AL' + (5000 + i),
      at: NOW - i * 3.7 * 3600000,
      actorId: actor.id,
      actor: actor.name,
      role: actor.role,
      permission,
      action: verb,
      target: prefix + '-' + (1000 + ((i * 313) % 9000)),
      sensitive: Boolean(PERMISSIONS[permission]?.sensitive),
      ip: `49.${36 + (i % 40)}.${i % 255}.${(i * 13) % 255}`,
    })
  }
  return out
}

export default STAFF
