/**
 * Orders store — the seam between the routes and the data source.
 *
 * DATA_SOURCE=mock keeps orders in an in-memory Map (survives a server run);
 * DATA_SOURCE=salesforce creates/reads real Order + OrderItem records.
 *
 * Security: the total is ALWAYS recomputed server-side from trusted catalog
 * prices. The client only sends { id, qty } — never prices. Both paths enforce
 * this.
 */
import { randomBytes } from 'node:crypto'
import { config } from '../config.js'
import { getProductsByIds } from './catalog.js'
import { badRequest, conflict, notFoundError } from '../lib/errors.js'
import * as sfOrders from '../sf/orders.js'

const useSalesforce = config.dataSource === 'salesforce'
const orders = new Map() // orderId -> order (mock only)

function makeOrderId() {
  return `MRD-${randomBytes(4).toString('hex').toUpperCase()}`
}

// ---- Mock implementation (Phases 1–2) ----
async function mockCreateOrder(items, user) {
  const products = await getProductsByIds(items.map((it) => it.id))
  const lines = items.map((it, i) => {
    const product = products[i]
    if (!product) {
      throw conflict(`Item "${it.id}" is no longer available.`, 'unavailable_item')
    }
    const qty = Math.max(1, Math.floor(Number(it.qty) || 0))
    return {
      id: product.id,
      name: product.name,
      qty,
      unitPriceCents: product.priceCents,
      lineCents: product.priceCents * qty,
    }
  })
  const totalCents = lines.reduce((sum, line) => sum + line.lineCents, 0)
  const order = {
    orderId: makeOrderId(),
    status: 'confirmed',
    items: lines,
    totalCents,
    placedAt: new Date().toISOString(),
    userEmail: user?.email || null, // for mock order history
  }
  orders.set(order.orderId, order)
  return stripInternal(order)
}

async function mockGetOrder(id) {
  const order = orders.get(id)
  if (!order) throw notFoundError(`Order "${id}" was not found.`)
  return stripInternal(order)
}

async function mockListOrders(user) {
  return [...orders.values()]
    .filter((o) => user?.email && o.userEmail === user.email)
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
    .map(stripInternal)
}

// Drop server-only fields before returning to the client.
function stripInternal({ userEmail: _userEmail, ...rest }) {
  return rest
}

// ---- Public API ----

/**
 * Create an order from validated cart items: [{ id, qty }].
 * `user` is the optional logged-in shopper { id, email }; guest orders pass null.
 */
export async function createOrder(items, user = null) {
  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest('Your cart is empty.', 'empty_cart')
  }
  if (useSalesforce) {
    return sfOrders.createOrder(items, user ? { contactId: user.id } : null)
  }
  return mockCreateOrder(items, user)
}

/** Fetch an order by id, or throw a 404 ApiError. */
export async function getOrder(id) {
  return useSalesforce ? sfOrders.getOrder(id) : mockGetOrder(id)
}

/** List orders for a logged-in shopper (most recent first). */
export async function listOrders(user) {
  if (!user) return []
  return useSalesforce ? sfOrders.listOrdersForContact(user.id) : mockListOrders(user)
}
