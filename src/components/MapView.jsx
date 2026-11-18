import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const LA = [33.9, -118.25]
// Leaflet needs literal colors, so read them from the theme tokens at render time.
const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/**
 * Keeps the map framed on what matters (client, caregivers, or the selected route) and in sync with its box size.
 * - Re-frames only when `fitKey` changes (new client, new search, another caregiver) — not on list refreshes.
 * - Waits for the layout to settle (route panel opening, sidebar folding) and re-frames if the size changes
 *   again shortly after, so the whole route is always visible in the space that is actually left.
 * - Stops as soon as the user drags, scrolls or zooms the map themselves.
 */
function MapSync({ points, padRight, fitKey }) {
  const map = useMap()
  const pointsRef = useRef(points)
  pointsRef.current = points
  const fitUntil = useRef(0) // re-fit on resize until this time (ms)

  const fit = (animate) => {
    const pts = pointsRef.current
    if (!pts.length) return
    const size = map.getSize()
    const right = padRight && size.x > 600 ? padRight : 48
    if (pts.length === 1) map.setView(pts[0], Math.max(map.getZoom(), 12), { animate })
    else map.fitBounds(pts, { paddingTopLeft: [48, 48], paddingBottomRight: [right, 48], maxZoom: 15, animate, duration: 0.5 })
  }

  // New subject: frame it once the layout has settled (panel/sidebar transitions take ~200 ms).
  useEffect(() => {
    fitUntil.current = Date.now() + 1200
    const t = setTimeout(() => {
      map.invalidateSize({ pan: false })
      fit(true)
    }, 220)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map])

  // Box size changed (panel opened/closed, sidebar folded, window resized): resize tiles, and re-frame if recent.
  useEffect(() => {
    const el = map.getContainer()
    let frame = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        map.invalidateSize({ pan: false })
        if (Date.now() < fitUntil.current) fit(false)
      })
    })
    ro.observe(el)
    // The user taking over the map ends automatic framing.
    const stop = () => (fitUntil.current = 0)
    el.addEventListener('pointerdown', stop)
    el.addEventListener('wheel', stop, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      el.removeEventListener('pointerdown', stop)
      el.removeEventListener('wheel', stop)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])
  return null
}

// ---------- Map icons ----------
// Solid shapes (pin = client, person = caregiver) drawn in the marker color with a surface-colored outline,
// so they read on the muted map without sitting on a background tile. Same 24px grid as the app icon set.
const SHAPES = {
  pin: 'M12 22.5s-7.5-6.6-7.5-12.4a7.5 7.5 0 0 1 15 0c0 5.8-7.5 12.4-7.5 12.4Zm0-9.4a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  person: 'M12 11.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Zm-8 9.6c0-4.2 3.6-7.4 8-7.4s8 3.2 8 7.4c0 .5-.4.8-.8.8H4.8a.8.8 0 0 1-.8-.8Z',
}
const iconCache = new Map()
function shapeIcon(shape, color, ring, size) {
  const key = [shape, color, ring, size].join('|')
  if (!iconCache.has(key)) {
    const html = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${SHAPES[shape]}" fill="${color}" fill-rule="evenodd" stroke="${ring}" stroke-width="2.2" stroke-linejoin="round" paint-order="stroke"/></svg>`
    const tip = shape === 'pin' // the pin's point (y = 22.5 of 24) sits exactly on the address
    iconCache.set(
      key,
      L.divIcon({
        html,
        className: 'map-icon map-icon-' + shape + (size >= 32 ? ' is-emphasis' : ''),
        iconSize: [size, size],
        iconAnchor: tip ? [size / 2, (size * 22.5) / 24] : [size / 2, size / 2],
        tooltipAnchor: tip ? [0, -size * 0.8] : [0, -size / 2],
      }),
    )
  }
  return iconCache.get(key)
}

/**
 * Draws the route line from start to end once the map has finished framing it.
 * Uses SVG for these two lines only (the rest of the map stays on canvas) so the stroke can be animated.
 */
