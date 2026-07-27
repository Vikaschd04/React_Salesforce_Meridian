import { useCallback, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { trackOrder } from '../api/store.js'
import { formatUsd, orderPaidUsd } from '../lib/money.js'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import OrderTimeline from '../components/OrderTimeline.jsx'
import Spinner from '../components/Spinner.jsx'
import useOrderStream from '../lib/useOrderStream.js'
import { isLiveStatus } from './account/Orders.jsx'
import useSeo from '../lib/useSeo.js'

/**
 * Public order tracking — for guests only (logged-in shoppers track from their
 * order history, so they're redirected there). Enter an order number + the email
 * used at checkout to see the order's status/timeline (read-only, email verified
 * server-side). Once found, the status updates live via a token-scoped SSE, the
 * same event stream the order history uses.
 */
export default function Track() {
  useSeo({
    title: 'Track your order',
    description: 'Check the status of a Meridian order with your order number and email — no account needed.',
  })
  const { user, loading } = useAuth()
  const [values, setValues] = useState({ orderId: '', email: '' })
  const [order, setOrder] = useState(null)
  const [streamToken, setStreamToken] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [flash, setFlash] = useState(false)
  // The looked-up email is reused to silently re-fetch on a live update.
  const lookedUp = useRef({ orderId: '', email: '' })

  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }))

  const fetchOrder = useCallback(async (orderId, email, { silent = false } = {}) => {
    if (!silent) setBusy(true)
    try {
      const res = await trackOrder({ orderId, email })
      const { streamToken: token, ...ord } = res
      setOrder(ord)
      if (token) setStreamToken(token)
      lookedUp.current = { orderId: ord.orderId, email }
      setError(null)
    } catch (err) {
      if (!silent) {
        setOrder(null)
        setStreamToken(null)
        setError(err.message || 'No order matches that number and email.')
      }
    } finally {
      if (!silent) setBusy(false)
    }
  }, [])

  // Live updates: when this order's status changes server-side, silently
  // re-fetch (reusing the verified email) and flash the timeline.
  const { connected } = useOrderStream(
    ({ orderId }) => {
      if (!order || orderId !== order.orderId) return
      fetchOrder(lookedUp.current.orderId, lookedUp.current.email, { silent: true })
      setFlash(true)
      setTimeout(() => setFlash(false), 1600)
    },
    streamToken ? `/api/orders/track/stream?token=${encodeURIComponent(streamToken)}` : null,
  )

  // Logged-in shoppers track from their order history — never bounce to login.
  if (loading) return <Spinner label="Loading…" />
  if (user) return <Navigate to="/account/orders" replace />

  async function onSubmit(e) {
    e.preventDefault()
    await fetchOrder(values.orderId.trim(), values.email.trim())
  }

  const live = connected && order && isLiveStatus(order.status)

  return (
    <div className="container track">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Track order' }]} />

      <header className="page-head">
        <p className="hero__eyebrow">Order tracking</p>
        <h1 className="page-head__title">Track your order</h1>
        <p className="page-head__lede">
          Enter your order number and the email you used at checkout to see where it is.
        </p>
      </header>

      <form className="auth-form track-form" onSubmit={onSubmit}>
        {error && (
          <p className="auth-form__error" role="alert">
            {error}
          </p>
        )}
        <div className="auth-form__row">
          <label className="field">
            <span className="field__label">Order number</span>
            <input
              type="text"
              required
              placeholder="MRD-…"
              value={values.orderId}
              onChange={(e) => set('orderId', e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Email</span>
            <input
              type="email"
              required
              value={values.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </label>
        </div>
        <button type="submit" className="btn btn--block" disabled={busy}>
          {busy ? 'Looking…' : 'Track order'}
        </button>
        <p className="field__hint">
          Have an account? <Link to="/login">Log in</Link> to see all your orders.
        </p>
      </form>

      {order && (
        <div className="order-card track-result">
          <div className="order-card__head">
            <div>
              <span className="order-card__label">Order</span>
              <h2 className="order-card__id order-detail__id">{order.orderId}</h2>
            </div>
            <span
              className={`order-card__status status--${order.status}${live ? ' order-card__status--live' : ''}`}
              title={live ? 'Live — this order updates automatically' : undefined}
            >
              {order.status}
            </span>
          </div>

          <div className={`order-detail__timeline${flash ? ' order-detail__timeline--flash' : ''}`}>
            <OrderTimeline order={order} />
          </div>

          <ul className="order-card__lines">
            {order.items.map((item) => (
              <li key={item.id} className="order-card__line">
                <span>
                  {item.qty} × {item.name}
                </span>
                <span>{formatUsd(item.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <div className="order-card__total">
            <span>Total paid</span>
            <span>{formatUsd(orderPaidUsd(order))}</span>
          </div>

          {order.shipping && (
            <div className="order-detail__shipping">
              <h3 className="account-section-title">Delivery</h3>
              <p className="order-detail__addr">
                {order.shipping.street}
                <br />
                {order.shipping.city}
                {order.shipping.state ? `, ${order.shipping.state}` : ''} {order.shipping.postalCode}
                <br />
                {order.shipping.country}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
