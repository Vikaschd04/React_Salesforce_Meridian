import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { formatUsd, round2, computeTax, SHIP_FREE_THRESHOLD, SHIP_FLAT } from '../lib/money.js'
import ProductImage from '../components/ProductImage.jsx'
import QtyStepper from '../components/QtyStepper.jsx'
import PromoInput from '../components/PromoInput.jsx'
import { catalogPath } from '../lib/catalogPath.js'

export default function Cart() {
  const { lines, items, subtotal, promo, discount, setQty, removeItem } = useCart()
  const { isAuthed, user } = useAuth()

  const freeShipping = promo?.freeShipping || subtotal === 0 || subtotal >= SHIP_FREE_THRESHOLD
  const shippingCost = freeShipping ? 0 : SHIP_FLAT
  const tax = computeTax(subtotal, discount)
  const grandTotal = round2(subtotal - discount + shippingCost + tax)
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
          {lines.map(({ id, qty, product, lineTotal }) => {
            const over = qty > product.stock
            // Bundles link to their own PDP and describe what's inside; coffees
            // show their origin.
            const to = catalogPath(product)
            const sub = product.isBundle
              ? product.components?.map((c) => c.name).join(' · ') ||
                `${product.components?.length ?? ''}-coffee bundle`
              : product.origin
            return (
              <li key={id} className="line">
                <Link to={to} className="line__art" aria-hidden="true" tabIndex={-1}>
                  <ProductImage product={product} className="line__img" />
                </Link>
                <div className="line__main">
                  <Link to={to} className="line__name">
                    {product.name}
                  </Link>
                  <p className="line__origin">{sub}</p>
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
                  <span className="line__price">{formatUsd(lineTotal)}</span>
                </div>
              </li>
            )
          })}
        </ul>

        <aside className="summary" aria-label="Order summary">
          <h2 className="summary__title">Summary</h2>
          <div className="summary__row">
            <span>Subtotal</span>
            <span>{formatUsd(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="summary__row summary__row--discount">
              <span>Discount{promo?.code ? ` · ${promo.code}` : ''}</span>
              <span>−{formatUsd(discount)}</span>
            </div>
          )}
          <div className="summary__row">
            <span>Shipping</span>
            <span>{shippingCost === 0 ? 'Free' : formatUsd(shippingCost)}</span>
          </div>
          {shippingCost > 0 && (
            <p className="summary__hint">
              Add {formatUsd(SHIP_FREE_THRESHOLD - subtotal)} more for free shipping.
            </p>
          )}
          <div className="summary__row">
            <span>Tax</span>
            <span>{formatUsd(tax)}</span>
          </div>
          <PromoInput />
          <div className="summary__row summary__row--total">
            <span>Total</span>
            <span>{formatUsd(grandTotal)}</span>
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
