/**
 * Company accounts for B2B team buying — standard Account, keyed by the custom
 * join field Account.Company_Domain__c (see docs/SALESFORCE_CONVENTIONS.md).
 */
import { withConn } from './client.js'

const esc = (s) => String(s).replace(/'/g, "\\'")

/**
 * Find the company Account for a domain, or create one. Joining an existing
 * Account ignores the typed name — the Account keeps whatever name its first
 * member gave it.
 */
export async function findOrCreateCompanyAccount(name, domain) {
  return withConn(async (conn) => {
    const safeDomain = esc(domain)
    const existing = await conn.query(
      `SELECT Id, Name FROM Account WHERE Company_Domain__c = '${safeDomain}' LIMIT 1`,
    )
    if (existing.records[0]) {
      return { id: existing.records[0].Id, name: existing.records[0].Name }
    }
    const created = await conn.sobject('Account').create({ Name: name, Company_Domain__c: domain })
    if (!created.success) {
      throw new Error('Failed to create company Account in Salesforce.')
    }
    return { id: created.id, name }
  })
}

/**
 * The Einstein Prediction Builder reorder-likelihood score (0–100) for a
 * company Account, or null when no model has scored it yet — which is the
 * normal state until an admin trains + runs a Prediction Builder model in
 * Salesforce Setup (see docs/SALESFORCE_SETUP.md). The BFF only reads the
 * field; it never computes the score.
 */
export async function getReorderLikelihood(accountId) {
  return withConn(async (conn) => {
    const res = await conn.query(
      `SELECT Reorder_Likelihood__c FROM Account WHERE Id = '${esc(accountId)}' LIMIT 1`,
    )
    const raw = res.records[0]?.Reorder_Likelihood__c
    return raw != null ? Number(raw) : null
  })
}
