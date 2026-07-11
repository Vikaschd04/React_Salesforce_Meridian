/**
 * Shared money rules so the server (which takes the payment) and the client
 * (which previews the total) agree. Shipping is free at/above the threshold or
 * with a free-shipping promo, otherwise a flat fee. Amounts are integer cents.
 */
export const SHIP_FREE_THRESHOLD_CENTS = 4500
export const SHIP_FLAT_CENTS = 600

/** Shipping cost for a goods subtotal (pre-discount), honoring a free-ship promo. */
export function computeShippingCents(subtotalCents, freeShipping = false) {
  if (freeShipping) return 0
  if (subtotalCents <= 0 || subtotalCents >= SHIP_FREE_THRESHOLD_CENTS) return 0
  return SHIP_FLAT_CENTS
}
