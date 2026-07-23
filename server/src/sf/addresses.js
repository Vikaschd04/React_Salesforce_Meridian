/**
 * Salesforce-backed saved addresses. A Meridian_Address__c row per saved
 * address, keyed to the shopper's Contact (the standard ContactPointAddress
 * object can't parent to a Contact — see docs/SALESFORCE_CONVENTIONS.md).
 * Enforces one default address per shopper.
 */
import { withConn } from './client.js'

const esc = (s) => String(s).replace(/'/g, "\\'")
const FIELDS =
  'Id, Label__c, Recipient_Name__c, Street__c, City__c, State_Code__c, Postal_Code__c, Country_Code__c, Is_Default__c'

function addressFromSf(r) {
  return {
    id: r.Id,
    label: r.Label__c || '',
    name: r.Recipient_Name__c || '',
    street: r.Street__c || '',
    city: r.City__c || '',
    stateCode: r.State_Code__c || '',
    postalCode: r.Postal_Code__c || '',
    countryCode: r.Country_Code__c || '',
    isDefault: r.Is_Default__c === true,
  }
}

function toSf(contactId, a) {
  return {
    Contact__c: contactId,
    Label__c: a.label,
    Recipient_Name__c: a.name,
    Street__c: a.street,
    City__c: a.city,
    State_Code__c: a.stateCode,
    Postal_Code__c: a.postalCode,
    Country_Code__c: a.countryCode,
    Is_Default__c: !!a.isDefault,
  }
}

/** The shopper's saved addresses, default first. */
export async function listForContact(contactId) {
  return withConn(async (conn) => {
    const res = await conn.query(
      `SELECT ${FIELDS} FROM Meridian_Address__c ` +
        `WHERE Contact__c = '${esc(contactId)}' ORDER BY Is_Default__c DESC, CreatedDate DESC`,
    )
    return res.records.map(addressFromSf)
  })
}

/** Clear Is_Default__c on all of the shopper's addresses except `keepId` (if given). */
async function clearOtherDefaults(conn, contactId, keepId) {
  const res = await conn.query(
    `SELECT Id FROM Meridian_Address__c WHERE Contact__c = '${esc(contactId)}' AND Is_Default__c = true`,
  )
  const toClear = res.records.filter((r) => r.Id !== keepId).map((r) => ({ Id: r.Id, Is_Default__c: false }))
  if (toClear.length) await conn.sobject('Meridian_Address__c').update(toClear)
}

/** Create an address. If it's the default (or the shopper's first), it becomes the sole default. */
export async function create(contactId, address) {
  return withConn(async (conn) => {
    const existing = await conn.query(
      `SELECT Id FROM Meridian_Address__c WHERE Contact__c = '${esc(contactId)}' LIMIT 1`,
    )
    const isFirst = existing.records.length === 0
    const body = toSf(contactId, { ...address, isDefault: address.isDefault || isFirst })
    const created = await conn.sobject('Meridian_Address__c').create(body)
    if (!created.success) throw new Error('Failed to save the address in Salesforce.')
    if (body.Is_Default__c) await clearOtherDefaults(conn, contactId, created.id)
  })
}

/** Update an address (partial). Setting it default clears the others. */
export async function update(contactId, id, patch) {
  return withConn(async (conn) => {
    // Guard: only the shopper's own address.
    const own = await conn.query(
      `SELECT Id FROM Meridian_Address__c WHERE Id = '${esc(id)}' AND Contact__c = '${esc(contactId)}' LIMIT 1`,
    )
    if (!own.records[0]) return
    const body = { Id: id }
    const map = {
      label: 'Label__c', name: 'Recipient_Name__c', street: 'Street__c', city: 'City__c',
      stateCode: 'State_Code__c', postalCode: 'Postal_Code__c', countryCode: 'Country_Code__c',
    }
    for (const [k, field] of Object.entries(map)) if (patch[k] !== undefined) body[field] = patch[k]
    if (patch.isDefault !== undefined) body.Is_Default__c = !!patch.isDefault
    await conn.sobject('Meridian_Address__c').update(body)
    if (body.Is_Default__c) await clearOtherDefaults(conn, contactId, id)
  })
}

/** Delete an address (only the shopper's own). */
export async function remove(contactId, id) {
  return withConn(async (conn) => {
    const own = await conn.query(
      `SELECT Id FROM Meridian_Address__c WHERE Id = '${esc(id)}' AND Contact__c = '${esc(contactId)}' LIMIT 1`,
    )
    if (!own.records[0]) return
    await conn.sobject('Meridian_Address__c').destroy(id)
  })
}
