/**
 * Auth store — the seam between auth routes and the data source.
 *
 * DATA_SOURCE=salesforce stores shoppers as Contacts; DATA_SOURCE=mock keeps
 * them in an in-memory Map so the app still runs without an org. Both hash
 * passwords with bcrypt and return the same profile shape { id, email,
 * firstName, lastName } — never the hash.
 */
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { config } from '../config.js'
import { badRequest } from '../lib/errors.js'
import { resolveCompany } from './companies.js'
import * as contacts from '../sf/contacts.js'

const useSalesforce = config.dataSource === 'salesforce'
const mockUsers = new Map() // email(lowercased) -> { id, firstName, lastName, email, hash, company }

const INVALID = () => badRequest('Incorrect email or password.', 'invalid_credentials')

// ---- Mock implementation ----
async function mockSignup({ firstName, lastName, email, password, company }) {
  const key = email.toLowerCase()
  if (mockUsers.has(key)) {
    throw badRequest('An account with that email already exists.', 'email_taken')
  }
  const hash = await bcrypt.hash(password, 10)
  const user = { id: `usr_${randomBytes(6).toString('hex')}`, firstName, lastName, email, hash, company }
  mockUsers.set(key, user)
  return { id: user.id, email, firstName, lastName, company }
}

async function mockAuthenticate({ email, password }) {
  const user = mockUsers.get(email.toLowerCase())
  if (!user) throw INVALID()
  const ok = await bcrypt.compare(password, user.hash)
  if (!ok) throw INVALID()
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    company: user.company || null,
  }
}

// ---- Public API ----

/**
 * Create an account. Throws 400 email_taken if it exists, or
 * personal_email_domain if `companyName` was given with a free-email address.
 * Returns a profile (with `company` set when buying on behalf of a business).
 */
export async function signup({ companyName, ...details }) {
  const company = await resolveCompany(companyName, details.email)
  if (useSalesforce) return contacts.createShopper({ ...details, company })
  return mockSignup({ ...details, company })
}

/** Verify credentials. Throws 400 invalid_credentials on failure. Returns a profile. */
export async function authenticate({ email, password }) {
  if (!useSalesforce) return mockAuthenticate({ email, password })
  const record = await contacts.findByEmail(email)
  if (!record) throw INVALID()
  const ok = await contacts.verifyPassword(record, password)
  if (!ok) throw INVALID()
  return contacts.toProfile(record)
}

/** Update the shopper's name. Returns the fresh profile. */
export async function updateProfile(user, { firstName, lastName }) {
  if (useSalesforce) return contacts.updateShopper(user.id, { firstName, lastName })
  const mock = mockUsers.get(user.email.toLowerCase())
  if (!mock) throw badRequest('Account not found.', 'not_found')
  mock.firstName = firstName
  mock.lastName = lastName
  return { id: mock.id, email: mock.email, firstName, lastName, company: mock.company || null }
}
