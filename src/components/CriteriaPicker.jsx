import { CRITERIA_GROUPS } from '../lib/criteria.js'

const NEXT = { '': 'P', P: 'R', R: '' }
const WORD = { '': 'Not needed', P: 'Preferred', R: 'Required' }

/**
 * CareFinder match criteria for a client. Each item cycles Not needed → Preferred → Required.
 * `value` is { [criterionId]: 'P' | 'R' }.
 */
export default function CriteriaPicker({ value = {}, onChange, className = '' }) {
  const set = (id) => {
    const next = NEXT[value[id] || '']
    const out = { ...value }
    if (next) out[id] = next
    else delete out[id]
    onChange(out)
  }
  const count = (k) => Object.values(value).filter((v) => v === k).length

  return (
    <fieldset className={'criteria ' + className}>
      <legend>Match criteria</legend>
      <p className="form-note criteria-legend">
        Select an item to cycle it: <span className="crit-mark crit-P">P</span> Preferred, <span className="crit-mark crit-R">R</span> Required, blank = not
        needed. {count('R')} required · {count('P')} preferred.
      </p>
      <div className="criteria-groups">
        {CRITERIA_GROUPS.map((g) => (
          <section key={g.id} className="criteria-group" aria-label={g.title}>
            <h4>{g.title}</h4>
            <ul>
              {g.items.map((c) => {
                const v = value[c.id] || ''
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={'crit-item' + (v ? ' crit-on-' + v : '')}
                      onClick={() => set(c.id)}
                      aria-label={`${c.label}: ${WORD[v]}. Select to change.`}
                    >
                      <span className={'crit-mark' + (v ? ' crit-' + v : '')} aria-hidden="true">
                        {v}
                      </span>
                      {c.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </fieldset>
  )
}
