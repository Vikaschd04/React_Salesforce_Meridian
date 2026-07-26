/**
 * Salesforce shopper auth (B2C via Person Accounts).
 *
 * Registering a shopper creates a **Person Account** — one record that is both
 * the Account (Name + PersonEmail) and its backing Contact — Salesforce's native
 * B2C model. The app's identity stays the backing Contact (PersonContactId): the
 * bcrypt password hash lives in Contact.Password_Hash__c (never leaves the
 * server), login finds the Contact by Email, and a shopper's orders attach to
 * their own person account (see sf/orders.js). Guests remain account-less.
 */
import bcrypt from 'bcryptjs'
import { withConn } from './client.js'
import { conflict } from '../lib/errors.js'

const esc = (s) => String(s).replace(/'/g, "\\'")

// The PersonAccount record type id, resolved once and cached (org-specific).
let personAccountRtId = null
async function getPersonAccountRecordTypeId(conn) {
  if (personAccountRtId) return personAccountRtId
  const res = await conn.query(
    "SELECT Id FROM RecordType WHERE SobjectType = 'Account' AND DeveloperName = 'PersonAccount' AND IsActive = true LIMIT 1",
  )
  if (!res.records[0]) {
    throw new Error('PersonAccount record type not found — is Person Accounts enabled?')
  }
  personAccountRtId = res.records[0].Id
  return personAccountRtId
}

/** Public profile shape (no hash). */
export function toProfile(record) {
  return {
    id: record.Id,
    email: record.Email,
    firstName: record.FirstName || '',
    lastName: record.LastName || '',
  }
}

/** Find a Contact by email (case-insensitive). Returns the raw record or null. */
export async function findByEmail(email) {
  const res = await withConn((conn) =>
    conn.query(
      `SELECT Id, FirstName, LastName, Email, Password_Hash__c, AccountId
       FROM Contact WHERE Email = '${esc(email)}' LIMIT 1`,
    ),
  )
  return res.records[0] || null
}

/**
 * Register a shopper as a Person Account with a hashed password. Throws 409 if
 * the email already exists. Returns the profile keyed on the backing Contact id
 * (the app's shopper identity), so login/orders/history are unchanged.
 */
export async function createShopper({ firstName, lastName, email, password }) {
  const existing = await findByEmail(email)
  if (existing) {
    throw conflict('An account with that email already exists.', 'email_taken')
  }
  const hash = await bcrypt.hash(password, 10)
  return withConn(async (conn) => {
    const rtId = await getPersonAccountRecordTypeId(conn)
    // Insert the Person Account (auto-creates the backing Contact).
    const acct = await conn.sobject('Account').create({
      RecordTypeId: rtId,
      FirstName: firstName,
      LastName: lastName,
      PersonEmail: email,
    })
    if (!acct.success) {
      throw new Error('Failed to create Person Account in Salesforce.')
    }
    // Read back the backing Contact and stash the password hash on it.
    const res = await conn.query(
      `SELECT PersonContactId FROM Account WHERE Id = '${esc(acct.id)}' LIMIT 1`,
    )
    const contactId = res.records[0]?.PersonContactId
    if (!contactId) throw new Error('Person Account created without a backing Contact.')
    await conn.sobject('Contact').update({ Id: contactId, Password_Hash__c: hash })
    return { id: contactId, email, firstName, lastName }
  })
}

/** Verify a plaintext password against a Contact record's stored hash. */
export async function verifyPassword(record, password) {
  const hash = record?.Password_Hash__c
  if (!hash) return false
  return bcrypt.compare(password, hash)
}

/** Update a shopper's name on their Contact; returns the fresh profile. */
export async function updateShopper(contactId, { firstName, lastName }) {
  await withConn((conn) =>
    conn.sobject('Contact').update({ Id: contactId, FirstName: firstName, LastName: lastName }),
  )
  const res = await withConn((conn) =>
    conn.query(
      `SELECT Id, FirstName, LastName, Email
       FROM Contact WHERE Id = '${esc(contactId)}' LIMIT 1`,
    ),
  )
  if (!res.records[0]) throw new Error('Contact not found after update.')
  return toProfile(res.records[0])
}
