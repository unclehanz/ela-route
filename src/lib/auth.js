// Sign-in gate for the static site.
// IMPORTANT: on a static site (GitHub Pages) this check runs in the visitor's browser, so it keeps casual visitors out
// but is NOT real security — anyone technical can bypass it. That is why the site ships with no personal data:
// caregiver/client data only exists in the browser of whoever imported it.
// Only a SHA-256 fingerprint of "username + password" is stored here, never the password itself.
const CREDENTIAL_HASH = '646732cf5431787040ea7081ec9fbeeb5410adadf127738e918ca35d08af52a1'
const SALT = 'ela-route:v1'
const SESSION_KEY = 'ela-route:session'

async function sha256(text) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function checkCredentials(username, password) {
  const hash = await sha256(`${SALT}\n${username.trim().toLowerCase()}\n${password}`)
  // Small fixed delay so every attempt takes the same time, right or wrong.
  await new Promise((r) => setTimeout(r, 400))
  return hash === CREDENTIAL_HASH
}

// The session lasts until the browser tab is closed.
export function isSignedIn() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === CREDENTIAL_HASH
  } catch {
    return false
  }
}

export function setSignedIn(on) {
  try {
    if (on) sessionStorage.setItem(SESSION_KEY, CREDENTIAL_HASH)
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* storage blocked: the user simply signs in again next time */
  }
}
