import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { isSignedIn, setSignedIn } from './lib/auth.js'
import { load } from './lib/storage.js'
import SignIn from './pages/SignIn.jsx'

// Apply the saved theme before anything renders (the sign-in screen included).
document.documentElement.dataset.theme =
  load('ela-route:theme') || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

function Root() {
  const [signedIn, setSignedInState] = useState(isSignedIn)
  if (!signedIn) return <SignIn onSignedIn={() => setSignedInState(true)} />
  return (
    <App
      onSignOut={() => {
        setSignedIn(false)
        setSignedInState(false)
      }}
    />
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <Root />
    </ToastProvider>
  </StrictMode>,
)
