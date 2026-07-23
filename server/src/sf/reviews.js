/**
 * Salesforce-backed product reviews. Product__c/Contact__c are Lookups, so
 * every query/insert resolves the app's ProductCode slug to the real
 * Salesforce Id via sf/catalog.js's getProduct() — same pattern sf/orders.js
 * uses to resolve order lines. That also gives a 404-if-missing check for
 * free (getProduct already throws notFoundError).
 */
import { withConn } from './client.js'
import { getProduct } from './catalog.js'
import { conflict } from '../lib/errors.js'

const REVIEW_FIELDS = 'Id, Rating__c, Title__c, Body__c, Reviewer_Name__c, CreatedDate'

function reviewFromSf(record) {
  return {
    id: record.Id,
    rating: Number(record.Rating__c || 0),
    title: record.Title__c || '',
    body: record.Body__c || '',
    reviewerName: record.Reviewer_Name__c || 'A shopper',
    createdAt: record.CreatedDate,
  }
}

/** Reviews for one product, most recent first, plus the average/count. */
export async function listForProduct(productId) {
  const product = await getProduct(productId) // throws notFoundError if missing
  const sfId = product._sfId

  return withConn(async (conn) => {
    const [list, agg] = await Promise.all([
      conn.query(
        `SELECT ${REVIEW_FIELDS} FROM Meridian_Product_Review__c WHERE Product__c = '${sfId}' ORDER BY CreatedDate DESC`,
      ),
      conn.query(
        `SELECT COUNT(Id) cnt, AVG(Rating__c) avgRating FROM Meridian_Product_Review__c WHERE Product__c = '${sfId}'`,
      ),
    ])
    const row = agg.records[0] || {}
    return {
      reviews: list.records.map(reviewFromSf),
      average: row.cnt > 0 ? Math.round(Number(row.avgRating) * 10) / 10 : 0,
      count: Number(row.cnt || 0),
    }
  })
}

/** The given shopper's review of the given product, or null. */
export async function findByContactAndProduct(contactId, productId) {
  const product = await getProduct(productId)
  const records = await withConn((conn) =>
    conn
      .query(
        `SELECT ${REVIEW_FIELDS} FROM Meridian_Product_Review__c ` +
          `WHERE Product__c = '${product._sfId}' AND Contact__c = '${contactId}' LIMIT 1`,
      )
      .then((r) => r.records),
  )
  return records[0] ? reviewFromSf(records[0]) : null
}

/** Create a review. Throws a 409 if this shopper already reviewed this product. */
export async function create({ productId, contactId, reviewerName, rating, title, body }) {
  const product = await getProduct(productId)
  const existing = await findByContactAndProduct(contactId, productId)
  if (existing) {
    throw conflict('You’ve already reviewed this product.', 'already_reviewed')
  }

  const created = await withConn((conn) =>
    conn.sobject('Meridian_Product_Review__c').create({
      Product__c: product._sfId,
      Contact__c: contactId,
      Reviewer_Name__c: reviewerName,
      Rating__c: rating,
      Title__c: title,
      Body__c: body,
    }),
  )
  if (!created.success) throw new Error('Failed to create the review in Salesforce.')

  const record = await withConn((conn) =>
    conn
      .query(`SELECT ${REVIEW_FIELDS} FROM Meridian_Product_Review__c WHERE Id = '${created.id}'`)
      .then((r) => r.records[0]),
  )
  return reviewFromSf(record)
}
