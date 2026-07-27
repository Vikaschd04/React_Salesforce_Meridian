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
        'SELECT Guest_Email__c, Discount__c, Promo_Code__c, ' +
          'Shipping_Amount__c, Payment_Intent__c, Tracking_Number__c FROM Order LIMIT 1',
      ),
    )
    ok('Order custom fields (guest_email/promo/discount/shipping/payment/tracking) visible')
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

  // 4h. Wishlist — standard Wishlist + WishlistItem, readable by Run-As.
  try {
    await withConn((conn) =>
      Promise.all([
        conn.query('SELECT Id, AccountId, WebStoreId FROM Wishlist LIMIT 1'),
        conn.query('SELECT Id, WishlistId, Product2Id FROM WishlistItem LIMIT 1'),
      ]),
    )
    ok('Wishlist + WishlistItem readable (saved products)')
  } catch (err) {
    failures++
    bad(`Wishlist/WishlistItem not readable: ${err.message}`)
    console.log('    → Run `npm run sf:setup` to grant the integration user access.')
  }

  // 4i. Saved addresses — standard ContactPointAddress, writable by Run-As.
  try {
    await withConn((conn) =>
      conn.query(
        'SELECT Id, Name, ParentId, AddressFirstName, AddressLastName, Street, City, StateCode, PostalCode, CountryCode, IsDefault FROM ContactPointAddress LIMIT 1',
      ),
    )
    ok('ContactPointAddress readable (saved addresses)')
  } catch (err) {
    failures++
    bad(`ContactPointAddress not readable: ${err.message}`)
    console.log('    → Run `npm run sf:setup` to grant the integration user access.')
  }

  // 4j. Order Change Data Capture enabled (real-time order updates). Not a hard
  // failure — the order page falls back to focus-refresh if this is off.
  try {
    const member = await withConn((conn) =>
      conn.metadata.read('PlatformEventChannelMember', ['ChangeEvents_OrderChangeEvent']),
    )
    const present = Array.isArray(member) ? member[0]?.fullName : member?.fullName
    if (present) {
      ok('Order Change Data Capture enabled (live order updates on)')
    } else {
      bad('Order CDC not enabled — real-time order updates off (focus-refresh fallback still works)')
      console.log('    → Run `npm run sf:setup` to enable it.')
    }
  } catch {
    bad('Order CDC not enabled — real-time order updates off (focus-refresh fallback still works)')
    console.log('    → Run `npm run sf:setup` to enable it.')
  }

  // 4k1. Promotions/coupons readable (standard Commerce objects) + demo coupons.
  try {
    await withConn((conn) =>
      Promise.all([
        conn.query('SELECT Id FROM Promotion LIMIT 1'),
        conn.query('SELECT Id FROM CouponCodeRedemption LIMIT 1'),
      ]),
    )
    const demo = await withConn((conn) =>
      conn.query("SELECT CouponCode FROM Coupon WHERE CouponCode IN ('WELCOME10','MERIDIAN5','FREESHIP')"),
    )
    const found = demo.records.map((r) => r.CouponCode)
    if (found.length === 3) {
      ok('Promotion/Coupon readable; demo coupons present (WELCOME10, MERIDIAN5, FREESHIP)')
    } else {
      ok(`Promotion/Coupon readable; demo coupons present: ${found.join(', ') || 'none'} (run sf:setup to seed)`)
    }
  } catch (err) {
    failures++
    bad(`Promotion/Coupon not readable: ${err.message}`)
    console.log('    → Grant the integration user Read on Promotion/Coupon + Create on CouponCodeRedemption.')
  }

  // 4k2. Person Accounts enabled + the PersonAccount record type resolves —
  // registered shoppers are created as Person Accounts (B2C customer records).
  try {
    const rt = await withConn((conn) =>
      conn.query(
        "SELECT Id FROM RecordType WHERE SobjectType='Account' AND DeveloperName='PersonAccount' AND IsActive=true LIMIT 1",
      ),
    )
    if (rt.records[0]) {
      ok('Person Account record type present (registered shoppers → person accounts)')
    } else {
      failures++
      bad('PersonAccount record type not found — shopper registration will fail')
      console.log('    → Enable Person Accounts + activate the PersonAccount record type.')
    }
  } catch (err) {
    failures++
    bad(`Person Account check failed: ${err.message}`)
  }

  // 4k. Case + CaseComment readable (support-ticket tracking). Standard objects;
  // the app creates Cases already, so this just confirms the Run-As user can
  // read them + their public comments for the customer's track-ticket view.
  try {
    await withConn((conn) => conn.query('SELECT Id, Status FROM Case LIMIT 1'))
    await withConn((conn) => conn.query('SELECT Id, IsPublished FROM CaseComment LIMIT 1'))
    ok('Case + CaseComment readable (support-ticket tracking)')
  } catch (err) {
    failures++
    bad(`Case/CaseComment not readable: ${err.message}`)
    console.log('    → Grant the integration user Read on Case + CaseComment.')
  }

  // 4m. Order Management: the app builds an OrderSummary per order. Confirm the
  // summary objects are readable, the OrderItem→delivery-group FLS field is
  // visible, and the shipping catalog + delivery method exist.
  try {
    await withConn((conn) =>
      Promise.all([
        conn.query('SELECT Id FROM OrderSummary LIMIT 1'),
        conn.query('SELECT Id, OrderDeliveryGroupId FROM OrderItem LIMIT 1'),
      ]),
    )
    const [ship, method] = await withConn((conn) =>
      Promise.all([
        conn.query("SELECT Id FROM Product2 WHERE ProductCode = 'meridian-shipping' LIMIT 1"),
        conn.query("SELECT Id FROM OrderDeliveryMethod WHERE Name = 'Meridian Standard Shipping' LIMIT 1"),
      ]),
    )
    if (ship.records[0] && method.records[0]) {
      ok('Order Management ready (OrderSummary readable, delivery-group FLS + shipping catalog present)')
    } else {
      failures++
      bad('OMS shipping catalog missing (shipping product / delivery method)')
      console.log('    → Run `npm run sf:setup` to create them.')
    }
  } catch (err) {
    failures++
    bad(`Order Management not ready: ${err.message}`)
    console.log('    → Run `npm run sf:setup` (grants OrderItem.OrderDeliveryGroupId FLS + OMS catalog).')
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
