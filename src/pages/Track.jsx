import { useState } from 'react'
import { Link } from 'react-router-dom'
import { trackOrder } from '../api/store.js'
import { formatCents } from '../lib/money.js'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import OrderTimeline from '../components/OrderTimeline.jsx'
import useSeo from '../lib/useSeo.js'

/**
 * Public order tracking — no login. Enter an order number + the email used at
 * checkout and see the order's status/timeline (read-only). The email must match
 * the order (verified server-side), so an order number alone reveals nothing.
 */
export default function Track() {
  useSeo({
    title: 'Track your order',
    description: 'Check the status of a Meridian order with your order number and email — no account needed.',
  })
  const [values, setValues] = useState({ orderId: '', email: '' })
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }))

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      setOrder(await trackOrder({ orderId: values.orderId.trim(), email: values.email.trim() }))
    } catch (err) {
      setOrder(null)
      setError(err.message || 'No order matches that number and email.')
    } finally {
      setLoading(false)
    }
  }

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
        <button type="submit" className="btn btn--block" disabled={loading}>
          {loading ? 'Looking…' : 'Track order'}
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
            <span className={`order-card__status status--${order.status}`}>{order.status}</span>
          </div>

          <OrderTimeline order={order} />

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
            <span>Total paid</span>
            <span>{formatCents(order.paidCents ?? order.totalCents + (order.shippingCents || 0))}</span>
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
