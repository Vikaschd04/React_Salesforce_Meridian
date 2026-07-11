import { Router } from 'express'
import { z } from 'zod'
import { listOrders, getOrder, cancelOrder } from '../store/orders.js'
import { updateProfile } from '../store/auth.js'
import { requireAuth, optionalAuth, setSessionCookie } from '../lib/session.js'
import { asyncHandler, badRequest } from '../lib/errors.js'

const router = Router()

// All account routes require a session.
router.use('/account', optionalAuth, requireAuth)

// GET /api/account/orders — the shopper's order history
router.get(
  '/account/orders',
  asyncHandler(async (req, res) => {
    res.json(await listOrders(req.user))
  }),
)

// GET /api/account/orders/:id — one order, ownership-scoped (404 if not theirs)
router.get(
  '/account/orders/:id',
  asyncHandler(async (req, res) => {
    res.json(await getOrder(req.params.id, req.user.id))
  }),
)

// POST /api/account/orders/:id/cancel — cancel own draft order; restores stock
router.post(
  '/account/orders/:id/cancel',
  asyncHandler(async (req, res) => {
    res.json(await cancelOrder(req.params.id, req.user))
  }),
)

const profileSchema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required.').max(80),
    lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  })
  .strict()

// PATCH /api/account/profile — update the shopper's name (email is the login key)
router.patch(
  '/account/profile',
  asyncHandler(async (req, res) => {
    const parsed = profileSchema.safeParse(req.body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      throw badRequest(first?.message || 'Invalid profile.', 'invalid_profile')
    }
    const profile = await updateProfile(req.user, parsed.data)
    // Re-issue the session cookie so the JWT carries the new name.
    setSessionCookie(res, profile)
    res.json(profile)
  }),
)

export default router
