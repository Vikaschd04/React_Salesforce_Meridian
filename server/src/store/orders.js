/**
 * Orders store. Phase 2 keeps orders in an in-memory Map so GET /api/orders/:id
 * works within a server run. Phase 3 replaces this with Salesforce Order /
 * OrderItem records.
 *
 * Security: the total is ALWAYS recomputed here from server-trusted catalog
 * prices. The client only sends { id, qty } — never prices.
 */
import { randomBytes } from 'node:crypto'
import { getProductsByIds } from './catalog.js'
import { badRequest, conflict } from '../lib/errors.js'

const orders = new Map() // orderId -> order

function makeOrderId() {
  return `MRD-${randomBytes(4).toString('hex').toUpperCase()}`
}

/**
 * Create an order from validated cart items: [{ id, qty }].
 * Throws 400 on empty cart, 409 on unknown/inactive items.
 */
export async function createOrder(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest('Your cart is empty.', 'empty_cart')
  }

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
  }
  orders.set(order.orderId, order)
  return order
}

/** Fetch an order by id, or undefined. */
export function getOrder(id) {
  return orders.get(id)
}
