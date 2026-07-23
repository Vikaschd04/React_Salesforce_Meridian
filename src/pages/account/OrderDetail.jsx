import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getMyOrder, cancelOrder } from '../../api/store.js'
import { formatCents } from '../../lib/money.js'
import Spinner from '../../components/Spinner.jsx'
import ErrorState from '../../components/ErrorState.jsx'
import OrderTimeline from '../../components/OrderTimeline.jsx'
import useRefreshOnFocus from '../../lib/useRefreshOnFocus.js'
import useReorder from '../../lib/useReorder.js'
import { formatOrderDate } from './Orders.jsx'

/** One order: items, totals, live status timeline — with cancel while unshipped. */
export default function OrderDetail() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState(null)
  const { reorder, result: reorderResult } = useReorder()

  // `silent` refreshes update the order in place (no spinner) — used by the
  // focus refetch + the Refresh button so a Salesforce change appears live.
  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) setRefreshing(true)
      else {
        setOrder(null)
        setError(null)
      }
      try {
        const data = await getMyOrder(id)
        setOrder(data)
        setError(null)
      } catch (err) {
        if (!silent) setError(err)
      } finally {
        setRefreshing(false)
      }
    },
    [id],
  )

  useEffect(() => {
    load()
  }, [load])

  const refresh = useCallback(() => load({ silent: true }), [load])
  useRefreshOnFocus(refresh)

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
        onRetry={error.status === 404 ? undefined : () => load()}
      />
    )
  }
  if (!order) return <Spinner label="Loading order…" />

  // A teammate's order under the same company account is view-only.
  const cancellable = (order.status === 'paid' || order.status === 'pending') && order.isOwner !== false

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
            <button
              type="button"
              className="order-card__refresh"
              onClick={refresh}
              disabled={refreshing}
              title="Check for updates"
            >
              {refreshing ? 'Refreshing…' : '↻ Refresh'}
            </button>
          </div>
        </div>

        {order.isOwner === false && order.placedByName && (
          <p className="order-detail__placedby">
            Placed by <strong>{order.placedByName}</strong> · view-only
          </p>
        )}

        <OrderTimeline order={order} />

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

        <div className="order-card__line order-card__line--sub">
          <span>Subtotal</span>
          <span>{formatCents(order.subtotalCents ?? order.totalCents + (order.discountCents || 0))}</span>
        </div>
        {order.discountCents > 0 && (
          <div className="order-card__line order-card__line--discount">
            <span>Discount{order.promoCode ? ` · ${order.promoCode}` : ''}</span>
            <span>−{formatCents(order.discountCents)}</span>
          </div>
        )}
        <div className="order-card__line order-card__line--sub">
          <span>Shipping</span>
          <span>{order.shippingCents ? formatCents(order.shippingCents) : 'Free'}</span>
        </div>

        <div className="order-card__total">
          <span>Total paid</span>
          <span>{formatCents(order.paidCents ?? order.totalCents + (order.shippingCents || 0))}</span>
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

        <div className="order-detail__reorder">
          <button
            type="button"
            className="btn order-detail__reorder-btn"
            onClick={() => reorder(order.items)}
          >
            <span className="order-detail__reorder-icon" aria-hidden="true">
              ↻
            </span>
            Reorder these items
          </button>
          {reorderResult && (
            <p
              className={`order-detail__reorder-msg${reorderResult.added > 0 ? ' order-detail__reorder-msg--ok' : ''}`}
              role="status"
            >
              {reorderResult.added > 0
                ? `✓ Added ${reorderResult.added} item${reorderResult.added === 1 ? '' : 's'} to your cart.`
                : 'None of these items are available anymore.'}
              {reorderResult.skipped > 0
                ? ` ${reorderResult.skipped} item${reorderResult.skipped === 1 ? ' is' : 's are'} no longer available.`
                : ''}{' '}
              {reorderResult.added > 0 && <Link to="/cart">View cart →</Link>}
            </p>
          )}
        </div>

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
