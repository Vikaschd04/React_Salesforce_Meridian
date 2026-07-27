/**
 * One-time schema setup for the parts the app creates via API rather than by
 * hand: the remaining web-order custom fields on Order, the Product Review
 * custom object, Order Change Data Capture, and the permission set that makes
 * all of it (plus the standard objects we use) visible to the integration user.
 *
 * Run:  DATA_SOURCE=salesforce node src/sf/setup-schema.js   (or: npm run sf:setup)
 *
 * Standard-first (see docs/SALESFORCE_CONVENTIONS.md): the order lifecycle uses
 * the STANDARD Order `Status` field — this step just adds the "Shipped" and
 * "Cancelled" values to it. A registered shopper's orders link via the STANDARD
 * `Order.AccountId` (their own Person Account); guests land on the shared
 * "Meridian Web Orders" `Account`. Only concepts with no standard equivalent
 * stay custom.
 *
 * Idempotent. Ensures:
 *   - Standard Order Status picklist has Shipped + Cancelled values
 *   - Custom Order fields with no standard equivalent: Guest_Email__c,
 *     Discount__c, Promo_Code__c, Shipping_Amount__c, Payment_Intent__c,
 *     Tracking_Number__c (the shopper↔order link is standard Order.AccountId)
 *   - Permission Set "Meridian_Web_Integration" with FLS on those custom fields,
 *     assigned to the integration (Run-As) user.
 *
 * Note: creating metadata requires the integration user to have "Customize
 * Application". If it can't, create the fields / picklist values manually and
 * grant field access.
 */
import { config } from '../config.js'
import { withConn } from './client.js'

const PERM_SET = 'Meridian_Web_Integration'
// OMS: the app builds an OrderSummary per order (sf/orderSummary.js). The
// standard "Delivery Charge" line references a shipping Product2; an
// OrderDeliveryMethod points at it. Names/codes are stable + resolved at runtime.
export const SHIPPING_PRODUCT_CODE = 'meridian-shipping'
export const DELIVERY_METHOD_NAME = 'Meridian Standard Shipping'

// Field definitions in Metadata API shape. `probe` is the SOQL column used to
// detect existence/visibility; `sobject` is the object it lives on (Order
// unless noted).
const FIELDS = [
  // The shopper↔order link is the STANDARD Order.AccountId (a registered
  // shopper's own Person Account) — no custom Shopper__c field. Guests land on
  // the shared account and are tracked by Guest_Email__c below.
  {
    sobject: 'Order',
    probe: 'Guest_Email__c',
    def: {
      fullName: 'Order.Guest_Email__c',
      label: 'Guest Email',
      type: 'Email',
    },
  },
  {
    sobject: 'Order',
    probe: 'Discount__c',
    def: {
      fullName: 'Order.Discount__c',
      label: 'Discount',
      type: 'Currency',
      precision: 12,
      scale: 2,
    },
  },
  {
    sobject: 'Order',
    probe: 'Promo_Code__c',
    def: {
      fullName: 'Order.Promo_Code__c',
      label: 'Promo Code',
      type: 'Text',
      length: 40,
    },
  },
  // ---- Payments (no standard order-level equivalents on this org) ----
  {
    sobject: 'Order',
    probe: 'Payment_Intent__c',
    def: {
      fullName: 'Order.Payment_Intent__c',
      label: 'Payment Intent',
      type: 'Text',
      length: 64,
    },
  },
  {
    sobject: 'Order',
    probe: 'Shipping_Amount__c',
    def: {
      fullName: 'Order.Shipping_Amount__c',
      label: 'Shipping Amount',
      type: 'Currency',
      precision: 12,
      scale: 2,
    },
  },
  {
    sobject: 'Order',
    probe: 'Tracking_Number__c',
    def: {
      fullName: 'Order.Tracking_Number__c',
      label: 'Tracking Number',
      type: 'Text',
      length: 64,
    },
  },
]

