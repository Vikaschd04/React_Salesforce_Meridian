/**
 * Promotion codes — a small, static, global table. Kept deliberately simple:
 * no per-user limits, expiry, or usage tracking (see the phase's "out of scope").
 *
 * Amounts are integer cents. `validatePromo` is the single source of truth and
 * is called both when the shopper applies a code *and* again at order creation,
 * so the discount is always recomputed server-side against trusted prices — a
 * forged client amount can never change what's charged.
 */
import { badRequest } from '../lib/errors.js'

const PROMOS = {
  WELCOME10: { kind: 'percent', value: 10, label: '10% off your order' },
  MERIDIAN5: { kind: 'fixed', value: 500, minSubtotalCents: 2500, label: '$5 off orders over $25' },
  FREESHIP: { kind: 'shipping', label: 'Free shipping' },
}

/**
 * Validate a code against a trusted subtotal (cents). Throws a 400 ApiError with
 * a friendly message when the code is missing, unknown, or below its minimum.
 * Returns { code, discountCents, freeShipping, label }.
 */
export function validatePromo(rawCode, subtotalCents) {
  const code = String(rawCode || '').trim().toUpperCase()
  if (!code) throw badRequest('Enter a promo code.', 'promo_missing')

  const promo = PROMOS[code]
  if (!promo) throw badRequest(`“${code}” isn’t a valid code.`, 'promo_invalid')

  const subtotal = Math.max(0, Math.floor(Number(subtotalCents) || 0))
  if (promo.minSubtotalCents && subtotal < promo.minSubtotalCents) {
    const shortBy = ((promo.minSubtotalCents - subtotal) / 100).toFixed(2)
    throw badRequest(`Add $${shortBy} more to use ${code}.`, 'promo_min')
  }

  let discountCents = 0
  let freeShipping = false
  if (promo.kind === 'percent') discountCents = Math.round(subtotal * (promo.value / 100))
  else if (promo.kind === 'fixed') discountCents = Math.min(promo.value, subtotal)
  else if (promo.kind === 'shipping') freeShipping = true

  return { code, discountCents, freeShipping, label: promo.label }
}

/**
 * Apply an optional code during order creation. Returns a neutral result when no
 * code is supplied; otherwise delegates to validatePromo (which throws if the
 * code is invalid at order time, e.g. a tampered/expired cart).
 */
export function applyPromo(rawCode, subtotalCents) {
  if (!rawCode) return { code: null, discountCents: 0, freeShipping: false, label: null }
  return validatePromo(rawCode, subtotalCents)
}
