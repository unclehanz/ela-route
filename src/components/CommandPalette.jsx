import { useEffect, useMemo, useRef, useState } from 'react'
import { NAV } from '../config.js'
import Icon from './Icon.jsx'

/**
 * Ctrl/Cmd+K quick finder for pages, clients and caregivers. An accelerator only:
 * everything here is also reachable from the visible navigation.
 */
export default function CommandPalette({ caregivers, clients, onClose, onRun }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    const prev = document.activeElement
    inputRef.current?.focus()
    return () => prev?.focus?.()
  }, [])

  const items = useMemo(() => {
    const s = q.trim().toLowerCase()
    const hit = (t) => !s || t.toLowerCase().includes(s)
    const pages = NAV.filter((n) => hit(n.title)).map((n) => ({ id: 'p-' + n.id, group: 'Go to', label: n.title, icon: n.icon, run: { type: 'page', id: n.id } }))
    const actions = [
      { id: 'a-cg', group: 'Actions', label: 'Add caregiver', icon: 'plus', run: { type: 'add-caregiver' } },
      { id: 'a-cl', group: 'Actions', label: 'Add client', icon: 'plus', run: { type: 'add-client' } },
      { id: 'a-theme', group: 'Actions', label: 'Switch light / dark theme', icon: 'moon', run: { type: 'theme' } },
    ].filter((a) => hit(a.label))
    const cls = s
      ? clients
          .filter((c) => hit(c.name))
          .slice(0, 6)
          .map((c) => ({ id: c.id, group: 'Find caregivers for client', label: c.name, meta: c.address || 'No address', icon: 'home', run: { type: 'client', item: c } }))
      : []
    const cgs = s
      ? caregivers
          .filter((c) => hit(c.name))
          .slice(0, 6)
          .map((c) => ({ id: c.id, group: 'Open caregiver', label: c.name, meta: c.status, icon: 'users', run: { type: 'caregiver', item: c } }))
      : []
    return [...cls, ...cgs, ...pages, ...actions]
  }, [q, caregivers, clients])

  const current = Math.min(active, Math.max(0, items.length - 1))
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [current])

  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((current + 1) % Math.max(1, items.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((current - 1 + items.length) % Math.max(1, items.length))
    } else if (e.key === 'Enter' && items[current]) {
      e.preventDefault()
      onRun(items[current].run)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  let lastGroup = null
  return (
    <div className="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Quick find">
        <div className="palette-input">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => (setQ(e.target.value), setActive(0))}
            onKeyDown={onKey}
            placeholder="Search clients, caregivers, pages…"
            aria-label="Search clients, caregivers and pages"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[current] ? 'pal-' + items[current].id : undefined}
          />
          <kbd>Esc</kbd>
        </div>
        <ul id="palette-list" className="palette-list" role="listbox" ref={listRef}>
          {items.map((it, i) => {
            const head = it.group !== lastGroup
            lastGroup = it.group
            return (
              <li key={it.id} role="presentation">
                {head && <p className="palette-group">{it.group}</p>}
                <div
                  id={'pal-' + it.id}
                  role="option"
                  aria-selected={i === current}
                  className={'palette-item' + (i === current ? ' is-active' : '')}
                  onMouseMove={() => setActive(i)}
                  onClick={() => onRun(it.run)}
                >
                  <Icon name={it.icon} size={18} />
                  <span className="palette-label">{it.label}</span>
                  {it.meta && <span className="palette-meta">{it.meta}</span>}
                </div>
              </li>
            )
          })}
          {!items.length && <li className="palette-empty">Nothing matches “{q}”.</li>}
        </ul>
      </div>
    </div>
  )
}
