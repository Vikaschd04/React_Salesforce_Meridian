/**
 * Support store — mock returns a fake case number; salesforce creates a real
 * Case via sf/cases.js.
 */
import { randomInt } from 'node:crypto'
import { config } from '../config.js'
import * as sfCases from '../sf/cases.js'

const useSalesforce = config.dataSource === 'salesforce'

/** Create a support request. Returns { caseNumber }. */
export async function createSupportRequest(details) {
  if (useSalesforce) {
    const { caseNumber } = await sfCases.createCase(details)
    return { caseNumber }
  }
  return { caseNumber: String(randomInt(10000000, 99999999)) }
}
