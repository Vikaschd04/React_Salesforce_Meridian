import { forwardRef, useImperativeHandle, useState } from 'react'
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

/**
 * Stripe Elements card entry (real Stripe test-mode provider). Rendered inside
 * an <Elements> provider by Checkout.jsx when the BFF reports provider=stripe.
 * The card details live in a Stripe-hosted iframe and NEVER touch our server —
 * on submit, Checkout calls the imperative `createPaymentMethod()` we expose here
 * to turn the card into a PaymentMethod id, which is all the BFF ever sees.
 *
 * The parent drives submission; this component only owns the card field + a
 * client-side validation message.
 */
const StripePaymentFields = forwardRef(function StripePaymentFields(_props, ref) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState(null)

  useImperativeHandle(
    ref,
    () => ({
      /** Create a PaymentMethod from the card field. Throws a friendly Error. */
      async createPaymentMethod(billingDetails) {
        if (!stripe || !elements) {
          throw new Error('Payment form is still loading — please try again in a moment.')
        }
        const { error: err, paymentMethod } = await stripe.createPaymentMethod({
          type: 'card',
          card: elements.getElement(CardElement),
          billing_details: billingDetails,
        })
        if (err) throw new Error(err.message)
        return { paymentMethodId: paymentMethod.id }
      },
    }),
    [stripe, elements],
  )

  // Stripe's card iframe can't read our CSS variables, so pick base colors from
  // the active theme once (checkout is rarely where someone toggles theme).
  const dark =
    document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.getAttribute('data-theme') &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  const cardStyle = {
    style: {
      base: {
        color: dark ? '#ececec' : '#1a1a1a',
        fontFamily: 'inherit',
        fontSize: '16px',
        '::placeholder': { color: dark ? '#8a8a8a' : '#9a9a9a' },
      },
      invalid: { color: '#c0392b' },
    },
  }

  return (
    <div className="pay">
      <div className="pay__head">
        <h2 className="account-section-title">Payment</h2>
        <span className="pay__badge">Test mode</span>
      </div>
      <p className="pay__hint">
        No real charge. Use <code>4242 4242 4242 4242</code> to succeed, or{' '}
        <code>4000 0000 0000 0002</code> to see a decline. Any future expiry / CVC / ZIP.
      </p>
      <div className="field field--span-2">
        <span className="field__label">Card details</span>
        <div className="pay__stripe-input">
          <CardElement options={cardStyle} onChange={(e) => setError(e.error ? e.error.message : null)} />
        </div>
      </div>
      {error && (
        <p className="auth-form__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
})

export default StripePaymentFields
