/**
 * Payment provider seam — the boundary between order creation and taking money.
 *
 * PAYMENT_PROVIDER=mock (default) simulates a charge entirely offline so the
 * whole checkout works with no third-party account. PAYMENT_PROVIDER=stripe uses
 * real Stripe test-mode PaymentIntents; the `stripe` SDK is lazy-imported so mock
 * mode needs no extra dependency.
 *
 * `charge()` is the single entry point. It returns { paymentId, status } on
 * success and throws an ApiError(402) via paymentError() on a decline.
 */
import { config } from '../config.js'
import { paymentError } from '../lib/errors.js'

const useStripe = config.paymentProvider === 'stripe'

/** Digits-only card number → true if it's the Stripe "decline" test PAN. */
function isDeclineCard(number) {
  const digits = String(number || '').replace(/\D/g, '')
  // Stripe's canonical generic-decline test card.
  return digits === '4000000000000002'
}

function looksLikeCard(number) {
  const digits = String(number || '').replace(/\D/g, '')
  return digits.length >= 12 && digits.length <= 19
}

/**
 * Take a payment for `amountCents`.
 * @param {object} args
 * @param {number} args.amountCents  Server-computed, trusted total.
 * @param {object} args.payment      Client-supplied payment details.
 *   mock:   { card: { number, exp, cvc, name } }
 *   stripe: { paymentMethodId }
 * @param {object} [args.metadata]   Attached to the charge (e.g. { email }).
 * @returns {Promise<{ paymentId: string, status: 'paid' }>}
 */
export async function charge({ amountCents, payment, metadata = {} }) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw paymentError('Nothing to charge.', 'invalid_amount')
  }
  return useStripe
    ? chargeStripe({ amountCents, payment, metadata })
    : chargeMock({ amountCents, payment })
}

// ---- Mock provider (offline) ----
function chargeMock({ payment }) {
  const card = payment?.card
  if (!card || !looksLikeCard(card.number)) {
    throw paymentError('Please enter a valid card number.', 'card_invalid')
  }
  if (isDeclineCard(card.number)) {
    throw paymentError('Your card was declined. Please try a different card.', 'card_declined')
  }
  const paymentId = `pi_mock_${Math.random().toString(36).slice(2, 12)}`
  return Promise.resolve({ paymentId, status: 'paid' })
}

// ---- Stripe provider (test mode) ----
let stripeClient = null
async function getStripe() {
  if (stripeClient) return stripeClient
  if (!config.payment.stripeSecretKey) {
    throw paymentError('Payments are not configured.', 'not_configured')
  }
  let Stripe
  try {
    ;({ default: Stripe } = await import('stripe'))
  } catch {
    throw paymentError(
      'Stripe is enabled but the `stripe` package is not installed (run `npm i stripe`).',
      'not_configured',
    )
  }
  stripeClient = new Stripe(config.payment.stripeSecretKey)
  return stripeClient
}

async function chargeStripe({ amountCents, payment, metadata }) {
  if (!payment?.paymentMethodId) {
    throw paymentError('Missing payment method.', 'card_invalid')
  }
  const stripe = await getStripe()
  try {
    // Confirm immediately server-side. Production/SCA flows move confirmation to
    // the client with Stripe Elements; test cards confirm fine this way.
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: config.payment.currency,
      payment_method: payment.paymentMethodId,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      metadata,
    })
    if (intent.status !== 'succeeded') {
      throw paymentError('Your card was declined.', 'card_declined')
    }
    return { paymentId: intent.id, status: 'paid' }
  } catch (err) {
    if (err.name === 'ApiError') throw err
    throw paymentError(err?.message || 'Your card was declined.', 'card_declined')
  }
}

/** Public payment config for the client (never leaks the secret key). */
export function paymentConfig() {
  return {
    provider: config.paymentProvider,
    publishableKey: useStripe ? config.payment.stripePublishableKey : '',
  }
}
