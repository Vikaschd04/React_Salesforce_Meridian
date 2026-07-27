/**
 * Salesforce-backed saved addresses on the STANDARD `ContactPointAddress` object
 * (no custom schema). Each row is parented to the shopper's **Person Account**
 * (`ParentId`) — registered shoppers are Person Accounts, which ContactPointAddress
 * accepts as a parent (a bare Contact was rejected, which is why this used to be a
 * custom object). One default address per shopper is enforced by the app.
 *
 * Field mapping (app shape ⇄ standard fields):
 *   label      ⇄ Name              (record label, e.g. "Home")
 *   name       ⇄ AddressFirstName + AddressLastName  (recipient, split on space)
 *   street     ⇄ Street
 *   city       ⇄ City
 *   stateCode  ⇄ StateCode         (State/Country picklists enabled → ISO codes)
 *   postalCode ⇄ PostalCode
 *   countryCode⇄ CountryCode
 *   isDefault  ⇄ IsDefault (mirrored to IsPrimary)
 * We only read/write our own shipping rows (`AddressType = 'Shipping'`), so any
 * addresses another integration parks on the account are left untouched.
 */
import { withConn } from './client.js'

const esc = (s) => String(s).replace(/'/g, "\\'")
const FIELDS =
  'Id, Name, AddressFirstName, AddressLastName, Street, City, StateCode, PostalCode, CountryCode, IsDefault'
const SCOPE = "AddressType = 'Shipping'"

// contactId → person-account id (stable per shopper; resolve once and cache).
const accountByContact = new Map()

async function accountFor(conn, contactId) {
  if (accountByContact.has(contactId)) return accountByContact.get(contactId)
  const res = await conn.query(
    `SELECT AccountId FROM Contact WHERE Id = '${esc(contactId)}' LIMIT 1`,
  )
  const accountId = res.records[0]?.AccountId || null
  if (accountId) accountByContact.set(contactId, accountId)
  return accountId
}

/** Combine the two standard name parts back into the app's single recipient name. */
function recipientName(r) {
  return [r.AddressFirstName, r.AddressLastName].filter(Boolean).join(' ')
}

/** Split a recipient name into first + last (Salesforce has no single name field). */
function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  const first = parts.shift() || ''
  return { AddressFirstName: first, AddressLastName: parts.join(' ') }
}

function addressFromSf(r) {
  return {
    id: r.Id,
    label: r.Name || '',
    name: recipientName(r),
    street: r.Street || '',
    city: r.City || '',
    stateCode: r.StateCode || '',
    postalCode: r.PostalCode || '',
    countryCode: r.CountryCode || '',
    isDefault: r.IsDefault === true,
  }
}

function toSf(accountId, a) {
  return {
    ParentId: accountId,
    // Name is required; fall back so a blank label still saves.
    Name: (a.label || a.name || a.street || 'Address').slice(0, 255),
    ...splitName(a.name),
    AddressType: 'Shipping',
    Street: a.street,
    City: a.city,
    StateCode: a.stateCode || null,
    PostalCode: a.postalCode,
    CountryCode: a.countryCode || null,
    IsDefault: !!a.isDefault,
    IsPrimary: !!a.isDefault,
    // Required custom flag from another integration on this org — not our data.
    received_from_SAP__c: false,
  }
}

/** The shopper's saved addresses, default first. */
export async function listForContact(contactId) {
  return withConn(async (conn) => {
    const accountId = await accountFor(conn, contactId)
    if (!accountId) return []
    const res = await conn.query(
      `SELECT ${FIELDS} FROM ContactPointAddress ` +
        `WHERE ParentId = '${esc(accountId)}' AND ${SCOPE} ` +
        `ORDER BY IsDefault DESC, CreatedDate DESC`,
    )
    return res.records.map(addressFromSf)
  })
}

/** Clear IsDefault/IsPrimary on all of the shopper's shipping addresses except `keepId`. */
async function clearOtherDefaults(conn, accountId, keepId) {
  const res = await conn.query(
    `SELECT Id FROM ContactPointAddress ` +
      `WHERE ParentId = '${esc(accountId)}' AND ${SCOPE} AND IsDefault = true`,
  )
  const toClear = res.records
    .filter((r) => r.Id !== keepId)
    .map((r) => ({ Id: r.Id, IsDefault: false, IsPrimary: false }))
  if (toClear.length) await conn.sobject('ContactPointAddress').update(toClear)
}

/** Create an address. If it's the default (or the shopper's first), it becomes the sole default. */
export async function create(contactId, address) {
  return withConn(async (conn) => {
    const accountId = await accountFor(conn, contactId)
    if (!accountId) throw new Error('No account found for this shopper.')
    const existing = await conn.query(
      `SELECT Id FROM ContactPointAddress WHERE ParentId = '${esc(accountId)}' AND ${SCOPE} LIMIT 1`,
    )
    const isFirst = existing.records.length === 0
    const body = toSf(accountId, { ...address, isDefault: address.isDefault || isFirst })
    const created = await conn.sobject('ContactPointAddress').create(body)
    if (!created.success) throw new Error('Failed to save the address in Salesforce.')
    if (body.IsDefault) await clearOtherDefaults(conn, accountId, created.id)
  })
}

/** Update an address (partial). Setting it default clears the others. */
export async function update(contactId, id, patch) {
  return withConn(async (conn) => {
    const accountId = await accountFor(conn, contactId)
    if (!accountId) return
    // Guard: only the shopper's own address (on their account).
    const own = await conn.query(
      `SELECT Id FROM ContactPointAddress ` +
        `WHERE Id = '${esc(id)}' AND ParentId = '${esc(accountId)}' AND ${SCOPE} LIMIT 1`,
    )
    if (!own.records[0]) return
    const body = { Id: id }
    if (patch.label !== undefined) body.Name = (patch.label || 'Address').slice(0, 255)
    if (patch.name !== undefined) Object.assign(body, splitName(patch.name))
    if (patch.street !== undefined) body.Street = patch.street
    if (patch.city !== undefined) body.City = patch.city
    if (patch.stateCode !== undefined) body.StateCode = patch.stateCode || null
    if (patch.postalCode !== undefined) body.PostalCode = patch.postalCode
    if (patch.countryCode !== undefined) body.CountryCode = patch.countryCode || null
    if (patch.isDefault !== undefined) {
      body.IsDefault = !!patch.isDefault
      body.IsPrimary = !!patch.isDefault
    }
    await conn.sobject('ContactPointAddress').update(body)
    if (body.IsDefault) await clearOtherDefaults(conn, accountId, id)
  })
}

/** Delete an address (only the shopper's own). */
export async function remove(contactId, id) {
  return withConn(async (conn) => {
    const accountId = await accountFor(conn, contactId)
    if (!accountId) return
    const own = await conn.query(
      `SELECT Id FROM ContactPointAddress ` +
        `WHERE Id = '${esc(id)}' AND ParentId = '${esc(accountId)}' AND ${SCOPE} LIMIT 1`,
    )
    if (!own.records[0]) return
    await conn.sobject('ContactPointAddress').destroy(id)
  })
}
