import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { getMyOrders } from '../api/store.js'
import { formatCents } from '../lib/money.js'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import Spinner from '../components/Spinner.jsx'
import ErrorState from '../components/ErrorState.jsx'

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function Account() {
  const { user, loading: authLoading, logout } = useAuth()
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!user) return
    let alive = true
    setOrders(null)
    setError(null)
    getMyOrders()
      .then((data) => alive && setOrders(data))
      .catch((err) => alive && setError(err))
    return () => {
      alive = false
    }
  }, [user, reloadKey])

  // Wait for the auth bootstrap, then require a session.
  if (authLoading) return <Spinner label="Loading your account…" />
  if (!user) return <Navigate to="/login" replace state={{ from: '/account' }} />

  return (
    <div className="container account-page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Account' }]} />

      <header className="account-head">
        <div>
          <h1 className="page-head__title">
            Hi, {user.firstName || 'there'}
          </h1>
          <p className="account-head__email">{user.email}</p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={logout}>
          Log out
        </button>
      </header>

      <section aria-labelledby="orders-heading" className="account-orders">
        <h2 id="orders-heading" className="section-head__title">
          Order history
        </h2>

        {error ? (
          <ErrorState message={error.message} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : !orders ? (
          <Spinner label="Loading orders…" />
        ) : orders.length === 0 ? (
          <div className="account-empty">
            <p>You haven’t placed any orders yet.</p>
            <Link to="/shop" className="btn">
              Start shopping
            </Link>
          </div>
        ) : (
          <ul className="order-list">
            {orders.map((order) => (
              <li key={order.orderId} className="order-card">
                <div className="order-card__head">
                  <div>
                    <span className="order-card__label">Order</span>
                    <span className="order-card__id">{order.orderId}</span>
                  </div>
                  <div className="order-card__meta">
                    <span className={`order-card__status status--${order.status}`}>
                      {order.status}
                    </span>
                    <span className="order-card__date">{formatDate(order.placedAt)}</span>
                  </div>
                </div>
                <ul className="order-card__lines">
                  {order.items.map((item) => (
                    <li key={item.id} className="order-card__line">
                      <span>
                        {item.qty} × {item.name}
                      </span>
                      <span>{formatCents(item.lineCents)}</span>
                    </li>
                  ))}
                </ul>
                <div className="order-card__total">
                  <span>Total</span>
                  <span>{formatCents(order.totalCents)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