// Values we add to the STANDARD Order `Status` picklist so the whole lifecycle
// rides the standard field. groupingString maps each to a StatusCode category.
// NOTE on `Cancelled` → groupingString 'Draft' (not 'Canceled'):
// Salesforce's 'Canceled' StatusCode is reserved for order amendments/reduction
// orders and can't be set through an ordinary Order update — trying it fails
// with ENTITY_IS_LOCKED ("You don't have permission to edit or delete an
// activated order"), even when the order is already in Draft. Grouping our
// Cancelled value under 'Draft' makes it a normal deactivation, which works.
// The app never reads StatusCode — orderStatus() keys off Status — so this is
// purely about what Salesforce will accept.
const ORDER_STATUS_ADDITIONS = [
  { fullName: 'Shipped', label: 'Shipped', groupingString: 'Activated' },
  { fullName: 'Cancelled', label: 'Cancelled', groupingString: 'Draft' },
]

// ---- Product reviews (new custom object — no standard equivalent on this
// Sales Cloud org; reviews are a Commerce Cloud B2C concept, not present
// here). NOTE: inline `fields` on a CustomObject metadata.create call looked
// like it worked (top-level `success: true`) but silently created ZERO of
// the fields — confirmed by describing the object afterward. Create the
// object shell first, then each field as its own CustomField call, exactly
// like every other custom field in this file (ensureField below). ----
const PRODUCT_REVIEW_OBJECT = 'Meridian_Product_Review__c'
const PRODUCT_REVIEW_FIELDS = [
  {
    sobject: PRODUCT_REVIEW_OBJECT,
    probe: 'Product__c',
    def: {
      fullName: `${PRODUCT_REVIEW_OBJECT}.Product__c`,
      label: 'Product',
      type: 'Lookup',
      referenceTo: 'Product2',
      relationshipLabel: 'Product Reviews',
      relationshipName: 'Meridian_Product_Reviews',
    },
  },
  {
    sobject: PRODUCT_REVIEW_OBJECT,
    probe: 'Contact__c',
    def: {
      fullName: `${PRODUCT_REVIEW_OBJECT}.Contact__c`,
      label: 'Reviewer',
      type: 'Lookup',
      referenceTo: 'Contact',
      relationshipLabel: 'Product Reviews',
      relationshipName: 'Meridian_Product_Reviews',
    },
  },
  {
    sobject: PRODUCT_REVIEW_OBJECT,
    probe: 'Rating__c',
    def: { fullName: `${PRODUCT_REVIEW_OBJECT}.Rating__c`, label: 'Rating', type: 'Number', precision: 1, scale: 0 },
  },
  {
    sobject: PRODUCT_REVIEW_OBJECT,
    probe: 'Title__c',
    def: { fullName: `${PRODUCT_REVIEW_OBJECT}.Title__c`, label: 'Title', type: 'Text', length: 120 },
  },
  {
    sobject: PRODUCT_REVIEW_OBJECT,
    probe: 'Body__c',
    def: {
      fullName: `${PRODUCT_REVIEW_OBJECT}.Body__c`,
      label: 'Body',
      type: 'LongTextArea',
      length: 4000,
      visibleLines: 5,
    },
  },
  {
    sobject: PRODUCT_REVIEW_OBJECT,
    probe: 'Reviewer_Name__c',
    def: { fullName: `${PRODUCT_REVIEW_OBJECT}.Reviewer_Name__c`, label: 'Reviewer Name', type: 'Text', length: 120 },
  },
]

// ---- Wishlist now uses the STANDARD `Wishlist` + `WishlistItem` objects (no
// custom schema). A shopper's Wishlist is parented to their Person Account + a
// WebStore (which the standard object requires); saved products are WishlistItem
// rows. We only grant object CRUD in ensurePermissions(). See sf/wishlist.js. ----

