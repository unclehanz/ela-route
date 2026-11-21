// Sign-in with Firebase Authentication (email + password).
// Accounts are created by an admin in the Firebase console (Authentication → Users); there is no self sign-up.
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore'
import { auth, db } from './firebase.js'

/** Calls `cb(user | null)` now and whenever the signed-in user changes. Returns an unsubscribe function. */
export const watchUser = (cb) => onAuthStateChanged(auth, cb)

/** Resolves { ok } or { ok: false, reason: 'credentials' | 'throttled' | 'network' }. */
export async function signIn(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email.trim(), password)
    return { ok: true }
  } catch (e) {
    if (e.code === 'auth/too-many-requests') return { ok: false, reason: 'throttled' }
    if (e.code === 'auth/network-request-failed') return { ok: false, reason: 'network' }
    // Wrong password, unknown email and disabled accounts all look the same to the user.
    return { ok: false, reason: 'credentials' }
  }
}

/** Sends a reset link if the account exists. Never reveals whether it does. */
export async function sendReset(email) {
  try {
    await sendPasswordResetEmail(auth, email.trim())
  } catch (e) {
    if (e.code === 'auth/network-request-failed') return { ok: false, reason: 'network' }
  }
  return { ok: true }
}

/** Signs out and wipes this device's offline copy of the data, then reloads to a clean sign-in screen. */
export async function signOutUser() {
  try {
    await signOut(auth)
    await terminate(db)
    await clearIndexedDbPersistence(db)
  } finally {
    window.location.reload()
  }
}
