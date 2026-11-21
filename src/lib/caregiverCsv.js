// Caregiver CSV: template, import and export.
// Lists inside one cell are separated by semicolons. Credentials are written "Type: expiration date",
// e.g. "Driver's License: 2028-03-28; Tuberculosis Test: 2028-02-05".
import { AVAILABILITY, DRIVERS, GENDERS, LANGUAGES, LEVELS, SKILLS, STATUSES } from './caregivers.js'
import { CRITERION, EXPERIENCE_GROUPS, monthBefore } from './criteria.js'
import { criterionCsvLabel, csvFile, findCriterion, joinList, list, pick, pickMany, readRows } from './csv.js'

export const CAREGIVER_COLUMNS = [
  'Name',
  'Phone',
  'Address',
  'Status',
  'Status Reason',
  'Level',
  'Gender',
  'Transport',
  'Skills',
  'Languages',
  'Availability',
  'Experience',
  'Credentials',
  'Do Not Assign',
  'Notes',
]

const EXPERIENCE = EXPERIENCE_GROUPS.flatMap((g) => g.items)

const EXAMPLE = [
  'EXAMPLE - delete this row',
  '(310) 555-0123',
  '123 Main St, Los Angeles, CA 90012',
  'Active',
  '',
  'Level 3',
  'Female',
  'Driver',
  'Hospice; Dementia',
  'English; Spanish',
  'Overnight; Weekends',
  'Bathing; Cooking; Toileting; Wheelchair; Dementia',
  "Driver's License: 2028-03-28; Car Insurance: 2027-02-28; Tuberculosis Test: 2028-02-05",
  'No',
  'Prefers short shifts',
]

/** Template (header + example row) and a second file listing the values each column accepts. */
export function caregiverTemplate() {
  return {
    template: csvFile([CAREGIVER_COLUMNS, EXAMPLE]),
    guide: csvFile([
      ['Column', 'Allowed values (separate several with ;)'],
      ['Status', joinList(STATUSES)],
      ['Level', joinList(LEVELS)],
      ['Gender', joinList(GENDERS)],
      ['Transport', joinList(DRIVERS)],
      ['Skills', joinList(SKILLS)],
      ['Languages', joinList(LANGUAGES)],
      ['Availability', joinList(AVAILABILITY)],
      ['Experience', joinList(EXPERIENCE.map(criterionCsvLabel))],
      ['Credentials', 'Type: yyyy-mm-dd (expiration date, optional). Any certification name is accepted.'],
      ['Do Not Assign', 'Yes; No'],
    ]),
  }
}

/** All caregivers as CSV, in the template's format (only active credentials are included). */
export function caregiversToCsv(caregivers) {
  return csvFile([
    CAREGIVER_COLUMNS,
    ...caregivers.map((c) => [
      c.name,
      c.phone,
      c.address,
      c.status,
      c.statusReason,
      c.level,
      c.gender,
      c.driver,
      joinList(c.skills),
      joinList(c.languages),
      joinList(c.availability),
      joinList((c.experience || []).map((id) => CRITERION[id] && criterionCsvLabel(CRITERION[id])).filter(Boolean)),
      joinList((c.credentials || []).filter((x) => x.active).map((x) => (x.expires ? `${x.type}: ${x.expires}` : x.type))),
      c.doNotAssign ? 'Yes' : 'No',
      c.notes,
    ]),
  ])
}

function toDate(s, line, problems) {
  if (!s) return ''
  const d = new Date(s + (/^\d{4}-\d{2}-\d{2}$/.test(s) ? 'T12:00:00' : ''))
  if (Number.isNaN(+d)) {
    problems.push(`Row ${line}: “${s}” is not a date (use yyyy-mm-dd)`)
    return ''
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Parse a filled-in template (or an export) into caregivers. Returns { records, problems, skipped }. */
export function parseCaregiverCsv(text) {
  return readRows(text, CAREGIVER_COLUMNS, (get, line, problems) => ({
    id: `csv-${line}`,
    name: get('Name'),
    phone: get('Phone'),
    address: get('Address'),
    status: pick(get('Status'), STATUSES, 'Status', problems, line) || 'Active',
    statusReason: get('Status Reason'),
    level: pick(get('Level'), LEVELS, 'Level', problems, line),
    gender: pick(get('Gender'), GENDERS, 'Gender', problems, line),
    driver: pick(get('Transport'), DRIVERS, 'Transport', problems, line),
    skills: pickMany(get('Skills'), SKILLS, 'Skills', problems, line),
    languages: pickMany(get('Languages'), LANGUAGES, 'Languages', problems, line),
    availability: pickMany(get('Availability'), AVAILABILITY, 'Availability', problems, line),
    experience: list(get('Experience'))
      .map((label) => {
        const hit = findCriterion(label, EXPERIENCE)
        if (!hit) problems.push(`Row ${line}: “${label}” is not an Experience option`)
        return hit?.id
      })
      .filter(Boolean),
    credentials: list(get('Credentials')).map((item) => {
      const m = item.match(/^(.*?)(?::\s*(\S.*))?$/)
      const expires = toDate(m[2]?.trim(), line, problems)
      return { type: m[1].trim(), active: true, expires, alertDate: monthBefore(expires), alertCaregiver: !!expires, notes: '' }
    }),
    doNotAssign: /^(y|yes|true|1|x)$/i.test(get('Do Not Assign')),
    notes: get('Notes'),
    source: 'CSV import',
  }))
}
