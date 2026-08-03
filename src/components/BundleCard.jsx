import { useState } from 'react'
import { Link } from 'react-router-dom'
import ProductImage from './ProductImage.jsx'
import { formatUsd } from '../lib/money.js'
import { useCart } from '../context/CartContext.jsx'
import useTilt from '../lib/useTilt.js'

/**
 * Catalog tile for a product bundle. Mirrors ProductCard (same `.card` shell,
 * image, and body) so bundles read as first-class products, with a bundle count
 * label tag, a savings badge, and the coffees inside as the "notes" line.
 */
export default function BundleCard({ bundle }) {
  const { addItem } = useCart()
  const tilt = useTilt(6)
  const [added, setAdded] = useState(false)

  const soldOut = bundle.stock <= 0

  function quickAdd(e) {
    e.preventDefault()
    e.stopPropagation()
    if (soldOut) return
    addItem(bundle.id, 1)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1600)
  }

  return (
    <article
      className="card"
      ref={tilt.ref}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
    >
      <Link to={`/bundles/${bundle.id}`} className="card__link" viewTransition>
        <div className="card__art">
          {/* Collage of the coffees inside, so shoppers see what's in the box. */}
          <div className="card__bundle-imgs" data-count={bundle.components.length}>
            {bundle.components.map((c) => (
              <ProductImage key={c.id} product={c} className="card__bundle-img" loading="eager" />
            ))}
          </div>
          <span className="card__bundle-tag">Bundle · {bundle.components.length} coffees</span>
          {bundle.savings > 0 && <span className="card__save">Save {bundle.savingsPct}%</span>}
          {soldOut && <span className="card__stock card__stock--out">Sold out</span>}
          <button
            type="button"
            className={`card__quick${added ? ' is-added' : ''}`}
            onClick={quickAdd}
            disabled={soldOut}
            aria-label={soldOut ? `${bundle.name} is sold out` : `Add ${bundle.name} to cart`}
          >
            {soldOut ? 'Sold out' : added ? '✓ Added' : '+ Add'}
          </button>
        </div>
        <div className="card__body">
          <h3 className="card__name">{bundle.name}</h3>
          <p className="card__notes">{bundle.components.map((c) => c.name).join(' · ')}</p>
          <div className="card__foot">
            <span className="card__price">
              {formatUsd(bundle.price)}
              {bundle.savings > 0 && <span className="card__was">{formatUsd(bundle.componentTotal)}</span>}
            </span>
            <span className="card__cta" aria-hidden="true">
              View →
            </span>
          </div>
        </div>
        <span className="card__glare" aria-hidden="true" />
      </Link>
    </article>
  )
}
