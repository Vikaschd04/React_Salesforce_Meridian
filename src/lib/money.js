/**
 * Money helper. All amounts are USD dollars (a decimal Number, e.g. 22 or 22.5);
 * formatting only happens at display time. Keep this the single source of
 * currency formatting + rounding.
 */

const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

/** Round a dollar amount to whole cents (2 dp) — use at every money boundary. */
export function round2(dollars) {
  return Math.round((Number(dollars) || 0) * 100) / 100
}

/** 22 -> "$22.00" */
export function formatUsd(dollars) {
  const value = Number.isFinite(dollars) ? dollars : 0
  return formatter.format(value)
}

/**
 * The amount actually charged for an order — merchandise, less discount, plus
 * shipping. Prefers the server's `paid`; falls back to computing it so the
 * *same* total shows on the order list, detail, confirmation, and guest track.
 */
export function orderPaidUsd(order) {
  return order.paid ?? (order.total || 0) + (order.shippingCost || 0)
}
