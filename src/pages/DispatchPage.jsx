import { useEffect, useMemo, useRef, useState } from 'react'
import TravelModes from '../components/TravelModes.jsx'
import CaregiverTags from '../components/CaregiverTags.jsx'
import EmptyState from '../components/EmptyState.jsx'
import FilterBar from '../components/FilterBar.jsx'
import SelectField from '../components/form/SelectField.jsx'
import Icon from '../components/Icon.jsx'
import MapView from '../components/MapView.jsx'
import Popover from '../components/Popover.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import Spinner from '../components/Spinner.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { useToast } from '../components/Toast.jsx'
import { CONTACT_OUTCOMES, filtersForClient, matches } from '../lib/caregivers.js'
import { fit, preferredOf } from '../lib/criteria.js'
import { fmtDate, fmtMi, fmtMin } from '../lib/format.js'
import { cached, currentTraffic, driveTimes, eta, geocode, guessMiles, located, milesBetween, route, TRAFFIC, useGeoVersion, zipCentroids, zipOf } from '../lib/geo.js'
import { useDelayed } from '../lib/hooks.js'
import ImportButton from '../components/ImportButton.jsx'

function RoutePanel({ info, traffic, trafficLabel, isBest, onOpen, onClose }) {
  const e = eta(info.minutes, traffic)
  return (
    <aside className="route-panel" aria-label="Route details">
      <header className="route-panel-head">
        <p className="eyebrow">{isBest ? 'Nearest caregiver' : 'Selected caregiver'}</p>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Close route details">
          <Icon name="x" size={18} />
        </button>
      </header>
      <div className="route-panel-body">
        <h2>
          <button type="button" className="name-link" onClick={onOpen}>
            {info.cg.name}
          </button>
        </h2>
        <p className="route-from">
          <Icon name="pin" size={14} /> {info.cg.address}
        </p>
        <CaregiverTags cg={info.cg} />
        <TravelModes cg={info.cg} from={info.from} to={info.to} drive={e} driveMiles={info.miles} trafficLabel={trafficLabel} />
        {info.cg.phone && (
          <a className="btn btn-primary btn-block" href={`tel:${info.cg.phone}`}>
            <Icon name="phone" size={16} /> Call {info.cg.phone}
          </a>
        )}
        {info.cg.notes && <p className="route-notes">{info.cg.notes}</p>}
        {/* Collapsed by default; reopens closed for each caregiver. For when a caregiver asks for directions. */}
        <details className="directions" key={info.cg.id}>
          <summary>
            <Icon name="navigation" size={16} />
            <span className="directions-label">Directions</span>
            <span className="text-muted">{info.steps.length} steps</span>
            <Icon name="chevronDown" size={16} className="directions-chevron" />
          </summary>
          <ol>
            {info.steps.map((st, i) => (
              <li key={i}>{st}</li>
            ))}
          </ol>
        </details>
        <p className="fine-print">Times are estimates from typical traffic, calibrated against Google Maps (about ±3 min).</p>
      </div>
    </aside>
  )
}

