import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import DataTable from '../../ui/patterns/DataTable.jsx'
import KpiRow from '../../ui/patterns/KpiRow.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select, Switch, Checkbox } from '../../ui/primitives/Input.jsx'
import { Badge, Card, CardHead, Tabs, Avatar, Empty, Divider, Modal } from '../../ui/primitives/Display.jsx'
import {
  STAFF, staffKpis, securityReview, auditLog,
  ROLE_TEMPLATES, ROLE_IDS, PERMISSIONS, PERMISSION_KEYS,
  can, permissionsByGroup, roleDiff,
} from '../../engines/people/peopleEngine.js'

const TABS = [
  { id: 'staff', label: 'Staff', icon: '☺' },
  { id: 'roles', label: 'Roles', icon: '⚿' },
  { id: 'audit', label: 'Audit log', icon: '▤' },
  { id: 'security', label: 'Security', icon: '⛨' },
]

const when = (ts) => {
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 60) return mins + 'm ago'
  if (mins < 1440) return Math.round(mins / 60) + 'h ago'
  return Math.round(mins / 1440) + 'd ago'
}

export default function People() {
  const [tab, setTab] = useState('staff')
  const kpis = useMemo(() => staffKpis(), [])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>People &amp; access</h1>
          <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
            Who works here, exactly what each of them can do, and a record of who changed what.
          </p>
        </div>
        <Button variant="primary" size="sm">＋ Invite teammate</Button>
      </div>

      <KpiRow columns={5} items={[
        { label: 'Team', value: kpis.total, sub: `${kpis.active} active`, icon: '☺' },
        { label: 'Invited', value: kpis.invited, sub: 'not yet accepted', tone: kpis.invited ? 'info' : 'neutral', icon: '✉' },
        { label: 'Suspended', value: kpis.suspended, tone: kpis.suspended ? 'warn' : 'neutral', icon: '⏸' },
        { label: 'No 2FA', value: kpis.withoutTwoFactor, sub: 'active accounts', tone: kpis.withoutTwoFactor ? 'danger' : 'success', icon: '⛨' },
        { label: 'Owners', value: kpis.owners, sub: 'full access', tone: kpis.owners === 1 ? 'warn' : 'neutral', icon: '★' },
      ]} />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'staff' && <StaffList />}
          {tab === 'roles' && <Roles />}
          {tab === 'audit' && <Audit />}
          {tab === 'security' && <Security kpis={kpis} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------------ Staff */

function StaffList() {
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return STAFF.filter(s => (role === 'all' || s.role === role)
      && (!needle || s.name.toLowerCase().includes(needle) || s.email.toLowerCase().includes(needle)))
  }, [q, role])

  return (
    <Card padding={false}>
      <div className="p-3 flex gap-2 flex-wrap items-center">
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or email"
          className="!w-auto flex-1 min-w-[180px]" />
        <Select value={role} onChange={e => setRole(e.target.value)} className="!w-auto"
          options={[{ value: 'all', label: 'All roles' }, ...ROLE_IDS.map(r => ({ value: r, label: ROLE_TEMPLATES[r].name }))]} />
      </div>
      <DataTable
        rows={rows}
        rowKey="id"
        pageSize={12}
        columns={[
          { key: 'name', label: 'Person', render: s => (
            <div className="flex items-center gap-2.5">
              <Avatar name={s.name} size={30} />
              <div>
                <div className="font-semibold text-[12.5px]">{s.name}</div>
                <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{s.email}</div>
              </div>
            </div>
          ) },
          { key: 'role', label: 'Role', render: s => (
            <Badge tone={ROLE_TEMPLATES[s.role]?.tone ?? 'neutral'} size="sm">{ROLE_TEMPLATES[s.role]?.name ?? s.role}</Badge>
          ) },
          { key: 'status', label: 'Status', render: s => (
            <Badge tone={s.status === 'Active' ? 'success' : s.status === 'Invited' ? 'info' : 'warn'} size="sm">{s.status}</Badge>
          ) },
          { key: 'twoFactor', label: '2FA', render: s => (
            s.twoFactor
              ? <Badge tone="success" size="sm" dot>On</Badge>
              : <Badge tone="danger" size="sm" dot>Off</Badge>
          ) },
          { key: 'lastActiveAt', label: 'Last active', render: s => <span className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>{when(s.lastActiveAt)}</span> },
          { key: 'actionsThisMonth', label: 'Actions', align: 'right', render: s => <span className="tabular-nums text-[12px]">{s.actionsThisMonth}</span> },
          { key: 'manage', label: '', align: 'right', render: () => <Button size="xs" variant="ghost">Manage</Button> },
        ]}
      />
    </Card>
  )
}

