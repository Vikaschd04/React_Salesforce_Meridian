import { useState } from 'react'
import { useCart } from '../context/CartContext.jsx'

/**
 * Promo-code entry for the cart / checkout summary. When a code is applied it
 * collapses to a badge + Remove; otherwise it's an input + Apply. Validation
 * (and the friendly error) comes from the server via the cart context.
 */
export default function PromoInput() {
  const { promo, applyPromoCode, clearPromo } = useCart()
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function onApply(e) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      await applyPromoCode(trimmed)
      setCode('')
    } catch (err) {
      setError(err.message || 'That code didn’t work.')
    } finally {
      setBusy(false)
    }
  }

  if (promo) {
    return (
      <div className="promo promo--applied">
        <span className="promo__badge">{promo.code}</span>
        <span className="promo__label">{promo.label}</span>
        <button type="button" className="promo__remove" onClick={clearPromo}>
          Remove
        </button>
      </div>
    )
  }

  return (
    <form className="promo" onSubmit={onApply}>
      <div className="promo__row">
        <input
          className="promo__input"
          placeholder="Promo code"
          value={code}
          autoComplete="off"
          aria-label="Promo code"
          onChange={(e) => {
            setCode(e.target.value)
            setError(null)
          }}
        />
        <button
          type="submit"
          className="btn btn--ghost promo__apply"
          disabled={busy || !code.trim()}
        >
          {busy ? 'Applying…' : 'Apply'}
        </button>
      </div>
      {error && (
        <p className="promo__error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
