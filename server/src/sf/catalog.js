/**
 * Salesforce-backed catalog. SOQL over active Product2 records, pulling the
 * standard-pricebook UnitPrice via a subquery, then mapping to the app shape.
 */
import { withConn } from './client.js'
import { PRODUCT_FIELDS, productFromSf } from './mappers.js'
import { notFoundError } from '../lib/errors.js'

function buildQuery(where) {
  return `
    SELECT ${PRODUCT_FIELDS.join(', ')},
      (SELECT Id, UnitPrice FROM PricebookEntries
        WHERE Pricebook2.IsStandard = true AND IsActive = true LIMIT 1)
    FROM Product2
    WHERE ${where}
    ORDER BY Name
  `.trim()
}

/** All active products (only those that have a standard price). */
export async function getProducts() {
  const records = await withConn((conn) =>
    conn.query(buildQuery('IsActive = true')).then((r) => r.records),
  )
  return records.map(productFromSf).filter((p) => p.priceCents > 0)
}

/** One active product by ProductCode (our slug), or 404. */
export async function getProduct(id) {
  const safe = String(id).replace(/'/g, "\\'")
  const records = await withConn((conn) =>
    conn
      .query(buildQuery(`IsActive = true AND ProductCode = '${safe}'`))
      .then((r) => r.records),
  )
  const product = records.map(productFromSf)[0]
  if (!product) throw notFoundError(`Product "${id}" was not found.`)
  return product
}

/** Fetch several products by ProductCode at once (used to price an order). */
export async function getProductsByCodes(codes) {
  const list = [...new Set(codes)].map((c) => `'${String(c).replace(/'/g, "\\'")}'`)
  if (list.length === 0) return new Map()
  const records = await withConn((conn) =>
    conn
      .query(buildQuery(`IsActive = true AND ProductCode IN (${list.join(', ')})`))
      .then((r) => r.records),
  )
  return new Map(records.map(productFromSf).map((p) => [p.id, p]))
}
