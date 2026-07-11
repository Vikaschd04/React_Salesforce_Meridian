import { Router } from 'express'
import { z } from 'zod'
import { createOrder, getOrder } from '../store/orders.js'
import { optionalAuth } from '../lib/session.js'
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
    const order = await createOrder(parsed.data.items, parsed.data.shipping, req.user)
    res.status(201).json(order)
  }),
)

// GET /api/orders/:id — order status (unscoped; used by the confirmation page)
router.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    res.json(await getOrder(req.params.id))
  }),
)

export default router
