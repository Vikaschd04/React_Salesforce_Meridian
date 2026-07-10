import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { placeOrder } from '../api/store.js'
import { formatCents } from '../lib/money.js'
import ProductImage from '../components/ProductImage.jsx'
import QtyStepper from '../components/QtyStepper.jsx'

const SHIP_FREE_THRESHOLD = 4500
const SHIP_FLAT_CENTS = 600

export default function Cart() {
  const { lines, items, totalCents, setQty, removeItem, clear } = useCart()
  const navigate = useNavigate()
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState(null)

  const shippingCents = totalCents === 0 || totalCents >= SHIP_FREE_THRESHOLD ? 0 : SHIP_FLAT_CENTS
  const grandTotalCents = totalCents + shippingCents

  async function handleCheckout() {
    setPlacing(true)
    setError(null)
    try {
      const order = await placeOrder(items)
      clear()
      navigate(`/confirmation/${order.orderId}`, { state: { order } })
    } catch (err) {
      setError(err)
      setPlacing(false)
    }
  }

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
        <span className="meridian-rule">
          {items.reduce((n, it) => n + it.qty, 0)} bags
        </span>
      </div>

      <div className="cart__grid">
        <ul className="cart__lines">
          {lines.map(({ id, qty, product, lineCents }) => (
            <li key={id} className="line">
              <Link to={`/product/${id}`} className="line__art" aria-hidden="true" tabIndex={-1}>
                <ProductImage product={product} className="line__img" />
              </Link>
              <div className="line__main">
                <Link to={`/product/${id}`} className="line__name">
                  {product.name}
                </Link>
                <p className="line__origin">{product.origin}</p>
                <button
                  type="button"
                  className="line__remove"
                  onClick={() => removeItem(id)}
                >
                  Remove
                </button>
              </div>
              <div className="line__controls">
                <QtyStepper
                  value={qty}
                  onChange={(n) => setQty(id, n)}
                  idLabel={`Quantity for ${product.name}`}
                />
                <span className="line__price">{formatCents(lineCents)}</span>
              </div>
            </li>
          ))}
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

          {error && (
            <p className="summary__error" role="alert">
              {error.message || 'Checkout failed. Please try again.'}
            </p>
          )}

          <button
            type="button"
            className="btn btn--block summary__checkout"
            onClick={handleCheckout}
            disabled={placing}
          >
            {placing ? 'Placing order…' : 'Checkout'}
          </button>
          <p className="summary__fine">
            Guest checkout · Payments arrive in a later phase (this is a mock order).
          </p>
        </aside>
      </div>
    </div>
  )
}
