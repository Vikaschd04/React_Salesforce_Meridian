import { Router } from 'express'
import { listOrders } from '../store/orders.js'
import { requireAuth, optionalAuth } from '../lib/session.js'
import { asyncHandler } from '../lib/errors.js'

const router = Router()

// GET /api/account/orders — the logged-in shopper's order history
router.get(
  '/account/orders',
  optionalAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await listOrders(req.user))
  }),
)

export default router
