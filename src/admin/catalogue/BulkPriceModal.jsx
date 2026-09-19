import React, { useState, useMemo } from 'react'
import store from '../../core/store/index.js'
import useToast from '../../hooks/useToast.js'
import { Modal, Badge } from '../../ui/primitives/Display.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select, Switch } from '../../ui/primitives/Input.jsx'
import { previewBulkPrice } from '../../engines/pricing/priceEngine.js'
import { inr } from '../../lib/analytics.js'

const MODES = [
  { value: 'decrease_pct', label: 'Decrease by %' },
  { value: 'increase_pct', label: 'Increase by %' },
  { value: 'decrease_amt', label: 'Decrease by ₹' },
  { value: 'increase_amt', label: 'Increase by ₹' },
  { value: 'set_fixed', label: 'Set fixed price' },
  { value: 'margin_target', label: 'Target net margin %' },
  { value: 'mrp_discount', label: '% off MRP' },
]

export default function BulkPriceModal({ open, onClose, products = [] }) {
  const { success } = useToast()
  const [mode, setMode] = useState('decrease_pct')
  const [value, setValue] = useState(10)
  const [charm, setCharm] = useState(true)
  const [floor, setFloor] = useState(true)

  const preview = useMemo(
    () => previewBulkPrice(products, { mode, value, charm: charm ? '99' : null, respectMarginFloor: floor }),
    [products, mode, value, charm, floor]
  )

  return (
    <Modal open={open} onClose={onClose} title={`Bulk price · ${products.length} products`} size="lg"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" disabled={!preview.changes.length}
          onClick={() => {
            store.dispatch('catalogue/applyBulkPrice', preview.changes)
            success(`${preview.changes.length} prices updated`)
            onClose?.()
          }}>
          Apply to {preview.changes.length}
        </Button>
      </>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Rule" value={mode} onChange={e => setMode(e.target.value)} options={MODES} />
          <Input label="Value" type="number" value={value} onChange={e => setValue(Number(e.target.value))}
            prefix={mode.includes('amt') || mode === 'set_fixed' ? '₹' : ''}
            suffix={mode.includes('pct') || mode.includes('margin') || mode.includes('discount') ? '%' : ''} />
        </div>

        <div className="flex flex-wrap gap-4">
          <Switch label="Round to …99" checked={charm} onChange={setCharm} size="sm" />
          <Switch label="Block below-cost prices" checked={floor} onChange={setFloor} size="sm" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Summary label="Will change" value={preview.changes.length} />
          <Summary label="Skipped" value={preview.skipped.length} tone={preview.skipped.length ? 'warning' : undefined} />
          <Summary label="Revenue delta" value={inr(preview.revenueImpact)}
            tone={preview.revenueImpact >= 0 ? 'success' : 'danger'} raw />
        </div>

        <div className="max-h-64 overflow-y-auto rounded-lg border" style={{ borderColor: 'var(--c-border)' }}>
          <table className="w-full text-[12px]">
            <thead className="sticky top-0" style={{ background: 'var(--c-surface-alt)' }}>
              <tr>
                {['Product', 'Now', 'New', 'Δ', 'Margin'].map((h, i) => (
                  <th key={h} className={`px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-semibold ${i ? 'text-right' : 'text-left'}`}
                    style={{ color: 'var(--c-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.changes.slice(0, 80).map(c => (
                <tr key={c.id} className="border-t" style={{ borderColor: 'var(--c-border)' }}>
                  <td className="px-2.5 py-1.5 max-w-[200px] truncate" style={{ color: 'var(--c-text)' }}>{c.name}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums" style={{ color: 'var(--c-text-muted)' }}>{inr(c.from)}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums font-semibold" style={{ color: 'var(--c-text)' }}>{inr(c.to)}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums"
                    style={{ color: c.to >= c.from ? 'var(--c-success)' : 'var(--c-danger)' }}>
                    {c.to >= c.from ? '+' : ''}{inr(c.to - c.from)}
                  </td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">
                    <Badge tone={c.newMarginPct >= 20 ? 'success' : c.newMarginPct >= 8 ? 'warning' : 'danger'} size="sm">
                      {c.newMarginPct}%
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!preview.changes.length && (
            <p className="text-center py-6 text-[12px]" style={{ color: 'var(--c-text-muted)' }}>
              No products would change with this rule.
            </p>
          )}
        </div>

        {preview.skipped.length > 0 && (
          <p className="text-[11px]" style={{ color: 'var(--c-warning)' }}>
            ⚠ {preview.skipped.length} skipped — the new price would fall below cost.
          </p>
        )}
      </div>
    </Modal>
  )
}

function Summary({ label, value, tone, raw }) {
  const colour = { success: 'var(--c-success)', warning: 'var(--c-warning)', danger: 'var(--c-danger)' }[tone] || 'var(--c-text)'
  return (
    <div className="t-card p-2.5" style={{ background: 'var(--c-surface-alt)' }}>
      <p className="text-[9.5px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-text-muted)' }}>{label}</p>
      <p className="text-[15px] font-bold tabular-nums" style={{ color: colour }}>{raw ? value : value}</p>
    </div>
  )
}
