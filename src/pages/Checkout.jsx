import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { placeOrder, getPaymentConfig, getAddresses, addAddress } from '../api/store.js'
import { formatCents } from '../lib/money.js'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import PromoInput from '../components/PromoInput.jsx'
import PaymentFields from '../components/PaymentFields.jsx'
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
  const { lines, items, totalCents, promo, discountCents, clear } = useCart()
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
  const [card, setCard] = useState({ number: '', exp: '', cvc: '', name: '' })
  const [payProvider, setPayProvider] = useState('mock')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState(null)
  const [savedAddresses, setSavedAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState('new')
  const [saveAddress, setSaveAddress] = useState(false)

  // Learn which payment UI to render (mock card form vs Stripe Elements).
  useEffect(() => {
    let alive = true
    getPaymentConfig()
      .then((cfg) => alive && setPayProvider(cfg.provider || 'mock'))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // Logged-in shoppers: load saved addresses and auto-fill the default.
  useEffect(() => {
    if (!user) return undefined
    let alive = true
    getAddresses()
      .then((list) => {
        if (!alive || !list.length) return
        setSavedAddresses(list)
        const def = list.find((a) => a.isDefault) || list[0]
        setSelectedAddressId(def.id)
        setValues((prev) => ({
          ...prev,
          name: def.name || prev.name,
          street: def.street,
          city: def.city,
          stateCode: def.stateCode,
          postalCode: def.postalCode,
          countryCode: def.countryCode,
        }))
      })
      .catch(() => {
        /* non-fatal: just type the address manually */
      })
    return () => {
      alive = false
    }
  }, [user])

  // Pick a saved address (or "new" to type a fresh one).
  function selectAddress(id) {
    setSelectedAddressId(id)
    if (id === 'new') return
    const a = savedAddresses.find((x) => x.id === id)
    if (!a) return
    setValues((prev) => ({
      ...prev,
      name: a.name || prev.name,
      street: a.street,
      city: a.city,
      stateCode: a.stateCode,
      postalCode: a.postalCode,
      countryCode: a.countryCode,
    }))
  }

  // Redirect only a genuinely empty cart back to the cart page. We key off the
  // raw `items` (not catalog-joined `lines`) so a refresh / direct link to
  // /checkout doesn't bounce out while the product catalog is still hydrating.
  if (items.length === 0 && !placing) return <Navigate to="/cart" replace />
  // Cart has items but prices haven't loaded yet — show a brief placeholder.
  const hydrating = lines.length === 0

  const freeShipping =
    promo?.freeShipping || totalCents === 0 || totalCents >= SHIP_FREE_THRESHOLD
  const shippingCents = freeShipping ? 0 : SHIP_FLAT_CENTS
  const grandTotalCents = totalCents - discountCents + shippingCents
  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }))
  // Changing country clears any previously chosen state/province.
  const setCountry = (code) => setValues((prev) => ({ ...prev, countryCode: code, stateCode: '' }))
  const region = regionsFor(values.countryCode)

  async function onSubmit(e) {
    e.preventDefault()
    setPlacing(true)
    setError(null)
    try {
      // Mock provider takes raw card fields; a real Stripe build would pass a
      // { paymentMethodId } created client-side by Stripe Elements instead.
      const payment = payProvider === 'stripe' ? { card } : { card }
      const order = await placeOrder(items, values, promo?.code || null, payment)
      // Best-effort: save this shipping address for next time (never blocks the
      // order if it fails). Only when the shopper opted in and typed a new one.
      if (user && saveAddress && selectedAddressId === 'new') {
        addAddress({
          label: '',
          name: values.name,
          street: values.street,
          city: values.city,
          stateCode: values.stateCode,
          postalCode: values.postalCode,
          countryCode: values.countryCode,
          isDefault: savedAddresses.length === 0,
        }).catch(() => {})
      }
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

          {savedAddresses.length > 0 && (
            <div className="checkout__saved" role="radiogroup" aria-label="Saved addresses">
              {savedAddresses.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  className={`checkout__saved-opt${selectedAddressId === a.id ? ' is-selected' : ''}`}
                  aria-pressed={selectedAddressId === a.id}
                  onClick={() => selectAddress(a.id)}
                >
                  <span className="checkout__saved-label">{a.label || a.name}</span>
                  <span className="checkout__saved-line">
                    {a.street}, {a.city} {a.stateCode}
                  </span>
                </button>
              ))}
              <button
                type="button"
                className={`checkout__saved-opt${selectedAddressId === 'new' ? ' is-selected' : ''}`}
                aria-pressed={selectedAddressId === 'new'}
                onClick={() => selectAddress('new')}
              >
                <span className="checkout__saved-label">+ New address</span>
                <span className="checkout__saved-line">Ship somewhere else</span>
              </button>
            </div>
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

          {user && selectedAddressId === 'new' && (
            <label className="auth-form__checkbox checkout__save-addr">
              <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
              Save this address to my account
            </label>
          )}

          <PaymentFields value={card} onChange={setCard} />

          <button type="submit" className="btn btn--block checkout__submit" disabled={placing}>
            {placing ? 'Processing payment…' : `Pay ${formatCents(grandTotalCents)}`}
          </button>
          <p className="field__hint">
            Test-mode checkout — no real charge. Your paid order is created in Salesforce.
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
          {discountCents > 0 && (
            <div className="summary__row summary__row--discount">
              <span>Discount{promo?.code ? ` · ${promo.code}` : ''}</span>
              <span>−{formatCents(discountCents)}</span>
            </div>
          )}
          <div className="summary__row">
            <span>Shipping</span>
            <span>{shippingCents === 0 ? 'Free' : formatCents(shippingCents)}</span>
          </div>
          <PromoInput />
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
