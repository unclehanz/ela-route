import { collection, doc, getDocs, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from './firebase.js'
import { load, uid } from './storage.js'

// Data before Firebase lived in localStorage under this key. It is folded into the team data once, then removed.
const LEGACY_KEY = 'ela-route:data:v1'

// The app ships with no personal data. Caregivers and clients come from importing the spreadsheet or the CSVs in the
// browser, or from the forms. Everyone who signs in shares one team pool and can change it:
//   teams/main/sections/{caregivers | clients | contacts | sheetDistances | meta}  →  { value, updatedAt, updatedBy }
// Each person's own settings stay with their account:
//   users/{uid}/sections/prefs  →  { value, updatedAt, updatedBy }
// One document per section keeps reads cheap and each well under Firestore's 1 MB document limit.
const TEAM = 'main'
const fresh = () => ({
  caregivers: [],
  clients: [],
  contacts: [],
  sheetDistances: {}, // { caregiverId: { clientId: [miles, note?] } } — distances typed into the spreadsheet
  importInfo: null, // { source, importedAt }
  settings: { candidates: 40 },
})

// section → whose it is: the shared 'team' pool or the signed-in 'user'
const SECTIONS = { caregivers: 'team', clients: 'team', contacts: 'team', sheetDistances: 'team', meta: 'team', prefs: 'user' }
const TEAM_SECTIONS = Object.keys(SECTIONS).filter((s) => SECTIONS[s] === 'team')
const KINDS = ['team', 'user']
const sectionRef = (userId, s) => (SECTIONS[s] === 'team' ? doc(db, 'teams', TEAM, 'sections', s) : doc(db, 'users', userId, 'sections', s))
const kindRef = (userId, kind) => (kind === 'team' ? collection(db, 'teams', TEAM, 'sections') : collection(db, 'users', userId, 'sections'))
const sectionOf = (d, s) => (s === 'meta' ? { importInfo: d.importInfo ?? null } : s === 'prefs' ? d.settings : d[s])
const withSection = (d, s, v) =>
  s === 'meta'
    ? { ...d, importInfo: v?.importInfo ?? null }
    : s === 'prefs'
      ? { ...d, settings: { ...fresh().settings, ...v } }
      : { ...d, [s]: v ?? fresh()[s] }
const MAX_SECTION = 950_000 // bytes; Firestore rejects documents over 1 MiB
const str = (v) => JSON.stringify(v ?? null)
const tooLarge = (s) => Object.assign(new Error(`The ${s} list is too large to save in one piece. Delete unused records.`), { code: 'too-large' })

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v)
const isIdList = (v) => Array.isArray(v) && v.every((x) => isObj(x) && x.id)

/**
 * Three-way merge: apply what changed on this device (base → local) on top of what is on the server now (remote).
 * Lists of records merge by id and objects by key, so two people editing different caregivers — or different fields
 * of the same one — both keep their changes. When both changed the same value, this device's change wins.
 */
export function merge3(base, local, remote) {
  if (str(local) === str(base)) return remote
  if (str(remote) === str(base) || str(local) === str(remote)) return local
  if ((base == null || isIdList(base)) && isIdList(local) && isIdList(remote)) {
    const b = new Map((base || []).map((x) => [x.id, x]))
    const l = new Map(local.map((x) => [x.id, x]))
    const r = new Set(remote.map((x) => x.id))
    const out = []
    for (const item of remote) {
      if (l.has(item.id)) out.push(merge3(b.get(item.id), l.get(item.id), item))
      else if (!b.has(item.id)) out.push(item) // added elsewhere
      // else: deleted here
    }
    for (const item of local) {
      if (r.has(item.id)) continue
      // Added here, or edited here after someone else deleted it.
      if (!b.has(item.id) || str(item) !== str(b.get(item.id))) out.push(item)
    }
    return out
  }
  if (isObj(local) && isObj(remote) && (base == null || isObj(base))) {
    const out = {}
    for (const k of new Set([...Object.keys(base || {}), ...Object.keys(local), ...Object.keys(remote)])) {
      const v = merge3(base?.[k], local[k], remote[k])
      if (v !== undefined) out[k] = v
    }
    return out
  }
  return local
}

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
      index.set(id, out.length - 1)
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

/**
 * Fold one account's earlier data into the team data (same name matching as an import; the team's values win).
 * Contact notes and spreadsheet distances follow the people they belong to.
 */
