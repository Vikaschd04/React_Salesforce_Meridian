/**
 * Salesforce Order Management — build an OrderSummary for a placed order.
 *
 * The ONLY file that knows the OMS objects. For each order the storefront
 * creates a standard OMS source order (delivery group + typed line items + a
 * "Delivery Charge" line — done in sf/orders.js's composite), then this module
 * adds the tax + adjustment lines and calls the standard `createOrderSummary`
 * action, which rolls everything up into an OrderSummary + OrderItemSummary +
 * OrderDeliveryGroupSummary (with TotalTaxAmount / TotalDeliveryAmount /
 * GrandTotalAmount). It *supplements* the Order — the app's order lifecycle
 * still rides Order.Status. See docs/SALESFORCE_CONVENTIONS.md (Order Management).
 *
 * All of this is best-effort at the call site: a failure here never fails the
 * paid order — the order just doesn't get a summary (the app falls back to
 * recomputing tax from the configured rate for display).
 */
import { withConn } from './client.js'
import { config } from '../config.js'

// The OMS "Delivery Charge" line references a shipping Product2; an
// OrderDeliveryMethod points at it. Stable names/codes, created by sf:setup.
export const SHIPPING_PRODUCT_CODE = 'meridian-shipping'
export const DELIVERY_METHOD_NAME = 'Meridian Standard Shipping'

const esc = (s) => String(s).replace(/'/g, "\\'")
const apiPath = () => `/services/data/v${config.salesforce.apiVersion}`
const today = () => new Date().toISOString().slice(0, 10)

// Shipping product PBE + delivery method are stable per org — resolve once.
let omsRefs = null
export async function getOmsRefs() {
  if (omsRefs) return omsRefs
  omsRefs = await withConn(async (conn) => {
    const prod = await conn.query(
      `SELECT Id, (SELECT Id FROM PricebookEntries WHERE Pricebook2.IsStandard = true AND IsActive = true LIMIT 1)
       FROM Product2 WHERE ProductCode = '${esc(SHIPPING_PRODUCT_CODE)}' LIMIT 1`,
    )
    const method = await conn.query(
      `SELECT Id FROM OrderDeliveryMethod WHERE Name = '${esc(DELIVERY_METHOD_NAME)}' LIMIT 1`,
    )
    const shippingProductId = prod.records[0]?.Id
    const shippingPbeId = prod.records[0]?.PricebookEntries?.records?.[0]?.Id
    const deliveryMethodId = method.records[0]?.Id
    if (!shippingProductId || !shippingPbeId || !deliveryMethodId) {
      throw new Error('OMS shipping catalog missing — run `npm run sf:setup`.')
    }
    return { shippingProductId, shippingPbeId, deliveryMethodId }
  })
  return omsRefs
}

/** Build the OrderDeliveryGroup body for the composite (ship-to from the order's shipping). */
export function deliveryGroupBody(shipping, deliveryMethodId, withStateCode = true) {
  return {
    OrderId: '@{newOrder.id}',
    OrderDeliveryMethodId: deliveryMethodId,
    DeliverToName: shipping?.name || 'Customer',
    DeliverToStreet: shipping?.street || null,
    DeliverToCity: shipping?.city || null,
    DeliverToPostalCode: shipping?.postalCode || null,
    DeliverToCountryCode: shipping?.countryCode || null,
    ...(withStateCode && shipping?.stateCode ? { DeliverToStateCode: shipping.stateCode } : {}),
  }
}

/**
 * Split `tax` across product lines in proportion to each line's amount, in whole
 * cents, so the per-line shares sum **exactly** to `tax` (largest-remainder
 * apportionment — floor every share, then hand the leftover cents to the lines
 * with the biggest fractional parts). Returns a dollar amount per input line.
 */
function distributeTax(lineAmounts, tax) {
  const totalCents = Math.round(tax * 100)
  const weights = lineAmounts.map((a) => Math.round(Math.max(0, a) * 100))
  const weightSum = weights.reduce((s, w) => s + w, 0)
  if (weightSum <= 0 || totalCents <= 0) return lineAmounts.map(() => 0)
  const exact = weights.map((w) => (totalCents * w) / weightSum)
  const cents = exact.map((x) => Math.floor(x))
  let leftover = totalCents - cents.reduce((s, c) => s + c, 0)
  const byFrac = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac)
  for (let k = 0; leftover > 0; k++, leftover--) cents[byFrac[k % byFrac.length].i] += 1
  return cents.map((c) => c / 100)
}

