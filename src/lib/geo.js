/**
 * Geo helper — formats a decimal lat/lng into the signature Meridian
 * coordinate label, e.g. formatCoords(6.16, 38.2) -> "06°10′N · 38°12′E".
 */

function toDMS(deg, positive, negative) {
  const hemisphere = deg >= 0 ? positive : negative
  const abs = Math.abs(deg)
  const whole = Math.floor(abs)
  const minutes = Math.round((abs - whole) * 60)
  // Handle rounding that pushes minutes to 60.
  const d = minutes === 60 ? whole + 1 : whole
  const m = minutes === 60 ? 0 : minutes
  return `${String(d).padStart(2, '0')}°${String(m).padStart(2, '0')}′${hemisphere}`
}

export function formatCoords(lat, lng) {
  return `${toDMS(lat, 'N', 'S')} · ${toDMS(lng, 'E', 'W')}`
}
