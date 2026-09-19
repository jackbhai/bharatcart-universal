import { RETURNS } from '../../../data/returnsSeed.js'
import { transitionReturn, RETURN_STATUS } from '../../../engines/returns/returnEngine.js'

const now = () => Date.now()
const uid = () => 'RMA' + now().toString(36).slice(-6).toUpperCase()

/** Returns / RMA slice — request intake through refund. */
export const returnsSlice = {
  initial: () => ({
    overrides: {},        // { [rmaId]: Partial<RMA> }
    created: [],          // RMAs raised inside the admin
    notes: {},
    policy: {
      windowDays: 7,
      pickupFee: 79,
      qcFailPenaltyPct: 100,
      qcPartialPenaltyPct: 30,
      storeCreditBonusPct: 10,
      autoApproveUnder: 2000,
      autoApproveTrustedCustomers: true,
      requirePhotoForDamage: true,
      exchangeAllowed: true,
      instantRefundForPrepaid: true,
    },
    lastAction: null,
  }),

  actions: {
    transition: (s, { rma, to, by = 'admin', note }) => {
      const merged = { ...rma, ...(s.overrides[rma.id] || {}) }
      const result = transitionReturn(merged, to, { by, note })
      if (!result.ok) {
        return { lastAction: { ok: false, id: rma.id, reason: result.reason, at: now() } }
      }
      const { id, ...rest } = result.rma
      return {
        overrides: { ...s.overrides, [rma.id]: { ...(s.overrides[rma.id] || {}), ...rest } },
        lastAction: { ok: true, id: rma.id, to, at: now() },
      }
    },

    bulkTransition: (s, { rmas, to, by = 'admin' }) => {
      const overrides = { ...s.overrides }
      let done = 0
      const failed = []
      for (const rma of rmas) {
        const merged = { ...rma, ...(overrides[rma.id] || {}) }
        const result = transitionReturn(merged, to, { by })
        if (result.ok) {
          const { id, ...rest } = result.rma
          overrides[id] = { ...(overrides[id] || {}), ...rest }
          done++
        } else {
          failed.push({ id: rma.id, reason: result.reason })
        }
      }
      return { overrides, lastAction: { ok: !failed.length, bulk: true, to, succeeded: done, failed, at: now() } }
    },

    update: (s, { id, patch }) => ({
      overrides: { ...s.overrides, [id]: { ...(s.overrides[id] || {}), ...patch, updatedAt: now() } },
    }),

    recordQC: (s, { id, outcome, notes, restock, destination }) => ({
      overrides: {
        ...s.overrides,
        [id]: {
          ...(s.overrides[id] || {}),
          qcOutcome: outcome,
          qcNotes: notes,
          restock,
          restockDestination: destination,
          qcAt: now(),
          status: outcome === 'fail' ? RETURN_STATUS.QC_FAILED : RETURN_STATUS.QC_PASSED,
        },
      },
    }),

    recordRefund: (s, { id, amount, method, reference }) => ({
      overrides: {
        ...s.overrides,
        [id]: {
          ...(s.overrides[id] || {}),
          status: RETURN_STATUS.REFUNDED,
          refundAmount: amount,
          refundMethod: method,
          refundReference: reference || 'RFND' + now().toString(36).toUpperCase(),
          refundedAt: now(),
        },
      },
    }),

    create: (s, rma) => ({
      created: [{
        id: uid(),
        status: RETURN_STATUS.REQUESTED,
        type: 'refund',
        requestedAt: now(),
        updatedAt: now(),
        refundAmount: 0,
        lines: [],
        timeline: [{ at: now(), to: RETURN_STATUS.REQUESTED, by: 'admin', note: 'Raised from admin' }],
        ...rma,
      }, ...s.created],
    }),

    addNote: (s, { id, text, by = 'admin' }) => ({
      notes: { ...s.notes, [id]: [{ id: 'n' + now().toString(36), text, by, at: now() }, ...(s.notes[id] || [])] },
    }),

    setPolicy: (s, patch) => ({ policy: { ...s.policy, ...patch } }),
    clearAction: () => ({ lastAction: null }),
    reset: () => ({ overrides: {}, created: [], notes: {} }),
  },
}

/* ----------------------------------------------------------- selectors */

export function selectReturns(state) {
  const { overrides, created } = state.returns
  const base = created.length ? [...created, ...RETURNS] : RETURNS
  if (!Object.keys(overrides).length) return base
  return base.map(r => (overrides[r.id] ? { ...r, ...overrides[r.id] } : r))
}

export function selectReturn(state, id) {
  return selectReturns(state).find(r => r.id === id) || null
}

export function selectReturnsByOrder(state, orderId) {
  return selectReturns(state).filter(r => r.orderId === orderId)
}

export function selectReturnsByCustomer(state, customerId) {
  return selectReturns(state).filter(r => r.customerId === customerId)
}

export function selectOpenReturns(state) {
  const closed = [RETURN_STATUS.REFUNDED, RETURN_STATUS.CLOSED, RETURN_STATUS.REJECTED]
  return selectReturns(state).filter(r => !closed.includes(r.status))
}

export function selectReturnPolicy(state) {
  return state.returns.policy
}

export default returnsSlice
