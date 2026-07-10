import { formatCoords } from '../lib/geo.js'

/**
 * The signature element: an origin's coordinates on a gold meridian hairline.
 * Used on every product card and the detail page.
 */
export default function CoordTag({ lat, lng, className = '' }) {
  return (
    <span className={`meridian-rule ${className}`}>{formatCoords(lat, lng)}</span>
  )
}
