import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore'
import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from './firebase.js'
import { load, uid } from './storage.js'

// Data before Firebase lived in localStorage under this key. It is uploaded once to an empty account, then removed.
const LEGACY_KEY = 'ela-route:data:v1'

// The app ships with no personal data. Caregivers and clients come from importing the spreadsheet or the caregiver
// CSV in the browser, or from the forms, and are saved to the signed-in user's Firestore space:
//   users/{uid}/sections/{caregivers | clients | contacts | sheetDistances | meta}  →  { value, updatedAt }
// One document per section keeps reads cheap (5 per load) and each well under Firestore's 1 MB document limit.
const fresh = () => ({
  caregivers: [],
  clients: [],
  contacts: [],
  sheetDistances: {}, // { caregiverId: { clientId: [miles, note?] } } — distances typed into the spreadsheet
  importInfo: null, // { source, importedAt }
  settings: { candidates: 40 },
})

const SECTIONS = ['caregivers', 'clients', 'contacts', 'sheetDistances', 'meta']
const sectionOf = (d, s) => (s === 'meta' ? { importInfo: d.importInfo ?? null, settings: d.settings } : d[s])
const withSection = (d, s, v) =>
  s === 'meta' ? { ...d, importInfo: v?.importInfo ?? null, settings: { ...fresh().settings, ...v?.settings } } : { ...d, [s]: v ?? fresh()[s] }
const MAX_SECTION = 950_000 // bytes; Firestore rejects documents over 1 MiB

