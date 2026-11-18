import { useRef, useState } from 'react'

/** One-line text with ellipsis; shows the full text as a tooltip only when it is actually cut off. */
export default function TruncText({ children, className = '' }) {
  const ref = useRef(null)
  const [tip, setTip] = useState(false)
  const check = () => {
    const el = ref.current
    setTip(!!el && el.scrollWidth > el.clientWidth)
  }
  return (
    <span className={'trunc-wrap ' + className}>
      <span
        ref={ref}
        className="trunc"
        tabIndex={tip ? 0 : undefined}
        onMouseEnter={check}
        onFocus={check}
        onMouseLeave={() => setTip(false)}
        onBlur={() => setTip(false)}
        onTouchStart={check}
      >
        {children}
      </span>
      {tip && (
        <span className="tooltip" role="tooltip">
          {children}
        </span>
      )}
    </span>
  )
}
