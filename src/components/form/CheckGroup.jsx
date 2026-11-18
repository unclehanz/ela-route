import Icon from '../Icon.jsx'

/** A labelled group of toggle chips backed by real checkboxes. */
export default function CheckGroup({ legend, options, value, onChange, className = '' }) {
  const toggle = (o) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])
  return (
    <fieldset className={'check-group ' + className}>
      {legend && <legend>{legend}</legend>}
      <div className="check-options">
        {options.map((o) => {
          const on = value.includes(o)
          return (
            <label key={o} className={'toggle-chip' + (on ? ' is-on' : '')}>
              <input type="checkbox" checked={on} onChange={() => toggle(o)} />
              {on && <Icon name="check" size={16} />}
              {o}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
