import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSlice } from '../../hooks/useStore.js'
import store from '../../core/store/index.js'

const ICONS = { success: '✓', error: '✕', warning: '!', info: 'i' }
const COLOURS = {
  success: 'var(--c-success)',
  error: 'var(--c-danger)',
  warning: 'var(--c-warning)',
  info: 'var(--c-info)',
}

export default function ToastHost() {
  const { toasts } = useSlice('ui')

  return (
    /* A live region, so confirmations and errors are announced rather than
       being purely visual. "polite" waits for a pause in speech; errors below
       escalate to "assertive" because a failed payment should interrupt. */
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="false"
      className="fixed z-[200] bottom-4 left-1/2 -translate-x-1/2 flex flex-col-reverse gap-2 pointer-events-none w-[calc(100%-2rem)] max-w-sm">
      <AnimatePresence mode="popLayout">
        {toasts.map(t => <Toast key={t.id} t={t} />)}
      </AnimatePresence>
    </div>
  )
}

function Toast({ t }) {
  useEffect(() => {
    if (!t.duration) return
    const id = setTimeout(() => store.dispatch('ui/dismissToast', t.id), t.duration)
    return () => clearTimeout(id)
  }, [t.id, t.duration])

  const colour = COLOURS[t.type] || COLOURS.info

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: .92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: .92, transition: { duration: .15 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      role={t.type === 'error' ? 'alert' : 'status'}
      aria-live={t.type === 'error' ? 'assertive' : 'polite'}
      className="pointer-events-auto flex items-start gap-2.5 px-3.5 py-3 rounded-xl shadow-2xl border backdrop-blur-xl"
      style={{
        background: 'color-mix(in srgb, var(--c-surface) 92%, transparent)',
        borderColor: 'var(--c-border)',
      }}
    >
      <span className="w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold shrink-0 mt-px"
        style={{ background: colour, color: '#fff' }}>
        {ICONS[t.type] || ICONS.info}
      </span>
      <div className="flex-1 min-w-0">
        {t.title && <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--c-text)' }}>{t.title}</p>}
        <p className="text-[12.5px] leading-snug" style={{ color: t.title ? 'var(--c-text-muted)' : 'var(--c-text)' }}>
          {t.message}
        </p>
      </div>
      <button onClick={() => store.dispatch('ui/dismissToast', t.id)}
        className="text-[14px] leading-none shrink-0 px-0.5 hover:opacity-100 opacity-40 transition-opacity"
        style={{ color: 'var(--c-text)' }}>
        ×
      </button>
      {t.duration && (
        <motion.span
          initial={{ scaleX: 1 }} animate={{ scaleX: 0 }}
          transition={{ duration: t.duration / 1000, ease: 'linear' }}
          className="absolute bottom-0 left-0 right-0 h-0.5 origin-left rounded-b-xl"
          style={{ background: colour, opacity: .5 }} />
      )}
    </motion.div>
  )
}
