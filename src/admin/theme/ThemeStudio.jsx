import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useTheme from '../../hooks/useTheme.js'
import useToast from '../../hooks/useToast.js'
import TokenControl from '../../theme/builder/TokenControl.jsx'
import TemplateGallery from '../../theme/builder/TemplateGallery.jsx'
import HeaderBuilder from '../../theme/builder/HeaderBuilder.jsx'
import FooterBuilder from '../../theme/builder/FooterBuilder.jsx'
import StorePreview from '../../theme/builder/StorePreview.jsx'
import { cx } from '../../ui/kit.jsx'

const TABS = [
  { id: 'templates', label: 'Templates', icon: '▦' },
  { id: 'brand', label: 'Brand', icon: '◈' },
  { id: 'colour', label: 'Colours', icon: '◐' },
  { id: 'typography', label: 'Type', icon: 'Aa' },
  { id: 'shape', label: 'Shape', icon: '▢' },
  { id: 'motion', label: 'Motion', icon: '✦' },
  { id: 'header', label: 'Header', icon: '▤' },
  { id: 'footer', label: 'Footer', icon: '▥' },
]

export default function ThemeStudio() {
  const theme = useTheme()
  const { success, error, info } = useToast()
  const [tab, setTab] = useState('templates')
  const [saveName, setSaveName] = useState('')
  const [showSave, setShowSave] = useState(false)
  const importRef = useRef(null)

  const group = theme.groups[tab]

  const doExport = () => {
    const json = theme.exportTheme()
    try {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bharatcart-theme-${theme.templateId}.json`
      a.click()
      URL.revokeObjectURL(url)
      success('Theme exported')
    } catch {
      navigator.clipboard?.writeText(json)
      info('Theme JSON copied to clipboard')
    }
  }

  const doImport = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const fr = new FileReader()
    fr.onload = () => {
      try {
        theme.importTheme(String(fr.result))
        success('Theme imported')
      } catch { error('That file is not a valid theme export') }
    }
    fr.readAsText(f)
    e.target.value = ''
  }

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------------- header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--c-text)' }}>
            Theme Studio
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
            Every change applies to the storefront instantly — {theme.templates.length} templates, {Object.keys(theme.meta).length} controls.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowSave(s => !s)}
            className="t-btn px-3 py-2 text-[12px] font-semibold border"
            style={{ borderColor: 'var(--c-border)', color: 'var(--c-text)' }}>
            Save theme
          </button>
          <button onClick={doExport}
            className="t-btn px-3 py-2 text-[12px] font-semibold border"
            style={{ borderColor: 'var(--c-border)', color: 'var(--c-text)' }}>
            Export
          </button>
          <button onClick={() => importRef.current?.click()}
            className="t-btn px-3 py-2 text-[12px] font-semibold border"
            style={{ borderColor: 'var(--c-border)', color: 'var(--c-text)' }}>
            Import
          </button>
          <input ref={importRef} type="file" accept="application/json" onChange={doImport} className="hidden" />
          <button onClick={() => { theme.resetAll(); info('Reset to template defaults') }}
            className="t-btn px-3 py-2 text-[12px] font-semibold"
            style={{ color: 'var(--c-danger)' }}>
            Reset
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showSave && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="t-card p-3 flex flex-wrap gap-2 items-center">
              <input value={saveName} onChange={e => setSaveName(e.target.value)}
                placeholder="Name this theme…"
                className="t-input flex-1 min-w-[180px] px-3 py-2 text-[13px]" />
              <button onClick={() => {
                theme.saveCustomTheme(saveName || undefined)
                setSaveName(''); setShowSave(false); success('Theme saved to your library')
              }}
                className="t-btn t-btn-primary px-4 py-2 text-[13px]">
                Save
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* contrast warnings */}
      {theme.contrastWarnings.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="t-card p-3 border-l-4" style={{ borderLeftColor: 'var(--c-warning)' }}>
          <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--c-text)' }}>
            Readability check
          </p>
          {theme.contrastWarnings.map(w => (
            <p key={w.label} className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
              <span className="font-medium">{w.label}</span> — contrast {w.ratio}:1 (WCAG wants 4.5:1)
            </p>
          ))}
        </motion.div>
      )}

      {/* ---------------------------------------------------------- tabs */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar pb-0.5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cx('relative px-3 py-2 text-[12px] font-semibold rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5')}
            style={tab === t.id ? { color: 'var(--c-primary-fg)' } : { color: 'var(--c-text-muted)' }}>
            {tab === t.id && (
              <motion.div layoutId="themetab" transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="absolute inset-0 rounded-lg" style={{ background: 'var(--c-primary)' }} />
            )}
            <span className="relative">{t.icon}</span>
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ---------------------------------------------------------- body */}
      <div className="grid lg:grid-cols-[minmax(0,340px)_1fr] gap-4 items-start">
        {/* left: controls */}
        <div className="t-card p-4 lg:sticky lg:top-4 max-h-[calc(100vh-7rem)] overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div key={tab}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.18 }}>

              {tab === 'templates' && (
                <TemplateGallery
                  templates={theme.templates}
                  activeId={theme.templateId}
                  onApply={(id) => { theme.applyTemplate(id); success(`Applied “${theme.templates.find(t => t.id === id)?.name}”`) }}
                  customThemes={theme.customThemes}
                  onApplyCustom={(id) => { theme.applyCustomTheme(id); success('Custom theme applied') }}
                  onDeleteCustom={(id) => { theme.deleteCustomTheme(id); info('Theme deleted') }}
                />
              )}

              {tab === 'header' && <HeaderBuilder theme={theme} />}
              {tab === 'footer' && <FooterBuilder theme={theme} />}

              {group && (
                <div>
                  <h3 className="text-[13px] font-semibold mb-1" style={{ color: 'var(--c-text)' }}>
                    {group.label}
                  </h3>
                  <p className="text-[11px] mb-2" style={{ color: 'var(--c-text-muted)' }}>
                    {Object.keys(group.tokens).length} controls
                  </p>
                  {Object.entries(group.tokens).map(([key, meta]) => (
                    <TokenControl
                      key={key}
                      tokenKey={key}
                      meta={meta}
                      value={theme.tokens[key]}
                      overridden={key in theme.overrides}
                      onChange={(v) => theme.setToken(key, v)}
                      onReset={() => theme.resetToken(key)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* right: live preview */}
        <StorePreview theme={theme} />
      </div>
    </div>
  )
}
