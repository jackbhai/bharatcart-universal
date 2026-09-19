import React from 'react'
import { useSlice } from '../../hooks/useStore.js'
import store from '../../core/store/index.js'
import useToast from '../../hooks/useToast.js'
import { Card, CardHead, Badge, Divider } from '../../ui/primitives/Display.jsx'
import { Input, Switch, Slider } from '../../ui/primitives/Input.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { RETURN_REASONS, NON_RETURNABLE_CATEGORIES } from '../../engines/returns/returnEngine.js'
import { inr } from '../../lib/analytics.js'

export default function ReturnPolicy() {
  const { policy } = useSlice('returns')
  const { success } = useToast()
  const set = (patch) => store.dispatch('returns/setPolicy', patch)

  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Card>
        <CardHead title="Return window & fees"
          subtitle="These values drive eligibility on the storefront and refund maths in the RMA queue." />
        <div className="space-y-4">
          <Slider label="Default return window" value={policy.windowDays}
            onChange={v => set({ windowDays: v })} min={0} max={30}
            format={v => v === 0 ? 'No returns' : `${v} days`} />
          <Slider label="Reverse pickup fee (customer fault)" value={policy.pickupFee}
            onChange={v => set({ pickupFee: v })} min={0} max={200} step={10} format={v => inr(v)} />
          <Slider label="Store credit bonus" value={policy.storeCreditBonusPct}
            onChange={v => set({ storeCreditBonusPct: v })} min={0} max={30}
            format={v => `+${v}%`} />
          <Slider label="QC partial-fail penalty" value={policy.qcPartialPenaltyPct}
            onChange={v => set({ qcPartialPenaltyPct: v })} min={0} max={100} step={5}
            format={v => `${v}% withheld`} />
        </div>
      </Card>

      <Card>
        <CardHead title="Automation" subtitle="Less manual triage on the low-risk majority." />
        <div className="space-y-3">
          <Switch label="Auto-approve trusted customers" checked={policy.autoApproveTrustedCustomers}
            onChange={v => set({ autoApproveTrustedCustomers: v })} />
          <Input label="Auto-approve returns under" type="number" prefix="₹" value={policy.autoApproveUnder}
            onChange={e => set({ autoApproveUnder: Number(e.target.value) })}
            hint="Low-value returns cost more to review than to approve" />
          <Divider />
          <Switch label="Require photos for damage claims" checked={policy.requirePhotoForDamage}
            onChange={v => set({ requirePhotoForDamage: v })} />
          <Switch label="Allow exchanges" checked={policy.exchangeAllowed}
            onChange={v => set({ exchangeAllowed: v })} />
          <Switch label="Instant refund for prepaid orders" checked={policy.instantRefundForPrepaid}
            onChange={v => set({ instantRefundForPrepaid: v })}
            />
          <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
            Instant refunds raise repeat-purchase rates but expose you to fraud on high-value items.
          </p>
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <CardHead title="Reason codes"
          subtitle="Fault decides who pays for pickup. Restockable decides whether the unit can be resold." />
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ background: 'var(--c-surface-alt)' }}>
                {['Reason', 'Fault', 'Window', 'Restockable', 'Photo required'].map(h => (
                  <th key={h} className="px-2.5 py-1.5 text-left text-[10px] uppercase tracking-wider font-semibold"
                    style={{ color: 'var(--c-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RETURN_REASONS.map(r => (
                <tr key={r.code} className="border-t" style={{ borderColor: 'var(--c-border)' }}>
                  <td className="px-2.5 py-2" style={{ color: 'var(--c-text)' }}>{r.label}</td>
                  <td className="px-2.5 py-2">
                    <Badge size="sm" tone={r.fault === 'seller' ? 'danger' : r.fault === 'courier' ? 'warning' : 'neutral'}>
                      {r.fault}
                    </Badge>
                  </td>
                  <td className="px-2.5 py-2 tabular-nums" style={{ color: 'var(--c-text-muted)' }}>{r.windowDays}d</td>
                  <td className="px-2.5 py-2">{r.restockable ? '✓' : '✗'}</td>
                  <td className="px-2.5 py-2">{r.requiresPhoto ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11.5px] mt-3" style={{ color: 'var(--c-text-muted)' }}>
          Never returnable: {NON_RETURNABLE_CATEGORIES.join(', ')} — hygiene and statutory restrictions.
        </p>
      </Card>
    </div>
  )
}
