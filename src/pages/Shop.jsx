import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getProducts } from '../api/store.js'
import ProductCard from '../components/ProductCard.jsx'
import ShopControls from '../components/ShopControls.jsx'
import ActiveFilters from '../components/ActiveFilters.jsx'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import Spinner from '../components/Spinner.jsx'
import ErrorState from '../components/ErrorState.jsx'

// Country is the last comma-separated part of the origin string.
const countryOf = (origin) => origin.split(',').pop().trim()

// Candidate price buckets (integer cents). Only non-empty ones are shown, so
// the facet scales with whatever catalog is loaded.
const PRICE_BUCKETS = [
  { id: 'under-20', label: 'Under $20', test: (c) => c < 2000 },
  { id: '20-25', label: '$20–$25', test: (c) => c >= 2000 && c < 2500 },
  { id: '25-30', label: '$25–$30', test: (c) => c >= 2500 && c < 3000 },
  { id: 'over-30', label: '$30+', test: (c) => c >= 3000 },
]
const bucketById = (id) => PRICE_BUCKETS.find((b) => b.id === id)

const SORT_LABELS = {
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  name: 'Name: A–Z',
}

export default function Shop() {
  const [products, setProducts] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Filters live in the URL so a filtered view is shareable and survives refresh.
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') || ''
  const origin = searchParams.get('origin') || ''
  const price = searchParams.get('price') || ''
  const sort = searchParams.get('sort') || 'featured'
  const roasts = useMemo(
    () => new Set((searchParams.get('roast') || '').split(',').filter(Boolean)),
    [searchParams],
  )

  // Write a single filter key to the URL (empty/default removes it).
  function setParam(key, value) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (!value || value === 'featured') next.delete(key)
        else next.set(key, value)
        return next
      },
      { replace: true },
    )
  }
  const setSearch = (v) => setParam('q', v.trim() ? v : '')
  const setOrigin = (v) => setParam('origin', v)
  const setPrice = (v) => setParam('price', price === v ? '' : v)
  const setSort = (v) => setParam('sort', v)
  function toggleRoast(r) {
    const next = new Set(roasts)
    if (next.has(r)) next.delete(r)
    else next.add(r)
    setParam('roast', [...next].join(','))
  }
  function reset() {
    setSearchParams({}, { replace: true })
  }

  useEffect(() => {
    let alive = true
    setProducts(null)
    setError(null)
    getProducts()
      .then((data) => alive && setProducts(data))
      .catch((err) => alive && setError(err))
    return () => {
      alive = false
    }
  }, [reloadKey])

  const origins = useMemo(() => {
    if (!products) return []
    return [...new Set(products.map((p) => countryOf(p.origin)))].sort()
  }, [products])

  // Only offer price buckets that actually contain products.
  const priceBuckets = useMemo(() => {
    if (!products) return []
    return PRICE_BUCKETS.filter((b) => products.some((p) => b.test(p.priceCents))).map(
      ({ id, label }) => ({ id, label }),
    )
  }, [products])

  const visible = useMemo(() => {
    if (!products) return []
    const q = search.trim().toLowerCase()
    const bucket = bucketById(price)
    let list = products.filter((p) => {
      if (roasts.size && !roasts.has(p.roast)) return false
      if (origin && countryOf(p.origin) !== origin) return false
      if (bucket && !bucket.test(p.priceCents)) return false
      if (q) {
        const hay = `${p.name} ${p.origin} ${p.tastingNotes.join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    switch (sort) {
      case 'price-asc':
        list = [...list].sort((a, b) => a.priceCents - b.priceCents)
        break
      case 'price-desc':
        list = [...list].sort((a, b) => b.priceCents - a.priceCents)
        break
      case 'name':
        list = [...list].sort((a, b) => a.name.localeCompare(b.name))
        break
      default:
        break // 'featured' keeps source order
    }
    return list
  }, [products, search, roasts, origin, price, sort])

  const hasFilters =
    search.trim() !== '' || roasts.size > 0 || origin !== '' || price !== '' || sort !== 'featured'

  // Chips describing every applied filter; each removes just itself.
  const chips = []
  if (search.trim()) chips.push({ key: 'q', label: `“${search.trim()}”`, clear: () => setSearch('') })
  for (const r of roasts) chips.push({ key: `roast-${r}`, label: `${r} roast`, clear: () => toggleRoast(r) })
  if (origin) chips.push({ key: 'origin', label: origin, clear: () => setOrigin('') })
  if (price) {
    const b = priceBuckets.find((x) => x.id === price) || bucketById(price)
    chips.push({ key: 'price', label: b?.label || price, clear: () => setPrice(price) })
  }
  if (sort !== 'featured')
    chips.push({ key: 'sort', label: SORT_LABELS[sort] || sort, clear: () => setSort('featured') })

  return (
    <div className="container shop">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Shop' }]} />

      <header className="page-head">
        <h1 className="page-head__title">The whole map</h1>
        <p className="page-head__lede">
          Sixteen single-origin coffees, each traced to a named farm and plotted to its
          coordinates. Filter by roast, hunt by tasting note, or just browse the world.
        </p>
      </header>

      {error ? (
        <ErrorState message={error.message} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : !products ? (
        <Spinner label="Plotting the map…" />
      ) : (
        <>
          <ShopControls
            search={search}
            onSearch={setSearch}
            roasts={roasts}
            onToggleRoast={toggleRoast}
            origin={origin}
            onOrigin={setOrigin}
            origins={origins}
            priceBuckets={priceBuckets}
            price={price}
            onPrice={setPrice}
            sort={sort}
            onSort={setSort}
            onReset={reset}
            hasFilters={hasFilters}
            products={products}
          />

          <ActiveFilters chips={chips} onClearAll={reset} />

          <p className="shop__count" role="status" aria-live="polite">
            {visible.length} {visible.length === 1 ? 'coffee' : 'coffees'}
            {hasFilters ? ` of ${products.length}` : ''}
          </p>

          {visible.length === 0 ? (
            <div className="shop__empty">
              <p className="shop__empty-title">No coffees match those filters.</p>
              <button type="button" className="btn btn--ghost" onClick={reset}>
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="grid">
              {visible.map((product, i) => (
                <li key={product.id} style={{ '--n': i }}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