export default function DispatchPage({ store, clientId, setClientId, onEditClient, onAddClient, onViewCaregiver, onNavigate, onRoutePanelChange }) {
  const { data, addMany } = store
  const toast = useToast()
  const geoVersion = useGeoVersion()
  const client = data.clients.find((c) => c.id === clientId)
  const [traffic, setTraffic] = useState(currentTraffic)
  const [filters, setFilters] = useState(() => ({ ...filtersForClient(client), excludeDoNotAssign: true }))
  const [results, setResults] = useState(null)
  const [phase, setPhase] = useState(null) // null | {kind:'route'} | {kind:'refine', done, total}
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [routeInfo, setRouteInfo] = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const runId = useRef(0)
  const search = useRef(null) // { run, cpos, pool, total } for the search in progress
  const userPicked = useRef(false)
  const lastRank = useRef(0)
  const showRouteSpinner = useDelayed(routeLoading)

  const t = TRAFFIC.find((x) => x.id === traffic)
  const clientPos = located(client?.address)
  const clientOptions = useMemo(
    () =>
      [...data.clients]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ value: c.id, label: c.address ? c.name : `${c.name} (no address)` })),
    [data.clients],
  )
  const lastContact = useMemo(() => {
    const m = {}
    for (const c of data.contacts) if (c.clientId === clientId) m[c.caregiverId] = c
    return m
  }, [data.contacts, clientId])

  function pickClient(id) {
    runId.current++
    search.current = null
    setClientId(id)
    setFilters({ ...filtersForClient(data.clients.find((x) => x.id === id)), excludeDoNotAssign: true })
    setResults(null)
    setSelected(null)
    setRouteInfo(null)
    setPhase(null)
    setError('')
  }

  // Rank whatever is on the map right now. Called once at the start and again as more addresses get located.
  async function rank(run) {
    const sr = search.current
    if (!sr || run !== runId.current) return
    lastRank.current = Date.now()
    const remaining = sr.pool.filter((c) => !cached(c.address)).length
    const nearest = sr.pool
      .map((c) => ({ cg: c, pos: located(c.address) }))
      .filter((x) => x.pos)
      .map((x) => ({ ...x, crow: milesBetween(x.pos, sr.cpos) }))
      .sort((a, b) => a.crow - b.crow)
      .slice(0, data.settings.candidates || 40)
    try {
      const drive = await driveTimes(
        nearest.map((x) => x.pos),
        sr.cpos,
      )
      if (run !== runId.current) return
      const list = nearest
        .map((x, i) => ({ ...x, miles: drive[i]?.miles ?? null, minutes: drive[i]?.minutes ?? null }))
        .sort((a, b) => (a.miles ?? 1e9) - (b.miles ?? 1e9))
      setResults({ list, pool: sr.pool.length, unlocated: sr.pool.filter((c) => cached(c.address)?.fail).length, remaining })
      setPhase(remaining ? { kind: 'refine', done: sr.total - remaining, total: sr.total } : null)
      // Follow the current best caregiver until the user picks one themselves.
      if (list[0] && !userPicked.current) showRoute(list[0], sr.cpos, true)
    } catch {
      if (run !== runId.current) return
      setPhase(null)
      setError('The free routing service did not respond. Wait a minute, then select Find caregivers again.')
    }
  }

  async function findNearest() {
    const run = ++runId.current
    search.current = null
    userPicked.current = false
    setError('')
    setSelected(null)
    setRouteInfo(null)
    setResults(null)
    setPhase({ kind: 'route' })
    const cpos = await geocode(client.address, -1)
    if (run !== runId.current) return
    if (!cpos) {
      setPhase(null)
      setError(`We couldn't find ${client.name}'s address on the map. Edit the address (check the street name or remove the apartment number) and try again.`)
      return
    }
    const pool = data.caregivers.filter((c) => c.address && matches(c, filters))
    const need = pool.filter((c) => !cached(c.address))
    // Look up the caregivers most likely to be close first (guessed from ZIP codes already on the map).
    const cents = zipCentroids()
    const czip = zipOf(client.address)
    for (const c of need) geocode(c.address, guessMiles(c.address, cpos, czip, cents))
    search.current = { run, cpos, pool, total: need.length }
    await rank(run)
  }

  // Let the app shell know when the route panel is showing (it auto-collapses the sidebar).
  const panelOpen = !!(routeInfo && results)
  useEffect(() => {
    onRoutePanelChange?.(panelOpen)
  }, [panelOpen, onRoutePanelChange])
  useEffect(() => () => onRoutePanelChange?.(false), [onRoutePanelChange])

  // While addresses are still being located, re-rank every few seconds so the list fills in progressively.
  useEffect(() => {
    if (phase?.kind !== 'refine' || !search.current) return
    const wait = Math.max(0, lastRank.current + 2500 - Date.now())
    const timer = setTimeout(() => rank(search.current.run), wait)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoVersion, phase?.kind])

  async function showRoute(r, cpos = clientPos, auto = false) {
    if (!auto) userPicked.current = true
    if (auto && r.cg.id === selected && routeInfo) return
    setSelected(r.cg.id)
    setRouteLoading(true)
    try {
      setRouteInfo({ ...(await route(r.pos, cpos)), cg: r.cg, from: r.pos, to: cpos })
    } catch {
      setRouteInfo(null)
      setError(`Couldn't load the route for ${r.cg.name}. Select them again to retry.`)
    }
    setRouteLoading(false)
  }

  function logContact(cg, outcome) {
    addMany('contacts', [{ date: new Date().toISOString(), clientId, caregiverId: cg.id, outcome }])
    toast({ title: `Contact logged: ${outcome}`, details: `${cg.name} for ${client.name}` })
  }

  const markers = []
  if (clientPos) markers.push({ id: 'client', kind: 'client', ...clientPos, label: client.name, permanent: true })
  results?.list.slice(0, 25).forEach((r, i) =>
    markers.push({
      id: r.cg.id,
      kind: 'caregiver',
      ...r.pos,
      rank: i + 1,
      selected: r.cg.id === selected,
      label: `${String(i + 1).padStart(2, '0')} ${r.cg.name} · ${fmtMi(r.miles)}`,
      permanent: i < 5 || r.cg.id === selected, // top 5 always show name + miles
    }),
  )
  const busy = phase?.kind === 'route'
  const showSkeleton = useDelayed(busy && !results)
  const activeFilterCount =
    ['level', 'gender', 'driver', 'search'].filter((k) => filters[k]).length +
    ['hospice', 'spanish', 'overnight', 'twelve', 'useCriteria'].filter((k) => filters[k]).length
  const required = filters.required || []

  return (
    <div className={'console' + (routeInfo && results ? ' has-panel' : '')}>
      <aside className="rail" aria-label="Dispatch search">
        <div className="rail-section">
          <div className="rail-row">
            <SelectField label="Client" placeholder="Select a client" options={clientOptions} value={clientId} onChange={(e) => pickClient(e.target.value)} className="grow" />
            <button type="button" className="btn btn-secondary btn-square" onClick={onAddClient} aria-label="Add client" title="Add client">
              <Icon name="plus" size={18} />
            </button>
          </div>

          {client &&
            (client.address ? (
              <p className="client-address">
                <Icon name="pin" size={14} />
                <span>{client.address}</span>
                <button type="button" className="btn-link" onClick={() => onEditClient(client)}>
                  Edit
                </button>
              </p>
            ) : (
              <div className="callout callout-warning">
                <Icon name="alert" size={18} />
                <p>
                  No address for {client.name}.{' '}
                  <button type="button" className="btn-link" onClick={() => onEditClient(client)}>
                    Add address
                  </button>
                </p>
              </div>
            ))}
          {client && (client.careManager || client.genderPreference || client.needs?.length > 0 || Object.keys(client.criteria || {}).length > 0) && (
            <p className="client-needs">
              {[
                client.careManager && `CM ${client.careManager}`,
                client.genderPreference && `${client.genderPreference} caregiver`,
                ...(client.needs || []),
                required.length > 0 && `${required.length} required criteria`,
                preferredOf(client).length > 0 && `${preferredOf(client).length} preferred`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}

          {client && (
            <>
              <div className="segmented segmented-full" role="radiogroup" aria-label="Traffic">
                {TRAFFIC.map((x) => (
                  <button key={x.id} type="button" role="radio" aria-checked={traffic === x.id} className={traffic === x.id ? 'is-on' : ''} onClick={() => setTraffic(x.id)}>
                    {x.label}
                  </button>
                ))}
              </div>
              <div className="rail-row">
                <Popover label={`Filters${activeFilterCount ? ` · ${activeFilterCount}` : ''}`} align="left" width={320}>
                  <FilterBar filters={filters} setFilters={setFilters} stacked />
                  {required.length > 0 && (
                    <label className={'toggle-chip align-start' + (filters.useCriteria ? ' is-on' : '')}>
                      <input type="checkbox" checked={!!filters.useCriteria} onChange={(e) => setFilters({ ...filters, useCriteria: e.target.checked })} />
                      {filters.useCriteria && <Icon name="check" size={14} />}
                      Only caregivers who meet all {required.length} required criteria
                    </label>
                  )}
                </Popover>
                <button type="button" className="btn btn-primary grow" disabled={!client.address || busy} onClick={findNearest}>
                  {busy ? <Spinner size={14} /> : <Icon name={results ? 'refresh' : 'search'} size={16} />}
                  {busy ? 'Searching…' : results ? 'Search again' : 'Find caregivers'}
                </button>
              </div>
            </>
          )}

          {phase?.kind === 'refine' && (
            <ProgressBar
              label="Refining: locating more caregivers"
              value={phase.done}
              max={phase.total}
              meta={`${phase.done}/${phase.total} · list updates as they come in`}
            />
          )}
          {phase?.kind === 'route' && (
            <p className="status-line" aria-live="polite">
              <Spinner size={14} /> Calculating drive times…
            </p>
          )}
          {error && (
            <div className="callout callout-danger" role="alert">
              <Icon name="alert" size={18} />
              <p>{error}</p>
            </div>
          )}
        </div>

        <div className="rail-results" aria-busy={busy}>
          {!data.caregivers.length && !data.clients.length && (
            <EmptyState icon="upload" title="Import your spreadsheet to start" action={<ImportButton store={store} primary onDone={onNavigate} />}>
              Choose the OPEN SHIFT .xlsx file. The file is read in this browser; the caregivers and clients in it are added to the team’s shared data.
            </EmptyState>
          )}
          {!client && (data.caregivers.length > 0 || data.clients.length > 0) && (
            <EmptyState icon="pin" title="Pick a client">
              Caregivers get ranked by driving distance to them. {data.clients.filter((c) => c.address).length}/{data.clients.length} clients have an address.
            </EmptyState>
          )}
          {showSkeleton && !results && (
            <ol className="result-list" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="result skeleton-row">
                  <span className="sk sk-rank" />
                  <span className="sk-body">
                    <span className="sk sk-name" />
                    <span className="sk sk-line" />
                    <span className="sk sk-line short" />
                  </span>
                  <span className="sk sk-num" />
                </li>
              ))}
            </ol>
          )}
          {client && !results && !busy && (
            <EmptyState icon="search" title={client.address ? 'Ready to search' : 'Address needed'}>
              {client.address ? 'Matching caregivers will be ranked by driving distance.' : 'Driving distance needs the street address of the client.'}
            </EmptyState>
          )}
          {results && !results.list.length && results.remaining > 0 && (
            <EmptyState icon="pin" title="Locating nearby caregivers">
              The closest caregivers are looked up first. Results appear here within a few seconds.
            </EmptyState>
          )}
          {results && !results.list.length && !results.remaining && (
            <EmptyState icon="users" title="No caregivers match">
              Loosen the filters or include more statuses.
            </EmptyState>
          )}
          {results?.list.length > 0 && (
            <>
              <header className="results-head">
                <span>
                  <strong className="num">{results.list.length}</strong> nearest
                </span>
                <span className="text-muted">
                  {results.pool} match{results.unlocated > 0 && ` · ${results.unlocated} not found`}
                </span>
              </header>
              <ol className="result-list">
                {results.list.map((r, i) => {
                  const sheet = data.sheetDistances?.[r.cg.id]?.[clientId]
                  const contact = lastContact[r.cg.id]
                  const sel = r.cg.id === selected
                  const f = fit(r.cg, client)
                  return (
                    <li key={r.cg.id} className={'result' + (sel ? ' is-selected' : '')} style={{ '--i': Math.min(i, 12) }}>
                      <button type="button" className="result-main" onClick={() => showRoute(r)} aria-pressed={sel}>
                        <span className="result-rank num">{String(i + 1).padStart(2, '0')}</span>
                        <span className="result-body">
                          <span className="result-name">{r.cg.name}</span>
                          <span className="result-line">
                            <StatusBadge status={r.cg.status} />
                            <CaregiverTags cg={r.cg} />
                          </span>
                          {r.cg.notes && <span className="result-note">{r.cg.notes}</span>}
                          {(f.preferredTotal > 0 || f.missing.length > 0) && (
                            <span className="result-meta">
                              {f.preferredTotal > 0 && `Preferred ${f.preferredMet}/${f.preferredTotal}`}
                              {f.preferredTotal > 0 && f.missing.length > 0 && ' · '}
                              {f.missing.length > 0 && <span className="text-danger">Missing {f.missing.length} required</span>}
                            </span>
                          )}
                          {(sheet || contact) && (
                            <span className="result-meta">
                              {sheet && `Sheet ${sheet[0] != null ? fmtMi(sheet[0]) : ''}${sheet[1] ? ` — ${sheet[1]}` : ''}`}
                              {sheet && contact && ' · '}
                              {contact && `${contact.outcome} ${fmtDate(contact.date)}`}
                            </span>
                          )}
                        </span>
                        <span className="result-figures num">
                          <strong>{fmtMi(r.miles)}</strong>
                          <span>{fmtMin(eta(r.minutes, traffic)?.typ)}</span>
                        </span>
                      </button>
                      <div className="result-actions">
                        {r.cg.phone && (
                          <a className="btn-link" href={`tel:${r.cg.phone}`}>
                            <Icon name="phone" size={14} /> {r.cg.phone}
                          </a>
                        )}
                        <select className="select-sm" value="" onChange={(e) => e.target.value && logContact(r.cg, e.target.value)} aria-label={`Log contact with ${r.cg.name}`}>
                          <option value="">Log contact</option>
                          {CONTACT_OUTCOMES.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </>
          )}
        </div>
      </aside>

      <section className="stage" aria-label="Map">
        <MapView
          markers={markers}
          line={routeInfo?.line}
          fitKey={`${clientId}|${routeInfo?.cg.id ?? 'none'}|${results ? 'results' : ''}`}
          focus={results ? [clientPos && [clientPos.lat, clientPos.lon], ...results.list.slice(0, 5).map((r) => [r.pos.lat, r.pos.lon])].filter(Boolean) : undefined}
          onSelect={(id) => {
            const r = results?.list.find((x) => x.cg.id === id)
            if (r) showRoute(r)
          }}
        />
        {showRouteSpinner && (
          <div className="map-status" aria-live="polite">
            <Spinner size={14} /> Loading route…
          </div>
        )}
      </section>

      {routeInfo && results && (
        <RoutePanel
          key={routeInfo.cg.id}
          info={routeInfo}
          traffic={traffic}
          trafficLabel={t.label}
          isBest={routeInfo.cg.id === results.list[0]?.cg.id}
          onOpen={() => onViewCaregiver(routeInfo.cg)}
          onClose={() => setRouteInfo(null)}
        />
      )}
    </div>
  )
}
