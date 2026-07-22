/**
 * Salesforce Contact operations for shopper auth. Shoppers are stored as
 * Contacts; the bcrypt password hash lives in the custom field
 * Contact.Password_Hash__c and never leaves the server.
 */
import bcrypt from 'bcryptjs'
import { withConn } from './client.js'
import { conflict } from '../lib/errors.js'

const esc = (s) => String(s).replace(/'/g, "\\'")

/** Public profile shape (no hash). */
export function toProfile(record) {
  return {
    id: record.Id,
    email: record.Email,
    firstName: record.FirstName || '',
    lastName: record.LastName || '',
    company: record.AccountId ? { id: record.AccountId, name: record.Account?.Name || '' } : null,
  }
}

/** Find a Contact by email (case-insensitive). Returns the raw record or null. */
export async function findByEmail(email) {
  const res = await withConn((conn) =>
    conn.query(
      `SELECT Id, FirstName, LastName, Email, Password_Hash__c, AccountId, Account.Name
       FROM Contact WHERE Email = '${esc(email)}' LIMIT 1`,
    ),
  )
  return res.records[0] || null
}

/**
 * Create a shopper Contact with a hashed password. Throws 409 if email exists.
 * `company` (optional) is a resolved { id, name } from store/companies.js —
 * when present, the Contact is linked to that company Account.
 */
export async function createShopper({ firstName, lastName, email, password, company = null }) {
  const existing = await findByEmail(email)
  if (existing) {
    throw conflict('An account with that email already exists.', 'email_taken')
  }
  const hash = await bcrypt.hash(password, 10)
  const result = await withConn((conn) =>
    conn.sobject('Contact').create({
      FirstName: firstName,
      LastName: lastName,
      Email: email,
      Password_Hash__c: hash,
      ...(company ? { AccountId: company.id } : {}),
    }),
  )
  if (!result.success) {
    throw new Error('Failed to create Contact in Salesforce.')
  }
  return { id: result.id, email, firstName, lastName, company }
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
      `SELECT Id, FirstName, LastName, Email, AccountId, Account.Name
       FROM Contact WHERE Id = '${esc(contactId)}' LIMIT 1`,
    ),
  )
  if (!res.records[0]) throw new Error('Contact not found after update.')
  return toProfile(res.records[0])
}
