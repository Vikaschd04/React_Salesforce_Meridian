import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getOrder } from '../api/store.js'
import { formatCents } from '../lib/money.js'

export default function Confirmation() {
  const { orderId } = useParams()
  const { state } = useLocation()
  // Present when arriving straight from checkout; absent on a refresh / shared link.
  const [order, setOrder] = useState(state?.order ?? null)
  const [loading, setLoading] = useState(!state?.order)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (state?.order) return // already have the receipt from checkout
    let alive = true
    setLoading(true)
    setNotFound(false)
    getOrder(orderId)
      .then((data) => alive && setOrder(data))
      .catch(() => alive && setNotFound(true))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [orderId, state])

  return (
    <div className="container confirm">
      <span className="meridian-rule">Order confirmed</span>
      <div className="confirm__mark" aria-hidden="true">
        <svg viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="22" fill="none" stroke="var(--gold)" strokeWidth="1.5" />
          <path
            d="M15 24.5l6.2 6.2L34 18"
            fill="none"
            stroke="var(--pine)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h1 className="confirm__title">Thank you — your coffee is on its way.</h1>
      <p className="confirm__text">
        We’ve received your order and will roast it to order. A confirmation email would
        follow in a later phase; for now, here’s your reference.
      </p>

      <div className="confirm__receipt">
        <div className="confirm__id">
          <span className="confirm__label">Order</span>
          <span className="confirm__value">{orderId}</span>
        </div>

        {order && (
          <>
            <ul className="confirm__lines">
              {order.items.map((item) => (
                <li key={item.id} className="confirm__line">
                  <span>
                    {item.qty} × {item.name}
                  </span>
                  <span>{formatCents(item.lineCents)}</span>
                </li>
              ))}
            </ul>
            <div className="confirm__total">
              <span>Total paid</span>
              <span>{formatCents(order.totalCents)}</span>
            </div>
          </>
        )}

        {!order && loading && <p className="confirm__text">Loading your receipt…</p>}
        {!order && !loading && notFound && (
          <p className="confirm__text">
            We couldn’t retrieve the details for this order, but your reference above is
            confirmed.
          </p>
        )}
      </div>

      <Link to="/" className="btn">
        Back to the coffees
      </Link>
    </div>
  )
}
