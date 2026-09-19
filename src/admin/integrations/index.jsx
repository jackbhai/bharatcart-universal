import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import DataTable from '../../ui/patterns/DataTable.jsx'
import KpiRow from '../../ui/patterns/KpiRow.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Checkbox, Radio } from '../../ui/primitives/Input.jsx'
import { Badge, Card, CardHead, Tabs, Empty, Divider, Drawer } from '../../ui/primitives/Display.jsx'
import { PROVIDER_CATEGORIES } from '../../engines/integrations/providers.js'
import {
  getProviders, getProvider, getIntegrationConfig, setIntegrationConfig,
  clearIntegration, isConfigured, getEnvStatus, getEffectiveValue,
  getWebhooks, addWebhook, removeWebhook, recordWebhookTest,
} from '../../engines/integrations/store.js'
import { WEBHOOK_EVENTS, samplePayload } from '../../engines/integrations/integrationEngine.js'

const TABS = [
  ...PROVIDER_CATEGORIES.map(c => ({ id: c.id, label: c.label, icon: c.icon })),
  { id: 'webhooks', label: 'Webhooks', icon: '⇄' },
  { id: 'backend', label: 'Backend API', icon: '⚿' },
]

const CATEGORY_IDS = PROVIDER_CATEGORIES.map(c => c.id)
const isSecret = (f) => f.secret === true || f.type === 'password'
const day = (ts) => (ts ? new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

export default function Integrations() {
  const [tab, setTab] = useState('database')
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  const kpis = useMemo(() => {
    const configured = CATEGORY_IDS.filter(isConfigured).length
    const hooks = getWebhooks()
    // Real count: how many secret env vars are actually present in this build.
    let secretsSet = 0, secretsTotal = 0
    for (const cat of CATEGORY_IDS) {
      for (const p of getProviders(cat)) {
        for (const f of p.fields ?? []) {
          if (isSecret(f) && f.envVar) {
            secretsTotal += 1
            if (getEnvStatus(f.envVar) === 'set') secretsSet += 1
          }
        }
      }
    }
    return { configured, hooks: hooks.length, secretsSet, secretsTotal }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow">Connections</p>
        <h1 className="text-xl font-bold mt-1" style={{ color: 'var(--c-text)' }}>Integrations</h1>
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          Connect this store to real services with your own credentials. Nothing here is pre-connected —
          a provider shows as configured only after you supply its values. Secrets live in environment
          variables, never in the browser.
        </p>
      </div>

      <KpiRow columns={4} items={[
        { label: 'Categories configured', value: `${kpis.configured}/${CATEGORY_IDS.length}`, tone: kpis.configured ? 'success' : 'neutral', icon: '⊞' },
        { label: 'Webhooks', value: kpis.hooks, sub: 'your endpoints', tone: 'neutral', icon: '⇄' },
        { label: 'Secrets in env', value: `${kpis.secretsSet}/${kpis.secretsTotal}`, sub: 'VITE_ vars present', tone: kpis.secretsSet ? 'success' : 'neutral', icon: '⚿' },
        { label: 'Providers available', value: PROVIDER_CATEGORIES.reduce((n, c) => n + getProviders(c.id).length, 0), sub: 'across 8 categories', tone: 'neutral', icon: '✦' },
      ]} />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab + refreshKey} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'webhooks' && <WebhooksPanel onChange={refresh} />}
          {tab === 'backend' && <BackendApiPanel />}
          {CATEGORY_IDS.includes(tab) && <CategoryPanel key={tab} category={tab} onChange={refresh} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------ Category panel */

function providerStatus(category, provider) {
  const { providerId } = getIntegrationConfig(category)
  if (providerId !== provider.id) return { label: 'Not connected', tone: 'neutral' }
  if (isConfigured(category)) return { label: 'Configured', tone: 'success' }
  return { label: 'Incomplete', tone: 'warn' }
}

function CategoryPanel({ category, onChange }) {
  const cat = PROVIDER_CATEGORIES.find(c => c.id === category)
  const providers = getProviders(category)
  const [selected, setSelected] = useState(null) // provider being configured in the drawer

  return (
    <div className="space-y-3">
      <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>{cat?.blurb}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {providers.map((p, i) => {
          const st = providerStatus(category, p)
          const statusGlow = st.tone === 'success' ? 'glow-ok' : st.tone === 'warn' ? 'glow-err' : ''
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 6) * 0.035, duration: 0.25 }} whileHover={{ y: -2 }}
              className={`rounded-2xl ${statusGlow}`}>
              <Card className="h-full cursor-pointer" onClick={() => setSelected(p)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-[13px]">{p.name}</div>
                  <Badge tone={st.tone} size="sm" dot={st.tone === 'success'}>{st.label}</Badge>
                </div>
                <p className="text-[11.5px] mt-1" style={{ color: 'var(--c-text-muted)' }}>{p.tagline}</p>
                <div className="text-[11px] mt-2 pt-2 flex items-center justify-between"
                  style={{ borderTop: '1px solid var(--c-border)', color: 'var(--c-text-muted)' }}>
                  <span>{p.fields.length === 0 ? 'No setup needed' : `${p.fields.length} setting${p.fields.length > 1 ? 's' : ''}`}</span>
                  <a href={p.docsUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                    className="underline">Docs</a>
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>

      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)}
        title={selected ? `${selected.name} — ${cat?.label}` : ''} width={520}>
        {selected && (
          <ConfigureForm
            key={selected.id}
            category={category}
            initialProviderId={selected.id}
            onDone={() => { setSelected(null); onChange() }}
          />
        )}
      </Drawer>
    </div>
  )
}

function ConfigureForm({ category, initialProviderId, onDone }) {
  const providers = getProviders(category)
  const saved = getIntegrationConfig(category)
  const [providerId, setProviderId] = useState(saved.providerId ?? initialProviderId)
  const [values, setValues] = useState(() => ({ ...(saved.config ?? {}) }))
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState(null)

  const def = getProvider(category, providerId)
  const setVal = (k, v) => { setValues(prev => ({ ...prev, [k]: v })); setResult(null) }

  const pickProvider = (id) => {
    setProviderId(id)
    const s = getIntegrationConfig(category)
    setValues(s.providerId === id ? { ...(s.config ?? {}) } : {})
    setResult(null)
  }

  const effectiveValues = useMemo(() => {
    const out = {}
    for (const f of def?.fields ?? []) out[f.key] = getEffectiveValue(f, values)
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, values])

  const runTest = async () => {
    if (!def) return
    setTesting(true)
    setResult(null)
    try {
      const r = await def.testConnection(effectiveValues)
      setResult({ ok: Boolean(r?.ok), message: String(r?.message ?? 'No result returned.') })
    } catch (e) {
      setResult({ ok: false, message: `Test failed to run: ${e?.message ?? e}` })
    } finally {
      setTesting(false)
    }
  }

  const save = () => {
    setIntegrationConfig(category, providerId, values) // store strips secrets
    onDone()
  }

  const disconnect = () => {
    clearIntegration(category)
    onDone()
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {providers.map(p => (
          <div key={p.id}
            className="rounded-[var(--radius-sm)] px-2.5 py-2 transition-colors"
            style={{ background: providerId === p.id ? 'var(--c-surface-2, rgba(0,0,0,0.04))' : 'transparent' }}>
            <Radio checked={providerId === p.id} onChange={() => pickProvider(p.id)}
              label={p.name} description={p.tagline} />
          </div>
        ))}
      </div>

      <Divider />

      {(def?.fields ?? []).length === 0 && (
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          {def?.tagline} Nothing to configure — save to select it for {category}.
        </p>
      )}

      <div className="space-y-3">
        {(def?.fields ?? []).map(f => isSecret(f) ? (
          <SecretField key={f.key} field={f} />
        ) : (
          <Input key={f.key}
            label={f.label}
            required={f.required}
            type={f.type === 'url' ? 'url' : 'text'}
            placeholder={f.help?.split('.')[0]}
            value={values[f.key] ?? ''}
            onChange={e => setVal(f.key, e.target.value)}
            hint={f.envVar ? `${f.help ?? ''} Env: ${f.envVar} (env wins over this value).` : f.help}
          />
        ))}
      </div>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: -6, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: .98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className={`rounded-[var(--radius-sm)] px-3 py-2.5 text-[12.5px] ${result.ok ? 'glow-ok' : 'glow-err'}`}
            style={{
              background: result.ok ? 'var(--c-success-bg, rgba(22,163,74,0.08))' : 'var(--c-danger-bg, rgba(220,38,38,0.08))',
              border: `1px solid ${result.ok ? 'var(--c-success, #16a34a)' : 'var(--c-danger, #dc2626)'}`,
              color: 'var(--c-text)',
            }}>
            <motion.span key={String(result.ok)} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 520, damping: 16 }}
              className="inline-block font-semibold">{result.ok ? '✓ ' : '✕ '}</motion.span>{result.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 flex-wrap pt-1">
        <Button size="sm" variant="primary" onClick={save}>Save</Button>
        <Button size="sm" variant="ghost" onClick={runTest} loading={testing} disabled={!def}>
          {testing ? 'Testing…' : 'Test connection'}
        </Button>
        {saved.providerId && (
          <Button size="sm" variant="ghost" onClick={disconnect}>Disconnect</Button>
        )}
      </div>
      <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
        Secrets are never stored in the browser — only non-secret values are saved here.
        This runs a real check against the provider; nothing is simulated.
      </p>
    </div>
  )
}

function SecretField({ field }) {
  const status = getEnvStatus(field.envVar)
  return (
    <div className="rounded-[var(--radius-sm)] p-3" style={{ border: '1px solid var(--c-border)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium" style={{ color: 'var(--c-text)' }}>
          {field.label}{field.required && <span style={{ color: 'var(--c-danger)' }}> *</span>}
        </span>
        <Badge tone={status === 'set' ? 'success' : 'neutral'} size="sm" dot={status === 'set'}>
          {status === 'set' ? 'Set' : 'Missing'}
        </Badge>
      </div>
      <div className="text-[11px] font-mono mt-1.5" style={{ color: 'var(--c-text-muted)' }}>{field.envVar}</div>
      <p className="text-[11px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
        {field.help} Add it to your <span className="font-mono">.env</span> file locally, or to
        Environment Variables in your Vercel/Netlify dashboard, then redeploy.
        This panel never asks for the value and never stores it.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------ Webhooks */

async function signPayload(secretHex, body) {
  const bytes = new Uint8Array(secretHex.match(/../g).map(h => parseInt(h, 16)))
  const key = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return 'sha256=' + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function WebhooksPanel({ onChange }) {
  const [hooks, setHooks] = useState(() => getWebhooks())
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState(['order.created'])
  const [error, setError] = useState('')
  const [sending, setSending] = useState(null)
  const [previewEvent, setPreviewEvent] = useState('order.created')
  const preview = useMemo(() => samplePayload(previewEvent), [previewEvent])

  const reload = () => { setHooks(getWebhooks()); onChange() }

  const toggleEvent = (e) => setEvents(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e])

  const add = () => {
    setError('')
    if (!/^https?:\/\/.+/.test(url.trim())) { setError('Enter a valid http(s) URL.'); return }
    if (events.length === 0) { setError('Select at least one event.'); return }
    try {
      addWebhook({ url: url.trim(), events })
      setUrl('')
      reload()
    } catch (e) { setError(e.message) }
  }

  const sendTest = async (hook) => {
    setSending(hook.id)
    const event = hook.events[0] ?? 'order.created'
    const body = JSON.stringify(samplePayload(event))
    try {
      const signature = await signPayload(hook.secret, body)
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BharatCart-Event': event,
          'X-BharatCart-Test': 'true',
          'X-BharatCart-Signature': signature,
        },
        body,
      })
      recordWebhookTest(hook.id, { ok: res.ok, httpStatus: res.status, error: res.ok ? null : `HTTP ${res.status}` })
    } catch {
      recordWebhookTest(hook.id, { ok: false, httpStatus: null, error: 'Network error — the endpoint did not answer, or the browser blocked it (CORS).' })
    } finally {
      setSending(null)
      reload()
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHead title="Your endpoints" subtitle="We POST signed JSON to these URLs. Starts empty — add your own." />
        <div className="flex gap-2 mt-2.5 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <Input placeholder="https://your-backend.in/hooks/bharatcart" value={url}
              onChange={e => setUrl(e.target.value)} />
          </div>
          <Button size="md" variant="primary" onClick={add}>Add endpoint</Button>
        </div>
        {error && <p className="text-[12px] mt-1.5" style={{ color: 'var(--c-danger)' }}>{error}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5">
          {WEBHOOK_EVENTS.map(e => (
            <Checkbox key={e} checked={events.includes(e)} onChange={() => toggleEvent(e)} label={e} />
          ))}
        </div>
      </Card>

      <Card padding={false}>
        <div className="p-3">
          <CardHead title="Endpoints" subtitle="Test deliveries report the real HTTP result — no fake statistics." />
        </div>
        {hooks.length === 0 ? (
          <div className="px-3 pb-3">
            <Empty icon="⇄" title="No webhooks yet"
              description="Add your endpoint above. Every delivery is a real signed POST; results are recorded here." />
          </div>
        ) : (
          <DataTable
            rows={hooks}
            rowKey="id"
            pageSize={10}
            expandable={h => (
              <div className="flex flex-wrap gap-1.5">
                {h.events.map(e => (
                  <span key={e} className="text-[11px] font-mono px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--c-surface-2, rgba(0,0,0,0.05))' }}>{e}</span>
                ))}
              </div>
            )}
            columns={[
              { key: 'url', label: 'Endpoint', render: h => (
                <span className="font-mono text-[11.5px] truncate max-w-[280px] inline-block" title={h.url}>{h.url}</span>
              ) },
              { key: 'events', label: 'Events', align: 'right', render: h => <span className="tabular-nums text-[12px]">{h.events.length}</span> },
              { key: 'lastTest', label: 'Last test', render: h => {
                if (!h.lastTest) return <span className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>Never tested</span>
                return h.lastTest.ok
                  ? <Badge tone="success" size="sm">✓ {h.lastTest.httpStatus ?? 'OK'}</Badge>
                  : <Badge tone="danger" size="sm" title={h.lastTest.error ?? ''}>
                      ✕ {h.lastTest.httpStatus ?? 'failed'}
                    </Badge>
              } },
              { key: 'createdAt', label: 'Added', render: h => <span className="text-[12px] tabular-nums">{day(h.createdAt)}</span> },
              { key: 'actions', label: '', align: 'right', render: h => (
                <div className="flex gap-1.5 justify-end">
                  <Button size="xs" variant="ghost" onClick={() => sendTest(h)}
                    loading={sending === h.id} disabled={sending !== null}>
                    {sending === h.id ? 'Sending…' : 'Send test event'}
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => { removeWebhook(h.id); reload() }}>Delete</Button>
                </div>
              ) },
            ]}
          />
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHead title="Available events" subtitle="Subscribe an endpoint to any combination of these." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5">
            {WEBHOOK_EVENTS.map(e => (
              <button key={e} onClick={() => setPreviewEvent(e)}
                className="text-left text-[11.5px] font-mono px-1.5 py-1 rounded transition-colors"
                style={{
                  background: previewEvent === e ? 'var(--c-surface-2, rgba(0,0,0,0.05))' : 'transparent',
                  color: previewEvent === e ? 'var(--c-primary)' : 'var(--c-text-muted)',
                }}>{e}</button>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="Test payload" subtitle={`What your endpoint receives for ${previewEvent} (signed with HMAC-SHA256).`} />
          <pre className="text-[11px] font-mono mt-1.5 p-3 rounded-[var(--radius-sm)] overflow-auto max-h-64"
            style={{ background: 'var(--c-surface-2, rgba(0,0,0,0.04))' }}>
            {JSON.stringify(preview, null, 2)}
          </pre>
        </Card>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- Backend API */

function BackendApiPanel() {
  const apiUrl = getEnvStatus('VITE_PAYMENTS_API_URL')
  const backend = getEnvStatus('VITE_BACKEND')
  return (
    <div className="space-y-3">
      <Card>
        <CardHead title="Backend API" subtitle="API keys are issued by your backend — not by this storefront." />
        <div className="text-[12.5px] space-y-2 mt-2" style={{ color: 'var(--c-text)' }}>
          <p>
            This is a static storefront. It holds no secrets and issues no API keys of its own.
            When you run a real backend (Supabase, Firebase, or your own server), <em>that</em> backend
            creates and revokes API keys for the mobile app, warehouse sync, and other clients.
          </p>
          <p style={{ color: 'var(--c-text-muted)' }}>
            What to build on your backend: order creation, payment signature verification,
            webhook receivers, and any endpoint the storefront calls. The full contract is in{' '}
            <span className="font-mono">docs/14-PRODUCTION.md</span> in the repository.
          </p>
        </div>
        <Divider label="Environment" />
        <div className="space-y-1.5">
          <EnvRow name="VITE_BACKEND" status={backend} hint="Which backend the app talks to: local | supabase | firebase | cloudflare." />
          <EnvRow name="VITE_PAYMENTS_API_URL" status={apiUrl} hint="Your server that creates payment orders and verifies signatures." />
        </div>
      </Card>
    </div>
  )
}

function EnvRow({ name, status, hint }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[var(--radius-sm)] px-2.5 py-2"
      style={{ background: 'var(--c-surface-2, rgba(0,0,0,0.03))' }}>
      <div>
        <div className="text-[12px] font-mono">{name}</div>
        <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{hint}</div>
      </div>
      <Badge tone={status === 'set' ? 'success' : 'neutral'} size="sm">{status === 'set' ? 'Set' : 'Missing'}</Badge>
    </div>
  )
}
