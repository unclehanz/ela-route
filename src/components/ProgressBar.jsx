/** Determinate progress with a text meta line (used for waits longer than a few seconds). */
export default function ProgressBar({ value, max, label, meta }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return (
    <div className="progress" aria-busy="true">
      <div className="progress-text">
        <span>{label}</span>
        <span className="text-muted">{meta ?? `${pct}%`}</span>
      </div>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
        <div className="progress-fill" style={{ width: pct + '%' }} />
      </div>
    </div>
  )
}
