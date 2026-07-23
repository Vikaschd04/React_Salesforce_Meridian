/**
 * Product reviews — the seam between the routes and the data source, mirroring
 * store/companies.js. DATA_SOURCE=mock keeps reviews in an in-memory array
 * (survives a server run); DATA_SOURCE=salesforce reads/writes real
 * Meridian_Product_Review__c records (see sf/reviews.js). Both paths enforce the same
 * rule: one review per shopper per product.
 */
import { config } from '../config.js'
import { randomBytes } from 'node:crypto'
import { getProduct } from './catalog.js'
import { conflict } from '../lib/errors.js'
import * as sfReviews from '../sf/reviews.js'

const useSalesforce = config.dataSource === 'salesforce'
const mockReviews = [] // { id, _productId, _contactId, reviewerName, rating, title, body, createdAt }

async function mockList(productId) {
  await getProduct(productId) // throws notFoundError if the product doesn't exist
  const forProduct = mockReviews
    .filter((r) => r._productId === productId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const count = forProduct.length
  const average = count > 0 ? Math.round((forProduct.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0
  return { reviews: forProduct.map(stripInternal), average, count }
}

function mockFind(contactId, productId) {
  const found = mockReviews.find((r) => r._productId === productId && r._contactId === contactId)
  return found ? stripInternal(found) : null
}

async function mockCreate({ productId, contactId, reviewerName, rating, title, body }) {
  await getProduct(productId) // throws notFoundError if the product doesn't exist
  if (mockFind(contactId, productId)) {
    throw conflict('You’ve already reviewed this product.', 'already_reviewed')
  }
  const review = {
    id: `rev_${randomBytes(6).toString('hex')}`,
    _productId: productId,
    _contactId: contactId,
    reviewerName,
    rating,
    title,
    body,
    createdAt: new Date().toISOString(),
  }
  mockReviews.push(review)
  return stripInternal(review)
}

function stripInternal({ _productId, _contactId, ...rest }) {
  return rest
}

/** { reviews, average, count, myReview } for a product; myReview only if contactId is given. */
export async function getReviews(productId, contactId) {
  const base = useSalesforce ? await sfReviews.listForProduct(productId) : await mockList(productId)
  const myReview = contactId
    ? useSalesforce
      ? await sfReviews.findByContactAndProduct(contactId, productId)
      : mockFind(contactId, productId)
    : null
  return { ...base, myReview }
}

/** Submit a review as the given (authenticated) user. Throws 409 if already reviewed. */
export async function submitReview(productId, user, { rating, title, body }) {
  const reviewerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'A shopper'
  const payload = { productId, contactId: user.id, reviewerName, rating, title, body }
  return useSalesforce ? sfReviews.create(payload) : mockCreate(payload)
}
