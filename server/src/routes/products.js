import { Router } from 'express'
import { getProducts, getProduct, listProducts, suggestProducts } from '../store/catalog.js'
import { asyncHandler } from '../lib/errors.js'

const router = Router()

const MAX_PAGE_SIZE = 48

// Parse & clamp the PLP query string into a listProducts() argument.
function parseListParams(query) {
  const str = (v) => (typeof v === 'string' ? v : '')
  const roast = str(query.roast)
  return {
    page: Math.max(1, Number.parseInt(query.page, 10) || 1),
    pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(query.pageSize, 10) || 10)),
    q: str(query.q),
    roasts: roast ? roast.split(',').map((s) => s.trim()).filter(Boolean) : [],
    origin: str(query.origin),
    price: str(query.price),
    sort: str(query.sort) || 'featured',
  }
}

// GET /api/products — every active product (used to price carts, build related
// lists, resolve wishlists — callers that genuinely need the whole catalog).
router.get(
  '/products',
  asyncHandler(async (req, res) => {
    res.json(await getProducts())
  }),
)

// GET /api/catalog — one filtered/sorted page for the shop PLP. Filters and
// facets are applied across the whole catalog; only the page is returned.
router.get(
  '/catalog',
  asyncHandler(async (req, res) => {
    res.json(await listProducts(parseListParams(req.query)))
  }),
)

// GET /api/catalog/suggest?q= — typeahead suggestions over the whole catalog.
router.get(
  '/catalog/suggest',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : ''
    res.json({ suggestions: await suggestProducts(q) })
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
