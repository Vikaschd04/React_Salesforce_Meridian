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

  // 4. Order merchandise total — standard TotalAmount rollup (no custom field)
  try {
    await withConn((conn) => conn.query('SELECT TotalAmount FROM Order LIMIT 1'))
    ok('Order.TotalAmount (standard) is readable')
  } catch (err) {
    failures++
    bad(`Order.TotalAmount unreadable: ${err.message}`)
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

  // 4c. Custom Order fields (no standard equivalent) visible to Run-As
  try {
    await withConn((conn) =>
      conn.query(
        'SELECT Shopper__c, Guest_Email__c, Discount_Cents__c, Promo_Code__c, ' +
          'Shipping_Cents__c, Payment_Intent__c, Tracking_Number__c FROM Order LIMIT 1',
      ),
    )
    ok('Order custom fields (shopper/guest_email/promo/discount/shipping/payment/tracking) visible')
  } catch (err) {
    failures++
    bad(`Order custom fields missing/hidden: ${err.message}`)
    console.log('    → Run `npm run sf:setup` to create them and grant field access.')
  }

  // 4d. Standard Order Status carries the web lifecycle values (Shipped/Cancelled)
  try {
    const statuses = await withConn(async (conn) => {
      const meta = await conn.sobject('Order').describe()
      return meta.fields.find((f) => f.name === 'Status')?.picklistValues?.map((v) => v.value) || []
    })
    const missing = ['Shipped', 'Cancelled'].filter((s) => !statuses.includes(s))
    if (missing.length) {
      failures++
      bad(`Order Status picklist missing values: ${missing.join(', ')}`)
      console.log('    → Run `npm run sf:setup` to add them.')
    } else {
      ok('Order.Status has the web lifecycle values (Shipped, Cancelled)')
    }
  } catch (err) {
    failures++
    bad(`Could not read Order Status picklist: ${err.message}`)
  }

  // 4e. Company-account join field (B2B team buying), visible to Run-As
  try {
    await withConn((conn) => conn.query('SELECT Company_Domain__c FROM Account LIMIT 1'))
    ok('Account.Company_Domain__c exists and is visible')
  } catch (err) {
    failures++
    bad(`Account.Company_Domain__c missing/hidden: ${err.message}`)
    console.log('    → Run `npm run sf:setup` to create it and grant field access.')
  }

  // 4f. Meridian_Product_Review__c custom object (reviews/ratings), visible to Run-As
  try {
    await withConn((conn) =>
      conn.query('SELECT Id, Product__c, Contact__c, Rating__c, Title__c, Body__c, Reviewer_Name__c FROM Meridian_Product_Review__c LIMIT 1'),
    )
    ok('Meridian_Product_Review__c exists and is visible')
  } catch (err) {
    failures++
    bad(`Meridian_Product_Review__c missing/hidden: ${err.message}`)
    console.log('    → Run `npm run sf:setup` to create it and grant object/field access.')
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
