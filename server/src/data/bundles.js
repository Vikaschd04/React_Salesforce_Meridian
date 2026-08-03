/**
 * Server-owned mock bundles (Phase 2). Mirrors the Salesforce model so mock and
 * salesforce modes behave identically:
 *   - a bundle IS a standard Product2 (ProductCode `bundle-*`, priced by a
 *     standard PricebookEntry) — so it flows through the normal order pipeline
 *   - `components` are the coffees inside (Product ids + qty), stored in
 *     Salesforce as `Meridian_Bundle_Component__c` junction rows
 *
 * `price` is the discounted bundle price (USD dollars); the per-coffee total and
 * the savings are computed from the live component prices (see store/bundles.js).
 * `image` reuses a representative component photo so no new assets are needed.
 * Bundles deliberately have no Origin/Roast, so they never leak into the
 * single-origin shop catalog.
 */
export const BUNDLES = [
  {
    id: 'bundle-light-flight',
    name: 'The Light Flight',
    description:
      'Three of our brightest, most delicate lots — a tour of high-grown washed coffees from Ethiopia, Kenya, and Rwanda. Built for slow pour-over mornings.',
    price: 59.0,
    image: '/products/yirgacheffe-koke.jpg',
    accent: '#c98a3c',
    stock: 18,
    active: true,
    components: [
      { id: 'yirgacheffe-koke', qty: 1 },
      { id: 'nyeri-gachatha', qty: 1 },
      { id: 'nyamasheke-kilimbi', qty: 1 },
    ],
  },
  {
    id: 'bundle-chocolate-comfort',
    name: 'Chocolate & Comfort',
    description:
      'Three rich, low-acid, chocolate-forward coffees for cozy mornings and everyday espresso. Naturally sweet and endlessly drinkable.',
    price: 45.0,
    image: '/products/cerrado-fazenda.jpg',
    accent: '#5a3520',
    stock: 20,
    active: true,
    components: [
      { id: 'cerrado-fazenda', qty: 1 },
      { id: 'gayo-takengon', qty: 1 },
      { id: 'chikmagalur-attikan', qty: 1 },
    ],
  },
  {
    id: 'bundle-world-tour',
    name: 'The World Tour',
    description:
      'Four coffees, four corners of the map — from a floral Ethiopian to a syrupy Sumatran. The best way to taste the whole Meridian range in one box.',
    price: 69.0,
    image: '/products/tarrazu-la-pastora.jpg',
    accent: '#b5632f',
    stock: 15,
    active: true,
    components: [
      { id: 'yirgacheffe-koke', qty: 1 },
      { id: 'huila-la-esperanza', qty: 1 },
      { id: 'gayo-takengon', qty: 1 },
      { id: 'tarrazu-la-pastora', qty: 1 },
    ],
  },
]
