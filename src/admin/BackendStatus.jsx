import React, { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { backendInfo, resetBackend } from '../engines/backend/index.js'

/**
 * Backend status pill for the admin sidebar.
 *
 * Shows which database the store's data actually lives in right now — cloud
 * provider, local dev storage, or "selected but misconfigured" — and links to
 * Admin → Integrations → Database where it is fixed. Read-only: it never
 * displays credential values, only the honest state from backendInfo().
 */
export default function BackendStatus() {
  const nav = useNavigate()
  const [info, setInfo] = useState(() => backendInfo())

  const refresh = useCallback(() => {
    resetBackend()
    setInfo(backendInfo())
  }, [])

  const tone = info.misconfigured
    ? { dot: '#f43f5e', text: 'Backend misconfigured', glow: 'glow-err' }
    : info.isDevOnly
      ? { dot: '#f59e0b', text: 'Local dev storage', glow: 'glow-warn' }
      : { dot: '#34d399', text: info.providerName || info.label, glow: 'glow-ok' }

  return (
    <button
      type="button"
      onClick={() => nav('/admin/integrations')}
      onMouseEnter={refresh}
      title={`${info.detail} — open Integrations → Database`}
      className={`pressable focus-ring w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left ${tone.glow}`}
    >
      <span
        aria-hidden="true"
        className="pulse-dot w-2 h-2 rounded-full shrink-0"
        style={{ background: tone.dot, color: tone.dot, boxShadow: `0 0 8px ${tone.dot}` }}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold text-slate-200 truncate leading-tight">
          {tone.text}
        </span>
        <span className="block text-[9px] text-slate-500 truncate leading-tight">
          {info.misconfigured ? 'tap to fix' : info.isDevOnly ? 'tap to connect cloud DB' : 'database · tap to manage'}
        </span>
      </span>
      <span aria-hidden="true" className="text-slate-600 text-[12px] shrink-0">🗄</span>
    </button>
  )
}
