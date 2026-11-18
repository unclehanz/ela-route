import { useCallback, useEffect, useRef, useState } from 'react'
import { load, save, uid } from './storage.js'

const KEY = 'ela-route:data:v1'

// The app ships with no personal data. Caregivers and clients come from importing the spreadsheet in the browser
// (see parseWorkbook.js) or from the forms, and are stored only in this browser.
const fresh = () => ({
  caregivers: [],
  clients: [],
  mileage: [],
  contacts: [],
  sheetDistances: {}, // { caregiverId: { clientId: [miles, note?] } } — distances typed into the spreadsheet
  importInfo: null, // { source, importedAt }
  settings: { ratePerMile: 0.7, candidates: 40 },
})

const nameKey = (s) => (s || '').toLowerCase().replace(/["'“”]/g, '').replace(/\s+/g, ' ').trim()
const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0)

/**
 * Merge a parsed workbook into existing data, matching people by name.
 * Existing values always win (they may be the user's edits); the spreadsheet only fills blanks and adds new people.
 */
export function mergeWorkbook(data, parsed) {
  const stats = { caregiversAdded: 0, caregiversUpdated: 0, clientsAdded: 0, clientsUpdated: 0 }
  const idMap = {}
  const mergeList = (existing, incoming, prefix, kind) => {
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
  const caregivers = mergeList(data.caregivers, parsed.caregivers, 'cg', 'caregivers')
  const clients = mergeList(data.clients, parsed.clients, 'cl', 'clients')
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

export function useStore() {
  const [data, setData] = useState(() => ({ ...fresh(), ...load(KEY, {}) }))

  const latest = useRef(data)
  useEffect(() => {
    latest.current = data
    save(KEY, data)
  }, [data])

  const upsert = useCallback((collection, item) => {
    const id = item.id || uid(collection.slice(0, 2))
    setData((d) => {
      const list = d[collection]
      const exists = list.some((x) => x.id === id)
      return { ...d, [collection]: exists ? list.map((x) => (x.id === id ? { ...item, id } : x)) : [...list, { ...item, id }] }
    })
    return id
  }, [])

  const addMany = useCallback((collection, items) => {
    setData((d) => ({ ...d, [collection]: [...d[collection], ...items.map((x) => ({ ...x, id: x.id || uid(collection.slice(0, 2)) }))] }))
  }, [])

  const remove = useCallback((collection, id) => {
    setData((d) => ({ ...d, [collection]: d[collection].filter((x) => x.id !== id) }))
  }, [])

  const setSettings = useCallback((patch) => setData((d) => ({ ...d, settings: { ...d.settings, ...patch } })), [])
  const clearAll = useCallback(() => setData((d) => ({ ...fresh(), settings: d.settings })), [])
  const replaceAll = useCallback((obj) => setData({ ...fresh(), ...obj }), [])

  /** Import a parsed workbook; returns counts of what changed. */
  const importWorkbook = useCallback((parsed) => {
    const r = mergeWorkbook(latest.current, parsed)
    latest.current = r.data
    setData(r.data)
    return r.stats
  }, [])

  return { data, upsert, addMany, remove, setSettings, clearAll, replaceAll, importWorkbook }
}
