// CareFinder match criteria (client requirements) and caregiver certifications & credentials.
// Lists mirror the agency's CareFinder screens. Ids are stable slugs so stored data survives label tweaks.
import { today } from './format.js'

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const group = (id, title, labels) => ({ id, title, items: labels.map((label) => ({ id: `${id}-${slug(label)}`, label, group: id })) })

/** Client match criteria, in the order CareFinder shows them. Each can be marked Preferred (P) or Required (R). */
export const CRITERIA_GROUPS = [
  group('gen', 'General', [
    'Ambulation/Mobility',
    'Bathing',
    'Bed Bath',
    'Cooking',
    'COVID 19 Training/Certification with ABC',
    'Dressing',
    'Hospice (No Comfort Kit)',
    'Incontinence Bladder',
    'Incontinence Bowel',
    'Incontinence Experience (briefs)',
    'Level 1 Service',
    'Level 2 Service',
    'Level 3 Service',
    'Prefers Female Caregiver',
    'Prefers Male Caregiver',
    'Toileting',
  ]),
  group('cert', 'Certifications', [
    'Car Insurance',
    'CNA License',
    "Driver's License",
    'G-Tube',
    'Guide Dementia Training #1',
    'Guide Dementia Training #2',
    'HHA Certification',
    'Home Care License',
    'Hoyer Lift Experience',
    'Know Your Rights Feb 1st',
    'Non-driver',
    'Tuberculosis Test',
  ]),
  group('xfer', 'Transfers', [
    'Can Handle Client Weight',
    'General Transferring',
    'Hips, Knees (fractures)',
    'Hospital Bed',
    'Hoyer Lift',
    'Range of Motion (PT)',
    'Repositioning/Bed Bound',
    'Walker and Cane',
    'Wheelchair',
  ]),
  group('misc', 'Other/Misc', [
    'ALS',
    "Alzheimer's",
    'Arthritis',
    'Bed Pan',
    'Cancer/Chemotherapy',
    'Combative/Hallucinations',
    'COPD',
    'Dementia',
    'G-Tube',
    'Heart Disease',
    'Hospice (end of life)',
    'Mild Cognitive Impairment',
    "Parkinson's",
    'Stroke',
    'Sundowning',
  ]),
]

export const CRITERIA = CRITERIA_GROUPS.flatMap((g) => g.items)
export const CRITERION = Object.fromEntries(CRITERIA.map((c) => [c.id, c]))

/** Criteria answered by the caregiver's level and gender instead of the experience checklist. */
const LEVEL_IDS = { 'gen-level-1-service': 1, 'gen-level-2-service': 2, 'gen-level-3-service': 3 }
const GENDER_IDS = { 'gen-prefers-female-caregiver': 'Female', 'gen-prefers-male-caregiver': 'Male' }

/** Experience a caregiver can tick on their profile: every non-certification criterion except level and gender. */
export const EXPERIENCE_GROUPS = CRITERIA_GROUPS.filter((g) => g.id !== 'cert').map((g) => ({
  ...g,
  items: g.items.filter((c) => !(c.id in LEVEL_IDS) && !(c.id in GENDER_IDS)),
}))

/** Caregiver certification & credential types, in the order CareFinder shows them. Custom types can be added. */
export const CREDENTIAL_TYPES = [
  'Car Insurance',
  'CNA License',
  "Driver's License",
  'G-Tube',
  'Guide Dementia Training #1',
  'Guide Dementia Training #2',
  'HHA Certification',
  'Home Care License',
  'Hoyer Lift Experience',
  'Know Your Rights Feb 1st',
  'Live Scan',
  'LVN/LPN Certification',
  'Non-driver',
  'Passport',
  'Performance Evaluation',
  'SNF/Hospital',
  'State Affiliation date with ABC',
  'State ID Card',
  'State Training Required',
  'Tuberculosis Test',
]

export const blankCredential = (type) => ({ type, active: false, expires: '', alertDate: '', alertCaregiver: false, notes: '' })

/** yyyy-mm-dd one month before `iso` (the default alert date CareFinder uses). */
export function monthBefore(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 2, Math.min(d, new Date(y, m - 1, 0).getDate()))
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** 'expired' | 'renew' (alert date reached) | 'ok' for one credential. */
export function credentialState(c, on = today()) {
  if (!c?.active) return 'inactive'
  if (c.expires && c.expires < on) return 'expired'
  if (c.alertDate && c.alertDate <= on) return 'renew'
  return 'ok'
}

const credential = (cg, type) => (cg.credentials || []).find((c) => c.type === type)

/**
 * Does the caregiver meet one criterion?
 * Certifications need an active, unexpired credential. Caregivers imported from the spreadsheet have no credentials yet,
 * so a few are inferred from older fields (transport, skills) until a credential of that type is entered.
 */
export function meets(cg, id) {
  const c = CRITERION[id]
  if (!c) return true
  if (id in LEVEL_IDS) return (+String(cg.level || '').replace(/\D/g, '') || 0) >= LEVEL_IDS[id]
  if (id in GENDER_IDS) return cg.gender === GENDER_IDS[id]
  const skills = cg.skills || []
  if (c.group === 'cert') {
    const cred = credential(cg, c.label)
    if (cred) return ['ok', 'renew'].includes(credentialState(cred))
    if (c.label === "Driver's License") return ['Driver', 'No Car Insurance'].includes(cg.driver)
    if (c.label === 'Car Insurance') return cg.driver === 'Driver'
    if (c.label === 'Non-driver') return ['Non-Driver', 'No License'].includes(cg.driver)
    if (c.label === 'Hoyer Lift Experience') return skills.includes('Hoyer Lift')
    return false
  }
  if ((cg.experience || []).includes(id)) return true
  if (['misc-dementia', 'misc-alzheimer-s'].includes(id)) return skills.includes('Dementia')
  if (id === 'xfer-hoyer-lift') return skills.includes('Hoyer Lift')
  if (['gen-hospice-no-comfort-kit', 'misc-hospice-end-of-life'].includes(id)) return skills.includes('Hospice')
  return false
}

/** Ids a client marks as Required / Preferred. `criteria` is { [id]: 'R' | 'P' }. */
export const requiredOf = (client) => Object.keys(client?.criteria || {}).filter((id) => client.criteria[id] === 'R' && CRITERION[id])
export const preferredOf = (client) => Object.keys(client?.criteria || {}).filter((id) => client.criteria[id] === 'P' && CRITERION[id])

/** How a caregiver fits a client's criteria: missing required items and preferred items met. */
export function fit(cg, client) {
  const req = requiredOf(client)
  const pref = preferredOf(client)
  return {
    missing: req.filter((id) => !meets(cg, id)),
    preferredMet: pref.filter((id) => meets(cg, id)).length,
    preferredTotal: pref.length,
  }
}
