import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { formatCents } from '../lib/money.js'
import ProductImage from '../components/ProductImage.jsx'
import QtyStepper from '../components/QtyStepper.jsx'

const SHIP_FREE_THRESHOLD = 4500
const SHIP_FLAT_CENTS = 600

export default function Cart() {
  const { lines, items, totalCents, setQty, removeItem } = useCart()
  const { isAuthed, user } = useAuth()

  const shippingCents = totalCents === 0 || totalCents >= SHIP_FREE_THRESHOLD ? 0 : SHIP_FLAT_CENTS
  const grandTotalCents = totalCents + shippingCents
  // Block checkout if any line exceeds available stock.
  const overStock = lines.some(({ qty, product }) => qty > product.stock)

  if (lines.length === 0) {
    return (
      <div className="container cart-empty">
        <span className="meridian-rule">Cart · 00°00′ empty</span>
        <h1 className="cart-empty__title">Your cart is empty</h1>
        <p className="cart-empty__text">
          No coordinates plotted yet. Find a coffee worth mapping.
        </p>
        <Link to="/" className="btn">
          Browse the coffees
        </Link>
      </div>
    )
  }

  return (
    <div className="container cart">
      <div className="section-head">
        <h1 className="section-head__title">Your cart</h1>
        <span className="meridian-rule">{items.reduce((n, it) => n + it.qty, 0)} bags</span>
      </div>

      <div className="cart__grid">
        <ul className="cart__lines">
          {lines.map(({ id, qty, product, lineCents }) => {
            const over = qty > product.stock
            return (
              <li key={id} className="line">
                <Link to={`/product/${id}`} className="line__art" aria-hidden="true" tabIndex={-1}>
                  <ProductImage product={product} className="line__img" />
                </Link>
                <div className="line__main">
                  <Link to={`/product/${id}`} className="line__name">
                    {product.name}
                  </Link>
                  <p className="line__origin">{product.origin}</p>
                  {over && (
                    <p className="line__stockwarn">
                      Only {product.stock} left — reduce the quantity to check out.
                    </p>
                  )}
                  <button type="button" className="line__remove" onClick={() => removeItem(id)}>
                    Remove
                  </button>
                </div>
                <div className="line__controls">
                  <QtyStepper
                    value={qty}
                    onChange={(n) => setQty(id, n)}
                    max={Math.max(1, product.stock)}
                    idLabel={`Quantity for ${product.name}`}
                  />
                  <span className="line__price">{formatCents(lineCents)}</span>
                </div>
              </li>
            )
          })}
        </ul>

        <aside className="summary" aria-label="Order summary">
          <h2 className="summary__title">Summary</h2>
          <div className="summary__row">
            <span>Subtotal</span>
            <span>{formatCents(totalCents)}</span>
          </div>
          <div className="summary__row">
            <span>Shipping</span>
            <span>{shippingCents === 0 ? 'Free' : formatCents(shippingCents)}</span>
          </div>
          {shippingCents > 0 && (
            <p className="summary__hint">
              Add {formatCents(SHIP_FREE_THRESHOLD - totalCents)} more for free shipping.
            </p>
          )}
          <div className="summary__row summary__row--total">
            <span>Total</span>
            <span>{formatCents(grandTotalCents)}</span>
          </div>

          <div className="summary__auth">
            {isAuthed ? (
              <p className="summary__signedin">
                Checking out as <strong>{user.firstName || user.email}</strong> — this order
                will appear in your history.
              </p>
            ) : (
              <p className="summary__guest">
                <Link to="/login" state={{ from: '/checkout' }}>
                  Log in
                </Link>{' '}
                to save this order to your account, or continue as a guest.
              </p>
            )}
          </div>

          {overStock ? (
            <button type="button" className="btn btn--block summary__checkout" disabled>
              Adjust quantities to continue
            </button>
          ) : (
            <Link to="/checkout" className="btn btn--block summary__checkout">
              Continue to checkout
            </Link>
          )}
          <p className="summary__fine">
            Guest checkout · No payment taken (mock order created in Salesforce).
          </p>
        </aside>
      </div>
    </div>
  )
}
