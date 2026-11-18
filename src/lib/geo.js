// Free geocoding (OpenStreetMap Nominatim, Photon fallback) and routing (OSRM public server).
// Every result is cached in localStorage so each address is looked up only once.
import { useEffect, useState } from 'react'
import { load, save } from './storage.js'

const GEO_KEY = 'ela-route:geo:v1'
const DRIVE_KEY = 'ela-route:drive:v1'
const OSRM = 'https://router.project-osrm.org'
const METERS_PER_MILE = 1609.344

let geoCache = load(GEO_KEY, {})
let driveCache = load(DRIVE_KEY, {})
const inflight = new Map()
const listeners = new Set()
export const queue = { pending: 0, done: 0, failed: 0 }

function emit() {
  save(GEO_KEY, geoCache)
  listeners.forEach((fn) => fn())
}

// Re-render a component whenever a new address gets located.
export function useGeoVersion() {
  const [v, setV] = useState(0)
  useEffect(() => {
    const fn = () => setV((x) => x + 1)
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [])
  return v
}

export const addrKey = (a) => (a || '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Cached position for an address: {lat, lon}, {fail: true}, or undefined if not looked up yet. */
export const cached = (address) => (address ? geoCache[addrKey(address)] : undefined)
export const located = (address) => {
  const c = cached(address)
  return c && !c.fail ? c : null
}

export function forget(address) {
  delete geoCache[addrKey(address)]
  emit()
}

/** Strip apartment/unit numbers, which often make free geocoders miss. */
export function simplify(a) {
  return a
    .replace(/,?\s*USA$/i, '')
    .replace(/\b(apt|apartment|unit|ste|suite|spc|space|bldg)\.?\s*#?\s*[\w-]+/gi, '')
    .replace(/#\s*[\w-]+/g, '')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim()
}

async function nominatim(q) {
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=' + encodeURIComponent(q)
  const r = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  if (!r.ok) throw new Error('Nominatim ' + r.status)
  const j = await r.json()
  return j[0] ? { lat: +j[0].lat, lon: +j[0].lon, by: 'osm' } : null
}

async function photon(q) {
  // Bias toward Los Angeles.
  const url = 'https://photon.komoot.io/api/?limit=1&lat=33.9&lon=-118.2&q=' + encodeURIComponent(q)
  const r = await fetch(url)
  if (!r.ok) throw new Error('Photon ' + r.status)
  const j = await r.json()
  const f = j.features?.[0]
  return f ? { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], by: 'photon' } : null
}

// ---------- Lookup scheduler ----------
// The two free services work in parallel, each at a polite pace of its own
// (Nominatim's limit is 1 request/second; Photon is used at about 3/second).
// If one service can't find an address, the other one gets a try.
// Jobs have a priority (lower = sooner) so the caregivers most likely to be nearest are located first.
const LANES = [
  { name: 'osm', run: nominatim, gap: 1100, busy: false, next: 0 },
  { name: 'photon', run: photon, gap: 350, busy: false, next: 0 },
]
const jobs = []

function finish(job, res) {
  if (res) {
    geoCache[job.k] = res
    queue.done++
  } else if (job.error) {
    queue.failed++ // network/service problem: not cached, so it is retried next time
  } else {
    geoCache[job.k] = { fail: true }
    queue.failed++
  }
  queue.pending--
  inflight.delete(job.k)
  emit()
  job.resolve(res || null)
}

function pump() {
  for (const lane of LANES) {
    if (lane.busy) continue
    let best = -1
    for (let i = 0; i < jobs.length; i++) {
      if (jobs[i].tried.has(lane.name)) continue
      if (best < 0 || jobs[i].priority < jobs[best].priority) best = i
    }
    if (best < 0) continue
    const job = jobs.splice(best, 1)[0]
    lane.busy = true
    setTimeout(
      async () => {
        job.tried.add(lane.name)
        let res = null
        try {
          res = await lane.run(simplify(job.address))
          lane.next = Date.now() + lane.gap
        } catch {
          job.error = true
          lane.next = Date.now() + 10000 // service busy or rate-limited: back off this lane for a while
        }
        lane.busy = false
        if (res) finish(job, res)
        else if (job.tried.size < LANES.length) jobs.push(job)
        else finish(job, null)
        pump()
      },
      Math.max(0, lane.next - Date.now()),
    )
  }
}

/** Look up an address (cached). Lower priority numbers are looked up sooner. */
export function geocode(address, priority = 100) {
  if (!address?.trim()) return Promise.resolve(null)
  const k = addrKey(address)
  if (geoCache[k]) return Promise.resolve(geoCache[k].fail ? null : geoCache[k])
  if (inflight.has(k)) {
    const job = jobs.find((j) => j.k === k)
    if (job) job.priority = Math.min(job.priority, priority)
    return inflight.get(k)
  }
  let resolve
  const p = new Promise((r) => (resolve = r))
  jobs.push({ k, address, priority, tried: new Set(), resolve })
  inflight.set(k, p)
  queue.pending++
  emit()
  pump()
  return p
}

/** Queue every address that isn't on the map yet (low priority by default). */
export function locateAll(addresses, priority = 1000) {
  return Promise.all([...new Set(addresses.filter((a) => a && !cached(a)))].map((a) => geocode(a, priority)))
}

// ---------- ZIP hints (learned from addresses already on the map; no outside data) ----------
export const zipOf = (address) => {
  const all = (address || '').match(/9d{4}/g)
  return all ? all[all.length - 1] : null
}

/** Average position of every located address in each ZIP code. */
export function zipCentroids() {
  const acc = {}
  for (const [k, v] of Object.entries(geoCache)) {
    if (!v || v.fail) continue
    const z = zipOf(k)
    if (!z) continue
    const a = (acc[z] ||= { lat: 0, lon: 0, n: 0 })
    a.lat += v.lat
    a.lon += v.lon
    a.n++
  }
  for (const a of Object.values(acc)) {
    a.lat /= a.n
    a.lon /= a.n
  }
  return acc
}

/** Rough distance guess used only to decide lookup order. */
export function guessMiles(address, target, targetZip, centroids) {
  const z = zipOf(address)
  if (z && centroids[z]) return milesBetween(centroids[z], target)
  if (z && targetZip) return 30 + Math.min(Math.abs(+z - +targetZip), 600) / 10
  return 90
}

export function milesBetween(a, b) {
  const R = 3958.8
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const ll = (p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`
const pairKey = (a, b) => ll(a) + '>' + ll(b)

async function osrm(path) {
  const r = await fetch(OSRM + path)
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.code !== 'Ok') throw new Error('Routing service: ' + (j.message || j.code || r.status))
  return j
}

/** Road miles + minutes from each origin to one destination (cached). */
export async function driveTimes(origins, dest) {
  const missing = origins.filter((o) => !driveCache[pairKey(o, dest)])
  for (let i = 0; i < missing.length; i += 80) {
    const chunk = missing.slice(i, i + 80)
    const coords = [...chunk, dest].map(ll).join(';')
    const sources = chunk.map((_, j) => j).join(';')
    const j = await osrm(`/table/v1/driving/${coords}?sources=${sources}&destinations=${chunk.length}&annotations=duration,distance`)
    chunk.forEach((o, n) => {
      const sec = j.durations[n][0]
      const m = j.distances[n][0]
      driveCache[pairKey(o, dest)] = sec == null ? { none: true } : { minutes: sec / 60, miles: m / METERS_PER_MILE }
    })
  }
  if (missing.length) save(DRIVE_KEY, driveCache)
  return origins.map((o) => {
    const v = driveCache[pairKey(o, dest)]
    return v && !v.none ? v : null
  })
}

function stepText(s) {
  const { type, modifier } = s.maneuver
  const road = s.name || s.ref || ''
  const onto = road ? ` onto ${road}` : ''
  const dist = s.distance / METERS_PER_MILE
  const d = dist >= 0.1 ? ` (${dist.toFixed(1)} mi)` : ''
  const dir = modifier && modifier !== 'straight' ? modifier : ''
  if (type === 'depart') return road ? `Head out on ${road}${d}` : `Head out${d}`
  if (type === 'arrive') return 'Arrive at destination'
  if (type === 'roundabout' || type === 'rotary') return `Take the roundabout${onto}${d}`
  if (type === 'merge') return `Merge${onto}${d}`
  if (type === 'on ramp') return road ? `Take the ramp onto ${road}${d}` : `Take the ramp${dir ? ' on the ' + dir : ''}${d}`
  if (type === 'off ramp') return road ? `Take the exit toward ${road}${d}` : `Take the exit${dir ? ' on the ' + dir : ''}${d}`
  if (type === 'fork') return `Keep ${dir || 'straight'} at the fork${onto}${d}`
  if (modifier === 'uturn') return `Make a U-turn${onto}${d}`
  if (!dir) return road ? `Continue on ${road}${d}` : `Continue straight${d}`
  return `Turn ${dir}${onto}${d}`
}

/** Full road route with geometry and turn-by-turn steps. */
export async function route(from, to) {
  const j = await osrm(`/route/v1/driving/${ll(from)};${ll(to)}?overview=full&geometries=geojson&steps=true`)
  const r = j.routes[0]
  return {
    miles: r.distance / METERS_PER_MILE,
    minutes: r.duration / 60,
    line: r.geometry.coordinates.map(([x, y]) => [y, x]),
    steps: r.legs[0].steps.map(stepText),
  }
}

// Walking routes come from the FOSSGIS OpenStreetMap routing server (free, no key).
// Its pace is ~12% quicker than Google's walking estimates (checked on 2 trips), so times are scaled to match.
const FOOT = 'https://routing.openstreetmap.de/routed-foot'
const WALK_FACTOR = 1.12

/** Walking miles + minutes between two points (cached). */
export async function walkTime(from, to) {
  const k = 'foot:' + pairKey(from, to)
  if (driveCache[k]) return driveCache[k]
  const r = await fetch(`${FOOT}/route/v1/driving/${ll(from)};${ll(to)}?overview=false`)
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.code !== 'Ok') throw new Error('Walking route unavailable')
  const v = { miles: j.routes[0].distance / METERS_PER_MILE, minutes: (j.routes[0].duration / 60) * WALK_FACTOR }
  driveCache[k] = v
  save(DRIVE_KEY, driveCache)
  return v
}

/** Directions links that open the trip in Google Maps or Apple Maps. mode: 'driving' | 'transit' | 'walking'. */
export function mapsLinks(from, to, mode) {
  const apple = { driving: 'd', transit: 'r', walking: 'w' }[mode]
  return {
    google: `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lon}&destination=${to.lat},${to.lon}&travelmode=${mode}`,
    apple: `https://maps.apple.com/?saddr=${from.lat},${from.lon}&daddr=${to.lat},${to.lon}&dirflg=${apple}`,
  }
}

/** Best visiting order starting at points[0]. Returns the order of input indexes plus legs. */
export async function trip(points, roundtrip) {
  const q = `source=first&roundtrip=${roundtrip}${roundtrip ? '' : '&destination=any'}&overview=full&geometries=geojson`
  const j = await osrm(`/trip/v1/driving/${points.map(ll).join(';')}?${q}`)
  const t = j.trips[0]
  const order = j.waypoints.map((w, i) => ({ i, pos: w.waypoint_index })).sort((a, b) => a.pos - b.pos).map((x) => x.i)
  return {
    order,
    miles: t.distance / METERS_PER_MILE,
    minutes: t.duration / 60,
    legs: t.legs.map((l) => ({ miles: l.distance / METERS_PER_MILE, minutes: l.duration / 60 })),
    line: t.geometry.coordinates.map(([x, y]) => [y, x]),
  }
}

// ---------- Drive-time model ----------
// Free routing (OSRM) gives free-flow minutes with no traffic. These settings turn that into realistic times.
// Calibrated against Google Maps "typical" times: 63 trips over 16 South Bay / Long Beach routes at four
// departure times (Nov 2026). Typical = overhead + factor × free-flow minutes; low/high give the usual range.
// Accuracy on routes left out of the fit: about ±3.4 min on average; Google's typical time falls inside our
// low–high range 97% of the time; caregiver ranking matches Google's order for 94% of pairs.
export const TRAFFIC = [
  { id: 'offpeak', label: 'Night', lo: [2.2, 0.83], typ: [5.2, 0.92], hi: [8.2, 1.01] },
  { id: 'midday', label: 'Midday', lo: [2.2, 0.9], typ: [5.2, 1.32], hi: [8.2, 1.75] },
  { id: 'am', label: '8 AM rush', lo: [2.2, 1.06], typ: [5.2, 1.65], hi: [8.2, 2.25] },
  { id: 'pm', label: '5:30 PM rush', lo: [2.2, 1.02], typ: [5.2, 1.54], hi: [8.2, 2.07] },
]

/** Typical, low and high drive minutes for one trip. */
export function eta(freeFlowMin, trafficId) {
  if (freeFlowMin == null) return null
  const t = TRAFFIC.find((x) => x.id === trafficId) || TRAFFIC[0]
  const f = ([overhead, factor]) => overhead + factor * freeFlowMin
  return { typ: f(t.typ), lo: f(t.lo), hi: f(t.hi) }
}

/** Sum of per-leg estimates for a multi-stop trip (every stop has its own parking/start-up overhead). */
export function etaLegs(legs, trafficId) {
  return legs.reduce(
    (s, l) => {
      const e = eta(l.minutes, trafficId)
      return { typ: s.typ + e.typ, lo: s.lo + e.lo, hi: s.hi + e.hi }
    },
    { typ: 0, lo: 0, hi: 0 },
  )
}

/** Traffic setting that matches the current time in Los Angeles. */
export function currentTraffic(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: 'numeric', hour12: false, weekday: 'short' }).formatToParts(date)
  const get = (t) => parts.find((p) => p.type === t)?.value
  const mins = (+get('hour') % 24) * 60 + +get('minute')
  if (['Sat', 'Sun'].includes(get('weekday'))) return mins >= 600 && mins < 1200 ? 'midday' : 'offpeak'
  if (mins >= 390 && mins < 570) return 'am'
  if (mins >= 570 && mins < 900) return 'midday'
  if (mins >= 900 && mins < 1140) return 'pm'
  return 'offpeak'
}
