// Shared CSV helpers for the caregiver and client import/export files.
import { CRITERIA, CRITERIA_GROUPS } from './criteria.js'
import { toCsv } from './files.js'

/** CSV text with a BOM so Excel opens it as UTF-8. */
export const csvFile = (rows) => '﻿' + toCsv(rows)

/** RFC 4180 CSV → array of rows (handles quotes, doubled quotes, commas and newlines inside quotes). */
export function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  text = text.replace(/^﻿/, '')
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

export const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
/** Split a cell holding several values ("a; b; c"). */
export const list = (s) => String(s || '').split(/[;|\n]/).map((x) => x.trim()).filter(Boolean)
export const joinList = (arr) => (arr || []).join('; ')

/**
 * Read a CSV with a header row. Calls `toRecord(get, line, problems)` for each data row; `get('Column')` returns the
 * trimmed cell. Rows with no name, or a name starting with "EXAMPLE", are skipped.
 */
export function readRows(text, columns, toRecord) {
  const rows = parseCsv(text)
  if (!rows.length) throw new Error('The file is empty.')
  const head = rows[0].map(norm)
  const col = Object.fromEntries(columns.map((c) => [c, head.indexOf(norm(c))]))
  if (col.Name < 0) throw new Error('No “Name” column. Start from the CSV template.')
  const problems = []
  const records = []
  let skipped = 0
  rows.slice(1).forEach((r, i) => {
    const line = i + 2
    const get = (c) => (col[c] >= 0 ? String(r[col[c]] ?? '').trim() : '')
    const name = get('Name')
    if (!name || /^example\b/i.test(name)) {
      skipped++
      return
    }
    records.push(toRecord(get, line, problems))
  })
  return { records, problems, skipped }
}

/** Match a typed value to an allowed one, ignoring case and punctuation. Unknown values are reported and dropped. */
export function pick(value, allowed, field, problems, line) {
  if (!value) return ''
  const hit = allowed.find((a) => norm(a) === norm(value))
  if (!hit) problems.push(`Row ${line}: “${value}” is not a ${field} option`)
  return hit || ''
}
export const pickMany = (value, allowed, field, problems, line) => list(value).map((v) => pick(v, allowed, field, problems, line)).filter(Boolean)

// "G-Tube" appears under both Certifications and Other/Misc, so CSV files name duplicates with their group.
const labelCount = CRITERIA.reduce((m, c) => ((m[c.label] = (m[c.label] || 0) + 1), m), {})
const groupTitle = Object.fromEntries(CRITERIA_GROUPS.map((g) => [g.id, g.title]))
/** The label a criterion has in CSV files, e.g. "Cooking" or "G-Tube (Other/Misc)". */
export const criterionCsvLabel = (c) => (labelCount[c.label] > 1 ? `${c.label} (${groupTitle[c.group]})` : c.label)

/** Find a criterion by its CSV label, among `pool` (defaults to all). Plain "G-Tube" matches the first one. */
export function findCriterion(label, pool = CRITERIA) {
  const n = norm(label)
  return pool.find((c) => norm(criterionCsvLabel(c)) === n) || pool.find((c) => norm(c.label) === n)
}
