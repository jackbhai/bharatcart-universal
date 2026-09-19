import React, { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { cx } from '../../ui/kit.jsx'

/** Renders the right editor widget for any token type. */
export default function TokenControl({ tokenKey, meta, value, onChange, onReset, overridden }) {
  const { type, label } = meta

  return (
    <div className="py-2.5 border-b last:border-0" style={{ borderColor: 'var(--c-border)' }}>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <label className="text-[12px] font-medium flex items-center gap-1.5" style={{ color: 'var(--c-text)' }}>
          {label}
          {overridden && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--c-primary)' }} title="Customised" />
          )}
        </label>
        {overridden && (
          <button onClick={onReset} className="text-[10px] hover:underline" style={{ color: 'var(--c-text-muted)' }}>
            reset
          </button>
        )}
      </div>

      {type === 'colour' && <ColourInput value={value} onChange={onChange} />}
      {type === 'text' && <TextInput value={value} onChange={onChange} />}
      {type === 'number' && <NumberInput value={value} meta={meta} onChange={onChange} />}
      {type === 'select' && <SelectInput value={value} meta={meta} onChange={onChange} />}
      {type === 'bool' && <BoolInput value={value} onChange={onChange} />}
      {type === 'font' && <FontInput value={value} onChange={onChange} />}
      {type === 'image' && <ImageInput value={value} onChange={onChange} />}
    </div>
  )
}

/* ------------------------------------------------------------ colour */
const SWATCHES = [
  '#F97316','#EF4444','#EC4899','#A855F7','#6366F1','#3B82F6',
  '#06B6D4','#10B981','#84CC16','#EAB308','#F59E0B','#78716C',
  '#0F172A','#475569','#94A3B8','#E2E8F0','#FFFFFF','#000000',
]

function ColourInput({ value, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <label className="relative w-9 h-9 rounded-lg overflow-hidden border cursor-pointer shrink-0"
          style={{ borderColor: 'var(--c-border)' }}>
          <input type="color" value={toHex(value)} onChange={e => onChange(e.target.value)}
            className="absolute -inset-2 w-[200%] h-[200%] cursor-pointer" />
        </label>
        <input value={value || ''} onChange={e => onChange(e.target.value)}
          className="t-input flex-1 px-2.5 py-2 text-[12px] font-mono min-w-0" spellCheck={false} />
        <button onClick={() => setOpen(o => !o)}
          className="px-2 py-2 text-[11px] rounded-lg shrink-0"
          style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}>
          {open ? '▴' : '▾'}
        </button>
      </div>
      {open && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="grid grid-cols-9 gap-1.5 mt-2 overflow-hidden">
          {SWATCHES.map(c => (
            <button key={c} onClick={() => { onChange(c); setOpen(false) }}
              className="aspect-square rounded-md border hover:scale-110 transition-transform"
              style={{ background: c, borderColor: 'var(--c-border)' }} title={c} />
          ))}
        </motion.div>
      )}
    </div>
  )
}

const toHex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v)) ? v : '#000000')

/* -------------------------------------------------------------- text */
function TextInput({ value, onChange }) {
  return (
    <input value={value ?? ''} onChange={e => onChange(e.target.value)}
      className="t-input w-full px-2.5 py-2 text-[12px]" />
  )
}

