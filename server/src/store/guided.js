/**
 * Guided selling store — serves the quiz and computes recommendations over the
 * live catalog (mock or Salesforce, via store/catalog.js), then optionally
 * persists the shopper's taste profile back onto their Salesforce Contact.
 *
 * All scoring runs over whatever store/catalog.js returns, so in Salesforce mode
 * every attribute the recommendation uses comes straight from Product2.
 */
import { getProducts } from './catalog.js'
import { publicQuiz, scoreProducts, tasteProfile } from '../lib/guided.js'
import { config } from '../config.js'
import * as sfContacts from '../sf/contacts.js'

const useSalesforce = config.dataSource === 'salesforce'

/** The quiz questions + options for the browser to render. */
export function getQuiz() {
  return publicQuiz()
}

/** Top matches for the shopper's answers (each annotated with match reasons). */
export async function recommend(answers, { limit = 3 } = {}) {
  const products = await getProducts()
  return scoreProducts(products, answers || {}, limit)
}

/**
 * Persist the shopper's taste profile on their Salesforce Contact. No-op in mock
 * mode or when logged out. Best-effort — never throws to the caller.
 */
export async function saveTasteProfile(contactId, answers) {
  if (!useSalesforce || !contactId) return
  const profile = tasteProfile(answers || {})
  if (!profile.roast && !profile.flavors) return
  try {
    await sfContacts.updateTasteProfile(contactId, profile)
  } catch (err) {
    console.warn('  ! Could not save taste profile to Contact:', err.message)
  }
}
