/**
 * Catalog store. Phase 2 reads from the mock module; Phase 3 will replace the
 * loader bodies with Salesforce (jsforce) queries — the route layer won't change.
 *
 * Product reads go through a short TTL cache to prepare for Salesforce's per-org
 * API limits.
 */
import { PRODUCTS } from '../data/products.js'
import { createCache } from '../lib/cache.js'
import { config } from '../config.js'
import { notFoundError } from '../lib/errors.js'

const cache = createCache(config.cacheTtlMs)

/** List all active products. */
export async function getProducts() {
  return cache.wrap('products:all', async () => PRODUCTS.filter((p) => p.active))
}

/** Fetch one active product by id, or throw a 404 ApiError. */
export async function getProduct(id) {
  const product = await cache.wrap(`product:${id}`, async () =>
    PRODUCTS.find((p) => p.id === id && p.active),
  )
  if (!product) throw notFoundError(`Product "${id}" was not found.`)
  return product
}

/** Look up several products by id at once (used to price an order). */
export async function getProductsByIds(ids) {
  const all = await getProducts()
  const byId = new Map(all.map((p) => [p.id, p]))
  return ids.map((id) => byId.get(id))
}
