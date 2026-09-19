/**
 * Webhook events + test payload builder.
 *
 * NOTE (2026-09): the old fake integration catalogue (hardcoded "Connected"
 * services, fake webhook delivery counts, fake API keys) was deleted. The
 * real provider registry lives in ./providers.js and the persisted
 * per-category configuration in ./store.js. This module keeps only:
 *   - WEBHOOK_EVENTS: the events the storefront can push to a merchant-owned endpoint
 *   - samplePayload(event): builds the JSON body we POST for a "send test event"
 *
 * samplePayload is a template for a REAL outgoing test delivery — not fake
 * data presented as history. It is clearly marked as a test payload.
 */

export const WEBHOOK_EVENTS = [
  'order.created', 'order.paid', 'order.fulfilled', 'order.cancelled',
  'return.requested', 'return.approved', 'refund.issued',
  'customer.created', 'customer.tier_changed',
  'product.created', 'product.updated', 'inventory.low',
  'cart.abandoned', 'review.submitted',
]

/** Build the JSON body for a real test-event delivery to a merchant endpoint. */
export function samplePayload(event) {
  const base = {
    id: 'evt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    event,
    createdAt: new Date().toISOString(),
    test: true,
  }
  const bodies = {
    'order.created': { order: { id: 'ORD-TEST-001', total: 1499, currency: 'INR', items: 2, status: 'Confirmed' } },
    'order.paid': { order: { id: 'ORD-TEST-001', total: 1499, currency: 'INR' }, payment: { method: 'upi', captured: true } },
    'inventory.low': { product: { id: 'P-TEST-001', name: 'Test product', stock: 3, reorderPoint: 12 } },
    'refund.issued': { refund: { id: 'rfnd_test_001', orderId: 'ORD-TEST-001', amount: 499, currency: 'INR' } },
    'customer.tier_changed': { customer: { id: 'C-TEST-001', from: 'Silver', to: 'Gold' } },
    'cart.abandoned': { cart: { id: 'CRT-TEST-001', value: 2499, items: 2 } },
  }
  return { ...base, data: bodies[event] ?? { note: 'Test delivery — replace with the real record on your backend.' } }
}

export default samplePayload
