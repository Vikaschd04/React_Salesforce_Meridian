const ROASTS = ['Light', 'Medium', 'Dark']

const SORTS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name: A–Z' },
]

/**
 * Filter / search / sort bar for the Shop page. Fully controlled — the parent
 * owns the state and does the actual filtering.
 */
export default function ShopControls({
  search,
  onSearch,
  roasts,
  onToggleRoast,
  origin,
  onOrigin,
  origins,
  priceBuckets = [],
  price,
  onPrice,
  sort,
  onSort,
  onReset,
  hasFilters,
}) {
  return (
    <div className="shop-controls">
      <div className="shop-controls__search">
        <label className="sr-only" htmlFor="shop-search">
          Search coffees
        </label>
        <svg className="shop-controls__icon" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <line x1="13.5" y1="13.5" x2="18" y2="18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          id="shop-search"
          type="search"
          className="shop-controls__input"
          placeholder="Search by name, origin, or tasting note…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      <div className="shop-controls__row">
        <div className="shop-controls__facets">
          <div className="roast-pills" role="group" aria-label="Filter by roast">
            {ROASTS.map((r) => {
              const active = roasts.has(r)
              return (
                <button
                  key={r}
                  type="button"
                  className={`roast-pill${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  data-roast={r}
                  onClick={() => onToggleRoast(r)}
                >
                  {r}
                </button>
              )
            })}
          </div>

          {priceBuckets.length > 1 && (
            <div className="price-pills" role="group" aria-label="Filter by price">
              {priceBuckets.map((b) => {
                const active = price === b.id
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={`price-pill${active ? ' is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => onPrice(b.id)}
                  >
                    {b.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="shop-controls__selects">
          <label className="select-field">
            <span className="sr-only">Filter by origin</span>
            <select value={origin} onChange={(e) => onOrigin(e.target.value)}>
              <option value="">All origins</option>
              {origins.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>

          <label className="select-field">
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={(e) => onSort(e.target.value)}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          {hasFilters && (
            <button type="button" className="shop-controls__reset" onClick={onReset}>
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
