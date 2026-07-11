import { Router } from 'express'
import { z } from 'zod'
import { validatePromo } from '../store/promos.js'
import { asyncHandler, badRequest } from '../lib/errors.js'

const router = Router()

const schema = z
  .object({
    code: z.string().trim().min(1, 'Enter a promo code.').max(40),
    subtotalCents: z.number().int().nonnegative(),
  })
  .strict()

// POST /api/promo/validate — check a code against a subtotal, return the discount.
router.post(
  '/promo/validate',
  asyncHandler(async (req, res) => {
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      throw badRequest(first?.message || 'Invalid request.', 'invalid_request')
    }
    // validatePromo throws a friendly 400 for missing/invalid/below-min codes.
    res.json(validatePromo(parsed.data.code, parsed.data.subtotalCents))
  }),
)

export default router
