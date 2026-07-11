import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { placeOrder } from '../api/store.js'
import { formatCents } from '../lib/money.js'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import { COUNTRIES, regionsFor } from '../data/regions.js'

const SHIP_FREE_THRESHOLD = 4500
const SHIP_FLAT_CENTS = 600

const FIELDS = [
  { key: 'name', label: 'Full name', autoComplete: 'name', span: 2 },
  { key: 'email', label: 'Email', autoComplete: 'email', type: 'email', span: 2 },
  { key: 'street', label: 'Street address', autoComplete: 'street-address', span: 2 },
  { key: 'city', label: 'City', autoComplete: 'address-level2', span: 1 },
  { key: 'postalCode', label: 'Postal code', autoComplete: 'postal-code', span: 1 },
]

export default function Checkout() {
  const { lines, items, totalCents, clear } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [values, setValues] = useState({
    name: user ? `${user.firstName} ${user.lastName}`.trim() : '',
    email: user?.email || '',
    street: '',
    city: '',
    stateCode: '',
    postalCode: '',
    countryCode: 'US',
  })
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState(null)

  // Redirect only a genuinely empty cart back to the cart page. We key off the
  // raw `items` (not catalog-joined `lines`) so a refresh / direct link to
  // /checkout doesn't bounce out while the product catalog is still hydrating.
  if (items.length === 0 && !placing) return <Navigate to="/cart" replace />
  // Cart has items but prices haven't loaded yet — show a brief placeholder.
  const hydrating = lines.length === 0

  const shippingCents =
    totalCents === 0 || totalCents >= SHIP_FREE_THRESHOLD ? 0 : SHIP_FLAT_CENTS
  const grandTotalCents = totalCents + shippingCents
  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }))
  // Changing country clears any previously chosen state/province.
  const setCountry = (code) => setValues((prev) => ({ ...prev, countryCode: code, stateCode: '' }))
  const region = regionsFor(values.countryCode)

  async function onSubmit(e) {
    e.preventDefault()
    setPlacing(true)
    setError(null)
    try {
      const order = await placeOrder(items, values)
      clear()
      navigate(`/confirmation/${order.orderId}`, { state: { order } })
    } catch (err) {
      setError(err)
      setPlacing(false)
    }
  }

  return (
    <div className="container checkout">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Cart', to: '/cart' }, { label: 'Checkout' }]} />

      <div className="section-head">
        <h1 className="section-head__title">Checkout</h1>
        {!user && (
          <span className="checkout__login-hint">
            <Link to="/login" state={{ from: '/checkout' }}>
              Log in
            </Link>{' '}
            to save this to your account
          </span>
        )}
      </div>

      {hydrating ? (
        <p className="checkout__loading">Loading your cart…</p>
      ) : (
      <div className="checkout__grid">
        <form className="checkout__form" onSubmit={onSubmit}>
          <h2 className="account-section-title">Shipping details</h2>

          {error && (
            <p className="auth-form__error" role="alert">
              {error.message || 'Checkout failed. Please try again.'}
            </p>
          )}

          <div className="checkout__fields">
            {FIELDS.map((f) => (
              <label key={f.key} className={`field field--span-${f.span}`}>
                <span className="field__label">
                  {f.label}
                  {f.optional && <span className="field__opt"> (optional)</span>}
                </span>
                <input
                  type={f.type || 'text'}
                  autoComplete={f.autoComplete}
                  required={!f.optional}
                  placeholder={f.placeholder}
                  value={values[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </label>
            ))}
            <label className="field field--span-1">
              <span className="field__label">Country</span>
              <select
                autoComplete="country"
                value={values.countryCode}
                onChange={(e) => setCountry(e.target.value)}
              >
                {COUNTRIES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            {region && (
              <label className="field field--span-1">
                <span className="field__label">{region.label}</span>
                <select
                  autoComplete="address-level1"
                  value={values.stateCode}
                  onChange={(e) => set('stateCode', e.target.value)}
                >
                  <option value="">Select {region.label.toLowerCase()}…</option>
                  {region.options.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <button type="submit" className="btn btn--block checkout__submit" disabled={placing}>
            {placing ? 'Placing order…' : `Place order · ${formatCents(grandTotalCents)}`}
          </button>
          <p className="field__hint">
            No payment is taken — this is a mock checkout. Your order is created in Salesforce.
          </p>
        </form>

        <aside className="summary checkout__summary" aria-label="Order summary">
          <h2 className="summary__title">Your order</h2>
          <ul className="checkout__items">
            {lines.map(({ id, qty, product, lineCents }) => (
              <li key={id} className="checkout__item">
                <span>
                  {qty} × {product.name}
                </span>
                <span>{formatCents(lineCents)}</span>
              </li>
            ))}
          </ul>
          <div className="summary__row">
            <span>Subtotal</span>
            <span>{formatCents(totalCents)}</span>
          </div>
          <div className="summary__row">
            <span>Shipping</span>
            <span>{shippingCents === 0 ? 'Free' : formatCents(shippingCents)}</span>
          </div>
          <div className="summary__row summary__row--total">
            <span>Total</span>
            <span>{formatCents(grandTotalCents)}</span>
          </div>
          <Link to="/cart" className="checkout__edit">
            ← Edit cart
          </Link>
        </aside>
      </div>
      )}
    </div>
  )
}