function DrawnRoute({ line, ring, color }) {
  const map = useMap()
  const svg = useMemo(() => L.svg({ padding: 0.5 }), [])
  const halo = useRef(null)
  const main = useRef(null)
  const sig = line.length + ':' + line[0] + ':' + line[line.length - 1]
  useEffect(() => {
    const paths = [halo.current?._path, main.current?._path].filter(Boolean)
    if (!paths.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    paths.forEach((p) => (p.style.opacity = '0'))
    let done = false
    const draw = () => {
      if (done) return
      done = true
      for (const p of paths) {
        const len = p.getTotalLength()
        p.style.transition = 'none'
        p.style.strokeDasharray = `${len}`
        p.style.strokeDashoffset = `${len}`
        p.style.opacity = '1'
        p.getBoundingClientRect() // apply the start state before animating
        p.style.transition = 'stroke-dashoffset 650ms cubic-bezier(0.2, 0.8, 0.2, 1)'
        p.style.strokeDashoffset = '0'
      }
      // Clear the dash once drawn so later zooms (which change the path length) render a solid line.
      setTimeout(() => paths.forEach((p) => Object.assign(p.style, { transition: '', strokeDasharray: '', strokeDashoffset: '' })), 700)
    }
    map.once('moveend', draw)
    const fallback = setTimeout(draw, 900) // already framed: no move will happen
    return () => {
      map.off('moveend', draw)
      clearTimeout(fallback)
      paths.forEach((p) => (p.style.opacity = '1'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, map])
  return (
    <>
      <Polyline ref={halo} positions={line} renderer={svg} pathOptions={{ color: ring, weight: 9, opacity: 0.9 }} interactive={false} />
      <Polyline ref={main} positions={line} renderer={svg} pathOptions={{ color, weight: 5 }} interactive={false} />
    </>
  )
}

/** Small key explaining the icons; shown when the map has markers. */
function Legend({ kinds }) {
  if (!kinds.size) return null
  return (
    <div className="map-legend" aria-hidden="true">
      {(kinds.has('client') || kinds.has('stop')) && (
        <span>
          <svg width="16" height="16" viewBox="0 0 24 24"><path d={SHAPES.pin} fillRule="evenodd" className="legend-client" /></svg> Client
        </span>
      )}
      {(kinds.has('caregiver') || kinds.has('home')) && (
        <span>
          <svg width="16" height="16" viewBox="0 0 24 24"><path d={SHAPES.person} className="legend-caregiver" /></svg> Caregiver
        </span>
      )}
    </div>
  )
}

/**
 * markers: [{ id, lat, lon, kind: 'client'|'caregiver'|'stop'|'home', label, permanent, selected, rank }]
 * line: [[lat, lon], ...]
 * fitKey: change it to re-frame the map (e.g. client id + selected caregiver).
 * focus: [[lat, lon], ...] points that must stay in view when the map frames itself.
 */
export default function MapView({ markers = [], line, onSelect, padRight, fitKey, focus }) {
  // What to keep in view: the route plus any `focus` points (e.g. client + nearest caregivers); otherwise all markers.
  const fit = focus?.length || line?.length ? [...(line || []), ...(focus || [])] : markers.map((m) => [m.lat, m.lon])
  const autoKey = fitKey ?? fit.map((p) => p.join(',')).join(';')
  const c = {
    brand: token('--brand-primary'),
    brandDark: token('--brand-primary-dark'),
    danger: token('--danger-strong'),
    neutral: token('--map-neutral'),
    ring: token('--surface-base'),
  }
  // [shape, color, size] per marker kind
  const look = (m) => {
    if (m.kind === 'client') return ['pin', c.danger, 38]
    if (m.kind === 'stop') return ['pin', c.brand, 34]
    if (m.kind === 'home') return ['person', c.brandDark, 30]
    if (m.selected) return ['person', c.brandDark, 32]
    return ['person', m.rank <= 5 ? c.brand : c.neutral, m.rank <= 5 ? 26 : 22]
  }
  const kinds = new Set(markers.map((m) => m.kind))
  return (
    <MapContainer
      center={LA}
      zoom={10}
      className="map"
      scrollWheelZoom
      preferCanvas // draw pins and routes on one canvas instead of hundreds of SVG elements
      zoomSnap={0.5}
      zoomDelta={0.5}
      wheelPxPerZoomLevel={90}
      wheelDebounceTime={30}
    >
      {/* OpenStreetMap tiles; each tile is greyed once (see .muted-tiles in App.css) so routes and pins stand out. */}
      <TileLayer
        className="muted-tiles"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        keepBuffer={6} // keep more surrounding tiles so panning doesn't show blank squares
        updateWhenZooming={false} // load new tiles after a zoom finishes, not on every animation frame
      />
      <MapSync points={fit} padRight={padRight} fitKey={autoKey} />
      {line?.length > 1 && <DrawnRoute line={line} ring={c.ring} color={c.brand} />}
      {markers.map((m) => {
        const [shape, color, size] = look(m)
        return (
          <Marker
            // Stable key: selection only swaps the icon; only the permanent-label switch needs a remount.
            key={m.id + (m.permanent ? ':p' : '')}
            position={[m.lat, m.lon]}
            icon={shapeIcon(shape, color, c.ring, size)}
            zIndexOffset={m.kind === 'client' ? 1000 : m.selected ? 900 : m.rank ? 100 - m.rank : 0}
            keyboard={false}
            bubblingMouseEvents={false}
            eventHandlers={onSelect && m.kind === 'caregiver' ? { click: () => onSelect(m.id) } : undefined}
          >
            {m.label != null && (
              <Tooltip permanent={m.permanent} direction="top" offset={[0, -2]} className="map-label">
                {m.label}
              </Tooltip>
            )}
          </Marker>
        )
      })}
      <Legend kinds={kinds} />
    </MapContainer>
  )
}
