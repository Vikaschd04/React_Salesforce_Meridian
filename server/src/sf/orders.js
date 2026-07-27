/**
 * Salesforce-backed orders. Creates a standard Order + OrderItems in a single
 * atomic Composite request, enforces live inventory, and reads orders back by
 * OrderNumber or Id.
 *
 * Security: totals and unit prices always come from server-trusted Salesforce
 * pricebook data — the client only supplies { id, qty } and shipping text.
 * Ownership: cancels and account-page reads are scoped to the session's
 * Contact (a shopper only sees/cancels their own orders), see getOrder().
 */
import { config } from '../config.js'
import { withConn } from './client.js'
import { getProductsByCodes } from './catalog.js'
import { orderFromSf, ORDER_FIELDS } from './mappers.js'
import { applyPromo, recordPromoRedemption } from '../store/promos.js'
import { charge } from '../pay/index.js'
import { computeShipping, round2 } from '../lib/totals.js'
import { badRequest, conflict, notFoundError } from '../lib/errors.js'

// Account + standard pricebook ids are stable per org; resolve once and cache.
let refs = null // { accountId, pricebookId }

// contactId → person-account id. A registered shopper's orders live on their own
// Person Account (Order.AccountId) — that's the shopper↔order link (replacing the
// old custom Shopper__c). Cached per shopper.
const accountByContact = new Map()
async function personAccountFor(contactId) {
  if (!contactId) return null
  if (accountByContact.has(contactId)) return accountByContact.get(contactId)
  const res = await withConn((conn) =>
    conn.query(`SELECT AccountId FROM Contact WHERE Id = '${esc(contactId)}' LIMIT 1`),
  )
  const id = res.records[0]?.AccountId || null
  if (id) accountByContact.set(contactId, id)
  return id
}

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
 * `auth` is optional { contactId }; when present the order lands on the
 * shopper's own Person Account (Order.AccountId), which is how it shows up in
 * their order history.
 */
export async function createOrder(items, shipping, auth = null, promoCode = null, payment = null) {
  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest('Your cart is empty.', 'empty_cart')
  }

  const byCode = await getProductsByCodes(items.map((it) => it.id))
  const { accountId, pricebookId } = await getRefs()

  // A registered shopper's order lands on THEIR person account (which is the
  // shopper↔order link — order history queries by it); guests (and any shopper
  // without one) fall back to the shared "Meridian Web Orders" account.
  let orderAccountId = accountId
  if (auth?.contactId) {
    const pa = await personAccountFor(auth.contactId)
    if (pa) orderAccountId = pa
  }

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

  const subtotal = round2(
    lines.reduce((sum, { product, qty }) => sum + product.price * qty, 0),
  )
  // Re-validate + apply the promo against the trusted subtotal (throws if bad).
  const promo = await applyPromo(promoCode, subtotal, {
    buyer: auth?.contactId || shipping?.email || null,
  })
  const total = round2(subtotal - promo.discount)
  const shippingCost = computeShipping(subtotal, promo.freeShipping)

  // Take payment against the trusted amount BEFORE writing anything — a decline
  // throws (402) and no order is created.
  const paid = await charge({
    amount: round2(total + shippingCost),
    payment,
    metadata: { email: shipping?.email || '' },
  })

  const base = apiPath()
  // Shared, always-valid part of the Order record. Standard-first: the lifecycle
  // rides the standard `Status` field (inserted Draft, activated below after
  // payment). Merchandise total is the standard TotalAmount rollup — we don't set
  // it. Only no-standard concepts (discount/promo/shipping amount in USD, payment
  // ref, shopper, guest email) are custom. See docs/SALESFORCE_CONVENTIONS.md.
  const orderBody = {
    // A registered shopper's own person account, else the shared web-orders
    // account (guests). AccountId IS the shopper↔order link (order history).
    AccountId: orderAccountId,
    Pricebook2Id: pricebookId,
    EffectiveDate: new Date().toISOString().slice(0, 10),
    Status: 'Draft', // Salesforce requires new orders to start Draft
    Discount__c: promo.discount,
    Promo_Code__c: promo.code,
    Shipping_Amount__c: shippingCost,
    Payment_Intent__c: paid.paymentId,
    Guest_Email__c: shipping?.email || null,
    ShippingStreet: shipping?.street || null,
    ShippingCity: shipping?.city || null,
    ShippingPostalCode: shipping?.postalCode || null,
    // This org has State/Country picklists enabled, so the ISO *Code fields
    // are the writable ones (Salesforce derives the text fields from them).
    ShippingCountryCode: shipping?.countryCode || null,
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

  // Payment succeeded → move the order out of Draft to the standard 'Activated'
  // (paid) status. Best-effort: the order + payment already exist, so a failure
  // here just leaves it Draft/pending for the merchant to activate.
  await withConn((conn) =>
    conn.sobject('Order').update({ Id: orderResult.body.id, Status: 'Activated' }),
  ).catch((err) => console.error('[order] activation failed:', err.message))

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

  // Record the coupon redemption in Salesforce (usage tracking / limits).
  // Best-effort — the order is already created + paid, so never fail it here.
  if (promo.code && promo.couponId) {
    recordPromoRedemption({
      code: promo.code,
      couponId: promo.couponId,
      orderNumber: order.orderId,
      buyer: auth?.contactId || shipping?.email || null,
    }).catch((err) => console.error('[promo] redemption record failed:', err.message))
  }

  return { ...order, freeShipping: promo.freeShipping }
}

