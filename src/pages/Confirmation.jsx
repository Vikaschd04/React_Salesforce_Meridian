import { Link, useLocation, useParams } from 'react-router-dom'
import { formatCents } from '../lib/money.js'

export default function Confirmation() {
  const { orderId } = useParams()
  const { state } = useLocation()
  const order = state?.order // present when arriving from checkout; absent on refresh

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
      </div>

      <Link to="/" className="btn">
        Back to the coffees
      </Link>
    </div>
  )
}
