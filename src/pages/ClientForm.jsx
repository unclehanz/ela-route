import { useState } from 'react'
import ConfirmDelete from '../components/ConfirmDialog.jsx'
import CheckGroup from '../components/form/CheckGroup.jsx'
import SelectField from '../components/form/SelectField.jsx'
import TextAreaField from '../components/form/TextAreaField.jsx'
import TextField from '../components/form/TextField.jsx'
import CriteriaPicker from '../components/CriteriaPicker.jsx'
import Icon from '../components/Icon.jsx'
import Modal from '../components/Modal.jsx'
import { CLIENT_NEEDS, GENDERS } from '../lib/caregivers.js'
import { cached, forget } from '../lib/geo.js'
import { rules, useForm } from '../lib/useForm.js'

const blank = { name: '', address: '', careManager: '', genderPreference: '', needs: [], criteria: {}, notes: '', phone: '' }

export default function ClientForm({ initial, careManagers = [], onSave, onDelete, onClose }) {
  const f = useForm({ ...blank, ...initial }, { name: rules.name, address: rules.addressRequired, phone: rules.phone })
  const [confirm, setConfirm] = useState(false)
  const v = f.values
  const notFound = initial?.address && v.address === initial.address && cached(v.address)?.fail

  const save = f.submit((vals) => {
    if (initial?.address && initial.address !== vals.address) forget(initial.address)
    onSave({ ...vals, name: vals.name.trim(), address: vals.address.trim() })
  })

  return (
    <Modal
      title={initial?.id ? `Edit ${initial.name}` : 'Add client'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          {onDelete && (
            <button type="button" className="btn btn-ghost-danger" onClick={() => setConfirm(true)}>
              <Icon name="trash" size={18} /> Delete client
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="client-form" className="btn btn-primary">
            {initial?.id ? 'Save changes' : 'Add client'}
          </button>
        </>
      }
    >
      <form id="client-form" ref={f.formRef} className="form-grid" onSubmit={save} noValidate>
        <TextField label="Client name" required value={v.name} onChange={(e) => f.set('name', e.target.value)} onBlur={f.blur('name')} error={f.errors.name} autoComplete="off" />
        <TextField label="Phone" type="tel" value={v.phone} onChange={(e) => f.set('phone', e.target.value)} onBlur={f.blur('phone')} error={f.errors.phone} />
        <TextField
          className="span-2"
          label="Address"
          required
          example="456 Ocean Blvd, Long Beach, CA 90802"
          value={v.address}
          onChange={(e) => f.set('address', e.target.value)}
          onBlur={f.blur('address')}
          error={f.errors.address}
          help={notFound ? 'This address could not be found on the map. Check the street name, or remove the apartment number.' : undefined}
        />
        <TextField label="Care manager" list="care-managers" value={v.careManager} onChange={(e) => f.set('careManager', e.target.value)}>
          <datalist id="care-managers">
            {careManagers.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </TextField>
        <SelectField
          label="Caregiver gender"
          placeholder="No preference"
          options={GENDERS}
          value={v.genderPreference}
          onChange={(e) => f.set('genderPreference', e.target.value)}
        />
        <CheckGroup className="span-2" legend="Care needs" options={CLIENT_NEEDS} value={v.needs} onChange={(x) => f.set('needs', x)} />
        <p className="form-note span-2">Gender preference, Hospice, Spanish-Speaking and Driver Needed narrow the caregiver list on the Dispatch page.</p>
        <CriteriaPicker className="span-2" value={v.criteria} onChange={(x) => f.set('criteria', x)} />
        <p className="form-note span-2">Caregivers missing a Required item are left out of Dispatch results (you can switch this off in Filters). Preferred items are counted on each result.</p>
        <TextAreaField className="span-2" label="Notes" value={v.notes} onChange={(e) => f.set('notes', e.target.value)} />
      </form>
      {confirm && (
        <ConfirmDelete
          title="Delete client?"
          message={`${initial.name} will be removed from the client list. You can undo this right after.`}
          confirmLabel={`Delete ${initial.name}`}
          onCancel={() => setConfirm(false)}
          onConfirm={onDelete}
        />
      )}
    </Modal>
  )
}
