/**
 * Wishlist — the seam between the routes and the data source, mirroring
 * store/companies.js. DATA_SOURCE=mock keeps wishlists in an in-memory
 * Map<contactId, Set<productId>>; DATA_SOURCE=salesforce reads/writes real
 * Meridian_Wishlist_Item__c rows (see sf/wishlist.js). Both paths enforce the
 * same rules, including the 404-on-missing-product check.
 */
import { config } from '../config.js'
import { getProduct } from './catalog.js'
import * as sfWishlist from '../sf/wishlist.js'

const useSalesforce = config.dataSource === 'salesforce'
const mockWishlists = new Map() // contactId -> Set<productId>

function mockSet(contactId) {
  let set = mockWishlists.get(contactId)
  if (!set) {
    set = new Set()
    mockWishlists.set(contactId, set)
  }
  return set
}

/** The shopper's saved product ids (slugs). */
export async function list(contactId) {
  if (useSalesforce) return sfWishlist.listForContact(contactId)
  return [...mockSet(contactId)]
}

/** Add a product; idempotent. Throws notFoundError if the product doesn't exist. */
export async function add(contactId, productId) {
  await getProduct(productId) // 404 if missing — same in both modes
  if (useSalesforce) return sfWishlist.add(contactId, productId)
  mockSet(contactId).add(productId)
}

/** Remove a product (no-op if not saved). */
export async function remove(contactId, productId) {
  await getProduct(productId)
  if (useSalesforce) return sfWishlist.remove(contactId, productId)
  mockSet(contactId).delete(productId)
}
