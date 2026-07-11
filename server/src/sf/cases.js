/**
 * Support requests → Salesforce Cases (standard object, zero org setup).
 * The web form's name/email land in the standard Supplied* fields so the Case
 * is fully usable in Service even though the requester may not be a Contact.
 */
import { withConn } from './client.js'

/** Create a web Case; returns { caseNumber, id }. */
export async function createCase({ name, email, subject, message }) {
  const result = await withConn((conn) =>
    conn.sobject('Case').create({
      Origin: 'Web',
      Subject: subject,
      Description: message,
      SuppliedName: name,
      SuppliedEmail: email,
    }),
  )
  if (!result.success) throw new Error('Failed to create Case in Salesforce.')
  const read = await withConn((conn) =>
    conn.query(`SELECT CaseNumber FROM Case WHERE Id = '${result.id}' LIMIT 1`),
  )
  return { id: result.id, caseNumber: read.records[0]?.CaseNumber || result.id }
}
