/**
 * Card entry for checkout (mock provider). Controlled by the parent, which owns
 * the { number, exp, cvc, name } state and sends it to placeOrder. Inputs are
 * lightly formatted for readability. In a real Stripe deployment this component
 * is swapped for Stripe Elements (the card number never touches our server) —
 * see the provider check in Checkout.jsx.
 */
function formatCardNumber(v) {
  const digits = v.replace(/\D/g, '').slice(0, 19)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}
function formatExpiry(v) {
  const digits = v.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}

export default function PaymentFields({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v })

  return (
    <div className="pay">
      <div className="pay__head">
        <h2 className="account-section-title">Payment</h2>
        <span className="pay__badge">Test mode</span>
      </div>
      <p className="pay__hint">
        No real charge. Use <code>4242 4242 4242 4242</code> to succeed, or{' '}
        <code>4000 0000 0000 0002</code> to see a decline. Any future expiry / CVC.
      </p>

      <div className="checkout__fields">
        <label className="field field--span-2">
          <span className="field__label">Card number</span>
          <input
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="1234 5678 9012 3456"
            value={value.number}
            onChange={(e) => set('number', formatCardNumber(e.target.value))}
            required
          />
        </label>
        <label className="field field--span-1">
          <span className="field__label">Expiry</span>
          <input
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            value={value.exp}
            onChange={(e) => set('exp', formatExpiry(e.target.value))}
            required
          />
        </label>
        <label className="field field--span-1">
          <span className="field__label">CVC</span>
          <input
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="123"
            value={value.cvc}
            onChange={(e) => set('cvc', e.target.value.replace(/\D/g, '').slice(0, 4))}
            required
          />
        </label>
        <label className="field field--span-2">
          <span className="field__label">Name on card</span>
          <input
            autoComplete="cc-name"
            placeholder="As printed on the card"
            value={value.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>
      </div>
    </div>
  )
}
