/**
 * Orders store — the seam between the routes and the data source.
 *
 * DATA_SOURCE=mock keeps orders in an in-memory Map (survives a server run);
 * DATA_SOURCE=salesforce creates/reads real Order + OrderItem records.
 *
 * Both paths enforce the same rules:
 *  - totals recomputed server-side from trusted prices (never client prices)
 *  - live stock: reject over-stock orders, decrement on create, restore on cancel
 *  - ownership: account reads/cancels scoped to the logged-in shopper
 */
import { randomBytes } from 'node:crypto'
import { config } from '../config.js'
import { getProductsByIds, invalidateCatalogCache } from './catalog.js'
import { PRODUCTS } from '../data/products.js'
import { applyPromo } from './promos.js'
import { badRequest, conflict, notFoundError } from '../lib/errors.js'
import * as sfOrders from '../sf/orders.js'

const useSalesforce = config.dataSource === 'salesforce'
const orders = new Map() // orderId -> order (mock only)

function makeOrderId() {
  return `MRD-${randomBytes(4).toString('hex').toUpperCase()}`
}

// ---- Mock implementation ----
async function mockCreateOrder(items, shipping, user, promoCode) {
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
  const order = {
    orderId: makeOrderId(),
    status: 'confirmed',
    items: lines,
    subtotalCents,
    discountCents: promo.discountCents,
    promoCode: promo.code,
    freeShipping: promo.freeShipping,
    totalCents: subtotalCents - promo.discountCents,
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

async function mockGetOrder(id, contactId = null) {
  const order = orders.get(id)
  if (!order || (contactId && order._ownerId !== contactId)) {
    throw notFoundError(`Order "${id}" was not found.`)
  }
  return stripInternal(order)
}

async function mockCancelOrder(id, contactId) {
  const order = orders.get(id)
  if (!order || order._ownerId !== contactId) {
    throw notFoundError(`Order "${id}" was not found.`)
  }
  if (order.status === 'cancelled') {
    throw badRequest('This order is already cancelled.', 'already_cancelled')
  }
  order.status = 'cancelled'
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

// Drop server-only fields before returning to the client.
function stripInternal({ _ownerId, ...rest }) {
  return rest
}

// ---- Public API ----

/**
 * Create an order from validated cart items + shipping details.
 * `user` is the optional logged-in shopper { id, email }; guests pass null.
 */
export async function createOrder(items, shipping, user = null, promoCode = null) {
  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest('Your cart is empty.', 'empty_cart')
  }
  if (useSalesforce) {
    const order = await sfOrders.createOrder(
      items,
      shipping,
      user ? { contactId: user.id } : null,
      promoCode,
    )
    invalidateCatalogCache() // stock changed
    return order
  }
  return mockCreateOrder(items, shipping, user, promoCode)
}

/** Fetch an order by id (optionally ownership-scoped), or throw 404. */
export async function getOrder(id, contactId = null) {
  return useSalesforce ? sfOrders.getOrder(id, contactId) : mockGetOrder(id, contactId)
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
