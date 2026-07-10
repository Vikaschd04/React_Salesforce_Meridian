/**
 * BagArt — generated cartographic artwork for each coffee, in place of stock
 * photos. Draws deterministic topographic "contour" rings seeded from the
 * product's coordinates and tinted with its origin accent. Fully offline and
 * on-concept (Meridian = maps), and it can never 404.
 */

function seededRings(lat, lng) {
  // Turn coordinates into a stable pseudo-random center + ring set.
  const seed = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453)
  const cx = 30 + ((seed * 40) % 40)
  const cy = 30 + (((seed * 71) % 40))
  const rings = []
  for (let i = 1; i <= 7; i++) {
    const wobble = ((seed * i * 17) % 6) - 3
    rings.push({ rx: i * 9 + wobble, ry: i * 7 + wobble * 0.7 })
  }
  return { cx, cy, rings }
}

export default function BagArt({ product, className = '' }) {
  const { lat, lng, accent } = product
  const { cx, cy, rings } = seededRings(lat, lng)

  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Contour map motif for ${product.name}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="100" height="100" fill="var(--surface)" />
      {/* Origin accent glow */}
      <circle cx={cx} cy={cy} r="46" fill={accent} opacity="0.12" />
      <g
        transform={`translate(${cx} ${cy})`}
        fill="none"
        stroke={accent}
        strokeWidth="0.8"
        opacity="0.55"
      >
        {rings.map((r, i) => (
          <ellipse key={i} rx={r.rx} ry={r.ry} />
        ))}
      </g>
      {/* Meridian crosshair through the origin */}
      <line x1={cx} y1="0" x2={cx} y2="100" stroke="var(--gold)" strokeWidth="0.5" opacity="0.9" />
      <line x1="0" y1={cy} x2="100" y2={cy} stroke="var(--gold)" strokeWidth="0.4" opacity="0.5" />
      <circle cx={cx} cy={cy} r="2.1" fill="var(--gold)" />
      <circle cx={cx} cy={cy} r="4.4" fill="none" stroke="var(--gold)" strokeWidth="0.6" />
    </svg>
  )
}