function mergeData(team, mine) {
  const stats = { caregiversAdded: 0, caregiversUpdated: 0, clientsAdded: 0, clientsUpdated: 0 }
  const idMap = {}
  const caregivers = mergeList(team.caregivers, mine.caregivers || [], 'cg', 'caregivers', stats, idMap)
  const clients = mergeList(team.clients, mine.clients || [], 'cl', 'clients', stats, idMap)
  const seen = new Set(team.contacts.map((c) => c.id))
  const contacts = [...team.contacts]
  for (const c of mine.contacts || []) {
    const id = c.id && !seen.has(c.id) ? c.id : uid('co')
    seen.add(id)
    contacts.push({ ...c, id, caregiverId: idMap[c.caregiverId] ?? c.caregiverId, clientId: idMap[c.clientId] ?? c.clientId })
  }
  const sheetDistances = structuredClone(team.sheetDistances)
  for (const [cg, row] of Object.entries(mine.sheetDistances || {})) {
    const to = (sheetDistances[idMap[cg] ?? cg] ||= {})
    for (const [cl, v] of Object.entries(row)) to[idMap[cl] ?? cl] ??= v
  }
  return { ...team, caregivers, clients, contacts, sheetDistances, importInfo: team.importInfo ?? mine.importInfo ?? null }
}

/**
 * Before sharing, each account had its own data under users/{uid}/sections (and before Firebase, in localStorage).
 * Move whatever this account still has into the team pool and delete the old copy, in one transaction.
 */
async function adoptOldData(userId) {
  const old = {}
  for (const d of (await getDocs(kindRef(userId, 'user'))).docs) old[d.id] = d.data().value
  const legacy = load(LEGACY_KEY)
  const sources = []
  if (TEAM_SECTIONS.some((s) => s in old)) sources.push({ ...old, importInfo: old.meta?.importInfo ?? null })
  if (legacy?.caregivers) sources.push(legacy)
  if (!sources.length) return
  await runTransaction(db, async (tx) => {
    const snaps = await Promise.all(TEAM_SECTIONS.map((s) => tx.get(sectionRef(userId, s))))
    let team = fresh()
    snaps.forEach((snap, i) => {
      if (snap.exists()) team = withSection(team, TEAM_SECTIONS[i], snap.data().value)
    })
    const merged = sources.reduce(mergeData, team)
    const stamp = { updatedAt: serverTimestamp(), updatedBy: userId }
    for (const s of TEAM_SECTIONS) {
      const v = sectionOf(merged, s)
      if (str(v) === str(sectionOf(team, s))) continue
      if (str(v).length > MAX_SECTION) throw tooLarge(s)
      tx.set(sectionRef(userId, s), { value: v, ...stamp })
    }
    for (const s of Object.keys(old)) if (s !== 'prefs') tx.delete(doc(db, 'users', userId, 'sections', s))
    const settings = old.meta?.settings ?? legacy?.settings
    if (settings && !old.prefs) tx.set(sectionRef(userId, 'prefs'), { value: settings, ...stamp })
  })
  if (legacy) {
    try {
      localStorage.removeItem(LEGACY_KEY)
    } catch {
      /* ignore */
    }
  }
}

function syncError(err) {
  if (err?.code === 'permission-denied') return 'Your account isn’t allowed to save data. Ask the admin to publish the latest Firestore rules.'
  if (err?.code === 'resource-exhausted') return 'Firebase’s free daily limit is used up. Changes are kept in this window; try again tomorrow.'
  if (err?.code === 'too-large') return err.message
  return 'Couldn’t save to the cloud. Changes are kept in this window (keep it open); check the connection and try again.'
}

/**
 * The team's shared data plus this user's settings, kept in memory and synced with Firestore.
 * `sync.state`: 'loading' (first read) · 'saved' · 'saving' · 'error' (with `message`).
 */
