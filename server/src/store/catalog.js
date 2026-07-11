/**
 * Catalog store — the seam between the routes and the data source.
 *
 * DATA_SOURCE=mock (default) reads the in-repo catalog; DATA_SOURCE=salesforce
 * reads a live org via ../sf/catalog.js. Routes call these functions and never
 * know which source is active. Reads go through a short TTL cache to prepare for
 * Salesforce's per-org API limits.
 */
import { PRODUCTS } from '../data/products.js'
import { createCache } from '../lib/cache.js'
import { config } from '../config.js'
import { notFoundError } from '../lib/errors.js'
import * as sfCatalog from '../sf/catalog.js'

const cache = createCache(config.cacheTtlMs)
const useSalesforce = config.dataSource === 'salesforce'

/** Drop cached product reads (e.g. after stock changed on an order/cancel). */
export function invalidateCatalogCache() {
  cache.clear()
}

// ---- Mock implementation (Phases 1–2) ----
async function mockGetProducts() {
  return PRODUCTS.filter((p) => p.active)
}
async function mockGetProduct(id) {
  const product = PRODUCTS.find((p) => p.id === id && p.active)
  if (!product) throw notFoundError(`Product "${id}" was not found.`)
  return product
}

// ---- Public API (cached) ----

/** List all active products. */
export async function getProducts() {
  return cache.wrap('products:all', () =>
    useSalesforce ? sfCatalog.getProducts() : mockGetProducts(),
  )
}

/** Fetch one active product by id, or throw a 404 ApiError. */
export async function getProduct(id) {
  return cache.wrap(`product:${id}`, () =>
    useSalesforce ? sfCatalog.getProduct(id) : mockGetProduct(id),
  )
}

/**
 * Look up several products by id at once (used to price an order).
 * Returns an array aligned to `ids` (undefined where not found).
 */
export async function getProductsByIds(ids) {
  if (useSalesforce) {
    const byId = await sfCatalog.getProductsByCodes(ids)
    return ids.map((id) => byId.get(id))
  }
  const all = await getProducts()
  const byId = new Map(all.map((p) => [p.id, p]))
  return ids.map((id) => byId.get(id))
}
