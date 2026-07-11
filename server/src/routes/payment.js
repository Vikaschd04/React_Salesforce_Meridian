import { Router } from 'express'
import { paymentConfig } from '../pay/index.js'
import { asyncHandler } from '../lib/errors.js'

const router = Router()

// GET /api/payment-config — tells the client which card UI to render
// ({ provider, publishableKey }). No secrets are exposed.
router.get(
  '/payment-config',
  asyncHandler(async (req, res) => {
    res.json(paymentConfig())
  }),
)

export default router
