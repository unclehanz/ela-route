import { AVAILABLE_STATUSES, DRIVERS, GENDERS, LEVELS, STATUSES } from '../lib/caregivers.js'
import CheckGroup from './form/CheckGroup.jsx'
import SelectField from './form/SelectField.jsx'
import TextField from './form/TextField.jsx'
import Icon from './Icon.jsx'
import Popover from './Popover.jsx'

const TOGGLES = [
  ['hospice', 'Hospice'],
  ['spanish', 'Spanish'],
  ['overnight', 'Overnight'],
  ['twelve', '12-hour'],
]

export function statusSummary(value) {
  if (value.length === STATUSES.length) return 'All statuses'
  if (value.length === AVAILABLE_STATUSES.length && AVAILABLE_STATUSES.every((s) => value.includes(s))) return 'Available only'
  return `${value.length} statuses`
}

export function StatusPicker({ value, onChange }) {
  return (
    <>
      <div className="popover-actions">
        <button type="button" className="btn-link" onClick={() => onChange([...AVAILABLE_STATUSES])}>
          Available only
        </button>
        <button type="button" className="btn-link" onClick={() => onChange([...STATUSES])}>
          Select all
        </button>
      </div>
      <CheckGroup options={STATUSES} value={value} onChange={onChange} />
    </>
  )
}

/** Caregiver filters. `stacked` lays them out vertically (used inside the Dispatch filter popover). */
export default function FilterBar({ filters, setFilters, showSearch = true, stacked = false }) {
  const set = (patch) => setFilters({ ...filters, ...patch })
  return (
    <div className={stacked ? 'filter-stack' : 'filter-bar'}>
      {showSearch && (
        <TextField
          label="Search"
          example="Name, address or notes"
          type="search"
          className="filter-search"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
        />
      )}
      <SelectField label="Level" placeholder="Any" options={LEVELS} value={filters.level} onChange={(e) => set({ level: e.target.value })} />
      <SelectField label="Gender" placeholder="Any" options={GENDERS} value={filters.gender} onChange={(e) => set({ gender: e.target.value })} />
      <SelectField label="Transport" placeholder="Any" options={DRIVERS} value={filters.driver} onChange={(e) => set({ driver: e.target.value })} />
      <div className="filter-toggles" role="group" aria-label="Requirements">
        {TOGGLES.map(([k, label]) => (
          <label key={k} className={'toggle-chip' + (filters[k] ? ' is-on' : '')}>
            <input type="checkbox" checked={filters[k]} onChange={(e) => set({ [k]: e.target.checked })} />
            {filters[k] && <Icon name="check" size={14} />}
            {label}
          </label>
        ))}
      </div>
      {stacked ? (
        <fieldset className="check-group">
          <legend>Status</legend>
          <StatusPicker value={filters.statuses} onChange={(statuses) => set({ statuses })} />
        </fieldset>
      ) : (
        <Popover label={statusSummary(filters.statuses)}>
          <StatusPicker value={filters.statuses} onChange={(statuses) => set({ statuses })} />
        </Popover>
      )}
    </div>
  )
}
