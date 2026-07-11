/**
 * Salesforce-backed orders. Creates a standard Order + OrderItems in a single
 * atomic Composite request, enforces live inventory, and reads orders back by
 * OrderNumber or Id.
 *
 * Security: totals and unit prices always come from server-trusted Salesforce
 * pricebook data — the client only supplies { id, qty } and shipping text.
 * Ownership: account reads/cancels are scoped to the session's Contact.
 */
import { config } from '../config.js'
import { withConn } from './client.js'
import { getProductsByCodes } from './catalog.js'
import { orderFromSf, ORDER_FIELDS } from './mappers.js'
import { applyPromo } from '../store/promos.js'
import { charge } from '../pay/index.js'
import { computeShippingCents } from '../lib/totals.js'
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
const esc = (s) => String(s).replace(/'/g, "\\'")

/**
 * Create an Order from validated cart items: [{ id, qty }].
 * `shipping` = { name, email, street, city, state, postalCode, country }.
 * `auth` is optional { contactId }; when present the order is linked to that
 * Contact via Order.Shopper__c so it shows up in order history.
 */
export async function createOrder(items, shipping, auth = null, promoCode = null, payment = null) {
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
    // Live inventory check against Salesforce Stock__c.
    if (qty > product.stock) {
      throw conflict(
        product.stock <= 0
          ? `"${product.name}" is sold out.`
          : `Only ${product.stock} bag${product.stock === 1 ? '' : 's'} of "${product.name}" left.`,
        'insufficient_stock',
      )
    }
    return { product, qty }
  })

  const subtotalCents = lines.reduce(
    (sum, { product, qty }) => sum + product.priceCents * qty,
    0,
  )
  // Re-validate + apply the promo against the trusted subtotal (throws if bad).
  const promo = applyPromo(promoCode, subtotalCents)
  const totalCents = subtotalCents - promo.discountCents
  const shippingCents = computeShippingCents(subtotalCents, promo.freeShipping)

  // Take payment against the trusted amount BEFORE writing anything — a decline
  // throws (402) and no order is created.
  const paid = await charge({
    amountCents: totalCents + shippingCents,
    payment,
    metadata: { email: shipping?.email || '' },
  })

  const base = apiPath()
  // Shared, always-valid part of the Order record.
  const orderBody = {
    AccountId: accountId,
    Pricebook2Id: pricebookId,
    EffectiveDate: new Date().toISOString().slice(0, 10),
    // Salesforce requires new orders to start Draft; the web-order lifecycle is
    // tracked by the custom Payment_Status__c / Fulfillment_Status__c fields.
    Status: 'Draft',
    Total_Cents__c: totalCents,
    Discount_Cents__c: promo.discountCents,
    Promo_Code__c: promo.code,
    Shipping_Cents__c: shippingCents,
    Payment_Status__c: 'Paid',
    Payment_Intent__c: paid.paymentId,
    Guest_Email__c: shipping?.email || null,
    ShippingStreet: shipping?.street || null,
    ShippingCity: shipping?.city || null,
    ShippingPostalCode: shipping?.postalCode || null,
    // This org has State/Country picklists enabled, so the ISO *Code fields
    // are the writable ones (Salesforce derives the text fields from them).
    ShippingCountryCode: shipping?.countryCode || null,
    ...(auth?.contactId ? { Shopper__c: auth.contactId } : {}),
  }
  const stateCode = shipping?.stateCode?.trim()

  // Attempt with the state code; if Salesforce rejects it as an invalid
  // state/country picklist value, retry once without it so the order still
  // goes through rather than failing the whole checkout.
  let orderResult
  try {
    orderResult = await submitOrder(
      { ...orderBody, ...(stateCode ? { ShippingStateCode: stateCode } : {}) },
      lines,
      base,
    )
  } catch (err) {
    if (stateCode && isStateCountryError(err)) {
      console.warn('[order] invalid state for country, retrying without it:', err.message)
      orderResult = await submitOrder(orderBody, lines, base).catch((err2) => {
        throw orderCreationError(err2)
      })
    } else {
      throw orderCreationError(err)
    }
  }

  // Decrement live stock (best effort — the order itself already succeeded).
  await withConn((conn) =>
    conn.sobject('Product2').update(
      lines.map(({ product, qty }) => ({
        Id: product._sfId,
        Stock__c: Math.max(0, product.stock - qty),
      })),
    ),
  ).catch((err) => console.error('[stock] decrement failed:', err.message))

  // freeShipping isn't persisted (it only waives the display shipping fee), so
  // carry it on the fresh response for the confirmation page.
  const order = await getOrder(orderResult.body.id)
  return { ...order, freeShipping: promo.freeShipping }
}

/** Read an order by OrderNumber (preferred) or Salesforce Id. */
export async function getOrder(idOrNumber, contactId = null) {
  const raw = await readRawOrder(idOrNumber)
  if (!raw) throw notFoundError(`Order "${idOrNumber}" was not found.`)
  // Ownership scope for account pages: the order must belong to this shopper.
  if (contactId && raw.head.Shopper__c !== contactId) {
    throw notFoundError(`Order "${idOrNumber}" was not found.`)
  }
  return orderFromSf(raw.head, raw.items)
}

