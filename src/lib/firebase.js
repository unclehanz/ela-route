// Firebase client (Auth + Firestore). Config comes from VITE_FIREBASE_* variables (see .env.example).
// These values identify the Firebase project; they are not secrets. Access is enforced by firestore.rules.
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const env = import.meta.env
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

/** False until the VITE_FIREBASE_* variables are set; the sign-in screen explains what to do. */
export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId)

export const app = firebaseConfigured ? initializeApp(config) : null
export const auth = app ? getAuth(app) : null
// Offline cache: the app keeps working without a connection and syncs when it is back. Cleared on sign-out.
export const db = app
  ? initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }), ignoreUndefinedProperties: true })
  : null
