/**
 * Accessible pager for the shop PLP. Renders Prev / numbered pages (with …
 * gaps for long ranges) / Next. Purely presentational — the parent owns the
 * current page and persists it (Shop keeps it in the URL) via onPage.
 */
export default function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null

  const go = (n) => () => {
    const target = Math.min(Math.max(1, n), totalPages)
    if (target !== page) onPage(target)
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="pagination__btn"
        onClick={go(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <span aria-hidden="true">‹</span> Prev
      </button>

      <ul className="pagination__pages">
        {pageList(page, totalPages).map((p, i) =>
          p === '…' ? (
            <li key={`gap-${i}`} className="pagination__gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                className={`pagination__page${p === page ? ' is-current' : ''}`}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}`}
                onClick={go(p)}
              >
                {p}
              </button>
            </li>
          ),
        )}
      </ul>

      <button
        type="button"
        className="pagination__btn"
        onClick={go(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        Next <span aria-hidden="true">›</span>
      </button>
    </nav>
  )
}

// Always show the first, last, current, and its neighbours; collapse the rest
// into … gaps so the control stays compact for large catalogs.
function pageList(page, total) {
  const wanted = new Set([1, total, page, page - 1, page + 1])
  const nums = [...wanted].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
  const out = []
  let prev = 0
  for (const n of nums) {
    if (n - prev > 1) out.push('…')
    out.push(n)
    prev = n
  }
  return out
}
