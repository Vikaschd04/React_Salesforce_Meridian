import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProducts } from '../api/store.js'
import ProductCard from '../components/ProductCard.jsx'
import CoordTicker from '../components/CoordTicker.jsx'
import Spinner from '../components/Spinner.jsx'
import ErrorState from '../components/ErrorState.jsx'
import JsonLd from '../components/JsonLd.jsx'
import useSeo from '../lib/useSeo.js'
import useReveal from '../lib/useReveal.js'
import useParallax from '../lib/useParallax.js'

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
  const [products, setProducts] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    setProducts(null)
    setError(null)
    getProducts()
      .then((data) => alive && setProducts(data))
      .catch((err) => alive && setError(err))
    return () => {
      alive = false
    }
  }, [reloadKey])

  useReveal([products])
  const heroRef = useParallax()
  useSeo({
    description:
      'Meridian roasts single-origin coffee traced to named farms and plotted to their coordinates. No blends, no anonymity — shipped fresh.',
  })

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const featured = products ? products.slice(0, 3) : null

  return (
    <>
      <JsonLd
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Meridian',
            url: origin,
            logo: `${origin}/favicon.svg`,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Meridian',
            url: origin,
            potentialAction: {
              '@type': 'SearchAction',
              target: `${origin}/shop?q={search_term_string}`,
              'query-input': 'required name=search_term_string',
            },
          },
        ]}
      />
      <section className="hero" ref={heroRef}>
        {/* layered cinematic backdrop: drifting grid, origin points, and a
            3D armillary sphere — each layer parallaxes at its own depth */}
        <div className="hero__sky" aria-hidden="true">
          <div className="hero__grid hero__layer" style={{ '--depth': 8 }} />
          <div className="hero__layer" style={{ '--depth': 18 }}>
            <span className="hero__point" style={{ '--x': '18%', '--y': '32%', '--d': '0s' }} />
            <span className="hero__point" style={{ '--x': '64%', '--y': '18%', '--d': '1.2s' }} />
            <span className="hero__point" style={{ '--x': '82%', '--y': '58%', '--d': '2.1s' }} />
            <span className="hero__point" style={{ '--x': '38%', '--y': '72%', '--d': '3s' }} />
          </div>
          <div className="armillary hero__layer" style={{ '--depth': 30 }}>
            <span className="armillary__ring armillary__ring--1" />
            <span className="armillary__ring armillary__ring--2" />
            <span className="armillary__ring armillary__ring--3" />
            <span className="armillary__core" />
          </div>
        </div>

        <div className="container hero__inner">
          <p className="hero__eyebrow hero__stagger" style={{ '--i': 0 }}>
            Est. at 0° · Prime Meridian Roasters
          </p>
          <h1 className="hero__title hero__stagger" style={{ '--i': 1 }}>
            Coffee with a<span className="hero__accent"> fixed address.</span>
          </h1>
          <p className="hero__lede hero__stagger" style={{ '--i': 2 }}>
            Every Meridian coffee is a single lot from a single place — traced to the farm,
            plotted to its coordinates, and roasted to show exactly where it came from. No
            blends, no anonymity, no filler.
          </p>
          <div className="hero__cta-row hero__stagger" style={{ '--i': 3 }}>
            <Link to="/shop" className="btn">
              Shop the coffees
            </Link>
            <Link to="/about" className="btn btn--ghost">
              Our sourcing
            </Link>
          </div>
        </div>

        <div className="hero__scrollcue hero__stagger" style={{ '--i': 5 }} aria-hidden="true">
          <span className="hero__scrollcue-line" />
          scroll
        </div>

        {products && <CoordTicker products={products} />}
      </section>

      <section className="container home-section" aria-labelledby="featured-heading">
        <div className="section-head reveal">
          <h2 id="featured-heading" className="section-head__title">
            This month’s lots
          </h2>
          <Link to="/shop" className="section-head__link">
            View all {products ? products.length : ''} →
          </Link>
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : !featured ? (
          <Spinner label="Scanning origins…" />
        ) : (
          <ul className="grid grid--3">
            {featured.map((product, i) => (
              <li key={product.id} className="reveal" style={{ '--reveal-delay': `${i * 0.12}s` }}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="roast-guide">
        <div className="container">
          <div className="section-head reveal">
            <h2 className="section-head__title">Find your roast</h2>
            <span className="meridian-rule">Light · Medium · Dark</span>
          </div>
          <div className="roast-guide__grid">
            {ROAST_GUIDE.map((r, i) => (
              <article
                key={r.roast}
                className="roast-card reveal"
                style={{ '--reveal-delay': `${i * 0.12}s` }}
              >
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
          {[
            {
              coord: '01 · Sourced',
              title: 'Named farms, real coordinates',
              text: 'We buy single lots from growers we can point to on a map — and we print those coordinates on every bag.',
            },
            {
              coord: '02 · Roasted',
              title: 'To order, in small batches',
              text: 'Each roast is dialled in to show the origin, not the roaster. We ship within 48 hours of roasting.',
            },
            {
              coord: '03 · Shipped',
              title: 'Whole bean, at peak',
              text: 'Sealed with a one-way valve so it arrives fresh. Free shipping on orders over $45.',
            },
          ].map((p, i) => (
            <div key={p.coord} className="promise__item reveal" style={{ '--reveal-delay': `${i * 0.12}s` }}>
              <span className="promise__coord">{p.coord}</span>
              <h3 className="promise__title">{p.title}</h3>
              <p>{p.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
