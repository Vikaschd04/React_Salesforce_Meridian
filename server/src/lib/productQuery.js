/**
 * Pure catalog query helpers — filter, sort, facet, paginate, and suggest over
 * an array of app-shaped products (the shape store/catalog.js returns for both
 * the mock catalog and Salesforce). No I/O here, so this is trivially unit-
 * testable and is the single source of truth for the shop's derived facets —
 * country (parsed from the origin string), price buckets, and tasting-note
 * search — that don't map cleanly onto SOQL.
 *
 * This runs server-side so the browser only ever receives one page. That is the
 * same contract a fully DB-backed storefront exposes, which is why the frontend
 * wouldn't change if this were ever pushed down into SOQL LIMIT/OFFSET or a
 * search index for a much larger catalog.
 */

/** Country is the last comma-separated segment of the origin string. */
export const countryOf = (origin = '') => origin.split(',').pop().trim()

// Candidate price buckets (USD dollars). Only non-empty ones are surfaced as a
// facet, so the filter UI scales with whatever catalog is loaded.
export const PRICE_BUCKETS = [
  { id: 'under-20', label: 'Under $20', test: (p) => p < 20 },
  { id: '20-25', label: '$20–$25', test: (p) => p >= 20 && p < 25 },
  { id: '25-30', label: '$25–$30', test: (p) => p >= 25 && p < 30 },
  { id: 'over-30', label: '$30+', test: (p) => p >= 30 },
]
const bucketById = (id) => PRICE_BUCKETS.find((b) => b.id === id)

/** Keep only products matching the active search + roast + origin + price filters. */
export function filterProducts(products, { q = '', roasts = [], origin = '', price = '' } = {}) {
  const needle = String(q).trim().toLowerCase()
  const roastSet = new Set(roasts)
  const bucket = bucketById(price)
  return products.filter((p) => {
    if (roastSet.size && !roastSet.has(p.roast)) return false
    if (origin && countryOf(p.origin) !== origin) return false
    if (bucket && !bucket.test(p.price)) return false
    if (needle) {
      const hay = `${p.name} ${p.origin} ${(p.tastingNotes || []).join(' ')}`.toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })
}

/** Return a sorted copy; 'featured' keeps the catalog's source order. */
export function sortProducts(products, sort = 'featured') {
  switch (sort) {
    case 'price-asc':
      return [...products].sort((a, b) => a.price - b.price)
    case 'price-desc':
      return [...products].sort((a, b) => b.price - a.price)
    case 'name':
      return [...products].sort((a, b) => a.name.localeCompare(b.name))
    default:
      return products
  }
}

/**
 * Facet options computed over the WHOLE catalog (not the current page or the
 * filtered subset) so the filter sidebar never collapses as filters are applied.
 */
export function buildFacets(products) {
  const origins = [...new Set(products.map((p) => countryOf(p.origin)))].filter(Boolean).sort()
  const roasts = [...new Set(products.map((p) => p.roast))].filter(Boolean)
  const priceBuckets = PRICE_BUCKETS.filter((b) => products.some((p) => b.test(p.price))).map(
    ({ id, label }) => ({ id, label }),
  )
  return { origins, roasts, priceBuckets }
}

/** Slice `items` into one page, clamping the page into range. */
export function paginate(items, page = 1, pageSize = 10) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages)
  const start = (safePage - 1) * pageSize
  return { pageItems: items.slice(start, start + pageSize), total, totalPages, page: safePage }
}

/**
 * Typeahead suggestions over the whole catalog: up to 6 matching products
 * (→ open the product) then up to 4 matching tasting notes (→ fill the search).
 * Mirrors the shop search box's old client-side logic, now server-side so the
 * browser never has to download the full catalog just to autocomplete.
 */
export function suggest(products, q, limit = 8) {
  const needle = String(q || '').trim().toLowerCase()
  if (needle.length < 1) return []
  const out = []
  for (const p of products) {
    if (p.name.toLowerCase().includes(needle) || (p.origin || '').toLowerCase().includes(needle)) {
      out.push({ type: 'product', id: p.id, label: p.name, hint: p.origin })
    }
    if (out.length >= 6) break
  }
  const notes = new Set()
  for (const p of products) {
    for (const note of p.tastingNotes || []) {
      if (note.toLowerCase().includes(needle)) notes.add(note)
    }
  }
  for (const note of [...notes].slice(0, 4)) {
    out.push({ type: 'note', id: `note-${note}`, label: note, hint: 'Tasting note' })
  }
  return out.slice(0, limit)
}
