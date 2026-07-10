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
  })
  .strict()

// POST /api/orders — validate cart, compute total server-side, create order
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
    const order = await createOrder(parsed.data.items, req.user)
    res.status(201).json(order)
  }),
)

// GET /api/orders/:id — order status
router.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    res.json(await getOrder(req.params.id))
  }),
)

export default router
