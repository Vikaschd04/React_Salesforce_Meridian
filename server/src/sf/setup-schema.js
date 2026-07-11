/**
 * One-time schema setup for the parts the app creates via API rather than by
 * hand: web-order fields on Order and the permission set that makes them
 * visible to the integration user.
 *
 * Run:  DATA_SOURCE=salesforce node src/sf/setup-schema.js   (or: npm run sf:setup)
 *
 * Idempotent. Creates (if missing):
 *   - Order.Shopper__c      Lookup → Contact  (links an order to the shopper)
 *   - Order.Guest_Email__c  Email             (contact email for any web order)
 *   - Order.Cancelled__c    Checkbox          (web-order cancellation flag;
 *                            the org's standard Status picklist has no
 *                            "Cancelled" value, so we track it ourselves)
 *   - Permission Set "Meridian_Web_Integration" with FLS on those fields,
 *     assigned to the integration (Run-As) user.
 *
 * Note: creating metadata requires the integration user to have "Customize
 * Application". If it can't, create the fields manually and grant field access.
 */
import { config } from '../config.js'
import { withConn } from './client.js'

const PERM_SET = 'Meridian_Web_Integration'

// Field definitions in Metadata API shape. `probe` is the SOQL column used to
// detect existence/visibility.
const FIELDS = [
  {
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
    probe: 'Guest_Email__c',
    def: {
      fullName: 'Order.Guest_Email__c',
      label: 'Guest Email',
      type: 'Email',
    },
  },
  {
    probe: 'Cancelled__c',
    def: {
      fullName: 'Order.Cancelled__c',
      label: 'Cancelled',
      type: 'Checkbox',
      defaultValue: 'false',
    },
  },
  {
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
    probe: 'Promo_Code__c',
    def: {
      fullName: 'Order.Promo_Code__c',
      label: 'Promo Code',
      type: 'Text',
      length: 40,
    },
  },
  // ---- Payments + fulfillment lifecycle ----
  {
    probe: 'Payment_Status__c',
    def: {
      fullName: 'Order.Payment_Status__c',
      label: 'Payment Status',
      type: 'Picklist',
      valueSet: {
        valueSetDefinition: {
          sorted: false,
          value: [
            { fullName: 'Unpaid', default: true, label: 'Unpaid' },
            { fullName: 'Paid', default: false, label: 'Paid' },
            { fullName: 'Refunded', default: false, label: 'Refunded' },
          ],
        },
      },
    },
  },
  {
    probe: 'Payment_Intent__c',
    def: {
      fullName: 'Order.Payment_Intent__c',
      label: 'Payment Intent',
      type: 'Text',
      length: 64,
    },
  },
  {
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
    probe: 'Fulfillment_Status__c',
    def: {
      fullName: 'Order.Fulfillment_Status__c',
      label: 'Fulfillment Status',
      type: 'Picklist',
      valueSet: {
        valueSetDefinition: {
          sorted: false,
          value: [
            { fullName: 'Unfulfilled', default: true, label: 'Unfulfilled' },
            { fullName: 'Shipped', default: false, label: 'Shipped' },
            { fullName: 'Delivered', default: false, label: 'Delivered' },
          ],
        },
      },
    },
  },
  {
    probe: 'Tracking_Number__c',
    def: {
      fullName: 'Order.Tracking_Number__c',
      label: 'Tracking Number',
      type: 'Text',
      length: 64,
    },
  },
  {
    probe: 'Shipped_Date__c',
    def: {
      fullName: 'Order.Shipped_Date__c',
      label: 'Shipped Date',
      type: 'Date',
    },
  },
]

async function ensureField(conn, { probe, def }) {
  try {
    await conn.query(`SELECT ${probe} FROM Order LIMIT 1`)
    console.log(`  • Order.${probe} already present`)
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
    await ensurePermissions(conn)
  })
  console.log('Schema setup complete.')
}

main().catch((err) => {
  console.error('Setup failed:', err.message)
  process.exit(1)
})
