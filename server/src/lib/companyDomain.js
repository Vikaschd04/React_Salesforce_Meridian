/**
 * Company-account join key. A shopper "buying for a company" is matched to
 * other teammates purely by their work email's domain — no invite links or
 * email-sending needed. Shared by both the mock and Salesforce paths (mirrors
 * the shared-logic pattern in lib/totals.js).
 */
import { badRequest } from './errors.js'

// Free/personal email providers can't anchor a company — anyone could type a
// company name against gmail.com and see someone else's order history.
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.co.in',
  'ymail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'gmx.com',
  'zoho.com',
  'yandex.com',
])

/** Lowercase domain from an email address, or '' if it can't be parsed. */
export function domainFromEmail(email) {
  const at = String(email || '').lastIndexOf('@')
  if (at < 0) return ''
  return email
    .slice(at + 1)
    .trim()
    .toLowerCase()
}

/** Throws a friendly 400 if the domain can't anchor a company account. */
export function assertCompanyDomainAllowed(domain) {
  if (!domain || FREE_EMAIL_DOMAINS.has(domain)) {
    throw badRequest(
      'Please use your work email address to set up a business account.',
      'personal_email_domain',
    )
  }
}
