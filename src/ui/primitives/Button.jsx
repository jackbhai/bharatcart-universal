import React, { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { cx } from '../../lib/cx.js'

const SIZES = {
  xs: 'px-2 py-1 text-[11px] gap-1',
  sm: 'px-2.5 py-1.5 text-[12px] gap-1.5',
  md: 'px-3.5 py-2 text-[13px] gap-2',
  lg: 'px-5 py-2.5 text-[14px] gap-2',
  xl: 'px-6 py-3 text-[15px] gap-2.5',
}

const Button = forwardRef(function Button({
  variant = 'primary', size = 'md', loading, disabled, icon, iconRight,
  full, className, children, as: Tag = motion.button, ...props
}, ref) {
  const style = {
    primary: { background: 'var(--c-primary)', color: 'var(--c-primary-fg)', border: 'none' },
    secondary: { background: 'var(--c-secondary)', color: '#fff', border: 'none' },
    soft: { background: 'var(--c-primary-soft)', color: 'var(--c-primary)', border: 'none' },
    outline: { background: 'transparent', color: 'var(--c-text)', border: 'var(--border-w) solid var(--c-border)' },
    ghost: { background: 'transparent', color: 'var(--c-text-muted)', border: 'none' },
    danger: { background: 'var(--c-danger)', color: '#fff', border: 'none' },
    success: { background: 'var(--c-success)', color: '#fff', border: 'none' },
    dark: { background: 'var(--c-text)', color: 'var(--c-surface)', border: 'none' },
  }[variant]

  return (
    <Tag
      ref={ref}
      disabled={disabled || loading}
      /*
       * Hover and press feedback on the shared primitive, so every button in
       * the app gets it rather than the seven that happened to hand-roll it.
       *
       * The values are small on purpose. An operator processing orders clicks
       * these thousands of times a shift; a button that visibly jumps is
       * charming for a day and irritating by Friday. Disabled and loading
       * buttons get nothing, because responding to a press that will not do
       * anything is a lie.
       */
      whileHover={disabled || loading ? undefined : { scale: 1.02, y: -1 }}
      whileTap={disabled || loading ? undefined : { scale: 0.975, y: 0 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      className={cx('t-btn inline-flex items-center justify-center font-semibold select-none',
        'disabled:opacity-50 disabled:cursor-not-allowed transition-all',
        SIZES[size], full && 'w-full', className)}
      style={{ ...style, borderRadius: 'var(--radius-sm)' }}
      {...props}
    >
      {loading && <Spinner />}
      {!loading && icon}
      {children}
      {iconRight}
    </Tag>
  )
})

function Spinner() {
  return (
    <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
  )
}

export default Button
