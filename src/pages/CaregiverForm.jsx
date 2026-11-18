import ConfirmDelete from '../components/ConfirmDialog.jsx'
import CheckGroup from '../components/form/CheckGroup.jsx'
import SelectField from '../components/form/SelectField.jsx'
import TextAreaField from '../components/form/TextAreaField.jsx'
import TextField from '../components/form/TextField.jsx'
import Icon from '../components/Icon.jsx'
import Modal from '../components/Modal.jsx'
import { AVAILABILITY, DRIVERS, GENDERS, LANGUAGES, LEVELS, SKILLS, STATUSES } from '../lib/caregivers.js'
import { cached, forget } from '../lib/geo.js'
import { rules, useForm } from '../lib/useForm.js'
import { useState } from 'react'

const blank = {
  name: '',
  phone: '',
  status: 'Active',
  statusReason: '',
  level: 'Level 3',
  gender: '',
  driver: '',
  skills: [],
  languages: ['English'],
  availability: [],
  doNotAssign: false,
  address: '',
  notes: '',
  source: 'Manual entry',
}

export default function CaregiverForm({ initial, onSave, onDelete, onClose }) {
  const f = useForm({ ...blank, ...initial }, { name: rules.name, address: rules.addressFormat, phone: rules.phone })
  const [confirm, setConfirm] = useState(false)
  const v = f.values
  const notFound = initial?.address && v.address === initial.address && cached(v.address)?.fail

  const save = f.submit((vals) => {
    if (initial?.address && initial.address !== vals.address) forget(initial.address)
    onSave({ ...vals, name: vals.name.trim(), address: vals.address.trim() })
  })

  return (
    <Modal
      title={initial?.id ? `Edit ${initial.name}` : 'Add caregiver'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          {onDelete && (
            <button type="button" className="btn btn-ghost-danger" onClick={() => setConfirm(true)}>
              <Icon name="trash" size={18} /> Delete caregiver
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="caregiver-form" className="btn btn-primary">
            {initial?.id ? 'Save changes' : 'Add caregiver'}
          </button>
        </>
      }
    >
      <form id="caregiver-form" ref={f.formRef} className="form-grid" onSubmit={save} noValidate>
        <TextField label="Full name" required value={v.name} onChange={(e) => f.set('name', e.target.value)} onBlur={f.blur('name')} error={f.errors.name} autoComplete="off" />
        <TextField label="Phone" type="tel" example="(310) 555-0123" value={v.phone} onChange={(e) => f.set('phone', e.target.value)} onBlur={f.blur('phone')} error={f.errors.phone} />
        <TextField
          className="span-2"
          label="Home address"
          example="123 Main St, Los Angeles, CA 90012"
          value={v.address}
          onChange={(e) => f.set('address', e.target.value)}
          onBlur={f.blur('address')}
          error={f.errors.address}
          help={notFound ? 'This address could not be found on the map. Check the street name, or remove the apartment number.' : 'Used to calculate drive time to clients.'}
        />
        <SelectField label="Status" options={STATUSES} value={v.status} onChange={(e) => f.set('status', e.target.value)} />
        <TextField label="Status reason" example="On leave, expired training…" value={v.statusReason} onChange={(e) => f.set('statusReason', e.target.value)} />
        <SelectField label="Level" placeholder="Unknown" options={LEVELS} value={v.level} onChange={(e) => f.set('level', e.target.value)} />
        <SelectField label="Gender" placeholder="Unknown" options={GENDERS} value={v.gender} onChange={(e) => f.set('gender', e.target.value)} />
        <SelectField label="Transport" placeholder="Unknown" options={DRIVERS} value={v.driver} onChange={(e) => f.set('driver', e.target.value)} />
        <label className={'toggle-chip toggle-danger align-center' + (v.doNotAssign ? ' is-on' : '')}>
          <input type="checkbox" checked={v.doNotAssign} onChange={(e) => f.set('doNotAssign', e.target.checked)} />
          {v.doNotAssign && <Icon name="check" size={16} />}
          Do not assign
        </label>
        <CheckGroup className="span-2" legend="Skills" options={SKILLS} value={v.skills} onChange={(x) => f.set('skills', x)} />
        <CheckGroup legend="Languages" options={LANGUAGES} value={v.languages} onChange={(x) => f.set('languages', x)} />
        <CheckGroup legend="Availability" options={AVAILABILITY} value={v.availability} onChange={(x) => f.set('availability', x)} />
        <TextAreaField className="span-2" label="Notes" value={v.notes} onChange={(e) => f.set('notes', e.target.value)} />
      </form>
      {confirm && (
        <ConfirmDelete
          title="Delete caregiver?"
          message={`${initial.name} will be removed from the caregiver list. Trips already in the mileage log are kept. You can undo this right after.`}
          confirmLabel={`Delete ${initial.name}`}
          onCancel={() => setConfirm(false)}
          onConfirm={onDelete}
        />
      )}
    </Modal>
  )
}
