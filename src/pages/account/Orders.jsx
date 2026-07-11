import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyOrders } from '../../api/store.js'
import { formatCents } from '../../lib/money.js'
import Spinner from '../../components/Spinner.jsx'
import ErrorState from '../../components/ErrorState.jsx'
import useRefreshOnFocus from '../../lib/useRefreshOnFocus.js'

export function formatOrderDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Order-history tab: compact list, each row linking to the order detail. */
export default function Orders() {
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setOrders(null)
      setError(null)
    }
    try {
      const data = await getMyOrders()
      setOrders(data)
      setError(null)
    } catch (err) {
      if (!silent) setError(err)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useRefreshOnFocus(useCallback(() => load({ silent: true }), [load]))

  if (error) {
    return <ErrorState message={error.message} onRetry={() => load()} />
  }
  if (!orders) return <Spinner label="Loading orders…" />

  if (orders.length === 0) {
    return (
      <div className="account-empty">
        <p>You haven’t placed any orders yet.</p>
        <Link to="/shop" className="btn">
          Start shopping
        </Link>
      </div>
    )
  }

  return (
    <ul className="order-list">
      {orders.map((order) => (
        <li key={order.orderId}>
          <Link to={`/account/orders/${order.orderId}`} className="order-row">
            <div className="order-row__main">
              <span className="order-card__id">{order.orderId}</span>
              <span className="order-row__summary">
                {order.items.reduce((n, it) => n + it.qty, 0)} bag
                {order.items.reduce((n, it) => n + it.qty, 0) === 1 ? '' : 's'} ·{' '}
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
        </li>
      ))}
    </ul>
  )
}
