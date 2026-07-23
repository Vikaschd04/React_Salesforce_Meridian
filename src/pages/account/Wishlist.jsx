import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProducts } from '../../api/store.js'
import { useWishlist } from '../../context/WishlistContext.jsx'
import ProductCard from '../../components/ProductCard.jsx'
import Spinner from '../../components/Spinner.jsx'
import ErrorState from '../../components/ErrorState.jsx'

/**
 * Wishlist tab: the shopper's saved coffees. Reads the id set from
 * WishlistContext and joins it against the catalog (loaded once, like
 * RelatedProducts). Un-hearting a card removes it from the set → it drops out
 * of the grid live. Only reachable when logged in (AccountLayout guards).
 */
export default function Wishlist() {
  const { ids } = useWishlist()
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    setCatalog(null)
    setError(null)
    getProducts()
      .then((all) => alive && setCatalog(all))
      .catch((err) => alive && setError(err))
    return () => {
      alive = false
    }
  }, [reloadKey])

  if (error) {
    return <ErrorState message={error.message} onRetry={() => setReloadKey((k) => k + 1)} />
  }
  if (!catalog) return <Spinner label="Loading your wishlist…" />

  // Preserve the catalog's order; filter to saved ids.
  const saved = catalog.filter((p) => ids.has(p.id))

  if (saved.length === 0) {
    return (
      <div className="account-empty">
        <p>No saved coffees yet. Tap the heart on any coffee to save it here.</p>
        <Link to="/shop" className="btn">
          Browse coffees
        </Link>
      </div>
    )
  }

  return (
    <ul className="grid wishlist-grid">
      {saved.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  )
}
