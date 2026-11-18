const TONE = {
  Active: 'success',
  'Regular Schedule': 'brand',
  'Full Schedule': 'brand',
  Orientation: 'brand',
  'On Hold': 'warning',
  'Non-Responsive': 'danger',
  Inactive: 'neutral',
  Unverified: 'neutral',
}

/** Status is always shown as text; the dot color is a secondary cue. */
export default function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${TONE[status] || 'neutral'}`}>
      <span className="badge-dot" aria-hidden="true" />
      {status}
    </span>
  )
}
