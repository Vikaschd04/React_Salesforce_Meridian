import { Router } from 'express'
import { getProducts, getProduct } from '../store/catalog.js'
import { asyncHandler } from '../lib/errors.js'

const router = Router()

// GET /api/products — list active products
router.get(
  '/products',
  asyncHandler(async (req, res) => {
    res.json(await getProducts())
  }),
)

// GET /api/products/:id — one product (404 if missing/inactive)
router.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    res.json(await getProduct(req.params.id))
  }),
)

export default router
