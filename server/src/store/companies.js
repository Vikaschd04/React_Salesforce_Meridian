/**
 * Company resolution — the seam between signup and the data source, mirroring
 * store/auth.js. DATA_SOURCE=mock keeps companies in an in-memory Map (keyed by
 * domain, survives a server run); DATA_SOURCE=salesforce finds/creates a real
 * Account (see sf/companies.js).
 */
import { config } from '../config.js'
import { randomBytes } from 'node:crypto'
import { domainFromEmail, assertCompanyDomainAllowed } from '../lib/companyDomain.js'
import * as sfCompanies from '../sf/companies.js'

const useSalesforce = config.dataSource === 'salesforce'
const mockCompanies = new Map() // domain -> { id, name }

function mockFindOrCreate(name, domain) {
  const existing = mockCompanies.get(domain)
  if (existing) return existing
  const company = { id: `acct_${randomBytes(6).toString('hex')}`, name }
  mockCompanies.set(domain, company)
  return company
}

/**
 * Resolve (find-or-create) the company Account for a signup.
 * Returns { id, name }, or null when no companyName was supplied (an
 * individual signup — unaffected by any of this). Throws a friendly 400
 * (`personal_email_domain`) if the email's domain can't anchor a company.
 */
export async function resolveCompany(companyName, email) {
  const name = companyName?.trim()
  if (!name) return null
  const domain = domainFromEmail(email)
  assertCompanyDomainAllowed(domain)
  return useSalesforce
    ? sfCompanies.findOrCreateCompanyAccount(name, domain)
    : mockFindOrCreate(name, domain)
}
