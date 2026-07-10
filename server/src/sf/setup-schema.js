/**
 * One-time schema setup for the parts the app creates via API rather than by
 * hand: the Order → Contact link used for shopper order history.
 *
 * Run:  DATA_SOURCE=salesforce node src/sf/setup-schema.js   (or: npm run sf:setup)
 *
 * Idempotent. Creates:
 *   - Order.Shopper__c  (Lookup to Contact) — links an order to the shopper.
 *   - Permission Set "Meridian_Web_Integration" with FLS on that field, assigned
 *     to the integration (Run-As) user so the BFF can read/write it.
 *
 * Note: creating metadata requires the integration user to have "Customize
 * Application"/"Modify Metadata". If it can't, create Order.Shopper__c manually
 * (Lookup → Contact) and grant the Run-As user field access.
 */
import { config } from '../config.js'
import { withConn } from './client.js'

const PERM_SET = 'Meridian_Web_Integration'

async function ensureField(conn) {
  try {
    await conn.query('SELECT Shopper__c FROM Order LIMIT 1')
    console.log('  • Order.Shopper__c already present')
    return
  } catch {
    // Not visible/missing — (re)create it.
  }
  const res = await conn.metadata.create('CustomField', [
    {
      fullName: 'Order.Shopper__c',
      label: 'Shopper',
      type: 'Lookup',
      referenceTo: 'Contact',
      relationshipLabel: 'Web Orders',
      relationshipName: 'Web_Orders',
    },
  ])
  const r = Array.isArray(res) ? res[0] : res
  if (!r.success && !/duplicate|already/i.test(JSON.stringify(r.errors))) {
    throw new Error(`Could not create Order.Shopper__c: ${JSON.stringify(r.errors)}`)
  }
  console.log('  • Created Order.Shopper__c (Lookup → Contact)')
}

async function ensurePermissions(conn) {
  // Create the permission set (ignore "already exists").
  const res = await conn.metadata.create('PermissionSet', [
    {
      fullName: PERM_SET,
      label: 'Meridian Web Integration',
      fieldPermissions: [{ field: 'Order.Shopper__c', readable: true, editable: true }],
    },
  ])
  const r = Array.isArray(res) ? res[0] : res
  if (r.success) console.log('  • Created permission set', PERM_SET)
  else console.log('  • Permission set already exists')

  // Ensure the field permission is present even if the set pre-existed.
  await conn.metadata
    .update('PermissionSet', [
      {
        fullName: PERM_SET,
        label: 'Meridian Web Integration',
        fieldPermissions: [{ field: 'Order.Shopper__c', readable: true, editable: true }],
      },
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
    await ensureField(conn)
    await ensurePermissions(conn)
  })
  console.log('Schema setup complete.')
}

main().catch((err) => {
  console.error('Setup failed:', err.message)
  process.exit(1)
})
