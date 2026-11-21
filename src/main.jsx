import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.jsx'
import Spinner from './components/Spinner.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { signOutUser, watchUser } from './lib/auth.js'
import { firebaseConfigured } from './lib/firebase.js'
import { useDelayed } from './lib/hooks.js'
import { load } from './lib/storage.js'
import SignIn from './pages/SignIn.jsx'

// Apply the saved theme before anything renders (the sign-in screen included).
document.documentElement.dataset.theme =
  load('ela-route:theme') || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

function Root() {
  const [user, setUser] = useState(firebaseConfigured ? undefined : null) // undefined = still checking
  useEffect(() => (firebaseConfigured ? watchUser(setUser) : undefined), [])
  const showSpinner = useDelayed(user === undefined)

  if (user === undefined)
    return (
      <div className="app-status" aria-busy="true">
        {showSpinner && (
          <p className="status-line">
            <Spinner size={14} /> Checking sign-in…
          </p>
        )}
      </div>
    )
  if (!user) return <SignIn />
  return <App key={user.uid} user={user} onSignOut={signOutUser} />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <Root />
    </ToastProvider>
  </StrictMode>,
)
