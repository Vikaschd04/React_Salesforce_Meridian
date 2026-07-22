/**
 * Orders store — the seam between the routes and the data source.
 *
 * DATA_SOURCE=mock keeps orders in an in-memory Map (survives a server run);
 * DATA_SOURCE=salesforce creates/reads real Order + OrderItem records.
 *
 * Both paths enforce the same rules:
 *  - totals recomputed server-side from trusted prices (never client prices)
 *  - live stock: reject over-stock orders, decrement on create, restore on cancel
 *  - ownership: a shopper's own orders are fully theirs (cancel included); a
 *    company-linked shopper can also VIEW (not cancel) any teammate's order
 *    under the same company Account — see getOrder()'s `scope` param.
 */
import { randomBytes } from 'node:crypto'
import { config } from '../config.js'
import { getProductsByIds, invalidateCatalogCache } from './catalog.js'
import { PRODUCTS } from '../data/products.js'
import { applyPromo } from './promos.js'
import { charge } from '../pay/index.js'
import { computeShippingCents } from '../lib/totals.js'
import { badRequest, conflict, notFoundError } from '../lib/errors.js'
import * as sfOrders from '../sf/orders.js'

const useSalesforce = config.dataSource === 'salesforce'
const orders = new Map() // orderId -> order (mock only)

function makeOrderId() {
  return `MRD-${randomBytes(4).toString('hex').toUpperCase()}`
}

// ---- Mock implementation ----
async function mockCreateOrder(items, shipping, user, promoCode, payment) {
  const products = await getProductsByIds(items.map((it) => it.id))
  const lines = items.map((it, i) => {
    const product = products[i]
    if (!product) {
      throw conflict(`Item "${it.id}" is no longer available.`, 'unavailable_item')
    }
    const qty = Math.max(1, Math.floor(Number(it.qty) || 0))
    if (qty > product.stock) {
      throw conflict(
        product.stock <= 0
          ? `"${product.name}" is sold out.`
          : `Only ${product.stock} bag${product.stock === 1 ? '' : 's'} of "${product.name}" left.`,
        'insufficient_stock',
      )
    }
    return {
      id: product.id,
      name: product.name,
      qty,
      unitPriceCents: product.priceCents,
      lineCents: product.priceCents * qty,
    }
  })
  // Decrement mock stock (mutates the in-repo catalog for this server run).
  for (const line of lines) {
    const src = PRODUCTS.find((p) => p.id === line.id)
    if (src) src.stock = Math.max(0, src.stock - line.qty)
  }
  invalidateCatalogCache()

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineCents, 0)
  // Re-validate + apply the promo against the trusted subtotal (throws if bad).
  const promo = applyPromo(promoCode, subtotalCents)
  const totalCents = subtotalCents - promo.discountCents
  const shippingCents = computeShippingCents(subtotalCents, promo.freeShipping)

  // Take payment before recording the order (a decline throws 402).
  const paid = await charge({
    amountCents: totalCents + shippingCents,
    payment,
    metadata: { email: shipping?.email || '' },
  })

  const order = {
    orderId: makeOrderId(),
    // Mirrors the SF display statuses: pending → paid → shipped → delivered /
    // cancelled. A paid order starts at 'paid' (standard Status = Activated).
    status: 'paid',
    paymentStatus: 'paid',
    trackingNumber: null,
    paymentId: paid.paymentId,
    items: lines,
    _ownerName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || null : null,
    _companyId: user?.company?.id || null,
    subtotalCents,
    discountCents: promo.discountCents,
    shippingCents,
    paidCents: totalCents + shippingCents,
    promoCode: promo.code,
    freeShipping: promo.freeShipping,
    totalCents,
    placedAt: new Date().toISOString(),
    email: shipping?.email || null,
    shipping: shipping
      ? {
          street: shipping.street,
          city: shipping.city,
          state: shipping.stateCode || '',
          postalCode: shipping.postalCode,
          country: shipping.countryCode,
        }
      : null,
    _ownerId: user?.id || null,
  }
  orders.set(order.orderId, order)
  return stripInternal(order)
}

