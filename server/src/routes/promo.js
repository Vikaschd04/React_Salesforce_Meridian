import { Router } from 'express'
import { z } from 'zod'
import { validatePromo } from '../store/promos.js'
import { optionalAuth } from '../lib/session.js'
import { asyncHandler, badRequest } from '../lib/errors.js'

const router = Router()

const schema = z
  .object({
    code: z.string().trim().min(1, 'Enter a promo code.').max(40),
    subtotal: z.number().nonnegative(),
  })
  .strict()

// POST /api/promo/validate — check a code against a subtotal, return the discount.
// optionalAuth so a logged-in shopper's id can be used for the per-buyer limit.
router.post(
  '/promo/validate',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      throw badRequest(first?.message || 'Invalid request.', 'invalid_request')
    }
    // validatePromo throws a friendly 400 for missing/invalid/expired/limit codes.
    res.json(await validatePromo(parsed.data.code, parsed.data.subtotal, { buyer: req.user?.id }))
  }),
)

export default router
