/**
 * Salesforce-backed wishlist. A Meridian_Wishlist_Item__c row per saved
 * (Contact, Product). Product__c is a Lookup, so every query/insert resolves
 * the app's ProductCode slug to the real Product2 Id via sf/catalog.js's
 * getProduct() — same pattern sf/reviews.js uses (and 404-if-missing for free).
 */
import { withConn } from './client.js'
import { getProduct } from './catalog.js'

const esc = (s) => String(s).replace(/'/g, "\\'")

/** The shopper's saved product slugs (ProductCodes), newest first. */
export async function listForContact(contactId) {
  return withConn(async (conn) => {
    const res = await conn.query(
      `SELECT Product__r.ProductCode FROM Meridian_Wishlist_Item__c ` +
        `WHERE Contact__c = '${esc(contactId)}' ORDER BY CreatedDate DESC`,
    )
    return res.records.map((r) => r.Product__r?.ProductCode).filter(Boolean)
  })
}

/** Add a product to the wishlist. Idempotent — no duplicate row per (contact, product). */
export async function add(contactId, productId) {
  const product = await getProduct(productId) // throws notFoundError if missing
  return withConn(async (conn) => {
    const existing = await conn.query(
      `SELECT Id FROM Meridian_Wishlist_Item__c ` +
        `WHERE Contact__c = '${esc(contactId)}' AND Product__c = '${product._sfId}' LIMIT 1`,
    )
    if (existing.records[0]) return // already saved — no-op
    const created = await conn
      .sobject('Meridian_Wishlist_Item__c')
      .create({ Contact__c: contactId, Product__c: product._sfId })
    if (!created.success) throw new Error('Failed to add to wishlist in Salesforce.')
  })
}

/** Remove a product from the wishlist (no-op if it wasn't saved). */
export async function remove(contactId, productId) {
  const product = await getProduct(productId)
  return withConn(async (conn) => {
    const rows = await conn.query(
      `SELECT Id FROM Meridian_Wishlist_Item__c ` +
        `WHERE Contact__c = '${esc(contactId)}' AND Product__c = '${product._sfId}'`,
    )
    if (!rows.records.length) return
    await conn.sobject('Meridian_Wishlist_Item__c').destroy(rows.records.map((r) => r.Id))
  })
}
