import { useEffect, useState } from 'react'
import { load, save } from './storage.js'

export function useMediaQuery(query) {
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches
  const [match, setMatch] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const fn = () => setMatch(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [query])
  return match
}

/** true after `ms` — used so quick responses never flash a loading state. */
export function useDelayed(active, ms = 300) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!active) {
      setShow(false)
      return
    }
    const t = setTimeout(() => setShow(true), ms)
    return () => clearTimeout(t)
  }, [active, ms])
  return active && show
}

const THEME_KEY = 'ela-route:theme'
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = load(THEME_KEY)
    if (saved) return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    save(THEME_KEY, theme)
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}
