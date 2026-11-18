import { useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState.jsx'
import SelectField from '../components/form/SelectField.jsx'
import TextField from '../components/form/TextField.jsx'
import Icon from '../components/Icon.jsx'
import MapView from '../components/MapView.jsx'
import PageHeader from '../components/PageHeader.jsx'
import Spinner from '../components/Spinner.jsx'
import { useToast } from '../components/Toast.jsx'
import { AVAILABLE_STATUSES } from '../lib/caregivers.js'
import { fmtMi, fmtMin, fmtMoney, fmtRange, plural, today } from '../lib/format.js'
import { currentTraffic, eta, etaLegs, geocode, TRAFFIC, trip, useGeoVersion } from '../lib/geo.js'

export default function RoutesPage({ store, onNavigate }) {
  const { data, addMany } = store
  const toast = useToast()
  useGeoVersion()
  const [cgId, setCgId] = useState('')
  const [picked, setPicked] = useState([])
  const [search, setSearch] = useState('')
  const [roundtrip, setRoundtrip] = useState(true)
  const [traffic, setTraffic] = useState(currentTraffic)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const cgOptions = useMemo(
    () =>
      data.caregivers
        .filter((c) => c.address && AVAILABLE_STATUSES.includes(c.status))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ value: c.id, label: c.driver ? `${c.name} (${c.driver})` : c.name })),
    [data.caregivers],
  )
  const clients = useMemo(
    () => data.clients.filter((c) => c.address && c.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)),
    [data.clients, search],
  )
  const cg = data.caregivers.find((c) => c.id === cgId)
  const hidden = data.clients.filter((c) => !c.address).length

  const reset = () => setResult(null)
  const toggle = (id) => {
    reset()
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  }

  async function optimize() {
    setError('')
    reset()
    setBusy(true)
    try {
      const stops = picked.map((id) => data.clients.find((c) => c.id === id))
      const home = await geocode(cg.address)
      if (!home) throw new Error(`We couldn't find ${cg.name}'s home address on the map. Edit it on the Caregivers page and try again.`)
      const pos = []
      for (const s of stops) {
        const p = await geocode(s.address)
        if (!p) throw new Error(`We couldn't find ${s.name}'s address on the map. Edit it on the Clients page and try again.`)
        pos.push(p)
      }
      const r = await trip([home, ...pos], roundtrip)
      const ordered = r.order.map((i) => (i === 0 ? { home: true, name: `${cg.name} (home)`, address: cg.address, pos: home } : { ...stops[i - 1], pos: pos[i - 1] }))
      setResult({ ...r, ordered })
    } catch (e) {
      setError(e.message.startsWith('Routing') ? 'The free routing service did not respond. Wait a minute and try again.' : e.message)
    }
    setBusy(false)
  }

  function logAll() {
    const legs = result.legs.map((leg, i) => {
      const from = result.ordered[i]
      const to = result.ordered[i + 1] || result.ordered[0]
      return {
        date: today(),
        caregiverId: cg.id,
        clientId: to.home ? '' : to.id,
        from: from.address,
        to: to.address,
        miles: +leg.miles.toFixed(1),
        minutes: Math.round(eta(leg.minutes, traffic).typ),
        purpose: to.home ? 'Return home' : 'Client visit',
      }
    })
    addMany('mileage', legs)
    toast({
      title: `${plural(legs.length, 'trip')} logged for ${cg.name}`,
      details: `${fmtMi(result.miles)} total · ${fmtMoney(result.miles * (data.settings.ratePerMile ?? 0.7))}`,
      actions: [{ label: 'View mileage log', primary: true, onClick: () => onNavigate('mileage') }],
    })
  }

  const markers = result
    ? result.ordered.map((s, i) => ({ id: `${s.id || 'home'}-${i}`, kind: s.home ? 'home' : 'stop', ...s.pos, label: s.home ? 'Start' : `${i}. ${s.name}`, permanent: true }))
    : []

  return (
    <>
      <PageHeader title="Route planner" subtitle="Find the shortest driving order for one caregiver visiting several clients." />
      <div className="routes-layout">
        <section className="panel routes-form" aria-label="Plan a route">
          <SelectField label="Caregiver" placeholder="Select caregiver" options={cgOptions} value={cgId} onChange={(e) => (setCgId(e.target.value), reset())} />
          {cg?.driver && cg.driver !== 'Driver' && (
            <div className="callout callout-warning">
              <Icon name="alert" />
              <p>
                {cg.name} is marked “{cg.driver}”.
              </p>
            </div>
          )}

          <fieldset className="stop-picker">
            <legend>
              Client stops <span className="text-muted">({picked.length} selected)</span>
              {picked.length > 0 && (
                <button type="button" className="btn-link" onClick={() => (setPicked([]), reset())}>
                  Clear
                </button>
              )}
            </legend>
            <TextField label="Search clients" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
            <ul className="stop-list">
              {clients.map((c) => {
                const on = picked.includes(c.id)
                return (
                  <li key={c.id}>
                    <label className={'stop' + (on ? ' is-on' : '')}>
                      <input type="checkbox" checked={on} onChange={() => toggle(c.id)} />
                      <span>
                        <span className="cell-strong">{c.name}</span>
                        <span className="text-muted small block">{c.address}</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            {!clients.length && (
              <EmptyState
                icon="home"
                title={search ? 'No clients match' : 'No clients have an address yet'}
                action={
                  !search && (
                    <button type="button" className="btn btn-secondary" onClick={() => onNavigate('clients')}>
                      Go to Clients
                    </button>
                  )
                }
              />
            )}
            {hidden > 0 && <p className="tf-help">{plural(hidden, 'client')} without an address {hidden === 1 ? 'is' : 'are'} not listed.</p>}
          </fieldset>

          <label className={'toggle-chip' + (roundtrip ? ' is-on' : '')}>
            <input type="checkbox" checked={roundtrip} onChange={(e) => (setRoundtrip(e.target.checked), reset())} />
            {roundtrip && <Icon name="check" size={16} />}
            Return home at the end
          </label>
          <div className="segmented segmented-full" role="radiogroup" aria-label="Traffic">
            {TRAFFIC.map((x) => (
              <button key={x.id} type="button" role="radio" aria-checked={traffic === x.id} className={traffic === x.id ? 'is-on' : ''} onClick={() => setTraffic(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary btn-block" disabled={!cg || !picked.length || busy} onClick={optimize}>
            {busy ? <Spinner /> : <Icon name="route" size={18} />}
            {busy ? 'Planning route…' : `Plan route (${plural(picked.length, 'stop')})`}
          </button>
          {error && (
            <div className="callout callout-danger" role="alert">
              <Icon name="alert" />
              <p>{error}</p>
            </div>
          )}
        </section>

        <div className="routes-main">
          <div className="map-frame">
            <MapView markers={markers} line={result?.line} fitKey={result ? `${cgId}|${result.order.join('-')}|${roundtrip}` : 'none'} />
          </div>
          {result ? (
            <section className="panel" aria-label="Planned route">
              <div className="route-summary">
                <dl className="route-figures">
                  <div>
                    <dt>Total distance</dt>
                    <dd>{fmtMi(result.miles)}</dd>
                  </div>
                  <div>
                    <dt>Drive time</dt>
                    <dd>{fmtMin(etaLegs(result.legs, traffic).typ)}</dd>
                    <p className="figure-note">typically {fmtRange(etaLegs(result.legs, traffic))}</p>
                  </div>
                  <div>
                    <dt>Stops</dt>
                    <dd>{result.ordered.length - 1}</dd>
                  </div>
                </dl>
                <button type="button" className="btn btn-secondary" onClick={logAll}>
                  <Icon name="receipt" size={18} /> Log all legs to mileage
                </button>
              </div>
              <ol className="leg-list">
                {result.legs.map((leg, i) => {
                  const from = result.ordered[i]
                  const to = result.ordered[i + 1] || result.ordered[0]
                  return (
                    <li key={i}>
                      <span>
                        {from.name} <Icon name="arrowRight" size={16} /> <span className="cell-strong">{to.name}</span>
                      </span>
                      <span className="text-muted num">
                        {fmtMi(leg.miles)} · {fmtMin(eta(leg.minutes, traffic).typ)}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </section>
          ) : (
            <section className="panel">
              <EmptyState icon="route" title="No route yet">
                Pick a caregiver and at least one client, then select Plan route.
              </EmptyState>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
