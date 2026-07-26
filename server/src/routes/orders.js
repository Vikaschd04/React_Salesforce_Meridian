import { Router } from 'express'
import { z } from 'zod'
import { createOrder, getOrder, trackOrder } from '../store/orders.js'
import { optionalAuth, signOrderTrackToken, readOrderTrackToken } from '../lib/session.js'
import { onOrderChange } from '../lib/orderEvents.js'
import { asyncHandler, badRequest } from '../lib/errors.js'

const router = Router()

// Reject unknown fields; ids must be non-empty; qty a sane positive integer.
const orderSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string().min(1),
            qty: z.number().int().positive().max(99),
          })
          .strict(),
      )
      .min(1, 'Your cart is empty.'),
    shipping: z
      .object({
        name: z.string().trim().min(1, 'Name is required.').max(120),
        email: z.string().trim().email('A valid email is required.').max(120),
        street: z.string().trim().min(1, 'Street address is required.').max(255),
        city: z.string().trim().min(1, 'City is required.').max(80),
        // ISO codes (State/Country picklists are enabled in the org).
        stateCode: z.string().trim().max(8).optional().default(''),
        postalCode: z.string().trim().min(1, 'Postal code is required.').max(20),
        countryCode: z.string().trim().min(2, 'Country is required.').max(4),
      })
      .strict(),
    // Optional promo code; re-validated + applied server-side at creation.
    promoCode: z.string().trim().max(40).optional(),
    // Payment details. Shape depends on provider (mock: { card }, stripe:
    // { paymentMethodId }); the pay module validates the specifics.
    payment: z
      .object({
        card: z
          .object({
            number: z.string().max(30),
            exp: z.string().max(10).optional(),
            cvc: z.string().max(6).optional(),
            name: z.string().max(120).optional(),
          })
          .optional(),
        paymentMethodId: z.string().max(120).optional(),
      })
      .passthrough()
      .optional(),
  })
  .strict()

// POST /api/orders — validate cart + shipping, compute total server-side, create
router.post(
  '/orders',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const parsed = orderSchema.safeParse(req.body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      throw badRequest(first?.message || 'Invalid order.', 'invalid_order')
    }
    // req.user is the logged-in shopper (or null for guest checkout).
    const order = await createOrder(
      parsed.data.items,
      parsed.data.shipping,
      req.user,
      parsed.data.promoCode,
      parsed.data.payment,
    )
    res.status(201).json(order)
  }),
)

// POST /api/orders/track — public guest tracking by order number + email.
// Registered before '/orders/:id' so "track" isn't captured as an :id (GET vs
// POST wouldn't collide, but keep it explicit).
const trackSchema = z
  .object({
    orderId: z.string().trim().min(1, 'Order number is required.').max(40),
    email: z.string().trim().email('A valid email is required.').max(120),
  })
  .strict()

router.post(
  '/orders/track',
  asyncHandler(async (req, res) => {
    const parsed = trackSchema.safeParse(req.body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      throw badRequest(first?.message || 'Invalid request.', 'invalid_track')
    }
    const order = await trackOrder(parsed.data.orderId, parsed.data.email)
    // A short-lived, order-scoped token so the guest can open the live stream
    // (below) without a session — they've just proven order#+email here.
    res.json({ ...order, streamToken: signOrderTrackToken(order.orderId) })
  }),
)

// GET /api/orders/track/stream?token=… — PUBLIC live order-status stream for a
// guest, scoped to the one order the token was minted for (POST /orders/track).
// No session; the token is the authorization. Mirrors the account SSE but
// filters the shared order-events bus by orderId instead of contactId.
router.get('/orders/track/stream', (req, res) => {
  const orderId = readOrderTrackToken(req.query.token)
  if (!orderId) {
    res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired tracking token.' })
    return
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write('retry: 3000\n\n')
  res.flushHeaders?.()

  const unsubscribe = onOrderChange((evt) => {
    if (evt.orderId !== orderId) return // only this order
    res.write(`event: order-update\ndata: ${JSON.stringify({ orderId: evt.orderId, status: evt.status })}\n\n`)
  })
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000)
  req.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
    res.end()
  })
})

// GET /api/orders/:id — order status (unscoped; used by the confirmation page)
router.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    res.json(await getOrder(req.params.id))
  }),
)

export default router
