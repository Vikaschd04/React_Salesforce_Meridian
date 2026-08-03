/**
 * Catalog store — the seam between the routes and the data source.
 *
 * DATA_SOURCE=mock (default) reads the in-repo catalog; DATA_SOURCE=salesforce
 * reads a live org via ../sf/catalog.js. Routes call these functions and never
 * know which source is active. Reads go through a short TTL cache to prepare for
 * Salesforce's per-org API limits.
 */
import { PRODUCTS } from '../data/products.js'
import { BUNDLES } from '../data/bundles.js'
import { createCache } from '../lib/cache.js'
import { config } from '../config.js'
import { notFoundError } from '../lib/errors.js'
import * as sfCatalog from '../sf/catalog.js'
import * as query from '../lib/productQuery.js'

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

/**
 * One page of the catalog for the shop's product-listing page (PLP).
 *
 * This is the "modern ecommerce" contract: the filters, sort, and facets are
 * computed over the ENTIRE catalog server-side, then only the requested page is
 * returned — the browser never holds the whole catalog. For our catalog size
 * (hundreds of SKUs) the full active list is a single cached read, so a page of
 * results costs no extra Salesforce API calls; the query strategy could later be
 * pushed into SOQL LIMIT/OFFSET without changing this signature or the frontend.
 *
 * Returns { items, page, pageSize, total, totalPages, facets } where `total` is
 * the count AFTER filtering (before paging) and `facets` describe the whole
 * catalog so the filter UI never collapses.
 */
export async function listProducts({
  page = 1,
  pageSize = 10,
  q = '',
  roasts = [],
  origin = '',
  price = '',
  sort = 'featured',
} = {}) {
  const all = await getProducts()
  const facets = query.buildFacets(all)
  const filtered = query.filterProducts(all, { q, roasts, origin, price })
  const sorted = query.sortProducts(filtered, sort)
  const { pageItems, total, totalPages, page: safePage } = query.paginate(sorted, page, pageSize)
  return { items: pageItems, page: safePage, pageSize, total, totalPages, facets }
}

/** Typeahead suggestions (products + tasting notes) over the whole catalog. */
export async function suggestProducts(q) {
  return query.suggest(await getProducts(), q)
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
    // Queries Product2 by ProductCode (unscoped), so bundles — also Product2
    // records — resolve here exactly like coffees.
    const byId = await sfCatalog.getProductsByCodes(ids)
    return ids.map((id) => byId.get(id))
  }
  const all = await getProducts()
  const byId = new Map(all.map((p) => [p.id, p]))
  // Mock parity: bundles are their own data source, so add them to the lookup so
  // a cart/order containing a bundle prices + stock-checks like any product.
  for (const b of BUNDLES) if (b.active && !byId.has(b.id)) byId.set(b.id, b)
  return ids.map((id) => byId.get(id))
}