/**
 * Add the sales-tax lines to a **Draft** OMS order (activated orders are locked,
 * so this runs before activation) so `OrderSummary.TotalTaxAmount` rolls up.
 * One `OrderItemTaxLineItem` **per product line**, each carrying that line's
 * share of the tax (apportioned by line amount) — so every OrderItemSummary
 * reflects its own tax and the sum matches the total exactly. Best-effort — the
 * caller ignores failures.
 *
 * `productItems` = `[{ id, amount }]` (Salesforce OrderItem id + pre-discount
 * line amount = qty × unit price), aligned with the order's product lines.
 *
 * We deliberately do NOT add an OMS discount adjustment: the promo discount lives
 * on Order.Discount__c (Phase 1), and this org's B2B adjustment handling rewrites
 * the source OrderItem prices, which would corrupt the app's reads. (The summary's
 * GrandTotalAmount is therefore pre-discount on promo orders — a documented
 * limitation; the app's displayed totals come from the Order + tax and match the
 * charge exactly.)
 */
export async function addTaxLine({ productItems, tax }) {
  if (!(tax > 0) || !Array.isArray(productItems) || productItems.length === 0) return
  const shares = distributeTax(productItems.map((p) => p.amount ?? 0), tax)
  const rows = productItems
    .map((p, i) => ({ id: p.id, amount: shares[i] }))
    .filter((r) => r.id && r.amount > 0)
    .map((r) => ({
      OrderItemId: r.id,
      Name: 'Sales Tax',
      Amount: r.amount,
      Type: 'Estimated',
      TaxEffectiveDate: today(),
    }))
  if (rows.length === 0) return
  return withConn((conn) => conn.sobject('OrderItemTaxLineItem').create(rows))
}

/**
 * Create the OrderSummary from an **already-activated** order via the standard
 * OMS action. Returns { id, number }. Best-effort — the caller ignores failures.
 */
export async function createFromOrder(orderId) {
  return withConn(async (conn) => {
    const res = await conn.request({
      method: 'POST',
      url: `${apiPath()}/actions/standard/createOrderSummary`,
      body: JSON.stringify({
        inputs: [{ createOrderSummaryInput: { orderId, orderLifeCycleType: 'UNMANAGED' } }],
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    const out = Array.isArray(res) ? res[0] : res
    const summaryId = out?.outputValues?.createOrderSummaryOutput?.orderSummaryId
    if (!out?.isSuccess || !summaryId) {
      throw new Error(`createOrderSummary failed: ${JSON.stringify(out?.errors || out)}`)
    }
    const os = await conn.query(`SELECT OrderNumber FROM OrderSummary WHERE Id = '${summaryId}' LIMIT 1`)
    return { id: summaryId, number: os.records[0]?.OrderNumber || null }
  })
}

/** Read an order's OrderSummary money rollups (or null). Keyed by the source Order Id. */
export async function summaryForOrder(orderId) {
  const map = await summariesForOrders([orderId])
  return map.get(orderId) || null
}

/** Bulk: source-order Id → its OrderSummary rollups. Used by order history. */
export async function summariesForOrders(orderIds) {
  const ids = [...new Set(orderIds.filter(Boolean))]
  if (ids.length === 0) return new Map()
  const inList = ids.map((id) => `'${esc(id)}'`).join(', ')
  return withConn(async (conn) => {
    const res = await conn.query(
      `SELECT Id, OrderNumber, OriginalOrderId, TotalProductAmount, TotalDeliveryAmount,
              TotalTaxAmount, TotalAdjDistAmount, GrandTotalAmount
       FROM OrderSummary WHERE OriginalOrderId IN (${inList})`,
    )
    const map = new Map()
    for (const r of res.records) {
      // Keep the earliest per order (there should be exactly one).
      if (!map.has(r.OriginalOrderId)) {
        map.set(r.OriginalOrderId, {
          summaryNumber: r.OrderNumber || null,
          tax: Number(r.TotalTaxAmount || 0),
          shippingCost: Number(r.TotalDeliveryAmount || 0),
          grandTotal: Number(r.GrandTotalAmount || 0),
        })
      }
    }
    return map
  })
}
