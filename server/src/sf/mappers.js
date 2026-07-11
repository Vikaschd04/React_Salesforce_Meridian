/**
 * Field mapping between Salesforce records and the app's product/order shape.
 *
 * This is the ONLY place that knows Salesforce field API names, so the UI shape
 * (identical to Phases 1–2) never leaks Salesforce specifics. If a field is
 * renamed in the org, it changes here and nowhere else.
 *
 * Money: Salesforce stores currency in dollars (Number). The app uses integer
 * cents everywhere, so we convert on the boundary.
 */

export const dollarsToCents = (dollars) => Math.round(Number(dollars || 0) * 100)
export const centsToDollars = (cents) => Number(cents || 0) / 100

/** Split a semicolon-separated notes field into a trimmed array. */
function parseNotes(value) {
  if (!value) return []
  return String(value)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Product2 (+ nested PricebookEntries) → app product.
 * ProductCode is the app's stable id/slug (e.g. "yirgacheffe-koke").
 */
export function productFromSf(record) {
  const entry = record.PricebookEntries?.records?.[0]
  return {
    id: record.ProductCode,
    name: record.Name,
    origin: record.Origin__c || '',
    roast: record.Roast__c || '',
    priceCents: dollarsToCents(entry?.UnitPrice),
    weightGrams: Number(record.Weight_Grams__c || 0),
    tastingNotes: parseNotes(record.Tasting_Notes__c),
    process: record.Process__c || '',
    altitudeMeters: Number(record.Altitude_Meters__c || 0),
    lat: record.Latitude__c != null ? Number(record.Latitude__c) : null,
    lng: record.Longitude__c != null ? Number(record.Longitude__c) : null,
    accent: record.Accent__c || '#5a3520',
    stock: Number(record.Stock__c || 0),
    active: record.IsActive === true,
    image: record.Image_Path__c || '',
    // Kept for order creation — not sent to the UI.
    _sfId: record.Id,
    _pricebookEntryId: entry?.Id,
    _unitPriceDollars: entry?.UnitPrice ?? 0,
  }
}

/** SELECT clause listing every Product2 field the app needs (+ standard price). */
export const PRODUCT_FIELDS = [
  'Id',
  'ProductCode',
  'Name',
  'Description',
  'IsActive',
  'Origin__c',
  'Roast__c',
  'Tasting_Notes__c',
  'Process__c',
  'Altitude_Meters__c',
  'Latitude__c',
  'Longitude__c',
  'Stock__c',
  'Weight_Grams__c',
  'Accent__c',
  'Image_Path__c',
]

/**
 * Fields selected whenever we read an Order. Standard-first: the lifecycle is the
 * standard `Status` field, the merchandise total is the standard `TotalAmount`
 * rollup, and the order date is standard. Only genuinely-no-standard concepts
 * (shopper link, guest email, promo/discount/shipping cents, payment ref,
 * tracking) remain custom. See docs/SALESFORCE_CONVENTIONS.md.
 */
export const ORDER_FIELDS =
  'Id, OrderNumber, Status, EffectiveDate, CreatedDate, ActivatedDate, TotalAmount, ' +
  'Guest_Email__c, Shopper__c, Discount_Cents__c, Promo_Code__c, ' +
  'Shipping_Cents__c, Payment_Intent__c, Tracking_Number__c, ' +
  'ShippingStreet, ShippingCity, ShippingState, ShippingPostalCode, ShippingCountry'

/**
 * Map the standard Order `Status` to the display status the UI drives its badge
 * and timeline from. The merchant advances an order by changing `Status` in
 * Salesforce (Placed → Confirmed → Shipped → Completed, or Cancelled).
 */
export function orderStatus({ Status }) {
  switch (Status) {
    case 'Cancelled':
      return 'cancelled'
    case 'Completed':
      return 'delivered'
    case 'Shipped':
      return 'shipped'
    case 'Activated':
      return 'paid'
    default:
      return 'pending' // Draft
  }
}

/** Standard Order + OrderItems → app order shape (matches the mock BFF output). */
export function orderFromSf(order, items = []) {
  const lines = items.map((it) => ({
    id: it.Product2?.ProductCode || it.Product2Id,
    name: it.Product2?.Name || '',
    qty: Number(it.Quantity || 0),
    unitPriceCents: dollarsToCents(it.UnitPrice),
    lineCents: dollarsToCents(it.TotalPrice ?? it.UnitPrice * it.Quantity),
  }))
  // Merchandise subtotal comes from the standard TotalAmount rollup (fallback to
  // the line items if it hasn't calculated yet). Discount + shipping are custom.
  const subtotalCents =
    order.TotalAmount != null
      ? dollarsToCents(order.TotalAmount)
      : lines.reduce((sum, l) => sum + l.lineCents, 0)
  const discountCents = Number(order.Discount_Cents__c || 0)
  const shippingCents = Number(order.Shipping_Cents__c || 0)
  const totalCents = subtotalCents - discountCents // merchandise after discount
  const status = orderStatus(order)
  const paid = status === 'paid' || status === 'shipped' || status === 'delivered'

  const hasShipping = order.ShippingStreet || order.ShippingCity
  return {
    orderId: order.OrderNumber || order.Id,
    status,
    paymentStatus: paid ? 'paid' : status === 'cancelled' ? 'refunded' : 'unpaid',
    trackingNumber: order.Tracking_Number__c || null,
    items: lines,
    subtotalCents,
    discountCents,
    shippingCents,
    paidCents: totalCents + shippingCents,
    promoCode: order.Promo_Code__c || null,
    totalCents,
    placedAt: order.EffectiveDate || order.CreatedDate || new Date().toISOString(),
    email: order.Guest_Email__c || null,
    shipping: hasShipping
      ? {
          street: order.ShippingStreet || '',
          city: order.ShippingCity || '',
          state: order.ShippingState || '',
          postalCode: order.ShippingPostalCode || '',
          country: order.ShippingCountry || '',
        }
      : null,
  }
}
