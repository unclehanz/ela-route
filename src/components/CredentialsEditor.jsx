import { useState } from 'react'
import { blankCredential, credentialState, CREDENTIAL_TYPES, monthBefore } from '../lib/criteria.js'
import { fmtDate } from '../lib/format.js'
import Icon from './Icon.jsx'

const STATE_TEXT = { expired: 'Expired', renew: 'Renew soon' }

/**
 * Caregiver certifications & credentials, laid out like CareFinder:
 * Active · Type · Expiration date · Alert date · Alert caregiver? · Notes.
 * `value` holds only the credentials that have something filled in; every standard type is always listed.
 */
export default function CredentialsEditor({ value = [], onChange, className = '' }) {
  const [custom, setCustom] = useState('')
  const byType = new Map(value.map((c) => [c.type, c]))
  const types = [...CREDENTIAL_TYPES, ...value.map((c) => c.type).filter((t) => !CREDENTIAL_TYPES.includes(t))]

  const update = (type, patch) => {
    const cur = byType.get(type) || blankCredential(type)
    const next = { ...cur, ...patch }
    // Setting an expiration date fills the alert date (one month before) and switches the credential on.
    if ('expires' in patch && patch.expires) {
      if (!cur.alertDate || cur.alertDate === monthBefore(cur.expires)) next.alertDate = monthBefore(patch.expires)
      if (!cur.active && !cur.expires) next.active = true
    }
    const filled = next.active || next.expires || next.alertDate || next.alertCaregiver || next.notes
    const rest = value.filter((c) => c.type !== type)
    onChange(filled ? [...rest, next].sort((a, b) => types.indexOf(a.type) - types.indexOf(b.type)) : rest)
  }

  const addCustom = () => {
    const t = custom.trim()
    if (!t || types.some((x) => x.toLowerCase() === t.toLowerCase())) return setCustom('')
    onChange([...value, { ...blankCredential(t), active: true }])
    setCustom('')
  }

  return (
    <fieldset className={'credentials ' + className}>
      <legend>Certifications and credentials</legend>
      <div className="cred-scroll">
        <table className="cred-table">
          <thead>
            <tr>
              <th scope="col">Active</th>
              <th scope="col">Type</th>
              <th scope="col">Expiration date</th>
              <th scope="col">Alert date</th>
              <th scope="col">Alert caregiver?</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {types.map((type) => {
              const c = byType.get(type) || blankCredential(type)
              const state = credentialState(c)
              return (
                <tr key={type} className={c.active ? 'is-active' : ''}>
                  <td>
                    <input type="checkbox" checked={c.active} onChange={(e) => update(type, { active: e.target.checked })} aria-label={`${type} active`} />
                  </td>
                  <th scope="row">
                    {type}
                    {STATE_TEXT[state] && (
                      <span className={'cred-state cred-' + state}>
                        <Icon name="alert" size={14} /> {STATE_TEXT[state]}
                        {state === 'expired' && ` ${fmtDate(c.expires)}`}
                      </span>
                    )}
                  </th>
                  <td>
                    <input type="date" className="input-sm" value={c.expires} onChange={(e) => update(type, { expires: e.target.value })} aria-label={`${type} expiration date`} />
                  </td>
                  <td>
                    <input type="date" className="input-sm" value={c.alertDate} onChange={(e) => update(type, { alertDate: e.target.value })} aria-label={`${type} alert date`} />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={c.alertCaregiver}
                      onChange={(e) => update(type, { alertCaregiver: e.target.checked })}
                      aria-label={`Alert caregiver about ${type}`}
                    />
                  </td>
                  <td>
                    <input className="input-sm" value={c.notes} onChange={(e) => update(type, { notes: e.target.value })} aria-label={`${type} notes`} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="cred-add">
        <input
          className="input-sm"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          placeholder="Other certification or credential"
          aria-label="Other certification or credential"
        />
        <button type="button" className="btn btn-secondary" onClick={addCustom} disabled={!custom.trim()}>
          <Icon name="plus" size={16} /> Add certification or credential
        </button>
      </div>
    </fieldset>
  )
}
