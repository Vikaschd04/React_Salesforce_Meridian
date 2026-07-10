import { formatCoords } from '../lib/geo.js'

/**
 * Scrolling coordinate ticker — a slow marquee of every origin's name and
 * lat/lng, like a departures board for coffee. Purely decorative
 * (aria-hidden); the list is duplicated so the CSS loop is seamless.
 * prefers-reduced-motion stops the scroll (global guard).
 */
export default function CoordTicker({ products = [] }) {
  if (products.length === 0) return null
  const entries = products.map((p) => ({
    id: p.id,
    label: `${p.origin.split(',').pop().trim()} ${formatCoords(p.lat, p.lng)}`,
  }))

  const strip = (keyPrefix) =>
    entries.map((e) => (
      <span key={`${keyPrefix}-${e.id}`} className="ticker__item">
        <span className="ticker__dot" />
        {e.label}
      </span>
    ))

  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker__track">
        {strip('a')}
        {strip('b')}
      </div>
    </div>
  )
}
