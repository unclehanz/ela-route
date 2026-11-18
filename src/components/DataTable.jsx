import { useMemo, useState } from 'react'
import { PAGE_SIZE } from '../config.js'
import { useMediaQuery } from '../lib/hooks.js'
import Icon from './Icon.jsx'
import TruncText from './TruncText.jsx'

/**
 * Sortable, striped, paginated table that turns into cards on phones.
 * columns: [{ key, header, render?(row), sortValue?(row), truncate?, pin?: 'left', num?, card?: 'title'|'hidden' }]
 */
export default function DataTable({ columns, rows, rowKey = (r) => r.id, onView, viewLabel = 'View', defaultSort, empty, caption, minWidth = 1100 }) {
  const isPhone = useMediaQuery('(max-width: 720px)')
  const [sort, setSort] = useState(defaultSort || { key: columns[0].key, dir: 'asc' })
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(null)

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return rows
    const get = col.sortValue || ((r) => r[col.key])
    const mult = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = get(a) ?? ''
      const y = get(b) ?? ''
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * mult
    })
  }, [rows, columns, sort])

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = sorted.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  const toggleSort = (key) => {
    setPage(0)
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))
  }
  const cell = (c, r) => (c.render ? c.render(r) : r[c.key])

  if (!rows.length) return <div className="table-card">{empty}</div>

  const pager = pages > 1 && (
    <nav className="pager" aria-label="Pages">
      <span className="text-muted">
        {current * PAGE_SIZE + 1}–{Math.min(sorted.length, (current + 1) * PAGE_SIZE)} of {sorted.length}
      </span>
      <button type="button" className="btn-icon" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Previous page">
        <Icon name="chevronLeft" />
      </button>
      <button type="button" className="btn-icon" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Next page">
        <Icon name="chevronRight" />
      </button>
    </nav>
  )

  if (isPhone) {
    const sortable = columns.filter((c) => c.sortValue || !c.render)
    return (
      <div>
        <div className="card-sort">
          <label>
            <span className="text-muted">Sort by</span>{' '}
            <select value={`${sort.key}:${sort.dir}`} onChange={(e) => {
              const [key, dir] = e.target.value.split(':')
              setSort({ key, dir })
            }}>
              {sortable.flatMap((c) => [
                <option key={c.key + 'a'} value={`${c.key}:asc`}>{c.header} (A–Z, low–high)</option>,
                <option key={c.key + 'd'} value={`${c.key}:desc`}>{c.header} (Z–A, high–low)</option>,
              ])}
            </select>
          </label>
        </div>
        <ul className="row-cards">
          {visible.map((r) => {
            const title = columns.find((c) => c.card === 'title') || columns[0]
            return (
              <li key={rowKey(r)} className="row-card">
                <div className="row-card-head">
                  <div className="row-card-title">{cell(title, r)}</div>
                  {onView && (
                    <button type="button" className="btn-icon" onClick={() => onView(r)} aria-label={`${viewLabel} ${r.name || ''}`}>
                      <Icon name="eye" />
                    </button>
                  )}
                </div>
                <dl>
                  {columns
                    .filter((c) => c !== title && c.card !== 'hidden')
                    .map((c) => (
                      <div key={c.key} className="row-card-field">
                        <dt>{c.header}</dt>
                        <dd>{c.truncate ? <TruncText>{cell(c, r)}</TruncText> : cell(c, r)}</dd>
                      </div>
                    ))}
                </dl>
              </li>
            )
          })}
        </ul>
        {pager}
      </div>
    )
  }

  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="data-table" style={{ minWidth }}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort.key === c.key
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={(c.pin ? 'pin-left ' : '') + (c.num ? 'num' : '')}
                    style={c.width ? { width: c.width } : undefined}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button type="button" className="th-sort" onClick={() => toggleSort(c.key)}>
                      {c.header}
                      <Icon name={active ? (sort.dir === 'asc' ? 'chevronUp' : 'chevronDown') : 'sort'} size={16} className={active ? '' : 'th-sort-idle'} />
                    </button>
                  </th>
                )
              })}
              {onView && (
                <th scope="col" className="pin-right col-action">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const k = rowKey(r)
              return (
                <tr
                  key={k}
                  className={selected === k ? 'is-selected' : ''}
                  onClick={() => setSelected(k)}
                  onDoubleClick={() => onView?.(r)}
                  aria-selected={selected === k}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={(c.pin ? 'pin-left ' : '') + (c.num ? 'num' : '')}>
                      {c.truncate ? <TruncText>{cell(c, r)}</TruncText> : cell(c, r)}
                    </td>
                  ))}
                  {onView && (
                    <td className="pin-right col-action">
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          onView(r)
                        }}
                        aria-label={`${viewLabel} ${r.name || ''}`}
                        title={viewLabel}
                      >
                        <Icon name="eye" />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {pager}
    </div>
  )
}
