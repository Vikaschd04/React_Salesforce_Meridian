/**
 * Optional seeder — populates a Salesforce org with Meridian's catalog so the
 * owner doesn't have to hand-enter 8 products. Idempotent: safe to re-run.
 *
 * Prerequisites (see docs/SALESFORCE_SETUP.md):
 *   - Custom fields on Product2 already created.
 *   - A Connected App with Client Credentials + creds in server/.env.
 *
 * Run:  DATA_SOURCE=salesforce node src/sf/seed.js
 *
 * It will: ensure the "Meridian Web Orders" Account exists, activate the standard
 * pricebook entries, and upsert each Product2 (+ standard PricebookEntry) keyed
 * by ProductCode (our slug). It creates DATA records only — never fields.
 */
import { config } from '../config.js'
import { withConn } from './client.js'
import { PRODUCTS } from '../data/products.js'

function productToSf(p) {
  return {
    Name: p.name,
    ProductCode: p.id,
    Description: p.description,
    IsActive: true,
    Origin__c: p.origin,
    Roast__c: p.roast,
    Tasting_Notes__c: p.tastingNotes.join('; '),
    Process__c: p.process,
    Altitude_Meters__c: p.altitudeMeters,
    Latitude__c: p.lat,
    Longitude__c: p.lng,
    Stock__c: p.stock,
    Weight_Grams__c: p.weightGrams,
    Accent__c: p.accent,
    Image_Path__c: p.image,
  }
}

async function ensureAccount(conn) {
  const name = config.salesforce.accountName
  const existing = await conn.query(
    `SELECT Id FROM Account WHERE Name = '${name.replace(/'/g, "\\'")}' LIMIT 1`,
  )
  if (existing.records[0]) return existing.records[0].Id
  const res = await conn.sobject('Account').create({ Name: name })
  console.log(`  • Created Account "${name}" (${res.id})`)
  return res.id
}

async function getStandardPricebookId(conn) {
  const pb = await conn.query('SELECT Id FROM Pricebook2 WHERE IsStandard = true LIMIT 1')
  if (!pb.records[0]) throw new Error('Standard Pricebook not found. Activate it in Setup.')
  return pb.records[0].Id
}

async function upsertProduct(conn, pricebookId, product) {
  const fields = productToSf(product)
  // Find existing Product2 by ProductCode.
  const found = await conn.query(
    `SELECT Id FROM Product2 WHERE ProductCode = '${product.id}' LIMIT 1`,
  )

  let productId
  if (found.records[0]) {
    productId = found.records[0].Id
    await conn.sobject('Product2').update({ Id: productId, ...fields })
  } else {
    const res = await conn.sobject('Product2').create(fields)
    productId = res.id
  }

  // Ensure a standard PricebookEntry with the right price.
  const unitPrice = product.priceCents / 100
  const pbe = await conn.query(
    `SELECT Id FROM PricebookEntry WHERE Pricebook2Id = '${pricebookId}' AND Product2Id = '${productId}' LIMIT 1`,
  )
  if (pbe.records[0]) {
    await conn.sobject('PricebookEntry').update({
      Id: pbe.records[0].Id,
      UnitPrice: unitPrice,
      IsActive: true,
    })
  } else {
    await conn.sobject('PricebookEntry').create({
      Pricebook2Id: pricebookId,
      Product2Id: productId,
      UnitPrice: unitPrice,
      IsActive: true,
    })
  }
  return productId
}

async function main() {
  if (config.dataSource !== 'salesforce') {
    console.error('Set DATA_SOURCE=salesforce (and SF_* creds) before seeding.')
    process.exit(1)
  }
  console.log(`Seeding Salesforce (${config.salesforce.loginUrl})…`)

  await withConn(async (conn) => {
    await ensureAccount(conn)
    const pricebookId = await getStandardPricebookId(conn)
    for (const product of PRODUCTS) {
      await upsertProduct(conn, pricebookId, product)
      console.log(`  • Upserted ${product.id} — $${(product.priceCents / 100).toFixed(2)}`)
    }
  })

  console.log(`Done. Seeded ${PRODUCTS.length} products.`)
}

main().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
