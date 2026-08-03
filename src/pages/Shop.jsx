import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCatalogPage } from '../api/store.js'
import ProductCard from '../components/ProductCard.jsx'
import ShopControls from '../components/ShopControls.jsx'
import ActiveFilters from '../components/ActiveFilters.jsx'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import Pagination from '../components/Pagination.jsx'
import Spinner from '../components/Spinner.jsx'
import ErrorState from '../components/ErrorState.jsx'
import useSeo from '../lib/useSeo.js'

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 350

const SORT_LABELS = {
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
  name: 'Name: A–Z',
}

export default function Shop() {
  useSeo({
    title: 'Shop',
    description:
      'Every Meridian single-origin coffee, traced to a named farm. Filter by roast, price, and tasting note.',
  })

  // Filters + page live in the URL so a filtered view is shareable and survives
  // refresh. The server does the actual filtering/sorting/paging.
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('q') || ''
  const origin = searchParams.get('origin') || ''
  const price = searchParams.get('price') || ''
  const sort = searchParams.get('sort') || 'featured'
  const roastKey = searchParams.get('roast') || ''
  const page = Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1)
  const roasts = useMemo(() => new Set(roastKey.split(',').filter(Boolean)), [roastKey])

  const [data, setData] = useState(null) // { items, page, total, totalPages, facets }
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  // Write one filter key to the URL. Any filter change (anything but `page`)
  // resets to page 1 — you never want to land on page 4 of a fresh filter.
  function setParam(key, value) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (!value || value === 'featured') next.delete(key)
        else next.set(key, value)
        if (key !== 'page') next.delete('page')
        return next
      },
      { replace: true },
    )
  }
  const setOrigin = (v) => setParam('origin', v)
  const setPrice = (v) => setParam('price', price === v ? '' : v)
  const setSort = (v) => setParam('sort', v)
  const setPage = (n) => setParam('page', n > 1 ? String(n) : '')
  function toggleRoast(r) {
    const next = new Set(roasts)
    if (next.has(r)) next.delete(r)
    else next.add(r)
    setParam('roast', [...next].join(','))
  }
  function reset() {
    setSearchDraft('')
    setSearchParams({}, { replace: true })
  }

  // Debounced search: typing updates the draft immediately (responsive input),
  // but the URL `q` — which drives the server fetch — is written after a pause
  // so we don't hit the BFF on every keystroke.
  const [searchDraft, setSearchDraft] = useState(search)
  useEffect(() => {
    setSearchDraft(search) // keep in sync when q changes externally (reset, chip)
  }, [search])
  useEffect(() => {
    if (searchDraft === search) return undefined
    const t = setTimeout(() => setParam('q', searchDraft.trim() ? searchDraft : ''), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft])

  // Fetch a page whenever the filters / sort / page change. Keep the previous
  // page visible (dimmed) while loading so the layout doesn't flash.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    getCatalogPage({ page, pageSize: PAGE_SIZE, q: search, roasts: [...roasts], origin, price, sort })
      .then((res) => {
        if (!alive) return
        setData(res)
        setLoading(false)
      })
      .catch((err) => {
        if (!alive) return
        setError(err)
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [search, roastKey, origin, price, sort, page, reloadKey, roasts])

  // If the URL asks for a page past the end (e.g. filters narrowed the results),
  // the server clamps it — reflect that back into the URL.
  useEffect(() => {
    if (data && data.page !== page) setPage(data.page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const facets = data?.facets || { origins: [], priceBuckets: [], roasts: [] }
  const hasFilters =
    search.trim() !== '' || roasts.size > 0 || origin !== '' || price !== '' || sort !== 'featured'

  // Chips describing every applied filter; each removes just itself.
  const chips = []
  if (search.trim()) chips.push({ key: 'q', label: `“${search.trim()}”`, clear: () => setParam('q', '') })
  for (const r of roasts) chips.push({ key: `roast-${r}`, label: `${r} roast`, clear: () => toggleRoast(r) })
  if (origin) chips.push({ key: 'origin', label: origin, clear: () => setOrigin('') })
  if (price) {
    const b = facets.priceBuckets.find((x) => x.id === price)
    chips.push({ key: 'price', label: b?.label || price, clear: () => setPrice(price) })
  }
  if (sort !== 'featured')
    chips.push({ key: 'sort', label: SORT_LABELS[sort] || sort, clear: () => setSort('featured') })

  const total = data?.total || 0
  const shown = data?.items?.length || 0
  const firstOnPage = total === 0 ? 0 : (data.page - 1) * PAGE_SIZE + 1
  const lastOnPage = total === 0 ? 0 : firstOnPage + shown - 1

  return (
    <div className="container shop">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Shop' }]} />

      <header className="page-head">
        <p className="hero__eyebrow">The catalog</p>
        <h1 className="page-head__title">
          The whole <span className="hero__accent">map.</span>
        </h1>
        <p className="page-head__lede">
          Single-origin coffees, each traced to a named farm and plotted to its coordinates.
          Filter by roast, hunt by tasting note, or just browse the world.
        </p>
      </header>

      {error ? (
        <ErrorState message={error.message} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : !data ? (
        <Spinner label="Plotting the map…" />
      ) : (
        <>
          <ShopControls
            search={searchDraft}
            onSearch={setSearchDraft}
            roasts={roasts}
            onToggleRoast={toggleRoast}
            origin={origin}
            onOrigin={setOrigin}
            origins={facets.origins}
            priceBuckets={facets.priceBuckets}
            price={price}
            onPrice={setPrice}
            sort={sort}
            onSort={setSort}
            onReset={reset}
            hasFilters={hasFilters}
          />

          <ActiveFilters chips={chips} onClearAll={reset} />

          <p className="shop__count" role="status" aria-live="polite">
            {total === 0
              ? 'No coffees'
              : `Showing ${firstOnPage}–${lastOnPage} of ${total} ${total === 1 ? 'coffee' : 'coffees'}`}
          </p>

          {total === 0 ? (
            <div className="shop__empty">
              <p className="shop__empty-title">No coffees match those filters.</p>
              <button type="button" className="btn btn--ghost" onClick={reset}>
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <ul className={`grid${loading ? ' is-loading' : ''}`} aria-busy={loading}>
                {data.items.map((product, i) => (
                  <li key={product.id} style={{ '--n': i }}>
                    <ProductCard product={product} />
                  </li>
                ))}
              </ul>

              <Pagination page={data.page} totalPages={data.totalPages} onPage={setPage} />
            </>
          )}
        </>
      )}
    </div>
  )
}
