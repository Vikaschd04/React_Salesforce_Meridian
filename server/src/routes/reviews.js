import { Router } from 'express'
import { z } from 'zod'
import { getReviews, submitReview } from '../store/reviews.js'
import { optionalAuth, requireAuth } from '../lib/session.js'
import { asyncHandler, badRequest } from '../lib/errors.js'

const router = Router()

// GET /api/products/:id/reviews — public; includes `myReview` when logged in.
router.get(
  '/products/:id/reviews',
  optionalAuth,
  asyncHandler(async (req, res) => {
    res.json(await getReviews(req.params.id, req.user?.id || null))
  }),
)

const reviewSchema = z
  .object({
    rating: z.number().int().min(1, 'Pick a rating.').max(5),
    title: z.string().trim().min(1, 'Give your review a title.').max(120),
    body: z.string().trim().min(1, 'Write a few words about this coffee.').max(2000),
  })
  .strict()

// POST /api/products/:id/reviews — requires a session; one review per shopper per product.
router.post(
  '/products/:id/reviews',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = reviewSchema.safeParse(req.body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      throw badRequest(first?.message || 'Invalid review.', 'invalid_review')
    }
    // submitReview throws a friendly 409 if this shopper already reviewed this product.
    res.json(await submitReview(req.params.id, req.user, parsed.data))
  }),
)

export default router