/**
 * Read an order by OrderNumber (preferred) or Salesforce Id.
 * `contactId` (optional) scopes account-page reads to the shopper who placed it
 * (404 otherwise). Unscoped (null) is used for internal reads and the public
 * confirmation page, where no ownership check applies.
 */
export async function getOrder(idOrNumber, contactId = null) {
  const raw = await readRawOrder(idOrNumber)
  if (!raw) throw notFoundError(`Order "${idOrNumber}" was not found.`)
  if (contactId) {
    // The shopper owns an order iff it's on their Person Account.
    const pa = await personAccountFor(contactId)
    if (!pa || raw.head.AccountId !== pa) {
      throw notFoundError(`Order "${idOrNumber}" was not found.`)
    }
  }
  return orderFromSf(raw.head, raw.items)
}

/**
 * Public guest tracking: fetch an order by number, returned **only if** the
 * given email matches the order's `Guest_Email__c` (the checkout email, set on
 * every order). Generic not-found on any mismatch — an order number alone can't
 * be probed.
 */
export async function trackOrder(idOrNumber, email) {
  const raw = await readRawOrder(idOrNumber)
  const wanted = (email || '').trim().toLowerCase()
  if (!raw || (raw.head.Guest_Email__c || '').toLowerCase() !== wanted) {
    throw notFoundError('No order matches that number and email.')
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
  const pa = await personAccountFor(contactId)
  if (!raw || !pa || raw.head.AccountId !== pa) {
    throw notFoundError(`Order "${idOrNumber}" was not found.`)
  }
  if (raw.head.Status === 'Cancelled') {
    throw badRequest('This order is already cancelled.', 'already_cancelled')
  }
  if (raw.head.Status === 'Shipped' || raw.head.Status === 'Completed') {
    throw badRequest('This order has already shipped and can no longer be cancelled.', 'not_cancellable')
  }

  // Standard lifecycle: move the order to the 'Cancelled' Status (a paid order is
  // implicitly refunded). Restores stock below.
  await withConn((conn) =>
    conn.sobject('Order').update({ Id: raw.head.Id, Status: 'Cancelled' }),
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
  const pa = await personAccountFor(contactId)
  if (!pa) return []
  const safe = esc(pa)
  return withConn(async (conn) => {
    const orders = await conn.query(
      `SELECT ${ORDER_FIELDS} FROM Order WHERE AccountId = '${safe}'
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
