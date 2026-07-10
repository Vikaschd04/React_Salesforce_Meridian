import { useEffect, useMemo, useState } from 'react'
import { getProducts } from '../api/store.js'
import ProductCard from '../components/ProductCard.jsx'
import ShopControls from '../components/ShopControls.jsx'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import Spinner from '../components/Spinner.jsx'
import ErrorState from '../components/ErrorState.jsx'

// Country is the last comma-separated part of the origin string.
const countryOf = (origin) => origin.split(',').pop().trim()

export default function Shop() {
  const [products, setProducts] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [search, setSearch] = useState('')
  const [roasts, setRoasts] = useState(() => new Set())
  const [origin, setOrigin] = useState('')
  const [sort, setSort] = useState('featured')

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

  const visible = useMemo(() => {
    if (!products) return []
    const q = search.trim().toLowerCase()
    let list = products.filter((p) => {
      if (roasts.size && !roasts.has(p.roast)) return false
      if (origin && countryOf(p.origin) !== origin) return false
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
  }, [products, search, roasts, origin, sort])

  const hasFilters = search.trim() !== '' || roasts.size > 0 || origin !== '' || sort !== 'featured'

  function toggleRoast(r) {
    setRoasts((prev) => {
      const next = new Set(prev)
      if (next.has(r)) next.delete(r)
      else next.add(r)
      return next
    })
  }

  function reset() {
    setSearch('')
    setRoasts(new Set())
    setOrigin('')
    setSort('featured')
  }

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
            sort={sort}
            onSort={setSort}
            onReset={reset}
            hasFilters={hasFilters}
          />

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
