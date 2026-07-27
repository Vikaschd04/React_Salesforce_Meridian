/**
 * Shared money rules so the server (which takes the payment) and the client
 * (which previews the total) agree. Shipping is free at/above the threshold or
 * with a free-shipping promo, otherwise a flat fee. Amounts are USD dollars.
 */
export const SHIP_FREE_THRESHOLD_USD = 45
export const SHIP_FLAT_USD = 6

/** Round a dollar amount to whole cents (2 dp) — use at every money boundary. */
export function round2(dollars) {
  return Math.round((Number(dollars) || 0) * 100) / 100
}

/** Shipping cost for a goods subtotal (pre-discount), honoring a free-ship promo. */
export function computeShipping(subtotal, freeShipping = false) {
  if (freeShipping) return 0
  if (subtotal <= 0 || subtotal >= SHIP_FREE_THRESHOLD_USD) return 0
  return SHIP_FLAT_USD
}
