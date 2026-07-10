/**
 * Salesforce readiness check — a fast, read-only diagnostic to run after setup.
 *
 * Run:  DATA_SOURCE=salesforce node src/sf/check.js   (or: npm run sf:check)
 *
 * It authenticates and verifies each thing the BFF needs, printing a checklist
 * with exact remediation when something's missing. Makes no writes. This is the
 * env-guarded integration check referenced in PHASE_3.
 */
import { config } from '../config.js'
import { withConn } from './client.js'
import { PRODUCT_FIELDS } from './mappers.js'

const ok = (m) => console.log(`  ✓ ${m}`)
const bad = (m) => console.log(`  ✗ ${m}`)

async function main() {
  if (config.dataSource !== 'salesforce') {
    console.error('Set DATA_SOURCE=salesforce (and SF_* creds) before checking.')
    process.exit(1)
  }
  console.log(`Checking Salesforce readiness (${config.salesforce.loginUrl})…\n`)
  let failures = 0

  // 1. Auth
  try {
    await withConn((conn) => conn.identity())
    ok('Authenticated via Client Credentials flow')
  } catch (err) {
    bad(`Auth failed: ${err.message}`)
    console.log('\n    → Check SF_CLIENT_ID/SECRET and that the Connected App has')
    console.log('      Client Credentials enabled with a Run-As user.')
    process.exit(1)
  }

  // 2. Custom fields on Product2 (query them; a missing field errors)
  try {
    await withConn((conn) =>
      conn.query(`SELECT ${PRODUCT_FIELDS.join(', ')} FROM Product2 LIMIT 1`),
    )
    ok('Product2 has all required custom fields')
  } catch (err) {
    failures++
    bad(`Product2 fields missing/incorrect: ${err.message}`)
    console.log('    → Create the custom fields listed in docs/SALESFORCE_SETUP.md §1.')
  }

  // 3. Account for guest orders
  try {
    const name = config.salesforce.accountName.replace(/'/g, "\\'")
    const res = await withConn((conn) =>
      conn.query(`SELECT Id FROM Account WHERE Name = '${name}' LIMIT 1`),
    )
    if (res.records[0]) ok(`Account "${config.salesforce.accountName}" exists`)
    else {
      failures++
      bad(`Account "${config.salesforce.accountName}" not found`)
      console.log('    → Create it (docs §3) or run `npm run seed`.')
    }
  } catch (err) {
    failures++
    bad(`Account check failed: ${err.message}`)
  }

  // 4. Order custom fields
  try {
    await withConn((conn) => conn.query('SELECT Total_Cents__c FROM Order LIMIT 1'))
    ok('Order.Total_Cents__c exists')
  } catch (err) {
    failures++
    bad(`Order.Total_Cents__c missing: ${err.message}`)
    console.log('    → Add the custom field on Order (docs §3).')
  }

  // 4b. Contact password field (shopper auth)
  try {
    await withConn((conn) => conn.query('SELECT Password_Hash__c FROM Contact LIMIT 1'))
    ok('Contact.Password_Hash__c exists (shopper auth)')
  } catch (err) {
    failures++
    bad(`Contact.Password_Hash__c missing: ${err.message}`)
    console.log('    → Add the custom field on Contact (docs §3b).')
  }

  // 4c. Order → shopper link (order history), readable by the Run-As user
  try {
    await withConn((conn) => conn.query('SELECT Shopper__c FROM Order LIMIT 1'))
    ok('Order.Shopper__c exists and is visible (order history)')
  } catch (err) {
    failures++
    bad(`Order.Shopper__c missing/hidden: ${err.message}`)
    console.log('    → Run `npm run sf:setup` to create it and grant field access.')
  }

  // 5. Active products with a standard price
  try {
    const res = await withConn((conn) =>
      conn.query(
        `SELECT Id, (SELECT UnitPrice FROM PricebookEntries WHERE Pricebook2.IsStandard = true)
         FROM Product2 WHERE IsActive = true`,
      ),
    )
    const priced = res.records.filter((r) => r.PricebookEntries?.records?.length)
    if (priced.length > 0) ok(`${priced.length} active product(s) with a standard price`)
    else {
      failures++
      bad('No active products with a standard price')
      console.log('    → Create products + pricebook entries (docs §2) or run `npm run seed`.')
    }
  } catch (err) {
    failures++
    bad(`Product query failed: ${err.message}`)
  }

  console.log('')
  if (failures === 0) {
    console.log('All checks passed. Set DATA_SOURCE=salesforce and restart the BFF.')
  } else {
    console.log(`${failures} check(s) failed — fix the items above, then re-run.`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Check failed:', err.message)
  process.exit(1)
})
