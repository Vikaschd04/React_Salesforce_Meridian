/**
 * Support store — the seam between the support/account routes and the data
 * source. DATA_SOURCE=salesforce creates/reads real Cases (sf/cases.js);
 * DATA_SOURCE=mock keeps tickets in an in-memory Map so the whole track-your-
 * ticket flow works offline (updates come from the mock dev-trigger).
 */
import { randomInt } from 'node:crypto'
import { config } from '../config.js'
import * as sfCases from '../sf/cases.js'

const useSalesforce = config.dataSource === 'salesforce'
const mockCases = new Map() // caseNumber -> { caseNumber, subject, description, status, closed, createdAt, contactId, email, updates: [] }

const CLOSED = new Set(['Closed'])

function mockSummary(c) {
  return { caseNumber: c.caseNumber, subject: c.subject, status: c.status, closed: c.closed, createdAt: c.createdAt }
}

/** Create a support request. Returns { caseNumber }. `contactId` when logged in. */
export async function createSupportRequest(details) {
  if (useSalesforce) {
    const { caseNumber } = await sfCases.createCase(details)
    return { caseNumber }
  }
  const caseNumber = String(randomInt(10000000, 99999999))
  mockCases.set(caseNumber, {
    caseNumber,
    subject: details.subject,
    description: details.message,
    status: 'New',
    closed: false,
    createdAt: new Date().toISOString(),
    contactId: details.contactId || null,
    email: (details.email || '').toLowerCase(),
    updates: [],
  })
  return { caseNumber }
}

/** List the shopper's tickets (most recent first). */
export async function listTickets(user) {
  if (useSalesforce) return sfCases.listCasesForContact({ contactId: user.id, email: user.email })
  const email = (user.email || '').toLowerCase()
  return [...mockCases.values()]
    .filter((c) => c.contactId === user.id || c.email === email)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(mockSummary)
}

/** One ticket + its public update thread, scoped to the shopper. null if not theirs. */
export async function getTicket(user, caseNumber) {
  if (useSalesforce) return sfCases.getCaseForContact(caseNumber, { contactId: user.id, email: user.email })
  const c = mockCases.get(caseNumber)
  if (!c) return null
  const email = (user.email || '').toLowerCase()
  if (c.contactId !== user.id && c.email !== email) return null
  return {
    caseNumber: c.caseNumber,
    subject: c.subject,
    description: c.description,
    status: c.status,
    closed: c.closed,
    createdAt: c.createdAt,
    updates: c.updates,
  }
}

/**
 * Mock-only: append a public reply (and optionally set status) to a ticket —
 * stands in for a merchant updating the Case in Salesforce, so the customer-
 * facing "see updates" flow is demoable + testable offline (routes/dev.js).
 */
export function mockReplyToCase(caseNumber, { body, status }) {
  const c = mockCases.get(caseNumber)
  if (!c) return null
  if (body) c.updates.push({ body, createdAt: new Date().toISOString() })
  if (status) {
    c.status = status
    c.closed = CLOSED.has(status)
  }
  return { caseNumber, status: c.status, updates: c.updates.length }
}
