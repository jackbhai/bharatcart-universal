const now = () => Date.now()
const uid = (p) => `${p}_${now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

/** Marketing — audiences, campaigns and automation flows. */
export const marketingSlice = {
  initial: () => ({
    audiences: [],
    campaigns: [],
    flows: [],
    attributionModel: 'last_touch',
    lastEstimate: null,
  }),

  actions: {
    createAudience: (s, aud) => ({
      audiences: [{ id: uid('aud'), name: 'New audience', match: 'all', rules: [], ...aud }, ...s.audiences],
    }),
    updateAudience: (s, { id, patch }) => ({
      audiences: s.audiences.map(a => (a.id === id ? { ...a, ...patch } : a)),
    }),
    removeAudience: (s, id) => ({ audiences: s.audiences.filter(a => a.id !== id) }),
    duplicateAudience: (s, id) => {
      const src = s.audiences.find(a => a.id === id)
      if (!src) return {}
      return { audiences: [{ ...src, id: uid('aud'), name: `${src.name} (copy)`, system: false }, ...s.audiences] }
    },

    createCampaign: (s, c) => ({
      campaigns: [{
        id: uid('cmp'), name: 'New campaign', channel: 'whatsapp', status: 'draft',
        discountPct: 0, stats: null, ...c,
      }, ...s.campaigns],
    }),
    updateCampaign: (s, { id, patch }) => ({
      campaigns: s.campaigns.map(c => (c.id === id ? { ...c, ...patch } : c)),
    }),
    removeCampaign: (s, id) => ({ campaigns: s.campaigns.filter(c => c.id !== id) }),
    duplicateCampaign: (s, id) => {
      const src = s.campaigns.find(c => c.id === id)
      if (!src) return {}
      return {
        campaigns: [{ ...src, id: uid('cmp'), name: `${src.name} (copy)`, status: 'draft', sentAt: null, stats: null }, ...s.campaigns],
      }
    },

    /** Mark a campaign sent, recording the forecast so results can be compared to it later. */
    sendCampaign: (s, { id, estimate }) => ({
      campaigns: s.campaigns.map(c => (c.id === id ? {
        ...c,
        status: 'sent',
        sentAt: now(),
        forecast: estimate ? {
          conversions: estimate.conversions, revenue: estimate.revenue, cost: estimate.cost,
        } : null,
        stats: estimate ? {
          sent: estimate.audienceSize, delivered: estimate.reach, opened: estimate.opens,
          clicked: estimate.clicks, converted: estimate.conversions, revenue: estimate.revenue,
        } : null,
      } : c)),
    }),

    toggleFlow: (s, id) => ({
      flows: s.flows.map(f => (f.id === id ? { ...f, active: !f.active } : f)),
    }),
    updateFlow: (s, { id, patch }) => ({
      flows: s.flows.map(f => (f.id === id ? { ...f, ...patch } : f)),
    }),
    addFlowStep: (s, { id, step }) => ({
      flows: s.flows.map(f => (f.id === id
        ? { ...f, steps: [...f.steps, { delayHours: 24, channel: 'email', label: 'New step', ...step }] }
        : f)),
    }),
    removeFlowStep: (s, { id, index }) => ({
      flows: s.flows.map(f => (f.id === id ? { ...f, steps: f.steps.filter((_, i) => i !== index) } : f)),
    }),

    setAttributionModel: (_s, model) => ({ attributionModel: model }),
    setEstimate: (_s, estimate) => ({ lastEstimate: estimate }),
  },
}

export function selectAudiences(state) { return state.marketing.audiences }
export function selectAudience(state, id) { return state.marketing.audiences.find(a => a.id === id) || null }
export function selectCampaigns(state) { return state.marketing.campaigns }
export function selectFlows(state) { return state.marketing.flows }
export function selectActiveFlows(state) { return state.marketing.flows.filter(f => f.active) }

export default marketingSlice
