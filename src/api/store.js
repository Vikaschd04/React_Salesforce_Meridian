/**
 * store.js — the ONE data-access module for the whole app.
 *
 * The UI (pages, components, context) must import from here and nowhere else.
 * This is the single swap point described in docs/ARCHITECTURE.md:
 *
 *   Phase 1  → returns mock data from src/data/products.js  (this file)
 *   Phase 2/3 → calls the BFF via fetch('/api/...')
 *   BFF       → calls Salesforce
 *
 * When the BFF lands, only the bodies below change (fetch instead of mock).
 * Every function is async and returns a Promise, so callers already await —
 * no page needs to change on swap.
 */

import { PRODUCTS } from '../data/products.js'

// Simulate network latency so loading states are real and exercised.
const LATENCY_MS = 320

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const clone = (value) => JSON.parse(JSON.stringify(value))

/**
 * A typed error the UI can show as a friendly message. The BFF will return the
 * same shape as JSON in later phases.
 */
export class StoreError extends Error {
  constructor(message, { code = 'store_error', status = 500 } = {}) {
    super(message)
    this.name = 'StoreError'
    this.code = code
    this.status = status
  }
}

/** List all active products. */
export async function getProducts() {
  await delay(LATENCY_MS)
  return clone(PRODUCTS.filter((p) => p.active))
}

/** Fetch a single product by id. Throws StoreError(404) if not found. */
export async function getProduct(id) {
  await delay(LATENCY_MS)
  const product = PRODUCTS.find((p) => p.id === id && p.active)
  if (!product) {
    throw new StoreError(`Product "${id}" was not found.`, {
      code: 'not_found',
      status: 404,
    })
  }
  return clone(product)
}

/**
 * Place an order from cart items: [{ id, qty }, ...].
 * Returns { orderId, totalCents, placedAt, items }.
 *
 * Phase 1 mock: validates against the catalog, computes the total from
 * server-trusted prices (never trust client prices), and returns a fake id.
 * Phase 2 will POST this to /api/orders instead.
 */
export async function placeOrder(items) {
  await delay(LATENCY_MS + 250)

  if (!Array.isArray(items) || items.length === 0) {
    throw new StoreError('Your cart is empty.', {
      code: 'empty_cart',
      status: 400,
    })
  }

  const lines = items.map(({ id, qty }) => {
    const product = PRODUCTS.find((p) => p.id === id && p.active)
    if (!product) {
      throw new StoreError(`Item "${id}" is no longer available.`, {
        code: 'unavailable_item',
        status: 409,
      })
    }
    const quantity = Math.max(1, Math.floor(Number(qty) || 0))
    return {
      id: product.id,
      name: product.name,
      qty: quantity,
      unitPriceCents: product.priceCents,
      lineCents: product.priceCents * quantity,
    }
  })

  const totalCents = lines.reduce((sum, line) => sum + line.lineCents, 0)

  return {
    orderId: makeOrderId(),
    totalCents,
    items: lines,
    placedAt: new Date().toISOString(),
  }
}

// e.g. "MRD-8F3K2Q" — human-readable-ish, unique enough for a mock.
function makeOrderId() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `MRD-${rand}`
}
