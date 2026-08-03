import { Router } from 'express'
import { getBundles, getBundle } from '../store/bundles.js'
import { asyncHandler } from '../lib/errors.js'

const router = Router()

// GET /api/bundles — active bundles (each with components + savings)
router.get(
  '/bundles',
  asyncHandler(async (req, res) => {
    res.json(await getBundles())
  }),
)

// GET /api/bundles/:id — one bundle (404 if missing/inactive)
router.get(
  '/bundles/:id',
  asyncHandler(async (req, res) => {
    res.json(await getBundle(req.params.id))
  }),
)

export default router
