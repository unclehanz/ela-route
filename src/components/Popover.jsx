import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

/** A button that toggles a floating panel; closes on outside click and Escape. */
export default function Popover({ label, children, align = 'right', width = 340, buttonClass = 'btn btn-secondary' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  return (
    <div className="popover-wrap" ref={ref}>
      <button type="button" className={buttonClass} aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} />
      </button>
      {open && (
        <div className={`popover popover-${align}`} style={{ width }} role="dialog">
          {children}
        </div>
      )}
    </div>
  )
}
