/**
 * Mock catalog for Meridian (Phase 1).
 *
 * This is the ONLY place raw product data lives. Nothing outside of
 * src/api/store.js is allowed to import this file — the store module is the
 * single swap point that later becomes a BFF call, then a Salesforce query.
 *
 * Conventions (see CLAUDE.md):
 *  - Money is stored as integer cents. Format only at display time.
 *  - `lat` / `lng` are decimal degrees of the origin farm; the UI renders them
 *    as the signature coordinate label.
 *  - `accent` seeds the generated cartographic bag art (no photo assets).
 */

export const PRODUCTS = [
  {
    id: 'yirgacheffe-koke',
    name: 'Koke, Yirgacheffe',
    origin: 'Gedeb, Ethiopia',
    roast: 'Light',
    priceCents: 2200,
    weightGrams: 340,
    tastingNotes: ['Jasmine', 'Bergamot', 'White peach'],
    process: 'Washed',
    altitudeMeters: 2050,
    lat: 6.16,
    lng: 38.2,
    accent: '#c98a3c',
    stock: 24,
    active: true,
    description:
      'Grown on smallholder plots ringing the Koke washing station, this heirloom-varietal lot is picked ripe and fully washed. The cup is bright and floral without tipping into sharpness — think a pot of jasmine tea with a squeeze of bergamot and a soft stone-fruit finish. A light roast built to show origin, not the roaster.',
  },
  {
    id: 'huila-la-esperanza',
    name: 'La Esperanza, Huila',
    origin: 'Pitalito, Colombia',
    roast: 'Medium',
    priceCents: 1950,
    weightGrams: 340,
    tastingNotes: ['Red apple', 'Caramel', 'Cocoa nib'],
    process: 'Washed',
    altitudeMeters: 1750,
    lat: 1.85,
    lng: -76.05,
    accent: '#b5632f',
    stock: 40,
    active: true,
    description:
      'A dependable, crowd-pleasing Colombian from the Bruselas district of Pitalito. Farmer Gilberto Ramírez ferments in tile tanks and dries on raised beds. Medium-roasted for balance: crisp red-apple acidity up front, a caramel middle, and a clean cocoa-nib close that holds up beautifully with milk.',
  },
  {
    id: 'antigua-la-tacita',
    name: 'La Tacita, Antigua',
    origin: 'Antigua, Guatemala',
    roast: 'Medium',
    priceCents: 2050,
    weightGrams: 340,
    tastingNotes: ['Milk chocolate', 'Orange', 'Toasted almond'],
    process: 'Washed',
    altitudeMeters: 1550,
    lat: 14.56,
    lng: -90.73,
    accent: '#8a5326',
    stock: 31,
    active: true,
    description:
      'Volcanic soil between three volcanoes gives Antigua coffee its signature body. This estate lot is dense and syrupy: bittersweet milk chocolate wrapped around a bright thread of orange, finishing with toasted almond. A versatile medium roast that pulls a gorgeous espresso and a rounded filter.',
  },
  {
    id: 'nyeri-gachatha',
    name: 'Gachatha AA, Nyeri',
    origin: 'Nyeri, Kenya',
    roast: 'Light',
    priceCents: 2450,
    weightGrams: 340,
    tastingNotes: ['Blackcurrant', 'Grapefruit', 'Brown sugar'],
    process: 'Washed',
    altitudeMeters: 1800,
    lat: -0.42,
    lng: 36.95,
    accent: '#9c3b46',
    stock: 18,
    active: true,
    description:
      'The Gachatha factory sits in the coffee heartland of Nyeri, drawing SL28 and SL34 cherry from around 900 members. Kenyan classics are all here: an electric blackcurrant top note, pink-grapefruit acidity, and a brown-sugar sweetness that keeps the intensity in check. Best enjoyed as a bright, juicy pour-over.',
  },
  {
    id: 'gayo-takengon',
    name: 'Gayo Highlands, Aceh',
    origin: 'Takengon, Sumatra',
    roast: 'Dark',
    priceCents: 1850,
    weightGrams: 340,
    tastingNotes: ['Cedar', 'Dark chocolate', 'Fig'],
    process: 'Wet-hulled',
    altitudeMeters: 1500,
    lat: 4.63,
    lng: 96.83,
    accent: '#3f2718',
    stock: 27,
    active: true,
    description:
      'Wet-hulled the traditional Sumatran way, giving the low-toned, earthy profile that Indonesia is loved for. Our darkest offering: cedar and pipe-tobacco aromatics over a base of dark chocolate and dried fig, with almost no acidity and a heavy, coating body. Made for a rainy morning and a French press.',
  },
  {
    id: 'tarrazu-la-pastora',
    name: 'La Pastora, Tarrazú',
    origin: 'Tarrazú, Costa Rica',
    roast: 'Medium',
    priceCents: 2150,
    weightGrams: 340,
    tastingNotes: ['Honey', 'Apricot', 'Almond'],
    process: 'Honey',
    altitudeMeters: 1700,
    lat: 9.65,
    lng: -84.02,
    accent: '#c9922f',
    stock: 22,
    active: true,
    description:
      'A honey-process lot from the famed Tarrazú region, where the mucilage is left on the bean during drying to build sweetness and body. The result is exactly as billed: liquid honey, ripe apricot, and a nutty almond finish. Silky and forgiving across brew methods — a great everyday medium roast.',
  },
  {
    id: 'cerrado-fazenda',
    name: 'Fazenda do Sertão, Cerrado',
    origin: 'Cerrado Mineiro, Brazil',
    roast: 'Dark',
    priceCents: 1650,
    weightGrams: 340,
    tastingNotes: ['Peanut', 'Dark cocoa', 'Molasses'],
    process: 'Natural',
    altitudeMeters: 1100,
    lat: -18.92,
    lng: -46.99,
    accent: '#5a3520',
    stock: 55,
    active: true,
    description:
      'Naturally processed and dried whole-cherry under the Minas Gerais sun, this is comfort in a cup and the backbone of our house espresso. Roasted a touch darker for a thick crema: roasted peanut, dark cocoa, and molasses with low acidity. Steams into a flawless flat white.',
  },
  {
    id: 'nyamasheke-kilimbi',
    name: 'Kilimbi, Nyamasheke',
    origin: 'Lake Kivu, Rwanda',
    roast: 'Light',
    priceCents: 2300,
    weightGrams: 340,
    tastingNotes: ['Black tea', 'Red plum', 'Honeycomb'],
    process: 'Washed',
    altitudeMeters: 1900,
    lat: -2.35,
    lng: 29.14,
    accent: '#7a4b8c',
    stock: 16,
    active: true,
    description:
      'From the hills above Lake Kivu, the Kilimbi station processes red-cherry Bourbon from nearby smallholders. A delicate, elegant African cup: a black-tea structure carrying red plum and a honeycomb sweetness that lingers. Reward for a careful, slightly cooler pour-over.',
  },
]