/* ------------------------------------------------------------ number */
function NumberInput({ value, meta, onChange }) {
  const { min = 0, max = 100, step = 1, unit = '' } = meta
  return (
    <div className="flex items-center gap-2.5">
      <input type="range" min={min} max={max} step={step} value={Number(value) || 0}
        onChange={e => onChange(Number(e.target.value))} className="flex-1 min-w-0" />
      <div className="flex items-center gap-1 shrink-0">
        <input type="number" min={min} max={max} step={step} value={Number(value) || 0}
          onChange={e => onChange(Number(e.target.value))}
          className="t-input w-14 px-1.5 py-1 text-[11px] text-right tabular-nums" />
        {unit && <span className="text-[10px]" style={{ color: 'var(--c-text-muted)' }}>{unit}</span>}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ select */
function SelectInput({ value, meta, onChange }) {
  const opts = meta.options || []
  if (opts.length <= 5) {
    return (
      <div className="flex flex-wrap gap-1">
        {opts.map(o => (
          <button key={o} onClick={() => onChange(o)}
            className={cx('px-2.5 py-1.5 text-[11px] rounded-lg border capitalize transition-all')}
            style={value === o
              ? { background: 'var(--c-primary)', color: 'var(--c-primary-fg)', borderColor: 'var(--c-primary)' }
              : { background: 'var(--c-surface)', color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}>
            {o}
          </button>
        ))}
      </div>
    )
  }
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="t-input w-full px-2.5 py-2 text-[12px] capitalize">
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

/* -------------------------------------------------------------- bool */
function BoolInput({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      className="relative w-11 h-6 rounded-full transition-colors"
      style={{ background: value ? 'var(--c-primary)' : 'var(--c-border)' }}>
      <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
        style={{ left: value ? 22 : 2 }} />
    </button>
  )
}

/* -------------------------------------------------------------- font */
const FONTS = [
  ["'Inter', system-ui, sans-serif", 'Inter'],
  ["'Poppins', 'Inter', sans-serif", 'Poppins'],
  ["'Jost', 'Inter', sans-serif", 'Jost'],
  ["'Space Grotesk', 'Inter', sans-serif", 'Space Grotesk'],
  ["'IBM Plex Sans', 'Inter', sans-serif", 'IBM Plex Sans'],
  ["'Karla', 'Inter', sans-serif", 'Karla'],
  ["'Quicksand', 'Inter', sans-serif", 'Quicksand'],
  ["'Nunito', 'Inter', sans-serif", 'Nunito'],
  ["'Playfair Display', Georgia, serif", 'Playfair Display'],
  ["'Cormorant Garamond', Georgia, serif", 'Cormorant Garamond'],
  ["'Libre Baskerville', Georgia, serif", 'Libre Baskerville'],
  ["'Archivo Black', Impact, sans-serif", 'Archivo Black'],
  ["'JetBrains Mono', monospace", 'JetBrains Mono'],
]

function FontInput({ value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="t-input w-full px-2.5 py-2 text-[12px]" style={{ fontFamily: value }}>
      {FONTS.map(([v, l]) => <option key={v} value={v} style={{ fontFamily: v }}>{l}</option>)}
    </select>
  )
}

/* ------------------------------------------------------------- image */
function ImageInput({ value, onChange }) {
  const fileRef = useRef(null)
  const [err, setErr] = useState('')

  const pick = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 400 * 1024) { setErr('Please use an image under 400 KB'); return }
    const fr = new FileReader()
    fr.onload = () => { onChange(fr.result); setErr('') }
    fr.readAsDataURL(f)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {value
          ? <img src={value} alt="" className="w-9 h-9 rounded-lg object-contain border shrink-0"
              style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface-alt)' }} />
          : <div className="w-9 h-9 rounded-lg border grid place-items-center text-[10px] shrink-0"
              style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-muted)' }}>—</div>}
        <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder="Paste image URL"
          className="t-input flex-1 px-2.5 py-2 text-[11px] min-w-0" />
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => fileRef.current?.click()}
          className="flex-1 px-2 py-1.5 text-[11px] rounded-lg border"
          style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-muted)' }}>
          Upload
        </button>
        {value && (
          <button onClick={() => onChange('')}
            className="px-2 py-1.5 text-[11px] rounded-lg border"
            style={{ borderColor: 'var(--c-border)', color: 'var(--c-danger)' }}>
            Clear
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={pick} className="hidden" />
      {err && <p className="text-[10px]" style={{ color: 'var(--c-danger)' }}>{err}</p>}
    </div>
  )
}
