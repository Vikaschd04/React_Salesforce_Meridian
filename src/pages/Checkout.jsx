import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { useCart } from '../context/CartContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { placeOrder, getPaymentConfig, getAddresses, addAddress } from '../api/store.js'
import { formatUsd, round2, computeTax, SHIP_FREE_THRESHOLD, SHIP_FLAT } from '../lib/money.js'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import PromoInput from '../components/PromoInput.jsx'
import PaymentFields from '../components/PaymentFields.jsx'
import StripePaymentFields from '../components/StripePaymentFields.jsx'
import ErrorPopup from '../components/ErrorPopup.jsx'
import { COUNTRIES, regionsFor } from '../data/regions.js'

const FIELDS = [
  { key: 'name', label: 'Full name', autoComplete: 'name', span: 2 },
  { key: 'email', label: 'Email', autoComplete: 'email', type: 'email', span: 2 },
  { key: 'street', label: 'Street address', autoComplete: 'street-address', span: 2 },
  { key: 'city', label: 'City', autoComplete: 'address-level2', span: 1 },
  { key: 'postalCode', label: 'Postal code', autoComplete: 'postal-code', span: 1 },
]

export default function Checkout() {
  const { lines, items, subtotal, promo, discount, clear } = useCart()
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
  const [payPublishableKey, setPayPublishableKey] = useState('')
  const stripeRef = useRef(null)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState(null)
  const [savedAddresses, setSavedAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState('new')
  const [saveAddress, setSaveAddress] = useState(false)

  // Learn which payment UI to render (mock card form vs Stripe Elements).
  useEffect(() => {
    let alive = true
    getPaymentConfig()
      .then((cfg) => {
        if (!alive) return
        setPayProvider(cfg.provider || 'mock')
        setPayPublishableKey(cfg.publishableKey || '')
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // Load Stripe.js once, only when the BFF is in Stripe mode with a key.
  const useStripe = payProvider === 'stripe' && !!payPublishableKey
  const stripePromise = useMemo(
    () => (useStripe ? loadStripe(payPublishableKey) : null),
    [useStripe, payPublishableKey],
  )

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
    if (id === 'new') {
      // Clear the shipping fields so the shopper types fresh details; keep only
      // name + email pre-filled from their account.
      setValues((prev) => ({
        ...prev,
        name: user ? `${user.firstName} ${user.lastName}`.trim() : prev.name,
        street: '',
        city: '',
        stateCode: '',
        postalCode: '',
        countryCode: 'US',
      }))
      return
    }
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
    promo?.freeShipping || subtotal === 0 || subtotal >= SHIP_FREE_THRESHOLD
  const shippingCost = freeShipping ? 0 : SHIP_FLAT
  const tax = computeTax(subtotal, discount)
  const grandTotal = round2(subtotal - discount + shippingCost + tax)
  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }))
  // Changing country clears any previously chosen state/province.
  const setCountry = (code) => setValues((prev) => ({ ...prev, countryCode: code, stateCode: '' }))
  const region = regionsFor(values.countryCode)

  async function onSubmit(e) {
    e.preventDefault()
    setPlacing(true)
    setError(null)
    try {
      // Stripe: tokenize the card client-side (never hits our server) → send the
      // PaymentMethod id. Mock: send the raw card fields. A Stripe card error
      // (e.g. a decline PAN) throws here and is shown by the catch below.
      const payment = useStripe
        ? await stripeRef.current.createPaymentMethod({
            name: values.name,
            email: values.email,
            address: {
              line1: values.street,
              city: values.city,
              state: values.stateCode || undefined,
              postal_code: values.postalCode,
              country: values.countryCode,
            },
          })
        : { card }
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

          <ErrorPopup
            message={error ? error.message || 'Checkout failed. Please try again.' : null}
            onClose={() => setError(null)}
          />

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

          {useStripe && stripePromise ? (
            <Elements stripe={stripePromise}>
              <StripePaymentFields ref={stripeRef} testMode={payPublishableKey.startsWith('pk_test_')} />
            </Elements>
          ) : (
            <PaymentFields value={card} onChange={setCard} />
          )}

          <button type="submit" className="btn btn--block checkout__submit" disabled={placing}>
            {placing ? (
              <span className="btn__loading">
                <span className="btn__spinner" aria-hidden="true" />
                Processing payment…
              </span>
            ) : (
              `Pay ${formatUsd(grandTotal)}`
            )}
          </button>
          <p className="field__hint">
            Test-mode checkout — no real charge. Your paid order is created in Salesforce.
          </p>
        </form>

        <aside className="summary checkout__summary" aria-label="Order summary">
          <h2 className="summary__title">Your order</h2>
          <ul className="checkout__items">
            {lines.map(({ id, qty, product, lineTotal }) => (
              <li key={id} className="checkout__item">
                <span>
                  {qty} × {product.name}
                </span>
                <span>{formatUsd(lineTotal)}</span>
              </li>
            ))}
          </ul>
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
          <div className="summary__row">
            <span>Tax</span>
            <span>{formatUsd(tax)}</span>
          </div>
          <PromoInput />
          <div className="summary__row summary__row--total">
            <span>Total</span>
            <span>{formatUsd(grandTotal)}</span>
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
