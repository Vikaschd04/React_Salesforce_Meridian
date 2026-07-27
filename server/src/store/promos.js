/**
 * Promotion codes — the seam between the promo/order flow and the data source.
 *
 * DATA_SOURCE=salesforce reads the whole coupon lifecycle from the STANDARD
 * Salesforce Commerce objects (Coupon/Promotion/PromotionTarget/…, see
 * sf/promos.js) — a merchant governs code, discount, validity/expiry, active
 * flag and usage limits entirely in Salesforce. DATA_SOURCE=mock keeps a small
 * in-repo table (with the same optional validity/limit fields) so the app runs
 * offline with identical behaviour.
 *
 * Either way the discount is computed here, server-side, against a trusted
 * subtotal (in cents) — a forged client amount can never change what's charged.
 * `validatePromo`/`applyPromo` share one `evaluate()`, so both modes and both
 * call paths (apply-a-code, and re-check at order creation) behave the same.
 */
import { config } from '../config.js'
import { badRequest } from '../lib/errors.js'
import * as sfPromos from '../sf/promos.js'

const useSalesforce = config.dataSource === 'salesforce'

// ---- Mock table: same shape a Salesforce Coupon resolves to (see sf/promos) ----
// `validFrom`/`validTo` are ISO strings (optional); `limit` is total redemptions.
const mockRedemptions = new Map() // code -> count
const MOCK_PROMOS = {
  WELCOME10: { kind: 'percent', value: 10, label: '10% off your order' },
  MERIDIAN5: { kind: 'fixed', value: 500, minSubtotalCents: 2500, label: '$5 off orders over $25' },
  FREESHIP: { kind: 'shipping', label: 'Free shipping' },
  // Test-only codes so mock mode / E2E can exercise the expiry + limit paths.
  EXPIRED10: { kind: 'percent', value: 10, validTo: '2000-01-01T00:00:00Z', label: 'Expired 10% off' },
  ONCE5: { kind: 'fixed', value: 500, limit: 1, label: '$5 off — one use total' },
}

function mockRule(code) {
  const p = MOCK_PROMOS[code]
  if (!p) return null
  return {
    couponId: `mock:${code}`,
    active: true,
    startDateTime: p.validFrom || null,
    endDateTime: p.validTo || null,
    promoActive: true,
    promoStart: null,
    promoEnd: null,
    kind: p.kind,
    value: p.value || 0,
    minSubtotalCents: p.minSubtotalCents || 0,
    limitAll: p.limit ?? null,
    limitPerBuyer: null,
    label: p.label,
  }
}

// ---- Shared evaluation (identical in both modes) ----

function withinWindow(now, start, end) {
  if (start && now < new Date(start).getTime()) return false
  if (end && now > new Date(end).getTime()) return false
  return true
}

/**
 * Turn a normalized rule + trusted subtotal into a discount, or throw a friendly
 * 400. Pure (no I/O) so mock and Salesforce share it exactly. `redeemed` is the
 * current redemption count (for limit checks); pass 0 when not enforcing.
 */
function evaluate(code, rule, subtotalCents, redeemed = 0) {
  if (!rule) throw badRequest(`“${code}” isn’t a valid code.`, 'promo_invalid')

  const now = Date.now()
  const couponLive = rule.active && withinWindow(now, rule.startDateTime, rule.endDateTime)
  const promoLive = rule.promoActive !== false && withinWindow(now, rule.promoStart, rule.promoEnd)
  if (!rule.active || rule.promoActive === false) {
    throw badRequest(`“${code}” is no longer available.`, 'promo_inactive')
  }
  if (!couponLive || !promoLive) {
    throw badRequest(`“${code}” has expired or isn’t active yet.`, 'promo_expired')
  }

  const subtotal = Math.max(0, Math.floor(Number(subtotalCents) || 0))
  if (rule.minSubtotalCents && subtotal < rule.minSubtotalCents) {
    const shortBy = ((rule.minSubtotalCents - subtotal) / 100).toFixed(2)
    throw badRequest(`Add $${shortBy} more to use ${code}.`, 'promo_min')
  }

  if (rule.limitAll != null && redeemed >= rule.limitAll) {
    throw badRequest(`“${code}” has reached its redemption limit.`, 'promo_limit')
  }

  let discountCents = 0
  let freeShipping = false
  if (rule.kind === 'percent') discountCents = Math.round(subtotal * (rule.value / 100))
  else if (rule.kind === 'fixed') discountCents = Math.min(rule.value, subtotal)
  else if (rule.kind === 'shipping') freeShipping = true

  return { code, couponId: rule.couponId, discountCents, freeShipping, label: rule.label }
}

// ---- Public API (async — reads Salesforce in salesforce mode) ----

/**
 * Validate a code against a trusted subtotal (cents). Throws a friendly 400 for
 * missing/invalid/inactive/expired/below-min/over-limit codes. `buyer` (optional)
 * enables the per-buyer limit pre-check for a logged-in shopper.
 */
export async function validatePromo(rawCode, subtotalCents, { buyer } = {}) {
  const code = String(rawCode || '').trim().toUpperCase()
  if (!code) throw badRequest('Enter a promo code.', 'promo_missing')

  if (!useSalesforce) {
    const rule = mockRule(code)
    return evaluate(code, rule, subtotalCents, mockRedemptions.get(code) || 0)
  }

  const rule = await sfPromos.getCouponRule(code)
  if (!rule) throw badRequest(`“${code}” isn’t a valid code.`, 'promo_invalid')
  // Count redemptions only when a limit is set (avoids an extra query otherwise).
  let redeemed = 0
  if (rule.limitAll != null) redeemed = await sfPromos.countRedemptions(rule.couponId)
  const result = evaluate(code, rule, subtotalCents, redeemed)
  // Per-buyer limit, when we know who's asking.
  if (rule.limitPerBuyer != null && buyer) {
    const mine = await sfPromos.countRedemptions(rule.couponId, buyer)
    if (mine >= rule.limitPerBuyer) {
      throw badRequest(`You’ve already used “${code}”.`, 'promo_limit')
    }
  }
  return result
}

/**
 * Apply an optional code during order creation. Neutral result when no code;
 * otherwise re-validates + recomputes (throws if the code went invalid/expired
 * between cart and checkout). Does NOT record the redemption — call
 * `recordPromoRedemption` after the order exists.
 */
export async function applyPromo(rawCode, subtotalCents, { buyer } = {}) {
  if (!rawCode) return { code: null, couponId: null, discountCents: 0, freeShipping: false, label: null }
  return validatePromo(rawCode, subtotalCents, { buyer })
}

/**
 * Record one redemption after an order is created. Best-effort — the caller
 * ignores failures so a redemption-tracking hiccup never fails a paid order.
 */
export async function recordPromoRedemption({ code, couponId, orderNumber, buyer }) {
  if (!code || !couponId || !orderNumber) return
  if (!useSalesforce) {
    mockRedemptions.set(code, (mockRedemptions.get(code) || 0) + 1)
    return
  }
  await sfPromos.recordRedemption({ couponId, orderNumber, buyer, code })
}
