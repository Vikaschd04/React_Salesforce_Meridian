import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { getCompanyOrders } from '../../api/store.js'
import { formatCents } from '../../lib/money.js'
import Spinner from '../../components/Spinner.jsx'
import ErrorState from '../../components/ErrorState.jsx'
import useRefreshOnFocus from '../../lib/useRefreshOnFocus.js'
import { formatOrderDate } from './Orders.jsx'

/**
 * Company tab: the shared order history for the shopper's team — any teammate's
 * order under the same Salesforce Account, most recent first. Only rendered
 * (see AccountLayout) when the shopper belongs to a company.
 */
export default function Company() {
  const { user } = useAuth()
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setOrders(null)
      setError(null)
    }
    try {
      const data = await getCompanyOrders()
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

  return (
    <div className="company-tab">
      <div className="company-tab__head">
        <h2 className="account-section-title">{user.company.name}</h2>
        <p className="field__hint">
          Every order placed by a teammate on this company account shows up here.
        </p>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={() => load()} />
      ) : !orders ? (
        <Spinner label="Loading company orders…" />
      ) : orders.length === 0 ? (
        <div className="account-empty">
          <p>No orders on this company account yet.</p>
          <Link to="/shop" className="btn">
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="order-list">
          {orders.map((order) => (
            <li key={order.orderId}>
              <Link to={`/account/orders/${order.orderId}`} className="order-row">
                <div className="order-row__main">
                  <span className="order-card__id">{order.orderId}</span>
                  <span className="order-row__summary">
                    {order.placedByName ? `Placed by ${order.placedByName} · ` : ''}
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
      )}
    </div>
  )
}
