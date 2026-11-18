import { useRef, useState } from 'react'

/**
 * Minimal form state with validation on blur (once edited) and submit, live re-validation after an error,
 * and focus moved to the first invalid field on a failed submit.
 * rules: { field: (value, allValues) => errorMessage | '' }
 */
export function useForm(initial, rules) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({})
  const formRef = useRef(null)
  const touched = useRef(new Set())

  const check = (k, v, all) => rules[k]?.(v, all) || ''

  const set = (k, v) => {
    touched.current.add(k)
    setValues((x) => {
      const next = { ...x, [k]: v }
      setErrors((e) => (e[k] ? { ...e, [k]: check(k, v, next) } : e))
      return next
    })
  }
  // Blur only validates fields the user has actually edited, so opening a form never shows errors.
  const blur = (k) => () => {
    if (touched.current.has(k)) setErrors((e) => ({ ...e, [k]: check(k, values[k], values) }))
  }

  const submit = (onValid) => (e) => {
    e.preventDefault()
    const errs = {}
    for (const k of Object.keys(rules)) {
      const m = check(k, values[k], values)
      if (m) errs[k] = m
    }
    setErrors(errs)
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus())
      return
    }
    onValid(values)
  }

  return { values, set, setValues, errors, blur, submit, formRef }
}

export const rules = {
  name: (v) => (!v?.trim() ? 'Enter a name.' : v.trim().length < 2 ? 'Name must be at least 2 characters.' : ''),
  addressRequired: (v) => (!v?.trim() ? 'Enter the street address so distances can be calculated.' : rules.addressFormat(v)),
  addressFormat: (v) => {
    if (!v?.trim()) return ''
    if (!/^\s*\d+\s+\S+/.test(v)) return 'Start with the street number, e.g. 123 Main St.'
    if (!/\b\d{5}\b/.test(v)) return 'Add the 5-digit ZIP code, e.g. Los Angeles, CA 90016.'
    return ''
  },
  phone: (v) => (v && v.replace(/\D/g, '').length < 10 ? 'Enter a 10-digit phone number.' : ''),
  miles: (v) => (v === '' || v == null ? 'Enter the miles driven.' : +v <= 0 || +v > 1000 ? 'Miles must be between 0.1 and 1000.' : ''),
  required: (label) => (v) => (!v ? `Select ${label}.` : ''),
}
