import { Router } from 'express'
import { z } from 'zod'
import { createSupportRequest } from '../store/support.js'
import { asyncHandler, badRequest } from '../lib/errors.js'

const router = Router()

const supportSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required.').max(120),
    email: z.string().trim().email('A valid email is required.').max(120),
    subject: z.string().trim().min(3, 'Subject is required.').max(200),
    message: z.string().trim().min(10, 'Tell us a little more (10+ characters).').max(4000),
  })
  .strict()

// POST /api/support — create a support request (Salesforce Case)
router.post(
  '/support',
  asyncHandler(async (req, res) => {
    const parsed = supportSchema.safeParse(req.body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      throw badRequest(first?.message || 'Invalid request.', 'invalid_support')
    }
    const result = await createSupportRequest(parsed.data)
    res.status(201).json(result)
  }),
)

export default router
