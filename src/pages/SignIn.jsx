import { useRef, useState } from 'react'
import Footer from '../components/Footer.jsx'
import TextField from '../components/form/TextField.jsx'
import Icon from '../components/Icon.jsx'
import Spinner from '../components/Spinner.jsx'
import { APP_NAME } from '../config.js'
import { sendReset, signIn } from '../lib/auth.js'
import { firebaseConfigured } from '../lib/firebase.js'

const FAILURE = {
  credentials: 'Username or password is incorrect.',
  throttled: 'Too many attempts. Wait a few minutes, then try again.',
  network: 'Can’t reach the sign-in service. Check your internet connection and try again.',
}

// The signed-in user is picked up by the auth listener in main.jsx, so there is no success callback here.
export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [failed, setFailed] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const userRef = useRef(null)
  const passRef = useRef(null)

  const emailError = (v) => (!v.trim() ? 'Enter your email address.' : !/^\S+@\S+\.\S+$/.test(v.trim()) ? 'Enter an email address like name@example.com.' : '')

  async function submit(e) {
    e.preventDefault()
    const errs = { email: emailError(email), password: password ? '' : 'Enter your password.' }
    setErrors(errs)
    setFailed('')
    setNotice('')
    if (errs.email) return userRef.current?.focus()
    if (errs.password) return passRef.current?.focus()
    setBusy(true)
    const r = await signIn(email, password)
    if (!r.ok) {
      setBusy(false)
      // Keep the email, clear the password, never say which one was wrong.
      setPassword('')
      setFailed(FAILURE[r.reason])
      requestAnimationFrame(() => passRef.current?.focus())
    }
  }

  async function reset() {
    const err = emailError(email)
    setFailed('')
    setNotice('')
    if (err) {
      setErrors({ ...errors, email: err })
      return userRef.current?.focus()
    }
    setBusy(true)
    const r = await sendReset(email)
    setBusy(false)
    if (r.ok) setNotice('If an account exists for that address, we have sent instructions to reset the password.')
    else setFailed(FAILURE.network)
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
          {!firebaseConfigured && (
            <p className="callout callout-warning" role="alert">
              <Icon name="alert" size={18} />
              <span>Sign-in isn’t set up yet. Add the Firebase settings (VITE_FIREBASE_*) described in the README, then rebuild the app.</span>
            </p>
          )}
          {failed && (
            <p className="callout callout-danger" role="alert">
              <Icon name="alert" size={18} />
              <span>{failed}</span>
            </p>
          )}
          {notice && (
            <p className="callout callout-success" role="status">
              <Icon name="check" size={18} />
              <span>{notice}</span>
            </p>
          )}
          <TextField
            label="Email"
            type="email"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            inputRef={userRef}
            value={email}
            onChange={(e) => (setEmail(e.target.value), errors.email && setErrors({ ...errors, email: emailError(e.target.value) }))}
            onBlur={() => email && setErrors({ ...errors, email: emailError(email) })}
            error={errors.email}
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
          <button type="submit" className="btn btn-primary btn-block signin-submit" disabled={busy || !firebaseConfigured}>
            {busy && <Spinner size={14} />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <button type="button" className="btn-link signin-forgot" onClick={reset} disabled={busy || !firebaseConfigured}>
            Forgot password?
          </button>
        </form>
      </main>
      <Footer />
    </div>
  )
}
