/**
 * Development-only routes — mounted ONLY when DATA_SOURCE=mock (see index.js).
 * Never exposed against a real Salesforce org.
 *
 * Provides a stand-in for the merchant-side actions that, in salesforce mode,
 * happen in Salesforce and stream back via Change Data Capture. Right now that's
 * advancing an order's fulfilment status, so the real-time order page can be
 * demoed and end-to-end tested with zero Salesforce.
 */
import { Router } from 'express'
import { advanceMockOrder } from '../store/orders.js'
import { emitOrderChange } from '../lib/orderEvents.js'
import { asyncHandler, badRequest } from '../lib/errors.js'

const router = Router()

// POST /api/dev/orders/:id/advance — move a mock order one step along the
// fulfilment path (paid → shipped → delivered) and publish the change to the
// order-events bus, exactly as a real CDC event would. Simulates the merchant.
router.post(
  '/dev/orders/:id/advance',
  asyncHandler(async (req, res) => {
    const change = advanceMockOrder(req.params.id)
    if (!change) throw badRequest('Nothing to advance (unknown order or already delivered).', 'not_advanceable')
    emitOrderChange(change)
    res.json({ ok: true, orderId: change.orderId, status: change.status })
  }),
)

export default router
