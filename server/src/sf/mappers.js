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

/** Standard Order + OrderItems → app order shape (matches the mock BFF output). */
export function orderFromSf(order, items = []) {
  const lines = items.map((it) => ({
    id: it.Product2?.ProductCode || it.Product2Id,
    name: it.Product2?.Name || '',
    qty: Number(it.Quantity || 0),
    unitPriceCents: dollarsToCents(it.UnitPrice),
    lineCents: dollarsToCents(it.TotalPrice ?? it.UnitPrice * it.Quantity),
  }))
  const totalCents =
    order.Total_Cents__c != null
      ? Number(order.Total_Cents__c)
      : lines.reduce((sum, l) => sum + l.lineCents, 0)

  return {
    orderId: order.OrderNumber || order.Id,
    status: (order.Status || 'confirmed').toLowerCase(),
    items: lines,
    totalCents,
    placedAt: order.EffectiveDate || order.CreatedDate || new Date().toISOString(),
  }
}