// ---- Saved addresses now use the STANDARD `ContactPointAddress` object (no
// custom schema). It parents to the shopper's Person Account (registered
// shoppers are Person Accounts, which CPA accepts — a bare Contact was
// rejected, which is why this used to be a custom object). We only grant object
// CRUD + FLS on the one required custom flag another integration added to it;
// the standard address fields are already visible. See sf/addresses.js. ----
const CONTACT_POINT_ADDRESS = 'ContactPointAddress'
// This org has a required custom checkbox on ContactPointAddress from a separate
// (SAP) integration — the integration user needs field access to set it on create.
const CPA_FIELD_PERMISSIONS = [
  { field: 'ContactPointAddress.received_from_SAP__c', readable: true, editable: true },
]

/**
 * Create a custom object SHELL (no fields — fields are created separately via
 * ensureField). Inline `fields` on a CustomObject create silently no-op, so we
 * never use them. Idempotent: probes for the object first.
 */
async function ensureCustomObject(conn, { apiName, label, pluralLabel, displayFormat }) {
  try {
    await conn.query(`SELECT Id FROM ${apiName} LIMIT 1`)
    console.log(`  • ${apiName} already present`)
    return
  } catch {
    // Missing — create the object shell; fields are created separately below.
  }
  const res = await conn.metadata.create('CustomObject', [
    {
      fullName: apiName,
      label,
      pluralLabel,
      nameField: { type: 'AutoNumber', label: 'Number', displayFormat },
      deploymentStatus: 'Deployed',
      sharingModel: 'ReadWrite',
    },
  ])
  const r = Array.isArray(res) ? res[0] : res
  if (!r.success) {
    throw new Error(`Could not create ${apiName}: ${JSON.stringify(r.errors)}`)
  }
  console.log(`  • Created ${apiName}`)
}

// OMS catalog + stock the org's B2B stock field so activation never blocks.
async function ensureOmsCatalog(conn) {
  const pb = await conn.query('SELECT Id FROM Pricebook2 WHERE IsStandard = true LIMIT 1')
  const pricebookId = pb.records[0]?.Id
  if (!pricebookId) {
    console.log('  ! No standard pricebook — skipping OMS shipping catalog')
    return
  }
  // Shipping Product2 (referenced by the OMS 'Delivery Charge' line).
  let prod = await conn.query(
    `SELECT Id FROM Product2 WHERE ProductCode = '${SHIPPING_PRODUCT_CODE}' LIMIT 1`,
  )
  let prodId = prod.records[0]?.Id
  if (!prodId) {
    prodId = (
      await conn.sobject('Product2').create({
        Name: 'Meridian Shipping',
        ProductCode: SHIPPING_PRODUCT_CODE,
        IsActive: true,
      })
    ).id
    console.log('  • Created shipping Product2')
  } else console.log('  • Shipping Product2 already present')
  // A $0 standard PricebookEntry so the line is a valid OrderItem (the real
  // shipping amount is set on the line's UnitPrice at order time).
  const pbe = await conn.query(
    `SELECT Id FROM PricebookEntry WHERE Pricebook2Id='${pricebookId}' AND Product2Id='${prodId}' LIMIT 1`,
  )
  if (!pbe.records[0]) {
    await conn.sobject('PricebookEntry').create({
      Pricebook2Id: pricebookId, Product2Id: prodId, UnitPrice: 0, IsActive: true,
    })
    console.log('  • Created shipping PricebookEntry')
  } else console.log('  • Shipping PricebookEntry already present')
  // OrderDeliveryMethod for the delivery group.
  const dm = await conn.query(
    `SELECT Id FROM OrderDeliveryMethod WHERE Name = '${DELIVERY_METHOD_NAME.replace(/'/g, "\\'")}' LIMIT 1`,
  )
  if (!dm.records[0]) {
    await conn.sobject('OrderDeliveryMethod').create({ Name: DELIVERY_METHOD_NAME, ProductId: prodId })
    console.log('  • Created OrderDeliveryMethod')
  } else console.log('  • OrderDeliveryMethod already present')
  // The org's B2B_UpdateStockOnOrder trigger decrements Product2.Available_Qty__c
  // on activation for Type='Order Product' items and throws if short — which our
  // OMS orders use. Keep Meridian products well-stocked on that field so a paid
  // order always activates (our real stock lives in Stock__c, unaffected).
  const low = await conn.query(
    'SELECT Id FROM Product2 WHERE Origin__c != null AND (Available_Qty__c = null OR Available_Qty__c < 1000)',
  )
  if (low.records.length) {
    await conn.sobject('Product2').update(low.records.map((r) => ({ Id: r.Id, Available_Qty__c: 100000 })))
    console.log(`  • Stocked Available_Qty__c on ${low.records.length} Meridian product(s)`)
  } else console.log('  • Meridian products already stocked (Available_Qty__c)')
}

