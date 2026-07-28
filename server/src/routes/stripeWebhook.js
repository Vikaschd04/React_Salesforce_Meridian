/**
 * Stripe webhook — POST /api/stripe/webhook.
 *
 * Stripe posts events here (payment succeeded/failed, refunds). This is a
 * backstop: in our flow the charge is confirmed synchronously before the order
 * is written, so the order never depends on the webhook — but it's the correct
 * place to reconcile async payment methods and dashboard-initiated refunds.
 *
 * Signature verification needs the RAW request body, so this route is mounted
 * with `express.raw()` BEFORE the global `express.json()` (see index.js).
 */
import express, { Router } from 'express'
import { config } from '../config.js'
import { constructWebhookEvent } from '../pay/index.js'

const router = Router()

router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // Only meaningful for the Stripe provider with a configured signing secret.
  if (config.paymentProvider !== 'stripe' || !config.payment.stripeWebhookSecret) {
    return res.status(200).json({ received: true, ignored: true })
  }
  const signature = req.headers['stripe-signature']
  let event
  try {
    event = await constructWebhookEvent(req.body, signature)
  } catch (err) {
    // Bad signature / malformed payload — never process it.
    console.warn(`[stripe:webhook] signature verification failed: ${err.message}`)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Acknowledge fast; handlers are lightweight + non-throwing.
  switch (event.type) {
    case 'payment_intent.succeeded':
      console.log(`[stripe:webhook] payment succeeded: ${event.data.object.id}`)
      break
    case 'payment_intent.payment_failed':
      console.warn(`[stripe:webhook] payment failed: ${event.data.object.id}`)
      break
    case 'charge.refunded':
      console.log(`[stripe:webhook] charge refunded: ${event.data.object.id}`)
      break
    default:
      // Unhandled event types are fine — just acknowledge.
      break
  }
  return res.json({ received: true })
})

export default router
