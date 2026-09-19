import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import DataTable from '../../ui/patterns/DataTable.jsx'
import KpiRow from '../../ui/patterns/KpiRow.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Textarea, Select } from '../../ui/primitives/Input.jsx'
import { Badge, Card, CardHead, Tabs, Progress, Empty, Divider, Drawer } from '../../ui/primitives/Display.jsx'
import {
  PAGES, BANNERS, BANNER_SLOTS, BLOG_POSTS, NAVIGATION,
  contentKpis, bannerPerformance, seoAudit, sitemap, CONTENT_STATUS,
} from '../../engines/content/contentEngine.js'

const TABS = [
  { id: 'pages', label: 'Pages', icon: '▤' },
  { id: 'banners', label: 'Banners', icon: '▭' },
  { id: 'blog', label: 'Journal', icon: '✎' },
  { id: 'navigation', label: 'Navigation', icon: '⌸' },
  { id: 'seo', label: 'SEO', icon: '⌕' },
]

const STATUS_TONE = { Published: 'success', Draft: 'neutral', Scheduled: 'info', Archived: 'warn', Failing: 'danger' }
const day = (ts) => (ts ? new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—')
const num = (n) => n.toLocaleString('en-IN')

export default function Content() {
  const [tab, setTab] = useState('pages')
  const kpis = useMemo(() => contentKpis(), [])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Content</h1>
          <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
            Everything the storefront says — pages, banners, the journal and the menus — editable without touching code.
          </p>
        </div>
        <Button variant="primary" size="sm">＋ New page</Button>
      </div>

      <KpiRow columns={6} items={[
        { label: 'Pages', value: kpis.pages, sub: `${kpis.published} published`, icon: '▤' },
        { label: 'Drafts', value: kpis.drafts, sub: `${kpis.scheduled} scheduled`, tone: kpis.drafts ? 'info' : 'neutral', icon: '✎' },
        { label: 'Live banners', value: kpis.liveBanners, sub: `of ${kpis.banners}`, icon: '▭' },
        { label: 'Banner CTR', value: kpis.bannerCtr + '%', sub: 'across live slots', tone: kpis.bannerCtr >= 3 ? 'success' : 'warn', icon: '◴' },
        { label: 'Journal posts', value: kpis.publishedPosts, sub: `of ${kpis.posts}`, icon: '✎' },
        { label: 'Content views', value: num(kpis.totalViews), sub: 'all time', icon: '☺' },
      ]} />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'pages' && <Pages />}
          {tab === 'banners' && <Banners />}
          {tab === 'blog' && <Blog />}
          {tab === 'navigation' && <Nav />}
          {tab === 'seo' && <Seo />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------------ Pages */

function Pages() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [editing, setEditing] = useState(null)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return PAGES.filter(p => (status === 'all' || p.status === status)
      && (!needle || p.title.toLowerCase().includes(needle) || p.slug.includes(needle)))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [q, status])

  return (
    <>
      <Card padding={false}>
        <div className="p-3 flex gap-2 flex-wrap items-center">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title or slug"
            className="!w-auto flex-1 min-w-[180px]" />
          <Select value={status} onChange={e => setStatus(e.target.value)} className="!w-auto"
            options={[{ value: 'all', label: 'All statuses' }, ...CONTENT_STATUS.map(s => ({ value: s, label: s }))]} />
        </div>
        <DataTable
          rows={rows}
          rowKey="id"
          pageSize={12}
          onRowClick={setEditing}
          columns={[
            { key: 'title', label: 'Page', render: p => (
              <div>
                <div className="font-semibold text-[12.5px]">{p.title}</div>
                <div className="text-[11px] font-mono" style={{ color: 'var(--c-text-muted)' }}>/pages/{p.slug}</div>
              </div>
            ) },
            { key: 'type', label: 'Type', render: p => <Badge tone="neutral" size="sm">{p.type}</Badge> },
            { key: 'status', label: 'Status', render: p => (
              <div className="flex items-center gap-1.5">
                <Badge tone={STATUS_TONE[p.status]} size="sm">{p.status}</Badge>
                {p.publishAt && <span className="text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>{day(p.publishAt)}</span>}
              </div>
            ) },
            { key: 'updatedAt', label: 'Updated', render: p => <span className="text-[12px] tabular-nums">{day(p.updatedAt)}</span> },
            { key: 'author', label: 'Author', render: p => <span className="text-[12px]">{p.author}</span> },
            { key: 'words', label: 'Words', align: 'right', render: p => <span className="tabular-nums text-[12px]">{p.words}</span> },
            { key: 'views', label: 'Views', align: 'right', render: p => <span className="tabular-nums text-[12px]">{num(p.views)}</span> },
            { key: 'seo', label: 'SEO', render: p => (
              p.seoTitle && p.seoDescription
                ? <Badge tone="success" size="sm">Set</Badge>
                : <Badge tone="warn" size="sm">Missing</Badge>
            ) },
          ]}
        />
      </Card>

      <Drawer open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.title ?? ''} width={520}>
        {editing && (
          <div className="space-y-3">
            <Input label="Title" defaultValue={editing.title} />
            <Input label="Slug" defaultValue={editing.slug} hint={`Visible at /pages/${editing.slug}`} />
            <Select label="Status" defaultValue={editing.status}
              options={CONTENT_STATUS.map(s => ({ value: s, label: s }))} />
            <Divider label="Search appearance" />
            <Input label="SEO title" defaultValue={editing.seoTitle}
              hint={`${(editing.seoTitle || '').length}/60 characters`} />
            <Textarea label="Meta description" rows={3} defaultValue={editing.seoDescription}
              hint={`${(editing.seoDescription || '').length}/160 characters`} />
            <div className="rounded-[var(--radius-sm)] p-3" style={{ background: 'var(--c-surface-2, rgba(0,0,0,0.03))' }}>
              <div className="text-[11px] mb-1" style={{ color: 'var(--c-text-muted)' }}>Google preview</div>
              <div className="text-[13px]" style={{ color: '#1a0dab' }}>{editing.seoTitle || editing.title}</div>
              <div className="text-[11.5px]" style={{ color: '#006621' }}>bharatcart.in/pages/{editing.slug}</div>
              <div className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>
                {editing.seoDescription || 'No meta description — Google will pick a snippet from the page.'}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="primary">Save</Button>
              <Button size="sm" variant="ghost">Preview</Button>
            </div>
          </div>
        )}
      </Drawer>
    </>
  )
}