async function ensureProductReviewObject(conn) {
  await ensureCustomObject(conn, {
    apiName: PRODUCT_REVIEW_OBJECT,
    label: 'Meridian Product Review',
    pluralLabel: 'Meridian Product Reviews',
    displayFormat: 'MPR-{0000}',
  })
}

async function ensureField(conn, { sobject, probe, def }) {
  try {
    await conn.query(`SELECT ${probe} FROM ${sobject} LIMIT 1`)
    console.log(`  • ${sobject}.${probe} already present`)
    return
  } catch {
    // Not visible/missing — (re)create it.
  }
  const res = await conn.metadata.create('CustomField', [def])
  const r = Array.isArray(res) ? res[0] : res
  if (!r.success && !/duplicate|already/i.test(JSON.stringify(r.errors))) {
    throw new Error(`Could not create ${def.fullName}: ${JSON.stringify(r.errors)}`)
  }
  console.log(`  • Created ${def.fullName} (${def.type})`)
}

/** Add Shipped/Cancelled to the standard Order Status picklist (idempotent). */
async function ensureOrderStatusValues(conn) {
  const read = await conn.metadata.read('StandardValueSet', 'OrderStatus')
  const vs = Array.isArray(read) ? read[0] : read
  const values = vs.standardValue || []
  const byName = new Map(values.map((v) => [v.fullName, v]))

  // Add any missing value, and correct one whose groupingString drifted (an
  // earlier version of this script mapped Cancelled to 'Canceled', which made
  // cancellation fail at runtime — this repairs such an org in place).
  const added = []
  const fixed = []
  const desired = [...values]
  for (const want of ORDER_STATUS_ADDITIONS) {
    const existing = byName.get(want.fullName)
    if (!existing) {
      desired.push({ ...want, default: false })
      added.push(want.fullName)
    } else if (existing.groupingString !== want.groupingString) {
      const i = desired.findIndex((v) => v.fullName === want.fullName)
      desired[i] = { ...existing, groupingString: want.groupingString }
      fixed.push(`${want.fullName}→${want.groupingString}`)
    }
  }

  if (!added.length && !fixed.length) {
    console.log('  • Order Status values (Shipped/Cancelled) already correct')
    return
  }
  const res = await conn.metadata.update('StandardValueSet', {
    fullName: 'OrderStatus',
    standardValue: desired,
  })
  const r = Array.isArray(res) ? res[0] : res
  if (!r.success) throw new Error(`Could not update Order Status picklist: ${JSON.stringify(r.errors)}`)
  if (added.length) console.log(`  • Added Order Status values: ${added.join(', ')}`)
  if (fixed.length) console.log(`  • Corrected Order Status grouping: ${fixed.join(', ')}`)
}

