import { useRef, useState } from 'react'
import Footer from '../components/Footer.jsx'
import TextField from '../components/form/TextField.jsx'
import Icon from '../components/Icon.jsx'
import Spinner from '../components/Spinner.jsx'
import { APP_NAME } from '../config.js'
import { checkCredentials, setSignedIn } from '../lib/auth.js'

export default function SignIn({ onSignedIn }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const userRef = useRef(null)
  const passRef = useRef(null)

  async function submit(e) {
    e.preventDefault()
    const errs = {}
    if (!username.trim()) errs.username = 'Enter your username.'
    if (!password) errs.password = 'Enter your password.'
    setErrors(errs)
    setFailed(false)
    if (errs.username) return userRef.current?.focus()
    if (errs.password) return passRef.current?.focus()
    setBusy(true)
    const ok = await checkCredentials(username, password)
    setBusy(false)
    if (ok) {
      setSignedIn(true)
      onSignedIn()
    } else {
      // Keep the username, clear the password, never say which one was wrong.
      setPassword('')
      setFailed(true)
      requestAnimationFrame(() => passRef.current?.focus())
    }
  }

  return (
    <div className="signin">
      <main className="signin-main">
        <form className="signin-card" onSubmit={submit} noValidate>
          <div className="signin-brand">
            <Icon name="logo" size={28} />
            <span>{APP_NAME}</span>
          </div>
          <h1>Sign in to {APP_NAME}</h1>
          {failed && (
            <p className="callout callout-danger" role="alert">
              <Icon name="alert" size={18} />
              <span>Username or password is incorrect.</span>
            </p>
          )}
          <TextField
            label="Username"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            inputRef={userRef}
            value={username}
            onChange={(e) => (setUsername(e.target.value), errors.username && setErrors({ ...errors, username: '' }))}
            error={errors.username}
          />
          <TextField
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            inputRef={passRef}
            value={password}
            onChange={(e) => (setPassword(e.target.value), errors.password && setErrors({ ...errors, password: '' }))}
            error={errors.password}
          />
          <button type="submit" className="btn btn-primary btn-block signin-submit" disabled={busy}>
            {busy && <Spinner size={14} />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
      <Footer />
    </div>
  )
}
