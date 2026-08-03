/**
 * Bundles store — the seam between routes and the data source. Mock reads the
 * in-repo bundle defs; salesforce reads Product2 (`bundle-*`) + the component
 * junction via ../sf/bundles.js. Cached behind the shared short TTL.
 */
import { BUNDLES } from '../data/bundles.js'
import { PRODUCTS } from '../data/products.js'
import { createCache } from '../lib/cache.js'
import { config } from '../config.js'
import { round2 } from '../lib/totals.js'
import { notFoundError } from '../lib/errors.js'
import * as sfBundles from '../sf/bundles.js'

const cache = createCache(config.cacheTtlMs)
const useSalesforce = config.dataSource === 'salesforce'

// ---- Mock implementation ----
function mockShape(bundle) {
  const components = bundle.components
    .map((c) => {
      const p = PRODUCTS.find((x) => x.id === c.id)
      if (!p) return null
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        image: p.image,
        accent: p.accent,
        roast: p.roast,
        origin: p.origin,
        qty: Math.max(1, Math.floor(Number(c.qty) || 1)),
      }
    })
    .filter(Boolean)
  const componentTotal = round2(components.reduce((sum, c) => sum + c.price * c.qty, 0))
  const savings = round2(componentTotal - bundle.price)
  return {
    id: bundle.id,
    name: bundle.name,
    description: bundle.description,
    price: bundle.price,
    image: bundle.image,
    accent: bundle.accent,
    stock: bundle.stock,
    active: bundle.active,
    isBundle: true,
    components,
    componentTotal,
    savings,
    savingsPct: componentTotal > 0 ? Math.round((savings / componentTotal) * 100) : 0,
  }
}

async function mockGetBundles() {
  return BUNDLES.filter((b) => b.active).map(mockShape)
}
async function mockGetBundle(id) {
  const bundle = BUNDLES.find((b) => b.id === id && b.active)
  if (!bundle) throw notFoundError(`Bundle "${id}" was not found.`)
  return mockShape(bundle)
}

// ---- Public API (cached) ----

/** All active bundles (with components + savings). */
export async function getBundles() {
  return cache.wrap('bundles:all', () =>
    useSalesforce ? sfBundles.getBundles() : mockGetBundles(),
  )
}

/** One bundle by id, or 404. */
export async function getBundle(id) {
  return cache.wrap(`bundle:${id}`, () =>
    useSalesforce ? sfBundles.getBundle(id) : mockGetBundle(id),
  )
}

/** Drop cached bundle reads (e.g. after stock changed on an order/cancel). */
export function invalidateBundleCache() {
  cache.clear()
}
