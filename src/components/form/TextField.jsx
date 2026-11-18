import { useId } from 'react'
import Icon from '../Icon.jsx'

/**
 * Floating-label text input. The label is the real <label>; `example` text appears only once the label has floated.
 * Pass `error` to show a validation message under the field.
 */
export default function TextField({ label, required, error, example, help, className = '', inputRef, children, ...props }) {
  const id = useId()
  const msgId = id + '-msg'
  return (
    <div className={'tf ' + (error ? 'tf-invalid ' : '') + className}>
      <div className="tf-box">
        <input
          id={id}
          ref={inputRef}
          placeholder={example || ' '}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || help ? msgId : undefined}
          {...props}
        />
        <label htmlFor={id}>
          {label}
          {required && <span aria-hidden="true"> *</span>}
        </label>
        {children}
      </div>
      {error ? (
        <p className="tf-error" id={msgId}>
          <Icon name="alert" size={16} /> {error}
        </p>
      ) : (
        help && (
          <p className="tf-help" id={msgId}>
            {help}
          </p>
        )
      )}
    </div>
  )
}
