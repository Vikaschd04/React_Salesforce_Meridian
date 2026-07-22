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
