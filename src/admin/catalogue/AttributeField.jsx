import React from 'react'
import { Input, Textarea, Select, Switch, Checkbox, Label } from '../../ui/primitives/Input.jsx'

/**
 * AttributeField — renders one vertical attribute field definition × value.
 *
 * field: { key, label, type, options?, required?, unit?, hint?, section? }
 *   type: 'text' | 'number' | 'select' | 'date' | 'switch' | 'multiselect' | 'textarea' | 'color'
 * value: the current product.attributes[key]; onChange(next) writes it back.
 */
export default function AttributeField({ field, value, onChange }) {
  const label = `${field.label}${field.required ? ' *' : ''}`
  const hint = field.hint
  const Hint = hint
    ? () => <p className="text-[10.5px] mt-1" style={{ color: 'var(--c-text-muted)' }}>{hint}</p>
    : () => null

  switch (field.type) {
    case 'number':
      return (
        <div>
          <Input label={label} type="number" suffix={field.unit} value={value ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
          <Hint />
        </div>
      )

    case 'select':
      return (
        <div>
          <Select label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)}
            options={[{ value: '', label: 'Select…' }, ...(field.options || [])]} />
          <Hint />
        </div>
      )

    case 'date':
      return (
        <div>
          <Input label={label} type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} />
          <Hint />
        </div>
      )

    case 'switch':
      return (
        <div>
          <Switch label={label} checked={Boolean(value)} onChange={onChange} />
          <Hint />
        </div>
      )

    case 'multiselect': {
      const arr = Array.isArray(value) ? value : []
      return (
        <div>
          <Label required={field.required}>{field.label}</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {(field.options || []).map((o) => {
              const v = optValue(o)
              const on = arr.includes(v)
              return (
                <Checkbox key={String(v)} label={optLabel(o)} checked={on}
                  onChange={() => onChange(on ? arr.filter((x) => x !== v) : [...arr, v])} />
              )
            })}
          </div>
          <Hint />
        </div>
      )
    }

    case 'textarea':
      return (
        <div>
          <Textarea label={label} rows={field.rows ?? 3} value={value ?? ''}
            onChange={(e) => onChange(e.target.value)} />
          <Hint />
        </div>
      )

    case 'color': {
      const presets = (field.options || []).map((o) => {
        const s = String(optValue(o))
        return s.startsWith('#') ? { name: s, hex: s } : { name: optLabel(o), hex: '#888888' }
      })
      const isHex = /^#[0-9a-f]{6}$/i.test(value || '')
      return (
        <div>
          <Label required={field.required}>{field.label}</Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {presets.map((p) => (
              <button key={p.hex + p.name} type="button" title={p.name} onClick={() => onChange(p.hex)}
                className="w-7 h-7 rounded-full border-2 transition-all"
                style={{
                  background: p.hex,
                  borderColor: value === p.hex ? 'var(--c-primary)' : 'var(--c-border)',
                }} />
            ))}
            <label className="w-7 h-7 rounded-full border-2 border-dashed grid place-items-center cursor-pointer text-[14px] leading-none"
              style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-muted)' }} title="Custom colour">
              +
              <input type="color" className="sr-only"
                value={isHex ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
            </label>
            {value && (
              <span className="text-[11px] font-mono" style={{ color: 'var(--c-text-muted)' }}>{value}</span>
            )}
          </div>
          <Hint />
        </div>
      )
    }

    case 'text':
    default:
      return (
        <div>
          <Input label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder} />
          <Hint />
        </div>
      )
  }
}

const optValue = (o) => (o && typeof o === 'object' ? (o.value ?? o.name ?? o.id ?? '') : o)
const optLabel = (o) => (o && typeof o === 'object'
  ? (o.label ?? o.name ?? String(o.value ?? ''))
  : String(o))
