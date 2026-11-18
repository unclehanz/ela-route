import { useId } from 'react'
import Icon from '../Icon.jsx'

/** Select with a permanently floated label. options: string[] or {value, label}[] */
export default function SelectField({ label, options, placeholder, required, error, className = '', ...props }) {
  const id = useId()
  return (
    <div className={'tf tf-select ' + (error ? 'tf-invalid ' : '') + className}>
      <div className="tf-box">
        <select id={id} required={required} aria-invalid={error ? true : undefined} aria-describedby={error ? id + '-msg' : undefined} {...props}>
          {placeholder != null && <option value="">{placeholder}</option>}
          {options.map((o) => {
            const v = typeof o === 'string' ? { value: o, label: o } : o
            return (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            )
          })}
        </select>
        <label htmlFor={id}>
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
        <Icon name="chevronDown" size={18} className="tf-chevron" />
      </div>
      {error && (
        <p className="tf-error" id={id + '-msg'}>
          <Icon name="alert" size={16} /> {error}
        </p>
      )}
    </div>
  )
}