/* ---------------------------------------------------------------- Banners */

function Banners() {
  const rows = useMemo(() => bannerPerformance(), [])
  const [slot, setSlot] = useState('all')
  const filtered = rows.filter(b => slot === 'all' || b.slot === slot)

  return (
    <div className="space-y-3">
      <Card>
        <CardHead title="Banner slots" subtitle="Where a banner can appear. Within a slot, the highest priority live banner wins." />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mt-2">
          {BANNER_SLOTS.map(s => {
            const live = rows.filter(b => b.slot === s.id && b.live).length
            return (
              <button key={s.id} onClick={() => setSlot(slot === s.id ? 'all' : s.id)}
                className="text-left rounded-[var(--radius-md)] px-3 py-2.5 transition-transform hover:-translate-y-0.5"
                style={{ background: 'var(--c-surface)', border: '1px solid ' + (slot === s.id ? 'var(--c-primary)' : 'var(--c-border)') }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[12.5px]">{s.label}</span>
                  <Badge tone={live ? 'success' : 'neutral'} size="sm">{live} live</Badge>
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>{s.description}</div>
              </button>
            )
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {filtered.map((b, i) => (
          <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 6) * 0.04, duration: 0.25 }}>
            <Card>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-[13px]">{b.name}</div>
                  <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{b.slot} · priority {b.priority}</div>
                </div>
                <Badge tone={b.live ? 'success' : STATUS_TONE[b.status]} size="sm">{b.live ? 'Live' : b.status}</Badge>
              </div>

              <div className="mt-2.5 rounded-[var(--radius-sm)] px-3 py-3 text-center"
                style={{ background: 'linear-gradient(135deg, var(--c-primary) 0%, var(--c-primary-dark, var(--c-primary)) 100%)', color: '#fff' }}>
                <div className="text-[13.5px] font-bold">{b.headline}</div>
                {b.subline && <div className="text-[11.5px] opacity-90 mt-0.5">{b.subline}</div>}
                {b.cta && (
                  <span className="inline-block mt-2 text-[11.5px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.22)' }}>{b.cta}</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
                <div>
                  <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>Impressions</div>
                  <div className="text-[13px] font-bold tabular-nums">{num(b.impressions)}</div>
                </div>
                <div>
                  <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>Clicks</div>
                  <div className="text-[13px] font-bold tabular-nums">{num(b.clicks)}</div>
                </div>
                <div>
                  <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>CTR</div>
                  <div className="text-[13px] font-bold tabular-nums"
                    style={{ color: b.ctr >= 5 ? 'var(--c-success, #16a34a)' : 'inherit' }}>{b.ctr}%</div>
                </div>
              </div>

              <div className="text-[11px] mt-2" style={{ color: 'var(--c-text-muted)' }}>
                {day(b.startsAt)} → {day(b.endsAt)}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------- Blog */

function Blog() {
  const rows = useMemo(() => [...BLOG_POSTS].sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0)), [])
  return (
    <Card padding={false}>
      <CardHead title="Journal" subtitle="Long-form posts are how a handloom store earns search traffic that ads cannot buy." />
      <DataTable
        rows={rows}
        rowKey="id"
        pageSize={10}
        columns={[
          { key: 'title', label: 'Post', render: p => (
            <div>
              <div className="font-semibold text-[12.5px]">{p.title}</div>
              <div className="text-[11px] font-mono" style={{ color: 'var(--c-text-muted)' }}>/blog/{p.slug}</div>
            </div>
          ) },
          { key: 'tag', label: 'Tag', render: p => <Badge tone="neutral" size="sm">{p.tag}</Badge> },
          { key: 'status', label: 'Status', render: p => <Badge tone={STATUS_TONE[p.status]} size="sm">{p.status}</Badge> },
          { key: 'author', label: 'Author', render: p => <span className="text-[12px]">{p.author}</span> },
          { key: 'publishedAt', label: 'Published', render: p => <span className="text-[12px] tabular-nums">{day(p.publishedAt)}</span> },
          { key: 'readMins', label: 'Read', align: 'right', render: p => <span className="tabular-nums text-[12px]">{p.readMins}m</span> },
          { key: 'views', label: 'Views', align: 'right', render: p => <span className="tabular-nums text-[12px] font-semibold">{num(p.views)}</span> },
        ]}
      />
    </Card>
  )
}

/* ------------------------------------------------------------- Navigation */

function Nav() {
  const [menu, setMenu] = useState('header')
  const items = NAVIGATION[menu] ?? []

  return (
    <div className="space-y-3">
      <Tabs tabs={[{ id: 'header', label: 'Header menu' }, { id: 'footer', label: 'Footer menu' }]}
        value={menu} onChange={setMenu} size="sm" />

      <Card>
        <CardHead title={menu === 'header' ? 'Header navigation' : 'Footer navigation'}
          subtitle="Drag to reorder in a full build. Links accept any storefront path or an external URL." />
        <div className="space-y-1.5 mt-2">
          {items.map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
              className="rounded-[var(--radius-sm)] px-3 py-2"
              style={{ background: 'var(--c-surface-2, rgba(0,0,0,0.03))' }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] cursor-grab" style={{ color: 'var(--c-text-muted)' }} aria-hidden="true">⠿</span>
                  <span className="font-semibold text-[12.5px]">{item.label}</span>
                  {item.href && <span className="text-[11px] font-mono" style={{ color: 'var(--c-text-muted)' }}>{item.href}</span>}
                </div>
                <Badge tone="neutral" size="sm">{item.children?.length ?? 0} sub</Badge>
              </div>
              {item.children?.length > 0 && (
                <div className="mt-1.5 ml-5 space-y-1">
                  {item.children.map(child => (
                    <div key={child.id} className="flex items-center justify-between gap-2 text-[12px]">
                      <span>{child.label}</span>
                      <span className="text-[11px] font-mono" style={{ color: 'var(--c-text-muted)' }}>{child.href}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="ghost">＋ Add link</Button>
          <Button size="sm" variant="primary">Save menu</Button>
        </div>
      </Card>
    </div>
  )
}

/* -------------------------------------------------------------------- SEO */

const LEVEL_TONE = { high: 'danger', warn: 'warn', info: 'info' }

function Seo() {
  const audit = useMemo(() => seoAudit(), [])
  const map = useMemo(() => sitemap(), [])

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-center">
            <div className="text-[30px] font-bold tabular-nums leading-none"
              style={{ color: audit.score >= 85 ? 'var(--c-success, #16a34a)' : audit.score >= 65 ? 'var(--c-warn, #d97706)' : 'var(--c-danger, #dc2626)' }}>
              {audit.score}
            </div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--c-text-muted)' }}>SEO score</div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <Progress value={audit.score} tone={audit.score >= 85 ? 'success' : audit.score >= 65 ? 'warn' : 'danger'} height={9} />
            <p className="text-[12px] mt-1.5" style={{ color: 'var(--c-text-muted)' }}>
              {audit.high} serious {audit.high === 1 ? 'issue' : 'issues'} and {audit.warn} warnings across published content.
            </p>
          </div>
        </div>
      </Card>

      <Card padding={false}>
        <CardHead title="Issues" subtitle="Fixing missing titles and descriptions is the cheapest ranking work available." />
        {audit.issues.length === 0
          ? <Empty icon="✓" title="No issues found" description="Every published page has a title and description within limits." />
          : (
            <DataTable
              rows={audit.issues.map((x, i) => ({ ...x, key: x.id + x.field + i }))}
              rowKey="key"
              pageSize={10}
              columns={[
                { key: 'title', label: 'Page', render: r => <span className="text-[12.5px] font-semibold">{r.title}</span> },
                { key: 'field', label: 'Field', render: r => <span className="text-[12px]">{r.field}</span> },
                { key: 'level', label: 'Severity', render: r => <Badge tone={LEVEL_TONE[r.level]} size="sm">{r.level}</Badge> },
                { key: 'note', label: 'What to do', render: r => <span className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>{r.note}</span> },
              ]}
            />
          )}
      </Card>

      <Card>
        <CardHead title={`Sitemap — ${num(map.total)} URLs`} subtitle="What search engines will find and how often they should re-crawl it." />
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 mt-2">
          {Object.entries(map.byType).map(([type, count]) => (
            <div key={type} className="rounded-[var(--radius-sm)] px-2.5 py-2 text-center"
              style={{ background: 'var(--c-surface-2, rgba(0,0,0,0.03))' }}>
              <div className="text-[15px] font-bold tabular-nums">{num(count)}</div>
              <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{type}</div>
            </div>
          ))}
        </div>
        <Divider />
        <div className="font-mono text-[11px] space-y-0.5 max-h-40 overflow-auto"
          style={{ color: 'var(--c-text-muted)' }}>
          {map.entries.slice(0, 40).map(e => (
            <div key={e.loc} className="flex justify-between gap-3">
              <span className="truncate">{e.loc}</span>
              <span className="shrink-0">{e.changefreq} · {e.priority}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
