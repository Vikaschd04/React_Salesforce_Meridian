/**
 * Support requests → Salesforce Cases (standard object, zero org setup).
 * The web form's name/email land in the standard Supplied* fields so the Case
 * is fully usable in Service even though the requester may not be a Contact.
 * A logged-in shopper's Case is also linked to their Contact (`ContactId`) so
 * they can track it from their account.
 *
 * Customers see a ticket's **public** replies — standard `CaseComment` rows with
 * `IsPublished = true`. Private (internal) comments are never returned.
 */
import { withConn } from './client.js'

const esc = (s) => String(s).replace(/'/g, "\\'")

/**
 * Create a web Case; returns { caseNumber, id }.
 * `contactId` (optional) links the Case to a logged-in shopper's Contact.
 */
export async function createCase({ name, email, subject, message, contactId = null }) {
  const result = await withConn((conn) =>
    conn.sobject('Case').create({
      Origin: 'Web',
      Subject: subject,
      Description: message,
      SuppliedName: name,
      SuppliedEmail: email,
      ...(contactId ? { ContactId: contactId } : {}),
    }),
  )
  if (!result.success) throw new Error('Failed to create Case in Salesforce.')
  const read = await withConn((conn) =>
    conn.query(`SELECT CaseNumber FROM Case WHERE Id = '${result.id}' LIMIT 1`),
  )
  return { id: result.id, caseNumber: read.records[0]?.CaseNumber || result.id }
}

/** Map a Case record to the app's ticket-summary shape. */
function ticketFromCase(c) {
  return {
    caseNumber: c.CaseNumber,
    subject: c.Subject || '(no subject)',
    status: c.Status || 'New',
    closed: c.IsClosed === true,
    createdAt: c.CreatedDate,
  }
}

/**
 * List the shopper's support tickets (most recent first). Matches either the
 * linked Contact OR the supplied email (covers tickets raised before linking).
 */
export async function listCasesForContact({ contactId, email }) {
  const clauses = []
  if (contactId) clauses.push(`ContactId = '${esc(contactId)}'`)
  if (email) clauses.push(`SuppliedEmail = '${esc(email)}'`)
  if (clauses.length === 0) return []
  const res = await withConn((conn) =>
    conn.query(
      `SELECT CaseNumber, Subject, Status, IsClosed, CreatedDate FROM Case
       WHERE ${clauses.join(' OR ')} ORDER BY CreatedDate DESC LIMIT 50`,
    ),
  )
  return res.records.map(ticketFromCase)
}

/**
 * One of the shopper's tickets + its public reply thread. Scoped: returns null
 * unless the Case belongs to the requester (by Contact or supplied email).
 */
export async function getCaseForContact(caseNumber, { contactId, email }) {
  const res = await withConn((conn) =>
    conn.query(
      `SELECT Id, CaseNumber, Subject, Description, Status, IsClosed, CreatedDate,
              ContactId, SuppliedEmail
       FROM Case WHERE CaseNumber = '${esc(caseNumber)}' LIMIT 1`,
    ),
  )
  const c = res.records[0]
  if (!c) return null
  const mine =
    (contactId && c.ContactId === contactId) ||
    (email && (c.SuppliedEmail || '').toLowerCase() === email.toLowerCase())
  if (!mine) return null

  const comments = await withConn((conn) =>
    conn.query(
      `SELECT CommentBody, CreatedDate FROM CaseComment
       WHERE ParentId = '${c.Id}' AND IsPublished = true ORDER BY CreatedDate ASC`,
    ),
  )
  return {
    ...ticketFromCase(c),
    description: c.Description || '',
    updates: comments.records.map((r) => ({ body: r.CommentBody || '', createdAt: r.CreatedDate })),
  }
}