async function ensurePermissions(conn) {
  const fieldPermissions = [...FIELDS, ...PRODUCT_REVIEW_FIELDS]
    .map(({ def }) => ({ field: def.fullName, readable: true, editable: true }))
    .concat(CPA_FIELD_PERMISSIONS)
    // OMS: the app builds an OrderSummary per order (sf/orderSummary.js), which
    // needs each source OrderItem assigned to an OrderDeliveryGroup. That standard
    // field is FLS-hidden from the integration user by default — grant it. (The
    // OMS objects themselves are already reachable via the user's profile.)
    .concat([{ field: 'OrderItem.OrderDeliveryGroupId', readable: true, editable: true }])

  // Salesforce LOCKS activated orders: once Status maps to the 'Activated'
  // StatusCode, the record can't be edited without this permission. Cancelling
  // moves an order to the 'Canceled' StatusCode category, which counts as
  // editing a locked order — so without this the cancel fails with
  // ENTITY_IS_LOCKED ("You don't have permission to edit or delete an
  // activated order"). Advancing Activated→Shipped/Completed does NOT need it,
  // since those stay inside the same 'Activated' category.
  // Salesforce enforces a dependency chain here: EditActivatedOrders requires
  // ActivateOrder, and both require Read+Edit object permissions on Order — so
  // all of them have to be granted together or the deploy is rejected with
  // FIELD_INTEGRITY_EXCEPTION ("depends on permission(s): …").
  const userPermissions = [
    { enabled: true, name: 'ActivateOrder' },
    { enabled: true, name: 'EditActivatedOrders' },
  ]
  const objectPermissions = [
    {
      object: 'Order',
      allowRead: true,
      allowCreate: true,
      allowEdit: true,
      allowDelete: false,
      viewAllRecords: false,
      modifyAllRecords: false,
    },
    // viewAllRecords: true — the integration user must read every shopper's
    // reviews (for aggregate rating + the review list), not just ones it
    // created itself; reviews are never edited/deleted by the app.
    {
      object: PRODUCT_REVIEW_OBJECT,
      allowRead: true,
      allowCreate: true,
      allowEdit: false,
      allowDelete: false,
      viewAllRecords: true,
      modifyAllRecords: false,
    },
    // Wishlist/ContactPointAddress are parented to Account (+ WebStore for
    // Wishlist), and Salesforce enforces that granting Read on them requires Read
    // on those parents — so grant the parents Read here. (The integration user
    // already creates person accounts at signup; this just satisfies the
    // permission-set dependency chain so the deploy is accepted.)
    // (Account Read itself depends on Contact Read — person accounts — so Contact
    // is granted here too.)
    ...['Contact', 'Account', 'WebStore'].map((object) => ({
      object,
      allowRead: true,
      allowCreate: false,
      allowEdit: false,
      allowDelete: false,
      viewAllRecords: false,
      modifyAllRecords: false,
    })),
    // Wishlist — standard Wishlist + WishlistItem. Items are added/removed, so
    // allowDelete: true (Salesforce requires allowEdit alongside allowDelete).
    // No viewAllRecords: the integration user OWNS every row it creates, so
    // Read(own) is enough (and viewAll would drag in View All Account/WebStore).
    ...['Wishlist', 'WishlistItem'].map((object) => ({
      object,
      allowRead: true,
      allowCreate: true,
      allowEdit: true,
      allowDelete: true,
      viewAllRecords: false,
      modifyAllRecords: false,
    })),
    // Saved addresses — standard ContactPointAddress, fully CRUD
    // (add / edit / delete / set-default). No viewAllRecords — the integration
    // user owns the rows it creates (and viewAll would require View All Account).
    {
      object: CONTACT_POINT_ADDRESS,
      allowRead: true,
      allowCreate: true,
      allowEdit: true,
      allowDelete: true,
      viewAllRecords: false,
      modifyAllRecords: false,
    },
    // Promotions/coupons (standard Commerce objects) — the app READS the promo
    // definition (a merchant creates/edits it in Salesforce). viewAllRecords so
    // coupons created by any user are visible to the integration user.
    ...['Promotion', 'Coupon', 'PromotionTarget', 'PromotionQualifier'].map((object) => ({
      object,
      allowRead: true,
      allowCreate: true,
      allowEdit: true,
      allowDelete: false,
      viewAllRecords: true,
      modifyAllRecords: false,
    })),
    // Redemptions are written on each promo order + counted for usage limits.
    {
      object: 'CouponCodeRedemption',
      allowRead: true,
      allowCreate: true,
      allowEdit: false,
      allowDelete: false,
      viewAllRecords: true,
      modifyAllRecords: false,
    },
  ]
  const permSetBody = {
    fullName: PERM_SET,
    label: 'Meridian Web Integration',
    fieldPermissions,
    objectPermissions,
    userPermissions,
  }

  // Create the permission set (ignore "already exists").
  const res = await conn.metadata.create('PermissionSet', [permSetBody])
  const r = Array.isArray(res) ? res[0] : res
  if (r.success) console.log('  • Created permission set', PERM_SET)
  else console.log('  • Permission set already exists')

  // Ensure every field/object/user permission is present even if the set
  // pre-existed. Surface failures — silently swallowing them once hid a missing
  // EditActivatedOrders grant, which made order cancellation fail at runtime.
  const upd = await conn.metadata.update('PermissionSet', [permSetBody]).catch((e) => {
    console.warn('  ! Permission set update failed:', e.message, JSON.stringify(e.data || ''))
    return null
  })
  const u = Array.isArray(upd) ? upd[0] : upd
  if (u?.success) {
    console.log('  • Permission set updated (fields + Order access + Edit Activated Orders)')
  } else if (u && !u.success) {
    console.warn('  ! Permission set update rejected:', JSON.stringify(u.errors))
  }

  // Assign to the Run-As user.
  const id = await conn.identity()
  const ps = await conn.query(`SELECT Id FROM PermissionSet WHERE Name = '${PERM_SET}' LIMIT 1`)
  const psId = ps.records[0]?.Id
  if (!psId) throw new Error('Permission set not found after creation.')

  const existing = await conn.query(
    `SELECT Id FROM PermissionSetAssignment WHERE PermissionSetId = '${psId}' AND AssigneeId = '${id.user_id}' LIMIT 1`,
  )
  if (existing.records[0]) {
    console.log('  • Permission set already assigned to', id.username)
    return
  }
  await conn.sobject('PermissionSetAssignment').create({ AssigneeId: id.user_id, PermissionSetId: psId })
  console.log('  • Assigned permission set to', id.username)
}