/* ------------------------------------------------------------------ Roles */

function Roles() {
  const [roleId, setRoleId] = useState('manager')
  const [compare, setCompare] = useState(null)
  const role = ROLE_TEMPLATES[roleId]
  const groups = useMemo(() => permissionsByGroup(role), [role])
  const diff = useMemo(() => (compare ? roleDiff(role, ROLE_TEMPLATES[compare]) : null), [role, compare])
  const grantedCount = PERMISSION_KEYS.filter(k => can(role, k)).length

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-3">
      <div className="space-y-1.5">
        {ROLE_IDS.map(id => {
          const r = ROLE_TEMPLATES[id]
          const count = PERMISSION_KEYS.filter(k => can(r, k)).length
          return (
            <button key={id} onClick={() => setRoleId(id)}
              className="w-full text-left rounded-[var(--radius-md)] px-3 py-2.5 transition-transform hover:translate-x-0.5"
              style={{ background: 'var(--c-surface)', border: '1px solid ' + (roleId === id ? 'var(--c-primary)' : 'var(--c-border)') }}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[12.5px]">{r.name}</span>
                <span className="text-[11px] tabular-nums" style={{ color: 'var(--c-text-muted)' }}>{count}</span>
              </div>
              <div className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'var(--c-text-muted)' }}>{r.description}</div>
            </button>
          )
        })}
        <Button size="sm" variant="ghost" full>＋ Custom role</Button>
      </div>

      <div className="space-y-3">
        <Card>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-bold">{role.name}</h2>
                {role.builtin && <Badge tone="neutral" size="sm">Built in</Badge>}
              </div>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>{role.description}</p>
              <p className="text-[12px] mt-1">
                <b className="tabular-nums">{grantedCount}</b>
                <span style={{ color: 'var(--c-text-muted)' }}> of {PERMISSION_KEYS.length} permissions · </span>
                <b className="tabular-nums">{STAFF.filter(s => s.role === roleId).length}</b>
                <span style={{ color: 'var(--c-text-muted)' }}> people</span>
              </p>
            </div>
            <Select value={compare ?? ''} onChange={e => setCompare(e.target.value || null)} className="!w-auto"
              options={[{ value: '', label: 'Compare with…' }, ...ROLE_IDS.filter(r => r !== roleId).map(r => ({ value: r, label: ROLE_TEMPLATES[r].name }))]} />
          </div>

          {diff && (
            <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="rounded-[var(--radius-sm)] p-2.5" style={{ background: 'var(--c-surface-2, rgba(0,0,0,0.03))' }}>
                <div className="text-[11.5px] font-semibold mb-1">Only {role.name} can</div>
                {diff.onlyA.length === 0
                  ? <div className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>Nothing extra.</div>
                  : <div className="text-[11.5px] space-y-0.5">{diff.onlyA.slice(0, 8).map(k => <div key={k}>· {PERMISSIONS[k].label}</div>)}
                      {diff.onlyA.length > 8 && <div style={{ color: 'var(--c-text-muted)' }}>+{diff.onlyA.length - 8} more</div>}</div>}
              </div>
              <div className="rounded-[var(--radius-sm)] p-2.5" style={{ background: 'var(--c-surface-2, rgba(0,0,0,0.03))' }}>
                <div className="text-[11.5px] font-semibold mb-1">Only {ROLE_TEMPLATES[compare].name} can</div>
                {diff.onlyB.length === 0
                  ? <div className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>Nothing extra.</div>
                  : <div className="text-[11.5px] space-y-0.5">{diff.onlyB.slice(0, 8).map(k => <div key={k}>· {PERMISSIONS[k].label}</div>)}
                      {diff.onlyB.length > 8 && <div style={{ color: 'var(--c-text-muted)' }}>+{diff.onlyB.length - 8} more</div>}</div>}
              </div>
            </div>
          )}
        </Card>

        {Object.entries(groups).map(([group, perms]) => (
          <Card key={group}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <h3 className="text-[13px] font-semibold">{group}</h3>
              <span className="text-[11px] tabular-nums" style={{ color: 'var(--c-text-muted)' }}>
                {perms.filter(p => p.granted).length}/{perms.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
              {perms.map(p => (
                <div key={p.key} className="flex items-center justify-between gap-2 py-0.5">
                  <span className="text-[12px] flex items-center gap-1.5">
                    {p.label}
                    {p.sensitive && <span title="Sensitive permission" aria-label="Sensitive" className="text-[10px] opacity-60">⚠</span>}
                  </span>
                  <Switch checked={p.granted} onChange={() => {}} disabled={role.builtin} size="sm" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- Audit log */

function Audit() {
  const [q, setQ] = useState('')
  const [onlySensitive, setOnlySensitive] = useState(false)
  const all = useMemo(() => auditLog({ limit: 160 }), [])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return all.filter(a => (!onlySensitive || a.sensitive)
      && (!needle || a.actor.toLowerCase().includes(needle) || a.target.toLowerCase().includes(needle)
        || a.action.toLowerCase().includes(needle)))
  }, [all, q, onlySensitive])

  return (
    <Card padding={false}>
      <div className="p-3 flex gap-3 flex-wrap items-center">
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search person, action or record"
          className="!w-auto flex-1 min-w-[200px]" />
        <Checkbox checked={onlySensitive} onChange={setOnlySensitive} label="Sensitive actions only" />
      </div>
      {rows.length === 0
        ? <Empty icon="◌" title="Nothing matches" description="Clear the filters to see the full trail." />
        : (
          <DataTable
            rows={rows}
            rowKey="id"
            pageSize={15}
            columns={[
              { key: 'at', label: 'When', render: a => <span className="text-[12px] tabular-nums" style={{ color: 'var(--c-text-muted)' }}>{when(a.at)}</span> },
              { key: 'actor', label: 'Who', render: a => (
                <div className="flex items-center gap-2">
                  <Avatar name={a.actor} size={24} />
                  <div>
                    <div className="text-[12px] font-semibold">{a.actor}</div>
                    <div className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>{ROLE_TEMPLATES[a.role]?.name ?? a.role}</div>
                  </div>
                </div>
              ) },
              { key: 'action', label: 'Action', render: a => (
                <span className="text-[12px]">{a.action} <b>{a.target}</b></span>
              ) },
              { key: 'permission', label: 'Permission', render: a => (
                <span className="text-[11.5px] font-mono" style={{ color: 'var(--c-text-muted)' }}>{a.permission}</span>
              ) },
              { key: 'sensitive', label: '', render: a => (a.sensitive ? <Badge tone="warn" size="sm">Sensitive</Badge> : null) },
              { key: 'ip', label: 'IP', render: a => <span className="text-[11.5px] font-mono" style={{ color: 'var(--c-text-muted)' }}>{a.ip}</span> },
            ]}
          />
        )}
    </Card>
  )
}

/* --------------------------------------------------------------- Security */

const LEVEL_TONE = { high: 'danger', warn: 'warn', info: 'info', ok: 'success' }

function Security({ kpis }) {
  const notes = useMemo(() => securityReview(), [])

  return (
    <div className="space-y-3">
      <Card>
        <CardHead title="Access review" subtitle="Advice, not rules. A small shop may legitimately run lean, but it should be a decision rather than an accident." />
        <div className="space-y-2 mt-1.5">
          {notes.map((n, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.22 }}
              className="flex items-start gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2"
              style={{ background: 'var(--c-surface-2, rgba(0,0,0,0.03))' }}>
              <Badge tone={LEVEL_TONE[n.level]} size="sm">{n.level}</Badge>
              <span className="text-[12.5px]">{n.text}</span>
            </motion.div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title="People per role" subtitle="Concentration of access across the team." />
        <div className="space-y-1.5 mt-1.5">
          {kpis.byRole.filter(r => r.count > 0).map(r => (
            <div key={r.role} className="flex items-center justify-between gap-3 text-[12.5px] py-1"
              style={{ borderBottom: '1px solid var(--c-border)' }}>
              <span>{r.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
                  {PERMISSION_KEYS.filter(k => can(r.role, k)).length} permissions
                </span>
                <Badge tone="neutral" size="sm">{r.count}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title="Sensitive permissions" subtitle="The actions worth double-checking before you grant them." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 mt-1.5">
          {PERMISSION_KEYS.filter(k => PERMISSIONS[k].sensitive).map(k => {
            const holders = STAFF.filter(s => s.status === 'Active' && can(s.role, k))
            return (
              <div key={k} className="flex items-center justify-between gap-2 text-[12px] py-0.5">
                <span>{PERMISSIONS[k].label}</span>
                <Badge tone={holders.length > 4 ? 'warn' : 'neutral'} size="sm">{holders.length}</Badge>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
