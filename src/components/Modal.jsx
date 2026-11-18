import { useEffect, useRef } from 'react'
import Icon from './Icon.jsx'

/** Accessible dialog: traps initial focus, closes on Escape and backdrop click, restores focus on close. */
export default function Modal({ title, onClose, children, size = 'md', footer }) {
  const ref = useRef(null)
  useEffect(() => {
    const prev = document.activeElement
    const first = ref.current?.querySelector('input, select, textarea, button:not(.modal-close)')
    first?.focus()
    // Only the top-most dialog reacts to Escape.
    const onKey = (e) => {
      const all = document.querySelectorAll('.modal')
      if (e.key === 'Escape' && all[all.length - 1] === ref.current) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="btn-icon modal-close" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}
