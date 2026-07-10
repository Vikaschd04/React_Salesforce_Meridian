/**
 * Money helper. All prices are stored as integer cents (USD); formatting only
 * happens at display time. Keep this the single source of currency formatting.
 */

const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

/** 2200 -> "$22.00" */
export function formatCents(cents) {
  const value = Number.isFinite(cents) ? cents : 0
  return formatter.format(value / 100)
}
