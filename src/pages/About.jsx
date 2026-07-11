import { Link } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import useReveal from '../lib/useReveal.js'
import useSeo from '../lib/useSeo.js'

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

      <header className="page-head">
        <p className="hero__eyebrow">Our sourcing</p>
        <h1 className="page-head__title">We know where your coffee is from. Exactly.</h1>
        <p className="page-head__lede">
          Meridian started with a simple frustration: most coffee hides its origin behind a
          blend and a nice label. We wanted the opposite — coffee you can trace to a hillside,
          a family, and a set of coordinates.
        </p>
      </header>

      <div className="prose reveal">
        <h2>Single origin, taken literally</h2>
        <p>
          Every coffee we sell is a single lot from a single place. No blends, no “100%
          Arabica” hand-waving. When we say a coffee is from Gaharo Hill in Kayanza, we mean
          the cherry was picked, floated, and washed at that specific station — and we print
          its latitude and longitude on the bag so you can look it up yourself.
        </p>

        <h2>Relationships, not commodities</h2>
        <p>
          We buy through importers who share farm-level data and pay above the commodity price.
          That means smaller volumes and coffees that sell out — but it also means the growers
          we work with can invest in quality year over year. Several of our lots come back to
          us each harvest from the same families.
        </p>

        <h2>Roasted to show the origin</h2>
        <p>
          Our roasting philosophy is restraint. A washed Ethiopian should taste like jasmine
          and bergamot; a natural Sumatran should taste like cedar and dark fruit. We dial each
          profile to highlight what the farm produced, then roast to order and ship within 48
          hours so it reaches you at its peak.
        </p>

        <h2>The map is the point</h2>
        <p>
          The meridian — the line of zero longitude — is our namesake because coffee is, above
          all, a story of place. Altitude, latitude, soil, and rainfall shape the cup more than
          anything we do in the roastery. Our job is to find remarkable lots and get out of
          their way.
        </p>
      </div>

      <div className="about__cta">
        <Link to="/shop" className="btn">
          Explore the coffees
        </Link>
      </div>
    </div>
  )
}