async function readRawOrder(idOrNumber) {
  const safe = esc(idOrNumber)
  const isSfId = /^[a-zA-Z0-9]{15,18}$/.test(idOrNumber) && !/^\d+$/.test(idOrNumber)
  const where = isSfId ? `Id = '${safe}'` : `OrderNumber = '${safe}'`

  return withConn(async (conn) => {
    const orders = await conn.query(`SELECT ${ORDER_FIELDS} FROM Order WHERE ${where} LIMIT 1`)
    const head = orders.records[0]
    if (!head) return null
    const lineItems = await conn.query(
      `SELECT Quantity, UnitPrice, TotalPrice, Product2Id, Product2.Name, Product2.ProductCode
       FROM OrderItem WHERE OrderId = '${head.Id}'`,
    )
    return { head, items: lineItems.records }
  })
}

/**
 * Cancel a shopper's own order. Allowed until it has shipped. Refunds a paid
 * order (mock) and restores the reserved stock.
 */
export async function cancelOrder(idOrNumber, contactId) {
  const raw = await readRawOrder(idOrNumber)
  if (!raw || raw.head.Shopper__c !== contactId) {
    throw notFoundError(`Order "${idOrNumber}" was not found.`)
  }
  if (raw.head.Cancelled__c) {
    throw badRequest('This order is already cancelled.', 'already_cancelled')
  }
  if (raw.head.Fulfillment_Status__c === 'Shipped' || raw.head.Fulfillment_Status__c === 'Delivered') {
    throw badRequest('This order has already shipped and can no longer be cancelled.', 'not_cancellable')
  }

  await withConn((conn) =>
    conn.sobject('Order').update({
      Id: raw.head.Id,
      Cancelled__c: true,
      // Refund a paid order (mock: just flip the status).
      ...(raw.head.Payment_Status__c === 'Paid' ? { Payment_Status__c: 'Refunded' } : {}),
    }),
  )

  // Restore stock (best effort).
  const productIds = raw.items.map((it) => `'${it.Product2Id}'`)
  if (productIds.length) {
    await withConn(async (conn) => {
      const current = await conn.query(
        `SELECT Id, Stock__c FROM Product2 WHERE Id IN (${productIds.join(', ')})`,
      )
      const byId = new Map(current.records.map((r) => [r.Id, Number(r.Stock__c || 0)]))
      await conn.sobject('Product2').update(
        raw.items.map((it) => ({
          Id: it.Product2Id,
          Stock__c: (byId.get(it.Product2Id) || 0) + Number(it.Quantity || 0),
        })),
      )
    }).catch((err) => console.error('[stock] restore failed:', err.message))
  }

  return getOrder(raw.head.Id)
}

/** List a shopper's orders (most recent first), each with its line items. */
export async function listOrdersForContact(contactId) {
  const safe = esc(contactId)
  return withConn(async (conn) => {
    const orders = await conn.query(
      `SELECT ${ORDER_FIELDS} FROM Order WHERE Shopper__c = '${safe}'
       ORDER BY CreatedDate DESC LIMIT 50`,
    )
    if (orders.records.length === 0) return []
    const ids = orders.records.map((o) => `'${o.Id}'`).join(', ')
    const items = await conn.query(
      `SELECT OrderId, Quantity, UnitPrice, TotalPrice, Product2Id, Product2.Name, Product2.ProductCode
       FROM OrderItem WHERE OrderId IN (${ids})`,
    )
    const byOrder = new Map()
    for (const it of items.records) {
      if (!byOrder.has(it.OrderId)) byOrder.set(it.OrderId, [])
      byOrder.get(it.OrderId).push(it)
    }
    return orders.records.map((o) => orderFromSf(o, byOrder.get(o.Id) || []))
  })
}

/**
 * Build + run the Order/OrderItem composite for a given order body. On failure
 * throws an Error carrying `_sfDetail` (the Salesforce message) so the caller
 * can decide whether to retry or surface it.
 */
async function submitOrder(orderBody, lines, base) {
  const compositeRequest = [
    { method: 'POST', url: `${base}/sobjects/Order`, referenceId: 'newOrder', body: orderBody },
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
    const err = new Error(`Salesforce order creation failed: ${detail}`)
    err._sfDetail = detail
    throw err
  }
  return orderResult
}

/** True when a Salesforce failure looks like a state/country picklist rejection. */
function isStateCountryError(err) {
  const s = String(err?._sfDetail || err?.message || '').toLowerCase()
  return s.includes('state') || s.includes('country') || s.includes('province')
}

/** Turn a raw Salesforce order failure into a friendly, user-facing 400. */
function orderCreationError(err) {
  const detail = err?._sfDetail || err?.message || 'unknown error'
  return badRequest(
    `We couldn't create your order: ${detail}. Please review your shipping details and try again.`,
    'order_failed',
  )
}

function summarizeComposite(result) {
  const failed = (result.compositeResponse || []).find((r) => r.httpStatusCode >= 300)
  const err = Array.isArray(failed?.body) ? failed.body[0] : failed?.body
  return err?.message || err?.errorCode || 'unknown error'
}