export function useStore(userId) {
  const [data, setData] = useState(fresh)
  const [sync, setSync] = useState({ state: 'loading' })
  const latest = useRef(data)
  const synced = useRef({}) // section → JSON last read from / written to Firestore
  const loaded = useRef({ team: false, user: false })
  const timer = useRef(null)
  const running = useRef(false)
  const again = useRef(false)
  const flushRef = useRef(null)
  const ready = () => loaded.current.team && loaded.current.user

  // Live read: the first snapshots load everything; later ones bring in changes made by teammates and other devices.
  // Changes made here that aren't saved yet are merged on top, so neither side's edit is lost.
  useEffect(() => {
    loaded.current = { team: false, user: false }
    synced.current = {}
    let stop = []
    let cancelled = false
    const listen = (kind) =>
      onSnapshot(
        kindRef(userId, kind),
        { includeMetadataChanges: true },
        (snap) => {
          // An empty answer from the offline cache only means this device hasn't downloaded anything yet.
          // Wait for the server, or a first edit here would overwrite the team's data.
          if (!loaded.current[kind] && snap.empty && snap.metadata.fromCache) return
          let next = latest.current
          for (const ch of snap.docChanges()) {
            const s = ch.doc.id
            if (SECTIONS[s] !== kind || ch.doc.metadata.hasPendingWrites) continue
            const remote = ch.type === 'removed' ? undefined : ch.doc.data().value
            const json = str(remote)
            if (json === synced.current[s]) continue
            const local = sectionOf(next, s)
            const dirty = loaded.current[kind] && str(local) !== synced.current[s]
            const merged = dirty ? merge3(JSON.parse(synced.current[s] ?? 'null'), local, remote) : remote
            synced.current[s] = json
            next = withSection(next, s, merged)
          }
          if (!loaded.current[kind]) {
            loaded.current[kind] = true
            // Sections that don't exist yet count as saved in their empty form.
            for (const s of Object.keys(SECTIONS)) if (SECTIONS[s] === kind) synced.current[s] ??= str(sectionOf(next, s))
            if (ready()) setSync({ state: 'saved' })
          }
          if (next !== latest.current) {
            latest.current = next
            setData(next)
          }
        },
        (err) => setSync({ state: 'error', message: syncError(err), fatal: !ready() }),
      )
    adoptOldData(userId)
      .catch((err) => console.warn('Couldn’t move this account’s earlier data into the team data; will retry at next sign-in.', err))
      .then(() => {
        if (!cancelled) stop = KINDS.map(listen)
      })
    return () => {
      cancelled = true
      stop.forEach((fn) => fn())
    }
  }, [userId])

  /**
   * Save every section that differs from what Firestore has. Runs as a transaction that reads the server's current
   * copy and merges this device's changes into it, so two people saving at the same moment don't overwrite each other.
   */
  const flush = useCallback(() => {
    clearTimeout(timer.current)
    if (!ready()) return
    if (running.current) {
      again.current = true
      return
    }
    const pending = Object.keys(SECTIONS).filter((s) => str(sectionOf(latest.current, s)) !== synced.current[s])
    if (!pending.length) return
    running.current = true
    setSync({ state: 'saving' })
    let used
    runTransaction(db, async (tx) => {
      const snaps = await Promise.all(pending.map((s) => tx.get(sectionRef(userId, s))))
      used = {}
      const out = {}
      pending.forEach((s, i) => {
        const local = sectionOf(latest.current, s)
        const remote = snaps[i].exists() ? snaps[i].data().value : undefined
        const merged = str(remote) === synced.current[s] ? local : merge3(JSON.parse(synced.current[s] ?? 'null'), local, remote)
        if (str(merged).length > MAX_SECTION) throw tooLarge(s)
        used[s] = local
        out[s] = merged ?? null
        tx.set(sectionRef(userId, s), { value: merged ?? null, updatedAt: serverTimestamp(), updatedBy: userId })
      })
      return out
    }).then(
      (out) => {
        running.current = false
        let next = latest.current
        for (const [s, v] of Object.entries(out)) {
          synced.current[s] = str(v)
          // Keep anything typed while the save was in flight.
          next = withSection(next, s, merge3(used[s], sectionOf(next, s), v))
        }
        if (next !== latest.current) {
          latest.current = next
          setData(next)
        }
        setSync({ state: 'saved' })
        if (again.current) {
          again.current = false
          flushRef.current()
        }
      },
      (err) => {
        running.current = false
        again.current = false
        setSync({ state: 'error', message: syncError(err) })
      },
    )
  }, [userId])

  useEffect(() => {
    flushRef.current = flush
  }, [flush])

  // Save shortly after each change, right away when the tab is hidden, and again when the connection comes back.
  useEffect(() => {
    latest.current = data
    if (!ready()) return
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 500)
  }, [data, flush])
  useEffect(() => {
    const now = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', now)
    window.addEventListener('pagehide', flush)
    window.addEventListener('online', flush)
    return () => {
      document.removeEventListener('visibilitychange', now)
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('online', flush)
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
    setData((d) => {
      const next = { ...fresh(), ...obj, settings: { ...d.settings, ...obj.settings } }
      delete next.mileage
      return next
    })
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
