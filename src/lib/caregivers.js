import { meets, requiredOf } from './criteria.js'

export const STATUSES = [
  'Active',
  'Regular Schedule',
  'Full Schedule',
  'Orientation',
  'On Hold',
  'Non-Responsive',
  'Inactive',
  'Unverified',
]
export const AVAILABLE_STATUSES = ['Active', 'Regular Schedule', 'Full Schedule', 'Orientation']
export const LEVELS = ['Level 1', 'Level 2', 'Level 3']
export const GENDERS = ['Female', 'Male']
export const DRIVERS = ['Driver', 'Non-Driver', 'No Car Insurance', 'No License']
export const SKILLS = ['Hospice', 'Hoyer Lift', 'Dementia', 'Gait Belt']
export const LANGUAGES = ['English', 'Spanish', 'Tagalog']
export const AVAILABILITY = ['Overnight', '12-Hour Shift', 'Weekends', 'Short Shifts']
export const CLIENT_NEEDS = ['Hospice', 'Hoyer Lift', 'Dementia', 'Gait Belt', 'No Pets', 'Non-Smoker', 'Spanish-Speaking', 'Driver Needed']
export const CONTACT_OUTCOMES = ['Called', 'Voicemail', 'Texted', 'Accepted', 'Declined', 'No Answer']

export const emptyFilters = () => ({
  search: '',
  statuses: [...AVAILABLE_STATUSES],
  level: '',
  gender: '',
  driver: '',
  hospice: false,
  spanish: false,
  overnight: false,
  twelve: false,
})

export function matches(cg, f) {
  if (f.search && !`${cg.name} ${cg.address} ${cg.notes}`.toLowerCase().includes(f.search.toLowerCase())) return false
  if (f.statuses?.length && !f.statuses.includes(cg.status)) return false
  if (f.excludeDoNotAssign && cg.doNotAssign) return false
  if (f.level && cg.level !== f.level) return false
  if (f.gender && cg.gender !== f.gender) return false
  if (f.driver && cg.driver !== f.driver) return false
  if (f.hospice && !cg.skills?.includes('Hospice')) return false
  if (f.spanish && !cg.languages?.includes('Spanish')) return false
  if (f.overnight && !cg.availability?.includes('Overnight')) return false
  if (f.twelve && !cg.availability?.includes('12-Hour Shift')) return false
  if (f.useCriteria && f.required?.some((id) => !meets(cg, id))) return false
  return true
}

/** Default caregiver filters implied by a client's care needs. */
export function filtersForClient(client) {
  const f = emptyFilters()
  if (!client) return f
  if (client.genderPreference) f.gender = client.genderPreference
  if (client.needs?.includes('Hospice')) f.hospice = true
  if (client.needs?.includes('Spanish-Speaking')) f.spanish = true
  if (client.needs?.includes('Driver Needed')) f.driver = 'Driver'
  // The client's Required match criteria (see criteria.js); they can be switched off in the Dispatch filters.
  f.required = requiredOf(client)
  f.useCriteria = f.required.length > 0
  return f
}
