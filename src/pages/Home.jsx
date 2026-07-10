import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProducts } from '../api/store.js'
import ProductCard from '../components/ProductCard.jsx'
import Spinner from '../components/Spinner.jsx'
import ErrorState from '../components/ErrorState.jsx'

const ROAST_GUIDE = [
  {
    roast: 'Light',
    blurb: 'Bright, aromatic, and origin-forward. Florals, citrus, and tea-like clarity. Best as filter.',
  },
  {
    roast: 'Medium',
    blurb: 'Balanced and versatile. Caramel, chocolate, and ripe fruit. Happy in filter or espresso.',
  },
  {
    roast: 'Dark',
    blurb: 'Deep, low-acid, and full-bodied. Cocoa, spice, and molasses. Built for milk and moka.',
  },
]

export default function Home() {
  const [featured, setFeatured] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    setFeatured(null)
    setError(null)
    getProducts()
      .then((data) => alive && setFeatured(data.slice(0, 3)))
      .catch((err) => alive && setError(err))
    return () => {
      alive = false
    }
  }, [reloadKey])

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <p className="hero__eyebrow">Est. at 0° · Prime Meridian Roasters</p>
          <h1 className="hero__title">
            Coffee with a<span className="hero__accent"> fixed address.</span>
          </h1>
          <p className="hero__lede">
            Every Meridian coffee is a single lot from a single place — traced to the farm,
            plotted to its coordinates, and roasted to show exactly where it came from. No
            blends, no anonymity, no filler.
          </p>
          <div className="hero__cta-row">
            <Link to="/shop" className="btn">
              Shop the coffees
            </Link>
            <Link to="/about" className="btn btn--ghost">
              Our sourcing
            </Link>
          </div>
        </div>
      </section>

      <section className="container home-section" aria-labelledby="featured-heading">
        <div className="section-head">
          <h2 id="featured-heading" className="section-head__title">
            This month’s lots
          </h2>
          <Link to="/shop" className="section-head__link">
            View all 16 →
          </Link>
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : !featured ? (
          <Spinner label="Brewing the map…" />
        ) : (
          <ul className="grid grid--3">
            {featured.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="roast-guide">
        <div className="container">
          <div className="section-head">
            <h2 className="section-head__title">Find your roast</h2>
            <span className="meridian-rule">Light · Medium · Dark</span>
          </div>
          <div className="roast-guide__grid">
            {ROAST_GUIDE.map((r) => (
              <article key={r.roast} className="roast-card">
                <span className="chip" data-roast={r.roast}>
                  {r.roast} roast
                </span>
                <p className="roast-card__blurb">{r.blurb}</p>
                <Link to="/shop" className="roast-card__link">
                  Browse {r.roast.toLowerCase()} →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container promise">
        <div className="promise__grid">
          <div className="promise__item">
            <span className="promise__coord">01 · Sourced</span>
            <h3 className="promise__title">Named farms, real coordinates</h3>
            <p>
              We buy single lots from growers we can point to on a map — and we print those
              coordinates on every bag.
            </p>
          </div>
          <div className="promise__item">
            <span className="promise__coord">02 · Roasted</span>
            <h3 className="promise__title">To order, in small batches</h3>
            <p>
              Each roast is dialled in to show the origin, not the roaster. We ship within 48
              hours of roasting.
            </p>
          </div>
          <div className="promise__item">
            <span className="promise__coord">03 · Shipped</span>
            <h3 className="promise__title">Whole bean, at peak</h3>
            <p>
              Sealed with a one-way valve so it arrives fresh. Free shipping on orders over
              $45.
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
