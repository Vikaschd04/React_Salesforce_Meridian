import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getMyOrder, cancelOrder } from '../../api/store.js'
import { formatCents } from '../../lib/money.js'
import Spinner from '../../components/Spinner.jsx'
import ErrorState from '../../components/ErrorState.jsx'
import { formatOrderDate } from './Orders.jsx'

/** One order: items, totals, shipping, status — with cancel while still draft. */
export default function OrderDetail() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState(null)

  useEffect(() => {
    let alive = true
    setOrder(null)
    setError(null)
    getMyOrder(id)
      .then((data) => alive && setOrder(data))
      .catch((err) => alive && setError(err))
    return () => {
      alive = false
    }
  }, [id, reloadKey])

  async function onCancel() {
    if (!window.confirm('Cancel this order? The bags go back on the shelf.')) return
    setCancelling(true)
    setCancelError(null)
    try {
      setOrder(await cancelOrder(id))
    } catch (err) {
      setCancelError(err.message || 'Could not cancel this order.')
    } finally {
      setCancelling(false)
    }
  }

  if (error) {
    return (
      <ErrorState
        message={error.status === 404 ? 'We couldn’t find that order.' : error.message}
        onRetry={error.status === 404 ? undefined : () => setReloadKey((k) => k + 1)}
      />
    )
  }
  if (!order) return <Spinner label="Loading order…" />

  const cancellable = order.status === 'draft'

  return (
    <section className="order-detail" aria-labelledby="order-detail-heading">
      <Link to="/account/orders" className="order-detail__back">
        ← All orders
      </Link>

      <div className="order-card">
        <div className="order-card__head">
          <div>
            <span className="order-card__label">Order</span>
            <h2 id="order-detail-heading" className="order-card__id order-detail__id">
              {order.orderId}
            </h2>
          </div>
          <div className="order-card__meta">
            <span className={`order-card__status status--${order.status}`}>{order.status}</span>
            <span className="order-card__date">{formatOrderDate(order.placedAt)}</span>
          </div>
        </div>

        <ul className="order-card__lines">
          {order.items.map((item) => (
            <li key={item.id} className="order-card__line">
              <span>
                {item.qty} × <Link to={`/product/${item.id}`}>{item.name}</Link>
              </span>
              <span>{formatCents(item.lineCents)}</span>
            </li>
          ))}
        </ul>

        <div className="order-card__total">
          <span>Total</span>
          <span>{formatCents(order.totalCents)}</span>
        </div>

        {(order.shipping || order.email) && (
          <div className="order-detail__shipping">
            <h3 className="account-section-title">Delivery</h3>
            <p className="order-detail__addr">
              {order.email && (
                <>
                  {order.email}
                  <br />
                </>
              )}
              {order.shipping && (
                <>
                  {order.shipping.street}
                  <br />
                  {order.shipping.city}
                  {order.shipping.state ? `, ${order.shipping.state}` : ''}{' '}
                  {order.shipping.postalCode}
                  <br />
                  {order.shipping.country}
                </>
              )}
            </p>
          </div>
        )}

        {cancelError && (
          <p className="summary__error" role="alert">
            {cancelError}
          </p>
        )}

        {cancellable && (
          <div className="order-detail__actions">
            <button type="button" className="btn btn--ghost order-detail__cancel" onClick={onCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Cancel order'}
            </button>
            <p className="field__hint">Orders can be cancelled until roasting begins.</p>
          </div>
        )}
      </div>
    </section>
  )
}
