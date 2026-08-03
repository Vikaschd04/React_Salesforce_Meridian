/**
 * Salesforce-backed bundles. A bundle is a standard Product2 (ProductCode
 * `bundle-*`, priced by its standard PricebookEntry); its coffees are the
 * standard-first choice's fallback — a small custom junction
 * `Meridian_Bundle_Component__c` (Bundle__c → the bundle, Component__c → the
 * coffee, Quantity__c). We resolve each component's live price/details through
 * the normal catalog read, so the per-coffee total + savings are always current.
 */
import { withConn } from './client.js'
import { getProductsByCodes } from './catalog.js'
import { PRODUCT_FIELDS, productFromSf } from './mappers.js'
import { round2 } from '../lib/totals.js'
import { notFoundError } from '../lib/errors.js'

// Meridian bundles are scoped by the `bundle-*` ProductCode convention (as
// coffees are scoped by Origin/Roast), so the org's other Bundle-class products
// never leak into the storefront.
const BUNDLE_SCOPE = "IsActive = true AND ProductCode LIKE 'bundle-%'"

function buildBundleQuery(where) {
  // PRODUCT_FIELDS already includes Description.
  return `
    SELECT ${PRODUCT_FIELDS.join(', ')},
      (SELECT Id, UnitPrice FROM PricebookEntries
        WHERE Pricebook2.IsStandard = true AND IsActive = true LIMIT 1)
    FROM Product2
    WHERE ${where}
    ORDER BY Name
  `.trim()
}

/** All active Meridian bundles (with resolved components + savings). */
export async function getBundles() {
  const records = await withConn((conn) =>
    conn.query(buildBundleQuery(BUNDLE_SCOPE)).then((r) => r.records),
  )
  return assemble(records)
}

/** One bundle by ProductCode (our slug), or 404. */
export async function getBundle(id) {
  const safe = String(id).replace(/'/g, "\\'")
  const records = await withConn((conn) =>
    conn.query(buildBundleQuery(`IsActive = true AND ProductCode = '${safe}'`)).then((r) => r.records),
  )
  const bundle = (await assemble(records))[0]
  if (!bundle) throw notFoundError(`Bundle "${id}" was not found.`)
  return bundle
}

// Resolve the component junction rows for a set of bundle records and fold each
// bundle into the app shape (base Product2 + components + savings).
async function assemble(bundleRecords) {
  if (bundleRecords.length === 0) return []
  const ids = bundleRecords.map((r) => `'${r.Id}'`)
  const comps = await withConn((conn) =>
    conn
      .query(
        `SELECT Bundle__c, Component__r.ProductCode, Quantity__c
         FROM Meridian_Bundle_Component__c WHERE Bundle__c IN (${ids.join(', ')})`,
      )
      .then((r) => r.records),
  )
  // Resolve each distinct component coffee's live price/details.
  const codes = [...new Set(comps.map((c) => c.Component__r?.ProductCode).filter(Boolean))]
  const byCode = codes.length ? await getProductsByCodes(codes) : new Map()

  const byBundle = new Map()
  for (const c of comps) {
    const p = byCode.get(c.Component__r?.ProductCode)
    if (!p) continue
    const list = byBundle.get(c.Bundle__c) || []
    list.push({
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.image,
      accent: p.accent,
      roast: p.roast,
      origin: p.origin,
      qty: Math.max(1, Math.floor(Number(c.Quantity__c) || 1)),
    })
    byBundle.set(c.Bundle__c, list)
  }
  return bundleRecords.map((rec) => bundleShape(rec, byBundle.get(rec.Id) || []))
}

function bundleShape(record, components) {
  const base = productFromSf(record)
  const componentTotal = round2(components.reduce((sum, c) => sum + c.price * c.qty, 0))
  const savings = round2(componentTotal - base.price)
  return {
    id: base.id,
    name: base.name,
    description: record.Description || '',
    price: base.price,
    image: base.image,
    accent: base.accent,
    stock: base.stock,
    active: base.active,
    isBundle: true,
    components,
    componentTotal,
    savings,
    savingsPct: componentTotal > 0 ? Math.round((savings / componentTotal) * 100) : 0,
  }
}