// Enable Change Data Capture for Order by adding it to the standard
// `ChangeEvents` channel (a PlatformEventChannelMember metadata component). This
// is what lets the BFF subscribe to /data/OrderChangeEvent and stream live
// order-status changes to shoppers. Idempotent + non-fatal: if it's already a
// member, or the deploy is rejected, real-time simply stays off and the app
// falls back to the order page's focus-refresh + Refresh button.
const CDC_MEMBER = 'ChangeEvents_OrderChangeEvent'
async function ensureOrderCdc(conn) {
  try {
    const existing = await conn.metadata.read('PlatformEventChannelMember', [CDC_MEMBER])
    if (Array.isArray(existing) ? existing[0]?.fullName : existing?.fullName) {
      console.log('  • Order CDC already enabled')
      return
    }
  } catch {
    // read failed (not present / not readable) — fall through to create
  }
  try {
    const res = await conn.metadata.create('PlatformEventChannelMember', [
      { fullName: CDC_MEMBER, eventChannel: 'ChangeEvents', selectedEntity: 'OrderChangeEvent' },
    ])
    const r = Array.isArray(res) ? res[0] : res
    if (r?.success || /already/i.test(JSON.stringify(r?.errors || ''))) {
      console.log('  • Enabled Order CDC (live order updates)')
    } else {
      console.warn(`  ! Could not enable Order CDC (real-time off): ${JSON.stringify(r?.errors)}`)
    }
  } catch (err) {
    console.warn(`  ! Could not enable Order CDC (real-time off): ${err.message}`)
  }
}

