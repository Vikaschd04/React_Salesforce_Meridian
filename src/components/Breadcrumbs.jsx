import { Link } from 'react-router-dom'

/**
 * Breadcrumb trail. `items` is an array of { label, to? }; the last item is
 * rendered as the current page (no link).
 */
export default function Breadcrumbs({ items }) {
  return (
    <nav className="crumb" aria-label="Breadcrumb">
      <ol className="crumb__list">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={i} className="crumb__item">
              {item.to && !last ? (
                <Link to={item.to} className="crumb__link">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined}>{item.label}</span>
              )}
              {!last && <span className="crumb__sep" aria-hidden="true">/</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
