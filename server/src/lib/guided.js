/**
 * Guided selling ("Find your coffee") — the quiz definition and the pure scoring
 * function. No I/O here, so it's trivially testable and shared by mock + SF.
 *
 * Every attribute the quiz scores against lives on the Salesforce Product2 record
 * (Roast__c, Body__c, Flavor_Profile__c, Brew_Methods__c) and reaches this module
 * through the normal catalog read — so recommendations are computed over live
 * Salesforce data, never a local copy. See store/guided.js + sf/guided.js.
 */

/**
 * The quiz. Each question scores one product attribute; an option's `match`
 * lists the attribute values it rewards (empty = "no preference", scores nothing
 * and never filters anything out). `attribute` names the field on the app
 * product shape; `weight` is how many points a match is worth.
 */
export const QUIZ = [
  {
    id: 'roast',
    attribute: 'roast', // single value
    weight: 3,
    label: 'How do you like your roast?',
    help: 'Lighter roasts drink brighter and more delicate; darker roasts are bolder and richer.',
    options: [
      { value: 'Light', label: 'Light & bright', match: ['Light'] },
      { value: 'Medium', label: 'Medium & balanced', match: ['Medium'] },
      { value: 'Dark', label: 'Dark & bold', match: ['Dark'] },
      { value: '', label: 'Surprise me', match: [] },
    ],
  },
  {
    id: 'flavor',
    attribute: 'flavorProfile', // array
    weight: 3,
    label: 'Which flavours pull you in?',
    help: 'Pick the family that sounds most like your ideal cup.',
    options: [
      { value: 'fruity', label: 'Bright & fruity', match: ['Fruity', 'Berry', 'Citrus'] },
      { value: 'floral', label: 'Floral & tea-like', match: ['Floral'] },
      { value: 'chocolate', label: 'Chocolate & nutty', match: ['Chocolate', 'Nutty'] },
      { value: 'caramel', label: 'Sweet & caramel', match: ['Caramel'] },
      { value: 'earthy', label: 'Bold & earthy', match: ['Earthy', 'Spice'] },
    ],
  },
  {
    id: 'body',
    attribute: 'body', // single value
    weight: 2,
    label: 'How much body do you want?',
    help: 'Body is the weight of the coffee in the cup — tea-like to syrupy.',
    options: [
      { value: 'Light', label: 'Light & delicate', match: ['Light'] },
      { value: 'Medium', label: 'Medium & smooth', match: ['Medium'] },
      { value: 'Full', label: 'Full & heavy', match: ['Full'] },
      { value: '', label: 'No preference', match: [] },
    ],
  },
  {
    id: 'brew',
    attribute: 'brewMethods', // array
    weight: 2,
    label: 'How do you usually brew?',
    help: 'We’ll favour coffees that shine with your method.',
    options: [
      { value: 'Espresso', label: 'Espresso', match: ['Espresso'] },
      { value: 'Pour-over', label: 'Pour-over', match: ['Pour-over'] },
      { value: 'French press', label: 'French press', match: ['French press'] },
      { value: 'Drip', label: 'Drip machine', match: ['Drip'] },
      { value: 'Cold brew', label: 'Cold brew', match: ['Cold brew'] },
      { value: '', label: 'A bit of everything', match: [] },
    ],
  },
]

const questionById = new Map(QUIZ.map((q) => [q.id, q]))

/** The quiz as sent to the browser — drop the internal scoring config. */
export function publicQuiz() {
  return QUIZ.map(({ id, label, help, options }) => ({
    id,
    label,
    help,
    options: options.map(({ value, label: l }) => ({ value, label: l })),
  }))
}

// Score one product against one answered question. Single-value attributes score
// the full weight on a hit; array attributes add a small bonus per extra overlap
// so a coffee matching several of the chosen flavours ranks above one that
// matches only one.
function scoreQuestion(product, question, answerValue) {
  const opt = question.options.find((o) => o.value === answerValue)
  if (!opt || opt.match.length === 0) return { score: 0, matched: false, hits: [] }
  const val = product[question.attribute]
  if (Array.isArray(val)) {
    const hits = opt.match.filter((m) => val.includes(m))
    if (hits.length === 0) return { score: 0, matched: false, hits: [] }
    return { score: question.weight + Math.min(hits.length - 1, 2), matched: true, hits }
  }
  const matched = opt.match.includes(val)
  return { score: matched ? question.weight : 0, matched, hits: matched ? [val] : [] }
}

// "A", "A & B", "A, B & C".
function naturalJoin(items) {
  if (items.length <= 1) return items[0] || ''
  if (items.length === 2) return `${items[0]} & ${items[1]}`
  return `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`
}

// A short, human "why this matched" line for one dimension.
function reasonFor(question, product, hits) {
  switch (question.id) {
    case 'roast':
      return `${product.roast} roast`
    case 'flavor':
      return `${naturalJoin(hits)} notes`
    case 'body':
      return `${product.body} body`
    case 'brew':
      return `Brews great as ${hits[0]?.toLowerCase()}`
    default:
      return hits.join(', ')
  }
}

/**
 * Rank products against the shopper's answers. Returns the top `limit`, each
 * annotated with `matchScore`, `matchPct` (0–100), and `reasons` (the dimensions
 * that matched). If the shopper expressed no preference at all, returns the first
 * `limit` as "a Meridian favourite" so the results page is never empty.
 */
export function scoreProducts(products, answers = {}, limit = 3) {
  const maxScore = QUIZ.reduce((sum, q) => {
    const opt = q.options.find((o) => o.value === answers[q.id])
    return sum + (opt && opt.match.length ? q.weight : 0)
  }, 0)

  if (maxScore === 0) {
    return products.slice(0, limit).map((p) => ({
      ...p,
      matchScore: 0,
      matchPct: 0,
      reasons: ['A Meridian favourite'],
    }))
  }

  const scored = products.map((product) => {
    let score = 0
    const reasons = []
    for (const q of QUIZ) {
      const answerValue = answers[q.id]
      if (answerValue == null || answerValue === '') continue
      const { score: s, matched, hits } = scoreQuestion(product, q, answerValue)
      score += s
      if (matched) reasons.push(reasonFor(q, product, hits))
    }
    return { product, score, reasons }
  })

  return scored
    .sort((a, b) => b.score - a.score) // stable → source order breaks ties
    .slice(0, limit)
    .map(({ product, score, reasons }) => ({
      ...product,
      matchScore: score,
      matchPct: Math.round((Math.min(score, maxScore) / maxScore) * 100),
      reasons,
    }))
}

/**
 * The shopper's taste profile from their answers, for persisting on the
 * Salesforce Contact (Preferred_Roast__c / Preferred_Flavors__c). Empty strings
 * where they had no preference.
 */
export function tasteProfile(answers = {}) {
  const roast = answers.roast || ''
  const flavorOpt = questionById.get('flavor')?.options.find((o) => o.value === answers.flavor)
  return {
    roast: roast === '' ? '' : roast,
    flavors: flavorOpt && flavorOpt.match.length ? flavorOpt.label : '',
  }
}