// Seed the demo promo codes into the STANDARD Commerce objects
// (Promotion → Coupon → PromotionTarget [+ PromotionQualifier]). Idempotent:
// probes each Coupon by code first. A merchant can add/edit more in Salesforce
// (code, discount, validity/expiry, active flag, redemption limits); the app
// reads them (see sf/promos.js). Non-fatal.
const DEMO_PROMOS = [
  {
    code: 'WELCOME10',
    name: 'Welcome 10% Off',
    display: '10% off your order',
    target: { TargetType: 'Transaction', AdjustmentType: 'PercentageDiscount', AdjustmentPercent: 10 },
  },
  {
    code: 'MERIDIAN5',
    name: 'Meridian $5 Off Over $25',
    display: '$5 off orders over $25',
    target: { TargetType: 'Transaction', AdjustmentType: 'FixedAmountOffTransaction', AdjustmentAmount: 5 },
    minAmount: 25,
  },
  {
    code: 'FREESHIP',
    name: 'Free Shipping',
    display: 'Free shipping',
    target: { TargetType: 'Shipping', AdjustmentType: 'PercentageDiscount', AdjustmentPercent: 100 },
  },
]

async function ensurePromotions(conn) {
  const today = new Date().toISOString().slice(0, 10)
  for (const p of DEMO_PROMOS) {
    const existing = await conn.query(
      `SELECT Id FROM Coupon WHERE CouponCode = '${p.code}' LIMIT 1`,
    )
    if (existing.records[0]) {
      console.log(`  • Coupon ${p.code} already present`)
      continue
    }
    try {
      const promo = await conn.sobject('Promotion').create({
        Name: p.name,
        DisplayName: p.display,
        Description: p.display,
        IsActive: true,
        StartDate: today,
      })
      if (!promo.success) throw new Error(JSON.stringify(promo.errors))
      await conn.sobject('Coupon').create({
        PromotionId: promo.id,
        CouponCode: p.code,
        Status: 'Active',
      })
      await conn.sobject('PromotionTarget').create({
        PromotionId: promo.id,
        ...p.target,
        TargetRuleCriteriaType: 'All',
        TargetOperator: 'NONE',
      })
      if (p.minAmount) {
        await conn.sobject('PromotionQualifier').create({
          PromotionId: promo.id,
          QualifierType: 'TransactionTotal',
          MinimumAmount: p.minAmount,
          QualifierRuleCriteriaType: 'All',
          QualifierOperator: 'NONE',
        })
      }
      console.log(`  • Seeded coupon ${p.code}`)
    } catch (err) {
      console.warn(`  ! Could not seed coupon ${p.code}: ${err.message}`)
    }
  }
}

async function main() {
  if (config.dataSource !== 'salesforce') {
    console.error('Set DATA_SOURCE=salesforce (and SF_* creds) before running setup.')
    process.exit(1)
  }
  console.log(`Setting up Meridian schema (${config.salesforce.loginUrl})…`)
  await withConn(async (conn) => {
    for (const field of FIELDS) await ensureField(conn, field)
    await ensureProductReviewObject(conn)
    for (const field of PRODUCT_REVIEW_FIELDS) await ensureField(conn, field)
    // Wishlist + saved addresses use standard objects (Wishlist/WishlistItem and
    // ContactPointAddress) — no custom object to create; access is granted in
    // ensurePermissions().
    await ensureOrderStatusValues(conn)
    await ensureOmsCatalog(conn)
    await ensurePermissions(conn)
    await ensureOrderCdc(conn)
    await ensurePromotions(conn)
  })
  console.log('Schema setup complete.')
}

main().catch((err) => {
  console.error('Setup failed:', err.message)
  process.exit(1)
})
