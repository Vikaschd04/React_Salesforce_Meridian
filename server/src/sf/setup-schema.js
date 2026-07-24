/**
 * One-time schema setup for the parts the app creates via API rather than by
 * hand: web-order fields on Order, the one company-account field on Account,
 * the Meridian_Product_Review__c custom object, and the permission set that makes all
 * of it visible to the integration user.
 *
 * Run:  DATA_SOURCE=salesforce node src/sf/setup-schema.js   (or: npm run sf:setup)
 *
 * Standard-first (see docs/SALESFORCE_CONVENTIONS.md): the order lifecycle uses
 * the STANDARD Order `Status` field — this step just adds the "Shipped" and
 * "Cancelled" values to it. Company buying uses the STANDARD `Account` object
 * and `Contact.AccountId`/`Order.AccountId` — the only new field is
 * `Account.Company_Domain__c`, the join key with no standard equivalent. Only
 * concepts with no standard equivalent on this org stay custom.
 *
 * Idempotent. Ensures:
 *   - Standard Order Status picklist has Shipped + Cancelled values
 *   - Custom Order fields with no standard equivalent: Shopper__c (Lookup→
 *     Contact), Guest_Email__c, Discount_Cents__c, Promo_Code__c,
 *     Shipping_Cents__c, Payment_Intent__c, Tracking_Number__c
 *   - Custom Account field: Company_Domain__c (join key for team buying)
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

// Field definitions in Metadata API shape. `probe` is the SOQL column used to
// detect existence/visibility; `sobject` is the object it lives on (Order
// unless noted).
const FIELDS = [
  {
    sobject: 'Order',
    probe: 'Shopper__c',
    def: {
      fullName: 'Order.Shopper__c',
      label: 'Shopper',
      type: 'Lookup',
      referenceTo: 'Contact',
      relationshipLabel: 'Web Orders',
      relationshipName: 'Web_Orders',
    },
  },
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
    probe: 'Discount_Cents__c',
    def: {
      fullName: 'Order.Discount_Cents__c',
      label: 'Discount Cents',
      type: 'Number',
      precision: 12,
      scale: 0,
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
    probe: 'Shipping_Cents__c',
    def: {
      fullName: 'Order.Shipping_Cents__c',
      label: 'Shipping Cents',
      type: 'Number',
      precision: 12,
      scale: 0,
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
  // ---- B2B: company accounts (no standard field for a domain join key) ----
  {
    sobject: 'Account',
    probe: 'Company_Domain__c',
    def: {
      fullName: 'Account.Company_Domain__c',
      label: 'Company Domain',
      type: 'Text',
      length: 120,
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

// ---- Wishlist (new junction custom object — no standard "wishlist" object
// on Sales Cloud; one row per saved (Contact, Product) pair). Same
// shell-then-fields pattern as reviews above. ----
const WISHLIST_OBJECT = 'Meridian_Wishlist_Item__c'
const WISHLIST_FIELDS = [
  {
    sobject: WISHLIST_OBJECT,
    probe: 'Contact__c',
    def: {
      fullName: `${WISHLIST_OBJECT}.Contact__c`,
      label: 'Shopper',
      type: 'Lookup',
      referenceTo: 'Contact',
      relationshipLabel: 'Wishlist Items',
      relationshipName: 'Meridian_Wishlist_Items',
    },
  },
  {
    sobject: WISHLIST_OBJECT,
    probe: 'Product__c',
    def: {
      fullName: `${WISHLIST_OBJECT}.Product__c`,
      label: 'Product',
      type: 'Lookup',
      referenceTo: 'Product2',
      relationshipLabel: 'Wishlist Items',
      relationshipName: 'Meridian_Wishlist_Items',
    },
  },
]

// ---- Saved addresses (custom object). The standard ContactPointAddress
// object exists on this org but its ParentId only accepts Account/Individual,
// not Contact (verified by a failed insert) — and our shoppers are Contacts.
// So a custom object, keyed to Contact, mirroring the app's shipping shape.
// State/Country are stored as ISO codes (Text), validated by the app's
// regions.js dropdowns, and flow into the Order's standard ShippingStateCode/
// ShippingCountryCode picklists at checkout. ----
const ADDRESS_OBJECT = 'Meridian_Address__c'
const T = (name, label, length) => ({
  sobject: ADDRESS_OBJECT,
  probe: name,
  def: { fullName: `${ADDRESS_OBJECT}.${name}`, label, type: 'Text', length },
})
const ADDRESS_FIELDS = [
  {
    sobject: ADDRESS_OBJECT,
    probe: 'Contact__c',
    def: {
      fullName: `${ADDRESS_OBJECT}.Contact__c`,
      label: 'Shopper',
      type: 'Lookup',
      referenceTo: 'Contact',
      relationshipLabel: 'Addresses',
      relationshipName: 'Meridian_Addresses',
    },
  },
  T('Label__c', 'Label', 80),
  T('Recipient_Name__c', 'Recipient Name', 120),
  T('Street__c', 'Street', 255),
  T('City__c', 'City', 80),
  T('State_Code__c', 'State Code', 10),
  T('Postal_Code__c', 'Postal Code', 20),
  T('Country_Code__c', 'Country Code', 10),
  {
    sobject: ADDRESS_OBJECT,
    probe: 'Is_Default__c',
    def: { fullName: `${ADDRESS_OBJECT}.Is_Default__c`, label: 'Is Default', type: 'Checkbox', defaultValue: false },
  },
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

async function ensureProductReviewObject(conn) {
  await ensureCustomObject(conn, {
    apiName: PRODUCT_REVIEW_OBJECT,
    label: 'Meridian Product Review',
    pluralLabel: 'Meridian Product Reviews',
    displayFormat: 'MPR-{0000}',
  })
}

async function ensureWishlistObject(conn) {
  await ensureCustomObject(conn, {
    apiName: WISHLIST_OBJECT,
    label: 'Meridian Wishlist Item',
    pluralLabel: 'Meridian Wishlist Items',
    displayFormat: 'MWL-{0000}',
  })
}

async function ensureAddressObject(conn) {
  await ensureCustomObject(conn, {
    apiName: ADDRESS_OBJECT,
    label: 'Meridian Address',
    pluralLabel: 'Meridian Addresses',
    displayFormat: 'MAD-{0000}',
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
  const fieldPermissions = [...FIELDS, ...PRODUCT_REVIEW_FIELDS, ...WISHLIST_FIELDS, ...ADDRESS_FIELDS].map(
    ({ def }) => ({ field: def.fullName, readable: true, editable: true }),
  )

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
    // Wishlist items get removed, so allowDelete: true here (unlike reviews).
    // Salesforce requires allowEdit whenever allowDelete is granted (a
    // FIELD_INTEGRITY dependency), even though the app never edits a row.
    {
      object: WISHLIST_OBJECT,
      allowRead: true,
      allowCreate: true,
      allowEdit: true,
      allowDelete: true,
      viewAllRecords: true,
      modifyAllRecords: false,
    },
    // Addresses are fully CRUD (add / edit / delete / set-default).
    {
      object: ADDRESS_OBJECT,
      allowRead: true,
      allowCreate: true,
      allowEdit: true,
      allowDelete: true,
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
    await ensureWishlistObject(conn)
    for (const field of WISHLIST_FIELDS) await ensureField(conn, field)
    await ensureAddressObject(conn)
    for (const field of ADDRESS_FIELDS) await ensureField(conn, field)
    await ensureOrderStatusValues(conn)
    await ensurePermissions(conn)
    await ensureOrderCdc(conn)
  })
  console.log('Schema setup complete.')
}

main().catch((err) => {
  console.error('Setup failed:', err.message)
  process.exit(1)
})
