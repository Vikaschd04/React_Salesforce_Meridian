import { useEffect, useState } from 'react'
import { getBundles } from '../api/store.js'
import BundleCard from '../components/BundleCard.jsx'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import Spinner from '../components/Spinner.jsx'
import ErrorState from '../components/ErrorState.jsx'
import useSeo from '../lib/useSeo.js'

export default function Bundles() {
  useSeo({
    title: 'Bundles',
    description:
      'Curated coffee bundles — sampler flights of Meridian single-origin coffees, at a saving over buying each bag on its own.',
  })

  const [bundles, setBundles] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    setBundles(null)
    setError(null)
    getBundles()
      .then((b) => alive && setBundles(b))
      .catch((e) => alive && setError(e))
    return () => {
      alive = false
    }
  }, [reloadKey])

  return (
    <div className="container bundles">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Bundles' }]} />

      <header className="page-head">
        <p className="hero__eyebrow">Bundles</p>
        <h1 className="page-head__title">
          Curated flights, <span className="hero__accent">less to pay.</span>
        </h1>
        <p className="page-head__lede">
          Hand-picked sets of our single-origin coffees — a themed tour in one box, priced below
          buying each bag on its own.
        </p>
      </header>

      {error ? (
        <ErrorState message={error.message} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : !bundles ? (
        <Spinner label="Assembling the flights…" />
      ) : bundles.length === 0 ? (
        <p className="shop__count">No bundles available right now.</p>
      ) : (
        <ul className="grid grid--bundles">
          {bundles.map((b, i) => (
            <li key={b.id} style={{ '--n': i }}>
              <BundleCard bundle={b} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
