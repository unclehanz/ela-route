import { useId } from 'react'

export default function TextAreaField({ label, className = '', ...props }) {
  const id = useId()
  return (
    <div className={'tf tf-area ' + className}>
      <div className="tf-box">
        <textarea id={id} placeholder=" " rows={3} {...props} />
        <label htmlFor={id}>{label}</label>
      </div>
    </div>
  )
}
