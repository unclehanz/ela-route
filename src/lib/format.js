// Shared, locale-aware formatting helpers. Components never format inline.
const nf1 = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })
const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })

export const fmtMi = (m) => (m == null || Number.isNaN(m) ? '—' : `${nf1.format(m)} mi`)
export const fmtMoney = (n) => money.format(n || 0)
export const fmtMin = (m) => {
  if (m == null) return '—'
  const r = Math.round(m)
  return r < 60 ? `${r} min` : `${Math.floor(r / 60)} h ${r % 60} min`
}
/** yyyy-mm-dd (local) → "Nov 18, 2026" */
export const fmtDate = (iso) => {
  if (!iso) return ''
  const d = iso.length === 10 ? new Date(iso + 'T12:00:00') : new Date(iso)
  return dateFmt.format(d)
}
export const fmtMonth = (ym) => monthFmt.format(new Date(ym + '-15T12:00:00'))
export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`

/** "18–34 min" from an eta() result. */
export const fmtRange = (e) => (e ? `${Math.round(e.lo)}–${Math.round(e.hi)} min` : '')
