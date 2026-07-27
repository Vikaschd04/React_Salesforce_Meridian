/**
 * Salesforce-backed wishlist on the STANDARD `Wishlist` + `WishlistItem` objects
 * (no custom schema). Each shopper has one `Wishlist` (parented to their Person
 * Account + a WebStore, which the standard object requires); saved products are
 * `WishlistItem` rows (`Product2Id`). The app's ProductCode slug is resolved to a
 * real Product2 Id via sf/catalog.js's getProduct() (404-if-missing for free).
 */
import { withConn, getConnection } from './client.js'
import { getProduct } from './catalog.js'
import { config } from '../config.js'

const esc = (s) => String(s).replace(/'/g, "\\'")

let ownerId = null // integration user id (Wishlist.OwnerId)
let webStoreId = null // resolved once (Wishlist.WebStoreId, required)
const wishlistByContact = new Map() // contactId -> Wishlist id
const accountByContact = new Map() // contactId -> person-account id

async function getOwnerId() {
  if (ownerId) return ownerId
  const conn = await getConnection()
  ownerId = (await conn.identity()).user_id
  return ownerId
}

async function getWebStoreId(conn) {
  if (webStoreId) return webStoreId
  const name = esc(config.salesforce.webStoreName)
  let res = await conn.query(`SELECT Id FROM WebStore WHERE Name = '${name}' LIMIT 1`)
  if (!res.records[0]) res = await conn.query('SELECT Id FROM WebStore LIMIT 1')
  if (!res.records[0]) throw new Error('No WebStore found — standard Wishlist requires one.')
  webStoreId = res.records[0].Id
  return webStoreId
}

async function accountFor(conn, contactId) {
  if (accountByContact.has(contactId)) return accountByContact.get(contactId)
  const res = await conn.query(
    `SELECT AccountId FROM Contact WHERE Id = '${esc(contactId)}' LIMIT 1`,
  )
  const accountId = res.records[0]?.AccountId || null
  if (accountId) accountByContact.set(contactId, accountId)
  return accountId
}

/** The shopper's Wishlist id — reuse an existing one for their account, else create it. */
async function ensureWishlist(conn, contactId) {
  if (wishlistByContact.has(contactId)) return wishlistByContact.get(contactId)
  const accountId = await accountFor(conn, contactId)
  if (!accountId) throw new Error('No account found for this shopper.')
  const existing = await conn.query(
    `SELECT Id FROM Wishlist WHERE AccountId = '${esc(accountId)}' ORDER BY CreatedDate ASC LIMIT 1`,
  )
  let id = existing.records[0]?.Id
  if (!id) {
    const created = await conn.sobject('Wishlist').create({
      Name: 'Saved items',
      AccountId: accountId,
      OwnerId: await getOwnerId(),
      WebStoreId: await getWebStoreId(conn),
    })
    if (!created.success) throw new Error('Failed to create the wishlist in Salesforce.')
    id = created.id
  }
  wishlistByContact.set(contactId, id)
  return id
}

/** The shopper's saved product slugs (ProductCodes), newest first. */
export async function listForContact(contactId) {
  return withConn(async (conn) => {
    const wishlistId = await ensureWishlist(conn, contactId)
    const res = await conn.query(
      `SELECT Product2.ProductCode FROM WishlistItem ` +
        `WHERE WishlistId = '${esc(wishlistId)}' ORDER BY CreatedDate DESC`,
    )
    return res.records.map((r) => r.Product2?.ProductCode).filter(Boolean)
  })
}

/** Add a product to the wishlist. Idempotent — no duplicate row per (wishlist, product). */
export async function add(contactId, productId) {
  const product = await getProduct(productId) // throws notFoundError if missing
  return withConn(async (conn) => {
    const wishlistId = await ensureWishlist(conn, contactId)
    const existing = await conn.query(
      `SELECT Id FROM WishlistItem ` +
        `WHERE WishlistId = '${esc(wishlistId)}' AND Product2Id = '${product._sfId}' LIMIT 1`,
    )
    if (existing.records[0]) return // already saved — no-op
    const created = await conn.sobject('WishlistItem').create({
      Name: String(product.name || product.id).slice(0, 255),
      WishlistId: wishlistId,
      Product2Id: product._sfId,
    })
    if (!created.success) throw new Error('Failed to add to wishlist in Salesforce.')
  })
}

/** Remove a product from the wishlist (no-op if it wasn't saved). */
export async function remove(contactId, productId) {
  const product = await getProduct(productId)
  return withConn(async (conn) => {
    const wishlistId = await ensureWishlist(conn, contactId)
    const rows = await conn.query(
      `SELECT Id FROM WishlistItem ` +
        `WHERE WishlistId = '${esc(wishlistId)}' AND Product2Id = '${product._sfId}'`,
    )
    if (!rows.records.length) return
    await conn.sobject('WishlistItem').destroy(rows.records.map((r) => r.Id))
  })
}
