import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cx } from '../../lib/cx.js'
import { Checkbox } from '../primitives/Input.jsx'
import { Empty, Skeleton } from '../primitives/Display.jsx'

/**
 * Full-featured table: sort, select, bulk actions, column chooser,
 * pagination, sticky header, row expansion, empty/loading states.
 */
export default function DataTable({
  rows = [],
  columns = [],
  rowKey = (r) => r.id,
  selectable = false,
  selected = [],
  onSelect,
  bulkActions,
  onRowClick,
  expandable,
  pageSize: initialPageSize = 25,
  loading = false,
  empty,
  dense = false,
  stickyHeader = true,
  showColumnChooser = true,
  initialSort,
  className,
}) {
  const [sort, setSort] = useState(initialSort || null)   // [key, dir]
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [hidden, setHidden] = useState(new Set())
  const [expanded, setExpanded] = useState(new Set())
  const [chooserOpen, setChooserOpen] = useState(false)

  const visibleColumns = useMemo(
    () => columns.filter(c => !hidden.has(c.key)),
    [columns, hidden]
  )

  const sorted = useMemo(() => {
    if (!sort) return rows
    const [key, dir] = sort
    const col = columns.find(c => c.key === key)
    const get = col?.sortValue || col?.value || ((r) => r[key])
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b)
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      const r = typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), undefined, { numeric: true })
      return dir === 'desc' ? -r : r
    })
  }, [rows, sort, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const paged = useMemo(
    () => sorted.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [sorted, safePage, pageSize]
  )

  const toggleSort = useCallback((key) => {
    setSort(cur => {
      if (!cur || cur[0] !== key) return [key, 'asc']
      if (cur[1] === 'asc') return [key, 'desc']
      return null
    })
  }, [])

  // Accept a field name as well as a function. Passing rowKey="id" is the
  // obvious thing to try and used to fail with "id is not a function".
  const keyOf = typeof rowKey === 'string' ? (r) => r[rowKey] : rowKey

  const pageKeys = paged.map(keyOf)
  const allSelected = pageKeys.length > 0 && pageKeys.every(k => selected.includes(k))
  const someSelected = pageKeys.some(k => selected.includes(k)) && !allSelected

  const toggleAll = () => {
    if (allSelected) onSelect?.(selected.filter(k => !pageKeys.includes(k)))
    else onSelect?.([...new Set([...selected, ...pageKeys])])
  }

  const toggleRow = (key) => {
    onSelect?.(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key])
  }

  const toggleExpand = (key) => {
    setExpanded(e => {
      const n = new Set(e)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  const cellPad = dense ? 'px-2.5 py-1.5' : 'px-3 py-2.5'

  return (
    <div className={cx('t-card overflow-hidden', className)} style={{ padding: 0 }}>
      {/* ---------------------------------------------------- toolbar */}
      <AnimatePresence>
        {selectable && selected.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b" style={{ borderColor: 'var(--c-border)' }}>
            <div className="px-3 py-2 flex items-center gap-3 flex-wrap"
              style={{ background: 'var(--c-primary-soft)' }}>
              <span className="text-[12px] font-semibold" style={{ color: 'var(--c-primary)' }}>
                {selected.length} selected
              </span>
              <button onClick={() => onSelect?.([])} className="text-[11.5px] hover:underline"
                style={{ color: 'var(--c-text-muted)' }}>Clear</button>
              <div className="flex-1" />
              {bulkActions}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showColumnChooser && (
        <div className="px-3 py-1.5 flex items-center justify-between border-b text-[11px]"
          style={{ borderColor: 'var(--c-border)', color: 'var(--c-text-muted)' }}>
          <span className="tabular-nums">
            {sorted.length.toLocaleString('en-IN')} {sorted.length === 1 ? 'row' : 'rows'}
            {sort && <> · sorted by {columns.find(c => c.key === sort[0])?.label} {sort[1] === 'asc' ? '↑' : '↓'}</>}
          </span>
          <div className="relative">
            <button onClick={() => setChooserOpen(o => !o)} className="hover:underline">
              Columns ({visibleColumns.length}/{columns.length})
            </button>
            <AnimatePresence>
              {chooserOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setChooserOpen(false)} />
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="absolute right-0 top-6 z-50 t-card shadow-xl p-2 w-48 max-h-72 overflow-y-auto">
                    {columns.map(c => (
                      <button key={c.key}
                        onClick={() => setHidden(h => {
                          const n = new Set(h)
                          n.has(c.key) ? n.delete(c.key) : n.add(c.key)
                          return n
                        })}
                        className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded hover:bg-black/5 text-left">
                        <Checkbox checked={!hidden.has(c.key)} onChange={() => {}} />
                        <span className="text-[12px]" style={{ color: 'var(--c-text)' }}>{c.label}</span>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------ table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className={cx(stickyHeader && 'sticky top-0 z-10')}>
            <tr style={{ background: 'var(--c-surface-alt)' }}>
              {selectable && (
                <th className={cx(cellPad, 'w-9')}>
                  <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
                </th>
              )}
              {expandable && <th className="w-8" />}
              {visibleColumns.map(c => (
                <th key={c.key}
                  onClick={() => c.sortable !== false && toggleSort(c.key)}
                  className={cx(cellPad, 'text-[10.5px] font-semibold uppercase tracking-wider whitespace-nowrap',
                    c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                    c.sortable !== false && 'cursor-pointer select-none hover:opacity-70 transition-opacity')}
                  style={{ color: 'var(--c-text-muted)', width: c.width }}>
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {sort?.[0] === c.key && (
                      <motion.span initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }}
                        style={{ color: 'var(--c-primary)' }}>
                        {sort[1] === 'asc' ? '↑' : '↓'}
                      </motion.span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={'sk' + i} className="border-t" style={{ borderColor: 'var(--c-border)' }}>
                {selectable && <td className={cellPad}><Skeleton width={16} height={16} /></td>}
                {expandable && <td />}
                {visibleColumns.map(c => (
                  <td key={c.key} className={cellPad}><Skeleton width={`${50 + (i * 7) % 40}%`} height={12} /></td>
                ))}
              </tr>
            ))}

            {!loading && paged.map((row, i) => {
              const key = keyOf(row)
              const isSelected = selected.includes(key)
              const isExpanded = expanded.has(key)
              return (
                <React.Fragment key={key}>
                  <motion.tr
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    /* The cap matters more than the increment: 0.012s per row
                       is elegant on 12 rows and would be a five-second wait on
                       480 customers. Total entrance time is bounded. */
                    transition={{ delay: Math.min(i * 0.012, 0.25), duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    /* Only a clickable row should react to the pointer;
                       feedback on a row that does nothing is a false promise. */
                    whileHover={onRowClick ? { x: 2 } : undefined}
                    onClick={() => onRowClick?.(row)}
                    className={cx('border-t transition-colors', onRowClick && 'cursor-pointer hover:bg-black/[0.02]')}
                    style={{
                      borderColor: 'var(--c-border)',
                      background: isSelected ? 'var(--c-primary-soft)' : undefined,
                    }}>
                    {selectable && (
                      <td className={cellPad} onClick={e => { e.stopPropagation(); toggleRow(key) }}>
                        <Checkbox checked={isSelected} onChange={() => {}} />
                      </td>
                    )}
                    {expandable && (
                      <td className="w-8 text-center" onClick={e => { e.stopPropagation(); toggleExpand(key) }}>
                        <motion.span animate={{ rotate: isExpanded ? 90 : 0 }}
                          className="inline-block text-[10px] cursor-pointer"
                          style={{ color: 'var(--c-text-muted)' }}>▶</motion.span>
                      </td>
                    )}
                    {visibleColumns.map(c => (
                      <td key={c.key}
                        className={cx(cellPad, 'text-[12.5px]',
                          c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                          c.nowrap !== false && 'whitespace-nowrap')}
                        style={{ color: 'var(--c-text)' }}>
                        {c.render ? c.render(row, i) : (c.value ? c.value(row) : row[c.key])}
                      </td>
                    ))}
                  </motion.tr>
                  <AnimatePresence>
                    {isExpanded && expandable && (
                      <tr>
                        <td colSpan={visibleColumns.length + (selectable ? 1 : 0) + 1} className="p-0">
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} className="overflow-hidden"
                            style={{ background: 'var(--c-surface-alt)' }}>
                            <div className="p-3">{expandable(row)}</div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              )
            })}
          </tbody>
        </table>

        {!loading && paged.length === 0 && (
          empty || <Empty icon="◌" title="Nothing here" description="Try adjusting your filters or search." />
        )}
      </div>

      {/* --------------------------------------------------- pagination */}
      {sorted.length > pageSize && (
        <div className="px-3 py-2 flex items-center justify-between gap-3 border-t flex-wrap"
          style={{ borderColor: 'var(--c-border)' }}>
          <div className="flex items-center gap-2 text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>
            <span className="tabular-nums">
              {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sorted.length)} of {sorted.length.toLocaleString('en-IN')}
            </span>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }}
              className="t-input px-1.5 py-0.5 text-[11px] cursor-pointer">
              {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <PageBtn onClick={() => setPage(0)} disabled={safePage === 0}>«</PageBtn>
            <PageBtn onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}>‹</PageBtn>
            <span className="px-2 text-[11.5px] tabular-nums" style={{ color: 'var(--c-text)' }}>
              {safePage + 1} / {totalPages}
            </span>
            <PageBtn onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={safePage >= totalPages - 1}>›</PageBtn>
            <PageBtn onClick={() => setPage(totalPages - 1)} disabled={safePage >= totalPages - 1}>»</PageBtn>
          </div>
        </div>
      )}
    </div>
  )
}

function PageBtn({ children, ...p }) {
  return (
    <button {...p}
      className="w-7 h-7 rounded-md text-[12px] disabled:opacity-30 transition-colors hover:bg-black/5"
      style={{ color: 'var(--c-text)' }}>
      {children}
    </button>
  )
}
