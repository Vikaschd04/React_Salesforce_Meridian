import { useEffect, useState } from 'react'
import { getProducts } from '../api/store.js'
import ProductCard from '../components/ProductCard.jsx'
import Spinner from '../components/Spinner.jsx'
import ErrorState from '../components/ErrorState.jsx'

export default function Catalog() {
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
          <a href="#catalog" className="btn hero__cta">
            Browse the coffees
          </a>
        </div>
      </section>

      <section id="catalog" className="container catalog" aria-labelledby="catalog-heading">
        <div className="section-head">
          <h2 id="catalog-heading" className="section-head__title">
            This month’s lots
          </h2>
          <span className="meridian-rule">
            {products ? `${products.length} origins` : 'Loading origins'}
          </span>
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : !products ? (
          <Spinner label="Plotting the map…" />
        ) : (
          <ul className="grid">
            {products.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
