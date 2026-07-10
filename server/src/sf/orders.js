/**
 * Salesforce-backed orders. Creates a standard Order + OrderItems in a single
 * atomic Composite request, and reads an order back by OrderNumber or Id.
 *
 * Security: the total and every unit price come from server-trusted Salesforce
 * pricebook data — the client only supplies { id, qty }. Same posture as the
 * mock BFF.
 */
import { config } from '../config.js'
import { withConn } from './client.js'
import { getProductsByCodes } from './catalog.js'
import { orderFromSf } from './mappers.js'
import { badRequest, conflict, notFoundError } from '../lib/errors.js'

// Account + standard pricebook ids are stable per org; resolve once and cache.
let refs = null // { accountId, pricebookId }

async function getRefs() {
  if (refs) return refs
  refs = await withConn(async (conn) => {
    const accountName = config.salesforce.accountName.replace(/'/g, "\\'")
    const [acct, pricebook] = await Promise.all([
      conn.query(`SELECT Id FROM Account WHERE Name = '${accountName}' LIMIT 1`),
      conn.query('SELECT Id FROM Pricebook2 WHERE IsStandard = true LIMIT 1'),
    ])
    if (!acct.records[0]) {
      throw new Error(
        `Salesforce Account "${config.salesforce.accountName}" not found. Create it (see docs/SALESFORCE_SETUP.md).`,
      )
    }
    if (!pricebook.records[0]) {
      throw new Error('Standard Pricebook not found/active in Salesforce.')
    }
    return { accountId: acct.records[0].Id, pricebookId: pricebook.records[0].Id }
  })
  return refs
}

const apiPath = () => `/services/data/v${config.salesforce.apiVersion}`

/** Create an Order from validated cart items: [{ id, qty }]. */
export async function createOrder(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest('Your cart is empty.', 'empty_cart')
  }

  const byCode = await getProductsByCodes(items.map((it) => it.id))
  const { accountId, pricebookId } = await getRefs()

  const lines = items.map((it) => {
    const product = byCode.get(it.id)
    if (!product || !product._pricebookEntryId) {
      throw conflict(`Item "${it.id}" is no longer available.`, 'unavailable_item')
    }
    const qty = Math.max(1, Math.floor(Number(it.qty) || 0))
    return { product, qty }
  })

  const totalCents = lines.reduce(
    (sum, { product, qty }) => sum + product.priceCents * qty,
    0,
  )

  const base = apiPath()
  const compositeRequest = [
    {
      method: 'POST',
      url: `${base}/sobjects/Order`,
      referenceId: 'newOrder',
      body: {
        AccountId: accountId,
        Pricebook2Id: pricebookId,
        EffectiveDate: new Date().toISOString().slice(0, 10),
        Status: 'Draft',
        TotalCents__c: totalCents,
      },
    },
    ...lines.map(({ product, qty }, i) => ({
      method: 'POST',
      url: `${base}/sobjects/OrderItem`,
      referenceId: `item${i}`,
      body: {
        OrderId: '@{newOrder.id}',
        Product2Id: product._sfId,
        PricebookEntryId: product._pricebookEntryId,
        Quantity: qty,
        UnitPrice: product._unitPriceDollars,
      },
    })),
  ]

  const result = await withConn((conn) =>
    conn.request({
      method: 'POST',
      url: `${base}/composite`,
      body: JSON.stringify({ allOrNone: true, compositeRequest }),
      headers: { 'Content-Type': 'application/json' },
    }),
  )

  const orderResult = result.compositeResponse?.find((r) => r.referenceId === 'newOrder')
  if (!orderResult || orderResult.httpStatusCode >= 300) {
    const detail = summarizeComposite(result)
    throw new Error(`Salesforce order creation failed: ${detail}`)
  }

  return getOrder(orderResult.body.id)
}

/** Read an order by OrderNumber (preferred) or Salesforce Id. */
export async function getOrder(idOrNumber) {
  const safe = String(idOrNumber).replace(/'/g, "\\'")
  const isSfId = /^[a-zA-Z0-9]{15,18}$/.test(idOrNumber) && !/^\d+$/.test(idOrNumber)
  const where = isSfId ? `Id = '${safe}'` : `OrderNumber = '${safe}'`

  const order = await withConn(async (conn) => {
    const orders = await conn.query(
      `SELECT Id, OrderNumber, Status, EffectiveDate, CreatedDate, TotalCents__c
       FROM Order WHERE ${where} LIMIT 1`,
    )
    const head = orders.records[0]
    if (!head) return null
    const lineItems = await conn.query(
      `SELECT Quantity, UnitPrice, TotalPrice, Product2Id, Product2.Name, Product2.ProductCode
       FROM OrderItem WHERE OrderId = '${head.Id}'`,
    )
    return orderFromSf(head, lineItems.records)
  })

  if (!order) throw notFoundError(`Order "${idOrNumber}" was not found.`)
  return order
}

function summarizeComposite(result) {
  const failed = (result.compositeResponse || []).find((r) => r.httpStatusCode >= 300)
  const err = Array.isArray(failed?.body) ? failed.body[0] : failed?.body
  return err?.message || err?.errorCode || 'unknown error'
}
