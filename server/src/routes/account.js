import { Router } from 'express'
import { z } from 'zod'
import { listOrders, listOrdersForCompany, getOrder, cancelOrder } from '../store/orders.js'
import { updateProfile } from '../store/auth.js'
import * as wishlist from '../store/wishlist.js'
import * as addresses from '../store/addresses.js'
import { requireAuth, optionalAuth, setSessionCookie } from '../lib/session.js'
import { asyncHandler, badRequest, notFoundError } from '../lib/errors.js'
import { onOrderChange } from '../lib/orderEvents.js'

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

// GET /api/account/orders/stream — Server-Sent Events: live order updates for
// THIS shopper. A message is pushed whenever one of their orders changes Status
// (in salesforce mode, driven by Order Change Data Capture via sf/orderStream;
// in mock mode, by the dev-trigger). The browser (useOrderStream) re-fetches
// the affected order so its timeline updates without a reload. Registered
// before '/account/orders/:id' so "stream" isn't captured as an :id.
router.get('/account/orders/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // don't let a proxy buffer the stream
  })
  res.write('retry: 3000\n\n') // browser reconnect hint
  res.flushHeaders?.()

  const contactId = req.user.id
  const unsubscribe = onOrderChange((evt) => {
    if (evt.contactId !== contactId) return // only this shopper's orders
    res.write(`event: order-update\ndata: ${JSON.stringify({ orderId: evt.orderId, status: evt.status })}\n\n`)
  })
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000)
  req.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
    res.end()
  })
})

// GET /api/account/orders/:id — one order: the shopper's own, or (view-only)
// any teammate's order under the same company account. 404 if neither.
router.get(
  '/account/orders/:id',
  asyncHandler(async (req, res) => {
    const scope = { contactId: req.user.id, companyAccountId: req.user.company?.id || null }
    res.json(await getOrder(req.params.id, scope))
  }),
)

// GET /api/account/company/orders — shared order history for the shopper's
// company (any teammate's order), most recent first. 404 if not part of one.
router.get(
  '/account/company/orders',
  asyncHandler(async (req, res) => {
    if (!req.user.company) {
      throw notFoundError('You’re not part of a company account.')
    }
    res.json(await listOrdersForCompany(req.user.company.id))
  }),
)

// POST /api/account/orders/:id/cancel — cancel own draft order; restores stock
router.post(
  '/account/orders/:id/cancel',
  asyncHandler(async (req, res) => {
    res.json(await cancelOrder(req.params.id, req.user))
  }),
)

// ---- Wishlist ----

// GET /api/account/wishlist — the shopper's saved product ids (slugs).
router.get(
  '/account/wishlist',
  asyncHandler(async (req, res) => {
    res.json(await wishlist.list(req.user.id))
  }),
)

const wishlistSchema = z.object({ productId: z.string().trim().min(1).max(120) }).strict()

// POST /api/account/wishlist — save a product; returns the updated id list.
router.post(
  '/account/wishlist',
  asyncHandler(async (req, res) => {
    const parsed = wishlistSchema.safeParse(req.body)
    if (!parsed.success) throw badRequest('Invalid product.', 'invalid_product')
    await wishlist.add(req.user.id, parsed.data.productId)
    res.json(await wishlist.list(req.user.id))
  }),
)

// DELETE /api/account/wishlist/:productId — unsave a product; returns the list.
router.delete(
  '/account/wishlist/:productId',
  asyncHandler(async (req, res) => {
    await wishlist.remove(req.user.id, req.params.productId)
    res.json(await wishlist.list(req.user.id))
  }),
)

// ---- Saved addresses ----

const addressSchema = z
  .object({
    label: z.string().trim().max(80).optional().default(''),
    name: z.string().trim().min(1, 'Add a recipient name.').max(120),
    street: z.string().trim().min(1, 'Add a street address.').max(255),
    city: z.string().trim().min(1, 'Add a city.').max(80),
    stateCode: z.string().trim().max(10).optional().default(''),
    postalCode: z.string().trim().min(1, 'Add a postal code.').max(20),
    countryCode: z.string().trim().min(1).max(10),
    isDefault: z.boolean().optional(),
  })
  .strict()

// Partial for PATCH (edit / set-default) — every field optional.
const addressPatchSchema = addressSchema.partial()

// GET /api/account/addresses — the shopper's saved addresses (default first).
router.get(
  '/account/addresses',
  asyncHandler(async (req, res) => {
    res.json(await addresses.list(req.user.id))
  }),
)

// POST /api/account/addresses — save a new address; returns the updated list.
router.post(
  '/account/addresses',
  asyncHandler(async (req, res) => {
    const parsed = addressSchema.safeParse(req.body)
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message || 'Invalid address.', 'invalid_address')
    res.json(await addresses.create(req.user.id, parsed.data))
  }),
)

// PATCH /api/account/addresses/:id — edit or set-default; returns the list.
router.patch(
  '/account/addresses/:id',
  asyncHandler(async (req, res) => {
    const parsed = addressPatchSchema.safeParse(req.body)
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message || 'Invalid address.', 'invalid_address')
    res.json(await addresses.update(req.user.id, req.params.id, parsed.data))
  }),
)

// DELETE /api/account/addresses/:id — remove an address; returns the list.
router.delete(
  '/account/addresses/:id',
  asyncHandler(async (req, res) => {
    res.json(await addresses.remove(req.user.id, req.params.id))
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
