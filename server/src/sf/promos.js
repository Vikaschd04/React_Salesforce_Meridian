/**
 * Promotions & coupons, read from the STANDARD Salesforce Commerce objects
 * (no custom schema): Coupon → Promotion, with the discount on PromotionTarget
 * and any min-subtotal on PromotionQualifier. Usage is tracked via
 * CouponCodeRedemption. A merchant creates/edits all of this in Salesforce
 * (code, discount, validity window/expiry, active flag, redemption limits) and
 * the storefront just reads + applies it — the discount itself is still computed
 * server-side against trusted prices in store/promos.js.
 *
 * See docs/DEVELOPER_GUIDE.md and docs/SALESFORCE_CONVENTIONS.md.
 */
import { withConn, getConnection } from './client.js'
import { createCache } from '../lib/cache.js'
import { round2 } from '../lib/totals.js'
import { config } from '../config.js'

const esc = (s) => String(s).replace(/'/g, "\\'")
// Coupon definitions change rarely — cache the resolved rule briefly. Usage
// counts are NEVER cached (they must be fresh to enforce limits).
const cache = createCache(config.cacheTtlMs)

let ownerId = null // integration user id, for CouponCodeRedemption.OwnerId
async function getOwnerId() {
  if (ownerId) return ownerId
  const conn = await getConnection()
  const id = await conn.identity()
  ownerId = id.user_id
  return ownerId
}

/**
 * Resolve a coupon code to a normalized rule, or null if there's no such coupon.
 * `{ couponId, active, startDateTime, endDateTime, promoActive, promoStart,
 *    promoEnd, kind, value, minSubtotal, limitAll, limitPerBuyer, label }`.
 * `kind` is 'percent' | 'fixed' | 'shipping'; `value` is a percent or USD dollars.
 */
export async function getCouponRule(rawCode) {
  const code = String(rawCode || '').trim().toUpperCase()
  if (!code) return null
  return cache.wrap(`coupon:${code}`, async () => {
    const coupon = await withConn((conn) =>
      conn.query(
        `SELECT Id, CouponCode, Status, StartDateTime, EndDateTime,
                RedemptionLimitAllBuyers, RedemptionLimitPerBuyer, PromotionId,
                Promotion.Name, Promotion.DisplayName, Promotion.Description,
                Promotion.IsActive, Promotion.StartDate, Promotion.EndDate
         FROM Coupon WHERE CouponCode = '${esc(code)}' LIMIT 1`,
      ),
    )
    const c = coupon.records[0]
    if (!c) return null

    const [targets, qualifiers] = await withConn((conn) =>
      Promise.all([
        conn.query(
          `SELECT TargetType, AdjustmentType, AdjustmentPercent, AdjustmentAmount
           FROM PromotionTarget WHERE PromotionId = '${c.PromotionId}'`,
        ),
        conn.query(
          `SELECT QualifierType, MinimumAmount FROM PromotionQualifier
           WHERE PromotionId = '${c.PromotionId}' AND QualifierType = 'TransactionTotal'`,
        ),
      ]),
    )

    // Map the standard adjustment → our internal discount shape.
    let kind = null
    let value = 0
    const shipTarget = targets.records.find((t) => t.TargetType === 'Shipping')
    const txnTarget = targets.records.find((t) => t.TargetType === 'Transaction')
    if (shipTarget) {
      kind = 'shipping'
    } else if (txnTarget) {
      if (txnTarget.AdjustmentType === 'PercentageDiscount') {
        kind = 'percent'
        value = Number(txnTarget.AdjustmentPercent || 0)
      } else if (String(txnTarget.AdjustmentType || '').startsWith('FixedAmountOff')) {
        kind = 'fixed'
        value = round2(txnTarget.AdjustmentAmount) // USD dollars
      }
    }

    const minAmount = qualifiers.records[0]?.MinimumAmount
    const label =
      c.Promotion?.DisplayName || c.Promotion?.Description || c.Promotion?.Name || 'Discount'

    return {
      couponId: c.Id,
      active: c.Status === 'Active',
      startDateTime: c.StartDateTime || null,
      endDateTime: c.EndDateTime || null,
      promoActive: c.Promotion?.IsActive === true,
      promoStart: c.Promotion?.StartDate || null,
      promoEnd: c.Promotion?.EndDate || null,
      kind,
      value,
      minSubtotal: minAmount != null ? round2(minAmount) : 0, // USD dollars
      limitAll: c.RedemptionLimitAllBuyers != null ? Number(c.RedemptionLimitAllBuyers) : null,
      limitPerBuyer: c.RedemptionLimitPerBuyer != null ? Number(c.RedemptionLimitPerBuyer) : null,
      label,
    }
  })
}

/** How many times this coupon has been redeemed (optionally by one buyer). Fresh, never cached. */
export async function countRedemptions(couponId, buyer = null) {
  const where = buyer
    ? `CouponId = '${esc(couponId)}' AND Buyer = '${esc(buyer)}'`
    : `CouponId = '${esc(couponId)}'`
  const res = await withConn((conn) =>
    conn.query(`SELECT COUNT() FROM CouponCodeRedemption WHERE ${where}`),
  )
  return res.totalSize
}

/** Record one redemption (best-effort; the caller ignores failures). */
export async function recordRedemption({ couponId, orderNumber, buyer, code }) {
  const owner = await getOwnerId()
  const name = `${code || 'PROMO'} · ${orderNumber}`.slice(0, 80)
  const res = await withConn((conn) =>
    conn.sobject('CouponCodeRedemption').create({
      OwnerId: owner,
      Name: name,
      CouponId: couponId,
      Transaction: String(orderNumber),
      Buyer: String(buyer || 'guest'),
    }),
  )
  if (!res.success) throw new Error('Failed to record CouponCodeRedemption.')
  return res.id
}
