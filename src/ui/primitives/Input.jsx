import React, { forwardRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cx } from '../../lib/cx.js'

export const Input = forwardRef(function Input({
  label, hint, error, prefix, suffix, size = 'md', className, containerClassName, ...props
}, ref) {
  const pad = { sm: 'px-2.5 py-1.5 text-[12px]', md: 'px-3 py-2 text-[13px]', lg: 'px-3.5 py-2.5 text-[14px]' }[size]
  return (
    <div className={containerClassName}>
      {label && <Label>{label}</Label>}
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-2.5 text-[12px] pointer-events-none" style={{ color: 'var(--c-text-muted)' }}>{prefix}</span>}
        <input ref={ref} {...props}
          className={cx('t-input w-full', pad, prefix && 'pl-7', suffix && 'pr-9', className)}
          style={error ? { borderColor: 'var(--c-danger)' } : undefined} />
        {suffix && <span className="absolute right-2.5 text-[12px]" style={{ color: 'var(--c-text-muted)' }}>{suffix}</span>}
      </div>
      <FieldFoot hint={hint} error={error} />
    </div>
  )
})

export const Textarea = forwardRef(function Textarea({ label, hint, error, rows = 3, className, ...props }, ref) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <textarea ref={ref} rows={rows} {...props}
        className={cx('t-input w-full px-3 py-2 text-[13px] resize-y', className)}
        style={error ? { borderColor: 'var(--c-danger)' } : undefined} />
      <FieldFoot hint={hint} error={error} />
    </div>
  )
})

export const Select = forwardRef(function Select({ label, hint, error, options = [], children, className, ...props }, ref) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <select ref={ref} {...props} className={cx('t-input w-full px-3 py-2 text-[13px] cursor-pointer', className)}>
        {children || options.map((o, i) => {
          // Accept plain strings/numbers, {value,label}, or arbitrary records —
          // rendering an object as a child throws and blanks the whole screen.
          const isRecord = o !== null && typeof o === 'object'
          const value = isRecord ? (o.value ?? o.id ?? o.name ?? o.state ?? String(i)) : o
          const raw = isRecord ? (o.label ?? o.name ?? o.state ?? o.value ?? o.id) : o
          const lbl = raw !== null && typeof raw === 'object' ? String(value) : raw
          return <option key={`${value}-${i}`} value={value}>{lbl}</option>
        })}
      </select>
      <FieldFoot hint={hint} error={error} />
    </div>
  )
})

export function Label({ children, required }) {
  return (
    <label className="text-[12px] font-medium block mb-1.5" style={{ color: 'var(--c-text)' }}>
      {children}{required && <span style={{ color: 'var(--c-danger)' }}> *</span>}
    </label>
  )
}

function FieldFoot({ hint, error }) {
  return (
    <AnimatePresence mode="wait">
      {(error || hint) && (
        <motion.p key={error ? 'e' : 'h'}
          initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="text-[11px] mt-1"
          style={{ color: error ? 'var(--c-danger)' : 'var(--c-text-muted)' }}>
          {error || hint}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

export function Switch({ checked, onChange, label, size = 'md', disabled }) {
  const dim = size === 'sm' ? { w: 36, h: 20, k: 16 } : { w: 44, h: 24, k: 20 }
  return (
    <button type="button" onClick={() => !disabled && onChange?.(!checked)} disabled={disabled}
      className={cx('flex items-center gap-2.5', disabled && 'opacity-50 cursor-not-allowed')}>
      <span className="relative rounded-full transition-colors shrink-0"
        style={{ width: dim.w, height: dim.h, background: checked ? 'var(--c-primary)' : 'var(--c-border)' }}>
        <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className="absolute top-0.5 rounded-full bg-white shadow"
          style={{ width: dim.k, height: dim.k, left: checked ? dim.w - dim.k - 2 : 2 }} />
      </span>
      {label && <span className="text-[12.5px]" style={{ color: 'var(--c-text)' }}>{label}</span>}
    </button>
  )
}

export function Checkbox({ checked, onChange, label, indeterminate }) {
  return (
    <button type="button" onClick={() => onChange?.(!checked)} className="flex items-center gap-2 text-left">
      <span className="w-4 h-4 rounded grid place-items-center shrink-0 transition-colors border"
        style={{
          background: checked || indeterminate ? 'var(--c-primary)' : 'transparent',
          borderColor: checked || indeterminate ? 'var(--c-primary)' : 'var(--c-border)',
        }}>
        {indeterminate
          ? <span className="w-2 h-0.5 rounded-full bg-white" />
          : checked && <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>}
      </span>
      {label && <span className="text-[12.5px]" style={{ color: 'var(--c-text)' }}>{label}</span>}
    </button>
  )
}

export function Radio({ checked, onChange, label, description }) {
  return (
    <button type="button" onClick={() => onChange?.(true)} className="flex items-start gap-2.5 text-left w-full">
      <span className="w-4 h-4 rounded-full grid place-items-center shrink-0 mt-0.5 border-2 transition-colors"
        style={{ borderColor: checked ? 'var(--c-primary)' : 'var(--c-border)' }}>
        {checked && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="w-2 h-2 rounded-full" style={{ background: 'var(--c-primary)' }} />}
      </span>
      <span className="min-w-0">
        <span className="text-[12.5px] block" style={{ color: 'var(--c-text)' }}>{label}</span>
        {description && <span className="text-[11px] block" style={{ color: 'var(--c-text-muted)' }}>{description}</span>}
      </span>
    </button>
  )
}

export function Slider({ value, onChange, min = 0, max = 100, step = 1, label, format }) {
  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <Label>{label}</Label>
          <span className="text-[12px] tabular-nums font-medium" style={{ color: 'var(--c-primary)' }}>
            {format ? format(value) : value}
          </span>
        </div>
      )}
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange?.(Number(e.target.value))} className="w-full" />
    </div>
  )
}

export function RangeSlider({ value = [0, 100], onChange, min = 0, max = 100, step = 1, format }) {
  const [lo, hi] = value
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[12px]" style={{ color: 'var(--c-text-muted)' }}>
        <span>{format ? format(lo) : lo}</span>
        <span>{format ? format(hi) : hi}</span>
      </div>
      <div className="relative h-1 rounded-full" style={{ background: 'var(--c-border)' }}>
        <div className="absolute h-1 rounded-full" style={{
          background: 'var(--c-primary)',
          left: `${((lo - min) / (max - min)) * 100}%`,
          right: `${100 - ((hi - min) / (max - min)) * 100}%`,
        }} />
      </div>
      <div className="flex gap-2">
        <input type="range" min={min} max={max} step={step} value={lo}
          onChange={e => onChange?.([Math.min(Number(e.target.value), hi), hi])} className="flex-1" />
        <input type="range" min={min} max={max} step={step} value={hi}
          onChange={e => onChange?.([lo, Math.max(Number(e.target.value), lo)])} className="flex-1" />
      </div>
    </div>
  )
}

export default Input