// `scope` mirrors sf/orders.js getOrder: { contactId, companyAccountId } or null
// (unscoped — used internally and by the public confirmation-page lookup).
async function mockGetOrder(id, scope = null) {
  const order = orders.get(id)
  if (!order) throw notFoundError(`Order "${id}" was not found.`)
  let isOwner
  if (scope) {
    const owns = Boolean(scope.contactId) && order._ownerId === scope.contactId
    const sameCompany = Boolean(scope.companyAccountId) && order._companyId === scope.companyAccountId
    if (!owns && !sameCompany) throw notFoundError(`Order "${id}" was not found.`)
    isOwner = owns
  }
  const clean = stripInternal(order)
  return scope ? { ...clean, isOwner, placedByName: order._ownerName || null } : clean
}

async function mockCancelOrder(id, contactId) {
  const order = orders.get(id)
  if (!order || order._ownerId !== contactId) {
    throw notFoundError(`Order "${id}" was not found.`)
  }
  if (order.status === 'cancelled') {
    throw badRequest('This order is already cancelled.', 'already_cancelled')
  }
  if (order.status === 'shipped' || order.status === 'delivered') {
    throw badRequest('This order has already shipped and can no longer be cancelled.', 'not_cancellable')
  }
  order.status = 'cancelled'
  if (order.paymentStatus === 'paid') order.paymentStatus = 'refunded'
  for (const line of order.items) {
    const src = PRODUCTS.find((p) => p.id === line.id)
    if (src) src.stock += line.qty
  }
  invalidateCatalogCache()
  return stripInternal(order)
}

async function mockListOrders(user) {
  return [...orders.values()]
    .filter((o) => user?.id && o._ownerId === user.id)
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
    .map(stripInternal)
}

/** Company-wide shared order history (mirrors sf/orders.js listOrdersForCompany). */
async function mockListOrdersForCompany(companyId) {
  return [...orders.values()]
    .filter((o) => companyId && o._companyId === companyId)
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
    .map((o) => ({ ...stripInternal(o), placedByName: o._ownerName || null }))
}

// Drop server-only fields before returning to the client.
function stripInternal({ _ownerId, _companyId, _ownerName, ...rest }) {
  return rest
}

// ---- Public API ----

/**
 * Create an order from validated cart items + shipping details.
 * `user` is the optional logged-in shopper { id, email }; guests pass null.
 */
export async function createOrder(items, shipping, user = null, promoCode = null, payment = null) {
  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest('Your cart is empty.', 'empty_cart')
  }
  if (useSalesforce) {
    const order = await sfOrders.createOrder(
      items,
      shipping,
      user ? { contactId: user.id, companyAccountId: user.company?.id || null } : null,
      promoCode,
      payment,
    )
    invalidateCatalogCache() // stock changed
    return order
  }
  return mockCreateOrder(items, shipping, user, promoCode, payment)
}

/**
 * Fetch an order by id. `scope` (optional) is { contactId, companyAccountId } —
 * visible if it's the caller's own order or belongs to their company (teammates
 * get view-only access, signalled by `isOwner: false`). Unscoped (omitted) is
 * used internally and by the public confirmation-page lookup.
 */
export async function getOrder(id, scope = null) {
  return useSalesforce ? sfOrders.getOrder(id, scope) : mockGetOrder(id, scope)
}

/** Cancel the shopper's own order; restores stock. */
export async function cancelOrder(id, user) {
  if (useSalesforce) {
    const order = await sfOrders.cancelOrder(id, user.id)
    invalidateCatalogCache()
    return order
  }
  return mockCancelOrder(id, user.id)
}

/** List orders for a logged-in shopper (most recent first). */
export async function listOrders(user) {
  if (!user) return []
  return useSalesforce ? sfOrders.listOrdersForContact(user.id) : mockListOrders(user)
}

/** Shared order history for a company account (most recent first, any teammate). */
export async function listOrdersForCompany(companyId) {
  if (!companyId) return []
  return useSalesforce ? sfOrders.listOrdersForCompany(companyId) : mockListOrdersForCompany(companyId)
}