const nameKey = (s) => (s || '').toLowerCase().replace(/["'“”]/g, '').replace(/\s+/g, ' ').trim()
const isEmpty = (v) =>
  v == null || v === '' || (Array.isArray(v) ? v.length === 0 : typeof v === 'object' && Object.keys(v).length === 0)

/**
 * Merge incoming people into an existing list, matching by name.
 * Existing values always win (they may be the user's edits); incoming rows only fill blanks and add new people.
 * `idMap` collects incoming id → stored id.
 */
function mergeList(existing, incoming, prefix, kind, stats, idMap) {
  const byName = new Map(existing.map((x) => [nameKey(x.name), x]))
  const out = existing.map((x) => ({ ...x }))
  const index = new Map(out.map((x, i) => [x.id, i]))
  for (const item of incoming) {
    const match = byName.get(nameKey(item.name))
    if (match) {
      idMap[item.id] = match.id
      const merged = { ...out[index.get(match.id)] }
      let changed = false
      for (const [k, v] of Object.entries(item)) {
        if (k === 'id') continue
        if (isEmpty(merged[k]) && !isEmpty(v)) {
          merged[k] = v
          changed = true
        }
      }
      out[index.get(match.id)] = merged
      if (changed) stats[kind + 'Updated']++
    } else {
      const id = uid(prefix)
      idMap[item.id] = id
      out.push({ ...item, id })
      byName.set(nameKey(item.name), { ...item, id })
      stats[kind + 'Added']++
    }
  }
  return out
}

/** Merge a parsed workbook into existing data (see mergeList). */
export function mergeWorkbook(data, parsed) {
  const stats = { caregiversAdded: 0, caregiversUpdated: 0, clientsAdded: 0, clientsUpdated: 0 }
  const idMap = {}
  const caregivers = mergeList(data.caregivers, parsed.caregivers, 'cg', 'caregivers', stats, idMap)
  const clients = mergeList(data.clients, parsed.clients, 'cl', 'clients', stats, idMap)
  const sheetDistances = {}
  for (const [cg, row] of Object.entries(parsed.legacyDistances || {})) {
    const to = (sheetDistances[idMap[cg]] ||= {})
    for (const [cl, v] of Object.entries(row)) if (idMap[cl]) to[idMap[cl]] = v
  }
  return {
    data: { ...data, caregivers, clients, sheetDistances, importInfo: { source: parsed.source, importedAt: parsed.importedAt } },
    stats,
  }
}

function syncError(err) {
  if (err?.code === 'permission-denied') return 'Your account isn’t allowed to save data. Ask the admin to check the Firestore rules.'
  if (err?.code === 'resource-exhausted') return 'Firebase’s free daily limit is used up. Changes stay on this device and sync tomorrow.'
  if (err?.code === 'too-large') return err.message
  return 'Couldn’t save to the cloud. Changes are kept on this device; check the connection and try again.'
}

/**
 * App data for one signed-in user, kept in memory and synced with Firestore.
 * `sync.state`: 'loading' (first read) · 'saved' · 'saving' · 'error' (with `message`).
 */
export function useStore(userId) {
  const [data, setData] = useState(fresh)
  const [sync, setSync] = useState({ state: 'loading' })
  const latest = useRef(data)
  const synced = useRef({}) // section → JSON last read from / written to Firestore
  const loaded = useRef(false)
  const migrating = useRef(false)
  const timer = useRef(null)
  const inFlight = useRef(0)

  // Live read: first snapshot loads everything; later ones bring in changes made on other devices.
  useEffect(() => {
    loaded.current = false
    synced.current = {}
    return onSnapshot(
      collection(db, 'users', userId, 'sections'),
      { includeMetadataChanges: true },
      (snap) => {
        // An empty answer from the offline cache only means this device hasn't downloaded anything yet.
        // Wait for the server, or a first edit here would overwrite the account's data.
        if (!loaded.current && snap.empty && snap.metadata.fromCache) return
        let next = latest.current
        for (const ch of snap.docChanges()) {
          const s = ch.doc.id
          if (!SECTIONS.includes(s) || ch.doc.metadata.hasPendingWrites) continue
          const v = ch.type === 'removed' ? undefined : ch.doc.data().value
          const json = JSON.stringify(v ?? null)
          if (json === synced.current[s]) continue
          synced.current[s] = json
          next = withSection(next, s, v)
        }
        if (!loaded.current) {
          loaded.current = true
          const legacy = snap.empty && load(LEGACY_KEY)
          if (legacy?.caregivers) {
            migrating.current = true
            next = { ...fresh(), ...legacy, settings: { ...fresh().settings, ...legacy.settings } }
            delete next.mileage
          }
          setSync({ state: 'saved' })
        }
        if (next !== latest.current) {
          latest.current = next
          setData(next)
        }
      },
      (err) => setSync({ state: 'error', message: syncError(err), fatal: !loaded.current }),
    )
  }, [userId])

  /** Write every section that differs from what Firestore has, in one batch. */
  const flush = useCallback(() => {
    clearTimeout(timer.current)
    if (!loaded.current) return
    const d = latest.current
    const batch = writeBatch(db)
    const written = []
    for (const s of SECTIONS) {
      const json = JSON.stringify(sectionOf(d, s) ?? null)
      if (json === synced.current[s]) continue
      if (json.length > MAX_SECTION) {
        setSync({ state: 'error', message: syncError({ code: 'too-large', message: `The ${s} list is too large to save in one piece. Delete unused records.` }) })
        continue
      }
      written.push([s, synced.current[s]])
      synced.current[s] = json
      batch.set(doc(db, 'users', userId, 'sections', s), { value: JSON.parse(json), updatedAt: serverTimestamp() })
    }
    if (!written.length) return
    inFlight.current++
    setSync({ state: 'saving' })
    batch.commit().then(
      () => {
        if (--inFlight.current === 0) setSync({ state: 'saved' })
        if (migrating.current) {
          migrating.current = false
          try {
            localStorage.removeItem(LEGACY_KEY)
          } catch {
            /* ignore */
          }
        }
      },
      (err) => {
        inFlight.current--
        for (const [s, prev] of written) if (synced.current[s] === JSON.stringify(sectionOf(latest.current, s) ?? null)) synced.current[s] = prev
        setSync({ state: 'error', message: syncError(err) })
      },
    )
  }, [userId])

  // Save shortly after each change (batched), and right away when the tab is hidden or closed.
  useEffect(() => {
    latest.current = data
    if (!loaded.current) return
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 500)
  }, [data, flush])
  useEffect(() => {
    const now = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', now)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', now)
      window.removeEventListener('pagehide', flush)
    }
  }, [flush])

  const upsert = useCallback((coll, item) => {
    const id = item.id || uid(coll.slice(0, 2))
    setData((d) => {
      const list = d[coll]
      const exists = list.some((x) => x.id === id)
      return { ...d, [coll]: exists ? list.map((x) => (x.id === id ? { ...item, id } : x)) : [...list, { ...item, id }] }
    })
    return id
  }, [])

  const addMany = useCallback((coll, items) => {
    setData((d) => ({ ...d, [coll]: [...d[coll], ...items.map((x) => ({ ...x, id: x.id || uid(coll.slice(0, 2)) }))] }))
  }, [])

  const remove = useCallback((coll, id) => {
    setData((d) => ({ ...d, [coll]: d[coll].filter((x) => x.id !== id) }))
  }, [])

  const setSettings = useCallback((patch) => setData((d) => ({ ...d, settings: { ...d.settings, ...patch } })), [])
  const clearAll = useCallback(() => setData((d) => ({ ...fresh(), settings: d.settings })), [])
  const replaceAll = useCallback((obj) => {
    const next = { ...fresh(), ...obj }
    delete next.mileage
    setData(next)
  }, [])

  /** Import a parsed workbook; returns counts of what changed. */
  const importWorkbook = useCallback((parsed) => {
    const r = mergeWorkbook(latest.current, parsed)
    latest.current = r.data
    setData(r.data)
    return r.stats
  }, [])

  /** Import caregivers or clients from CSV (kind: 'caregivers' | 'clients'); same name-matching rules as the workbook. */
  const importCsv = useCallback((kind, list) => {
    const stats = { [kind + 'Added']: 0, [kind + 'Updated']: 0 }
    const d = latest.current
    const next = { ...d, [kind]: mergeList(d[kind], list, kind === 'caregivers' ? 'cg' : 'cl', kind, stats, {}) }
    latest.current = next
    setData(next)
    return { added: stats[kind + 'Added'], updated: stats[kind + 'Updated'] }
  }, [])

  return { data, sync, retrySync: flush, upsert, addMany, remove, setSettings, clearAll, replaceAll, importWorkbook, importCsv }
}
