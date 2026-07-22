/**
 * One-time schema setup for the parts the app creates via API rather than by
 * hand: web-order fields on Order, the one company-account field on Account,
 * and the permission set that makes them visible to the integration user.
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
const ORDER_STATUS_ADDITIONS = [
  { fullName: 'Shipped', label: 'Shipped', groupingString: 'Activated' },
  { fullName: 'Cancelled', label: 'Cancelled', groupingString: 'Canceled' },
]

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
  const have = new Set(values.map((v) => v.fullName))
  const additions = ORDER_STATUS_ADDITIONS.filter((a) => !have.has(a.fullName)).map((a) => ({
    ...a,
    default: false,
  }))
  if (!additions.length) {
    console.log('  • Order Status values (Shipped/Cancelled) already present')
    return
  }
  const res = await conn.metadata.update('StandardValueSet', {
    fullName: 'OrderStatus',
    standardValue: [...values, ...additions],
  })
  const r = Array.isArray(res) ? res[0] : res
  if (!r.success) throw new Error(`Could not extend Order Status picklist: ${JSON.stringify(r.errors)}`)
  console.log(`  • Added Order Status values: ${additions.map((a) => a.fullName).join(', ')}`)
}

async function ensurePermissions(conn) {
  const fieldPermissions = FIELDS.map(({ def }) => ({
    field: def.fullName,
    readable: true,
    editable: true,
  }))

  // Create the permission set (ignore "already exists").
  const res = await conn.metadata.create('PermissionSet', [
    { fullName: PERM_SET, label: 'Meridian Web Integration', fieldPermissions },
  ])
  const r = Array.isArray(res) ? res[0] : res
  if (r.success) console.log('  • Created permission set', PERM_SET)
  else console.log('  • Permission set already exists')

  // Ensure every field permission is present even if the set pre-existed.
  await conn.metadata
    .update('PermissionSet', [
      { fullName: PERM_SET, label: 'Meridian Web Integration', fieldPermissions },
    ])
    .catch(() => {})

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

async function main() {
  if (config.dataSource !== 'salesforce') {
    console.error('Set DATA_SOURCE=salesforce (and SF_* creds) before running setup.')
    process.exit(1)
  }
  console.log(`Setting up Meridian schema (${config.salesforce.loginUrl})…`)
  await withConn(async (conn) => {
    for (const field of FIELDS) await ensureField(conn, field)
    await ensureOrderStatusValues(conn)
    await ensurePermissions(conn)
  })
  console.log('Schema setup complete.')
}

main().catch((err) => {
  console.error('Setup failed:', err.message)
  process.exit(1)
})
