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
import { listOrdersForCompany } from './orders.js'

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

/**
 * Mock reorder-likelihood heuristic (NOT a real ML model — DATA_SOURCE=mock
 * has no Einstein runtime). It exists only so the feature is exercisable and
 * testable offline. Compares days since the company's last order against
 * their average interval between orders: overdue → high, just-ordered → low.
 * Needs ≥2 orders to have an interval; returns null otherwise, matching the
 * Salesforce "no score yet" state so the UI path is identical in both modes.
 */
function mockReorderLikelihood(orders) {
  if (!orders || orders.length < 2) return null
  const times = orders
    .map((o) => new Date(o.placedAt).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)
  if (times.length < 2) return null

  const intervals = []
  for (let i = 1; i < times.length; i++) intervals.push(times[i] - times[i - 1])
  const avgInterval = intervals.reduce((s, x) => s + x, 0) / intervals.length
  if (avgInterval <= 0) return null

  const sinceLast = Date.now() - times[times.length - 1]
  // At/after the average interval → ~85%; halfway → ~50%; fresh → low. Clamp 5–95.
  const ratio = sinceLast / avgInterval
  const score = Math.round(Math.max(5, Math.min(95, ratio * 70 + 15)))
  return score
}

/**
 * Forward-looking insights for a company. Salesforce path reads the score an
 * Einstein Prediction Builder model wrote to Account.Reorder_Likelihood__c
 * (null until a model is trained + run — see docs/SALESFORCE_SETUP.md). Mock
 * path uses the heuristic above. Returns { reorderLikelihood: number|null }.
 */
export async function getCompanyInsights(companyId) {
  if (!companyId) return { reorderLikelihood: null }
  if (useSalesforce) {
    return { reorderLikelihood: await sfCompanies.getReorderLikelihood(companyId) }
  }
  const orders = await listOrdersForCompany(companyId)
  return { reorderLikelihood: mockReorderLikelihood(orders) }
}
