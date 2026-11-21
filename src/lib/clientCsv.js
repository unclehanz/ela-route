// Client CSV: template, import and export.
// Lists inside one cell are separated by semicolons. Match criteria go in two columns, by name:
// "Required Criteria" and "Preferred Criteria" (e.g. "Cooking; Level 3 Service; Driver's License").
import { CLIENT_NEEDS, GENDERS } from './caregivers.js'
import { CRITERIA, CRITERION } from './criteria.js'
import { criterionCsvLabel, csvFile, findCriterion, joinList, list, pick, pickMany, readRows } from './csv.js'

export const CLIENT_COLUMNS = ['Name', 'Phone', 'Address', 'Care Manager', 'Caregiver Gender', 'Care Needs', 'Required Criteria', 'Preferred Criteria', 'Notes']

const EXAMPLE = [
  'EXAMPLE - delete this row',
  '(562) 555-0188',
  '456 Ocean Blvd, Long Beach, CA 90802',
  'Jane Cruz',
  'Female',
  'Hospice; No Pets',
  "Cooking; Level 3 Service; Driver's License; Dementia",
  'Wheelchair; Sundowning',
  'Gate code 1234',
]

export function clientTemplate() {
  return {
    template: csvFile([CLIENT_COLUMNS, EXAMPLE]),
    guide: csvFile([
      ['Column', 'Allowed values (separate several with ;)'],
      ['Caregiver Gender', joinList(GENDERS) + ' (blank = no preference)'],
      ['Care Needs', joinList(CLIENT_NEEDS)],
      ['Required Criteria / Preferred Criteria', joinList(CRITERIA.map(criterionCsvLabel))],
    ]),
  }
}

const criteriaWith = (criteria, mark) =>
  joinList(Object.keys(criteria || {}).filter((id) => criteria[id] === mark && CRITERION[id]).map((id) => criterionCsvLabel(CRITERION[id])))

/** All clients as CSV, in the template's format. */
export function clientsToCsv(clients) {
  return csvFile([
    CLIENT_COLUMNS,
    ...clients.map((c) => [c.name, c.phone, c.address, c.careManager, c.genderPreference, joinList(c.needs), criteriaWith(c.criteria, 'R'), criteriaWith(c.criteria, 'P'), c.notes]),
  ])
}

/** Parse a filled-in template (or an export) into clients. Returns { records, problems, skipped }. */
export function parseClientCsv(text) {
  return readRows(text, CLIENT_COLUMNS, (get, line, problems) => {
    const criteria = {}
    for (const [column, mark] of [
      ['Preferred Criteria', 'P'],
      ['Required Criteria', 'R'], // Required wins if an item is in both columns
    ])
      for (const label of list(get(column))) {
        const hit = findCriterion(label)
        if (hit) criteria[hit.id] = mark
        else problems.push(`Row ${line}: “${label}” is not a match criterion`)
      }
    return {
      id: `csv-${line}`,
      name: get('Name'),
      phone: get('Phone'),
      address: get('Address'),
      careManager: get('Care Manager'),
      genderPreference: pick(get('Caregiver Gender'), GENDERS, 'Caregiver Gender', problems, line),
      needs: pickMany(get('Care Needs'), CLIENT_NEEDS, 'Care Needs', problems, line),
      criteria,
      notes: get('Notes'),
    }
  })
}
