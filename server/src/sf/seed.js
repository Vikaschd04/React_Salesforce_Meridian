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
import { BUNDLES } from '../data/bundles.js'

const BUNDLE_COMPONENT = 'Meridian_Bundle_Component__c'

function productToSf(p) {
  return {
    Name: p.name,
    ProductCode: p.id,
    Description: p.description,
    IsActive: true,
    Origin__c: p.origin,
    Roast__c: p.roast,
    Tasting_Notes__c: p.tastingNotes.join('; '),
    Body__c: p.body || '',
    Flavor_Profile__c: (p.flavorProfile || []).join('; '),
    Brew_Methods__c: (p.brewMethods || []).join('; '),
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

  // Ensure a standard PricebookEntry with the right price (USD dollars).
  const unitPrice = product.price
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

// Ensure the standard PricebookEntry for a product carries `unitPrice`.
async function ensurePricebookEntry(conn, pricebookId, productId, unitPrice) {
  const pbe = await conn.query(
    `SELECT Id FROM PricebookEntry WHERE Pricebook2Id = '${pricebookId}' AND Product2Id = '${productId}' LIMIT 1`,
  )
  if (pbe.records[0]) {
    await conn.sobject('PricebookEntry').update({ Id: pbe.records[0].Id, UnitPrice: unitPrice, IsActive: true })
  } else {
    await conn.sobject('PricebookEntry').create({
      Pricebook2Id: pricebookId, Product2Id: productId, UnitPrice: unitPrice, IsActive: true,
    })
  }
}

// A bundle is a standard Product2 (no Origin/Roast → stays out of the coffee
// catalog) priced by its PricebookEntry; its coffees are reconciled into the
// Meridian_Bundle_Component__c junction (delete + recreate → idempotent).
async function upsertBundle(conn, pricebookId, bundle, idByCode) {
  const fields = {
    Name: bundle.name,
    ProductCode: bundle.id,
    Description: bundle.description,
    IsActive: true,
    Stock__c: bundle.stock,
    Image_Path__c: bundle.image,
    Accent__c: bundle.accent,
  }
  const found = await conn.query(`SELECT Id FROM Product2 WHERE ProductCode = '${bundle.id}' LIMIT 1`)
  let bundleId
  if (found.records[0]) {
    bundleId = found.records[0].Id
    await conn.sobject('Product2').update({ Id: bundleId, ...fields })
  } else {
    bundleId = (await conn.sobject('Product2').create(fields)).id
  }
  await ensurePricebookEntry(conn, pricebookId, bundleId, bundle.price)

  // Reconcile components: clear existing junction rows, then recreate.
  const existing = await conn.query(`SELECT Id FROM ${BUNDLE_COMPONENT} WHERE Bundle__c = '${bundleId}'`)
  if (existing.records.length) {
    await conn.sobject(BUNDLE_COMPONENT).destroy(existing.records.map((r) => r.Id))
  }
  const rows = bundle.components
    .map((c) => ({ Bundle__c: bundleId, Component__c: idByCode.get(c.id), Quantity__c: c.qty }))
    .filter((r) => r.Component__c)
  if (rows.length) await conn.sobject(BUNDLE_COMPONENT).create(rows)
  return { bundleId, componentCount: rows.length }
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
    const idByCode = new Map()
    for (const product of PRODUCTS) {
      const productId = await upsertProduct(conn, pricebookId, product)
      idByCode.set(product.id, productId)
      console.log(`  • Upserted ${product.id} — $${product.price.toFixed(2)}`)
    }
    for (const bundle of BUNDLES) {
      const { componentCount } = await upsertBundle(conn, pricebookId, bundle, idByCode)
      console.log(`  • Upserted bundle ${bundle.id} — $${bundle.price.toFixed(2)} (${componentCount} coffees)`)
    }
  })

  console.log(`Done. Seeded ${PRODUCTS.length} products + ${BUNDLES.length} bundles.`)
}

main().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
