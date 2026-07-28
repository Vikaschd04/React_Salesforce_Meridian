import { Link } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import useReveal from '../lib/useReveal.js'
import useSeo from '../lib/useSeo.js'

// Punchy, non-brittle credibility numbers (nothing tied to the catalog count).
const STATS = [
  { value: '100%', label: 'Single-origin — never a blend' },
  { value: '48h', label: 'Roasted to order, then shipped' },
  { value: 'GPS', label: 'Every lot traced to its coordinates' },
  { value: 'Direct', label: 'Above-market prices to growers' },
]

// The four sourcing principles — the original copy, now structured as pillars.
const PILLARS = [
  {
    tag: 'Traceability',
    title: 'Single origin, taken literally',
    body: `Every coffee we sell is a single lot from a single place. No blends, no “100%
      Arabica” hand-waving. When we say a coffee is from Gaharo Hill in Kayanza, we mean the
      cherry was picked, floated, and washed at that specific station — and we print its
      latitude and longitude on the bag so you can look it up yourself.`,
  },
  {
    tag: 'Relationships',
    title: 'Relationships, not commodities',
    body: `We buy through importers who share farm-level data and pay above the commodity
      price. That means smaller volumes and coffees that sell out — but it also means the
      growers we work with can invest in quality year over year. Several of our lots come back
      to us each harvest from the same families.`,
  },
  {
    tag: 'Craft',
    title: 'Roasted to show the origin',
    body: `Our roasting philosophy is restraint. A washed Ethiopian should taste like jasmine
      and bergamot; a natural Sumatran should taste like cedar and dark fruit. We dial each
      profile to highlight what the farm produced, then roast to order and ship within 48 hours
      so it reaches you at its peak.`,
  },
  {
    tag: 'Place',
    title: 'The map is the point',
    body: `The meridian — the line of zero longitude — is our namesake because coffee is, above
      all, a story of place. Altitude, latitude, soil, and rainfall shape the cup more than
      anything we do in the roastery. Our job is to find remarkable lots and get out of their
      way.`,
  },
]

export default function About() {
  useReveal([])
  useSeo({
    title: 'Our sourcing',
    description:
      'How Meridian sources single-origin coffee: farm-level traceability, relationships over commodities, and roasting that shows the origin.',
  })

  return (
    <div className="container about">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Our sourcing' }]} />

      <header className="page-head about__head">
        <p className="hero__eyebrow">Our sourcing</p>
        <h1 className="page-head__title">
          We know where your coffee is from. <span className="hero__accent">Exactly.</span>
        </h1>
        <p className="page-head__lede">
          Meridian started with a simple frustration: most coffee hides its origin behind a
          blend and a nice label. We wanted the opposite — coffee you can trace to a hillside,
          a family, and a set of coordinates.
        </p>
      </header>

      <section className="sourcing-stats reveal" aria-label="Meridian by the numbers">
        {STATS.map((s) => (
          <div className="stat" key={s.label}>
            <span className="stat__value">{s.value}</span>
            <span className="stat__label">{s.label}</span>
          </div>
        ))}
      </section>

      <section className="pillars" aria-label="How we source">
        {PILLARS.map((p) => (
          <article className="pillar reveal" key={p.title}>
            <span className="pillar__eyebrow">{p.tag}</span>
            <h2 className="pillar__title">{p.title}</h2>
            <p className="pillar__body">{p.body}</p>
          </article>
        ))}
      </section>

      <section className="sourcing-cta reveal">
        <p className="hero__eyebrow">51°28′N · 0°00′W</p>
        <h2 className="sourcing-cta__title">Start at the origin.</h2>
        <p className="sourcing-cta__lede">
          Every lot is traceable to a hillside and plotted to its coordinates. Find yours.
        </p>
        <div className="sourcing-cta__row">
          <Link to="/shop" className="btn">
            Explore the coffees
          </Link>
          <Link to="/contact" className="btn btn--ghost">
            Talk to us
          </Link>
        </div>
      </section>
    </div>
  )
}
