import { useMemo, useState } from 'react'
import SelectField from '../components/form/SelectField.jsx'
import TextField from '../components/form/TextField.jsx'
import Icon from '../components/Icon.jsx'
import Modal from '../components/Modal.jsx'
import Spinner from '../components/Spinner.jsx'
import { today } from '../lib/format.js'
import { geocode, route } from '../lib/geo.js'
import { rules, useForm } from '../lib/useForm.js'

export default function TripForm({ caregivers, clients, onSave, onClose }) {
  const f = useForm(
    { date: today(), caregiverId: '', clientId: '', from: '', to: '', miles: '', roundTrip: false, purpose: 'Client visit' },
    { date: (x) => (!x ? 'Pick the trip date.' : ''), caregiverId: rules.required('a caregiver'), miles: rules.miles },
  )
  const [calc, setCalc] = useState({ busy: false, error: '' })
  const v = f.values
  const cgOptions = useMemo(() => [...caregivers].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name })), [caregivers])
  const clOptions = useMemo(() => [...clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name })), [clients])

  async function calculate() {
    setCalc({ busy: true, error: '' })
    try {
      const a = await geocode(v.from)
      const b = await geocode(v.to)
      if (!a || !b) throw new Error(`Couldn't find the ${!a ? 'starting' : 'destination'} address on the map. Check it and try again.`)
      const r = await route(a, b)
      f.set('miles', (r.miles * (v.roundTrip ? 2 : 1)).toFixed(1))
      setCalc({ busy: false, error: '' })
    } catch (e) {
      setCalc({ busy: false, error: e.message })
    }
  }

  return (
    <Modal
      title="Log a trip"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="trip-form" className="btn btn-primary">
            Save trip
          </button>
        </>
      }
    >
      <form id="trip-form" ref={f.formRef} className="form-grid" noValidate onSubmit={f.submit((vals) => onSave({ ...vals, miles: +vals.miles }))}>
        <TextField label="Date" type="date" required value={v.date} onChange={(e) => f.set('date', e.target.value)} onBlur={f.blur('date')} error={f.errors.date} />
        <SelectField
          label="Caregiver"
          required
          placeholder="Select caregiver"
          options={cgOptions}
          value={v.caregiverId}
          error={f.errors.caregiverId}
          onBlur={f.blur('caregiverId')}
          onChange={(e) => {
            f.set('caregiverId', e.target.value)
            if (!v.from) f.set('from', caregivers.find((c) => c.id === e.target.value)?.address || '')
          }}
        />
        <SelectField
          label="Client"
          placeholder="None"
          options={clOptions}
          value={v.clientId}
          onChange={(e) => {
            f.set('clientId', e.target.value)
            const addr = clients.find((c) => c.id === e.target.value)?.address
            if (addr) f.set('to', addr)
          }}
        />
        <TextField label="Purpose" value={v.purpose} onChange={(e) => f.set('purpose', e.target.value)} />
        <TextField className="span-2" label="From address" value={v.from} onChange={(e) => f.set('from', e.target.value)} />
        <TextField className="span-2" label="To address" value={v.to} onChange={(e) => f.set('to', e.target.value)} />
        <TextField
          label="Miles"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          required
          value={v.miles}
          onChange={(e) => f.set('miles', e.target.value)}
          onBlur={f.blur('miles')}
          error={f.errors.miles || calc.error}
          help="Type it, or calculate it from the two addresses."
        />
        <div className="field-actions">
          <button type="button" className="btn btn-secondary" disabled={!v.from || !v.to || calc.busy} onClick={calculate}>
            {calc.busy ? <Spinner /> : <Icon name="route" size={18} />}
            {calc.busy ? 'Calculating…' : 'Calculate miles'}
          </button>
          <label className={'toggle-chip' + (v.roundTrip ? ' is-on' : '')}>
            <input type="checkbox" checked={v.roundTrip} onChange={(e) => f.set('roundTrip', e.target.checked)} />
            {v.roundTrip && <Icon name="check" size={16} />}
            Round trip
          </label>
        </div>
      </form>
    </Modal>
  )
}
