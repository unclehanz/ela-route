import { useEffect, useState } from 'react'
import { fmtMi, fmtMin, fmtRange } from '../lib/format.js'
import { mapsLinks, walkTime } from '../lib/geo.js'
import { useDelayed } from '../lib/hooks.js'
import Icon from './Icon.jsx'
import Spinner from './Spinner.jsx'

const DRIVES = new Set(['Driver', ''])

function MapLinks({ from, to, mode, label }) {
  const l = mapsLinks(from, to, mode)
  return (
    <span className="mode-links">
      <a href={l.google} target="_blank" rel="noopener noreferrer" aria-label={`${label} in Google Maps (opens in a new tab)`}>
        Google Maps
      </a>
      <a href={l.apple} target="_blank" rel="noopener noreferrer" aria-label={`${label} in Apple Maps (opens in a new tab)`}>
        Apple Maps
      </a>
    </span>
  )
}

/**
 * How long the trip takes by car, public transit and on foot.
 * Car uses the calibrated drive estimate; walking is fetched from a free walking router;
 * transit has no free data source, so it links to Google/Apple Maps for live times instead of guessing.
 */
export default function TravelModes({ cg, from, to, drive, driveMiles, trafficLabel }) {
  const [walk, setWalk] = useState({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const showSpinner = useDelayed(walk.state === 'loading')

  useEffect(() => {
    if (!from || !to) return
    let live = true
    setWalk({ state: 'loading' })
    walkTime(from, to)
      .then((v) => live && setWalk({ state: 'ok', ...v }))
      .catch(() => live && setWalk({ state: 'error' }))
    return () => {
      live = false
    }
  }, [from, to, attempt])

  if (!from || !to) return null
  const drives = DRIVES.has(cg.driver || '')

  const car = (
    <li key="car" className={'mode' + (drives ? '' : ' is-unavailable')}>
      <Icon name="car" />
      <span>
        <span className="mode-name">Car</span>
        <span className="mode-sub">
          {drives ? `${fmtMin(drive.typ)} (${fmtRange(drive)}) · ${trafficLabel}` : `${cg.driver} — may need a ride`}
        </span>
      </span>
      <span className="mode-value">
        {fmtMi(driveMiles)}
        <small>{drives ? 'driving distance' : fmtMin(drive.typ)}</small>
      </span>
    </li>
  )

  const transit = (
    <li key="transit" className="mode">
      <Icon name="route" />
      <span>
        <span className="mode-name">Public transit</span>
        <span className="mode-sub">Bus and train times change by the hour</span>
      </span>
      <span className="mode-value">
        <MapLinks from={from} to={to} mode="transit" label="Transit times" />
        <small>live times</small>
      </span>
    </li>
  )

  const walking = (
    <li key="walk" className="mode">
      <Icon name="navigation" />
      <span>
        <span className="mode-name">Walking</span>
        <span className="mode-sub">
          {walk.state === 'ok' && (walk.minutes > 90 ? `${fmtMi(walk.miles)} · long walk` : fmtMi(walk.miles))}
          {walk.state === 'loading' && 'Calculating…'}
          {walk.state === 'error' && (
            <>
              Couldn’t load walking route.{' '}
              <button type="button" className="btn-link" onClick={() => setAttempt((x) => x + 1)}>
                Retry
              </button>
            </>
          )}
        </span>
      </span>
      <span className="mode-value" aria-busy={walk.state === 'loading'}>
        {walk.state === 'ok' && fmtMin(walk.minutes)}
        {walk.state === 'loading' && showSpinner && <Spinner size={14} />}
        {walk.state === 'error' && '—'}
        <small>
          <MapLinks from={from} to={to} mode="walking" label="Walking directions" />
        </small>
      </span>
    </li>
  )

  return (
    <section aria-label="Getting there">
      <div className="modes-head">
        <h3>Getting there</h3>
        {!drives && <span className="badge badge-warning"><span className="badge-dot" aria-hidden="true" />{cg.driver}</span>}
      </div>
      <ul className="modes">{drives ? [car, transit, walking] : [transit, walking, car]}</ul>
    </section>
  )
}
