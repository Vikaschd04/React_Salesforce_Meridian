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
async function mockCreateOrder(items) {
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

async function mockGetOrder(id) {
  const order = orders.get(id)
  if (!order) throw notFoundError(`Order "${id}" was not found.`)
  return order
}

// ---- Public API ----

/** Create an order from validated cart items: [{ id, qty }]. */
export async function createOrder(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest('Your cart is empty.', 'empty_cart')
  }
  return useSalesforce ? sfOrders.createOrder(items) : mockCreateOrder(items)
}

/** Fetch an order by id, or throw a 404 ApiError. */
export async function getOrder(id) {
  return useSalesforce ? sfOrders.getOrder(id) : mockGetOrder(id)
}
