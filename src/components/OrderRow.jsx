import { Link } from 'react-router-dom'
import { formatCents } from '../lib/money.js'
import { formatOrderDate } from '../pages/account/Orders.jsx'
import useReorder from '../lib/useReorder.js'

/**
 * One row in an order list — used by both the shopper's own order history
 * (Orders.jsx) and the shared B2B company history (Company.jsx), whose rows
 * were previously byte-identical inline markup in each file.
 *
 * The card and the link are deliberately separate elements (not one giant
 * <Link> wrapping everything, as before): a <button> nested inside an <a>
 * is invalid HTML and breaks keyboard/screen-reader navigation. The Reorder
 * button is a sibling of the Link, both inside the styled card wrapper.
 */
export default function OrderRow({ order }) {
  const { reorder, result } = useReorder()
  const qty = order.items.reduce((n, it) => n + it.qty, 0)

  return (
    <div className="order-row">
      <Link to={`/account/orders/${order.orderId}`} className="order-row__link">
        <div className="order-row__main">
          <span className="order-card__id">{order.orderId}</span>
          <span className="order-row__summary">
            {order.placedByName ? `Placed by ${order.placedByName} · ` : ''}
            {qty} bag{qty === 1 ? '' : 's'} ·{' '}
            {order.items
              .map((it) => it.name)
              .slice(0, 2)
              .join(', ')}
            {order.items.length > 2 ? '…' : ''}
          </span>
        </div>
        <div className="order-row__meta">
          <span className={`order-card__status status--${order.status}`}>{order.status}</span>
          <span className="order-card__date">{formatOrderDate(order.placedAt)}</span>
          <span className="order-row__total">{formatCents(order.totalCents)}</span>
          <span className="order-row__chev" aria-hidden="true">
            →
          </span>
        </div>
      </Link>
      <div className="order-row__actions">
        <button
          type="button"
          className="order-row__reorder"
          onClick={() => reorder(order.items)}
        >
          <span className="order-row__reorder-icon" aria-hidden="true">
            ↻
          </span>
          Reorder
        </button>
        {result && (
          <span
            className={`order-row__reorder-msg${result.added > 0 ? ' order-row__reorder-msg--ok' : ''}`}
            role="status"
          >
            {result.added > 0
              ? `✓ Added ${result.added} item${result.added === 1 ? '' : 's'}`
              : 'Unavailable'}
            {result.skipped > 0 ? ` · ${result.skipped} unavailable` : ''}
          </span>
        )}
      </div>
    </div>
  )
}
