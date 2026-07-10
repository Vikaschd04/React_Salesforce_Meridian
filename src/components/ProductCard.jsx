import { useState } from 'react'
import { Link } from 'react-router-dom'
import ProductImage from './ProductImage.jsx'
import CoordTag from './CoordTag.jsx'
import { formatCents } from '../lib/money.js'
import { useCart } from '../context/CartContext.jsx'
import useTilt from '../lib/useTilt.js'

export default function ProductCard({ product }) {
  const { addItem } = useCart()
  const tilt = useTilt(6)
  const [added, setAdded] = useState(false)

  function quickAdd(e) {
    // The button sits inside the card link — don't navigate.
    e.preventDefault()
    e.stopPropagation()
    addItem(product.id, 1)
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
      <Link to={`/product/${product.id}`} className="card__link" viewTransition>
        <div className="card__art">
          <ProductImage
            product={product}
            className="card__img"
            sizes="(max-width: 640px) 100vw, 320px"
            style={{ viewTransitionName: `product-${product.id}` }}
          />
          <span className="chip card__roast" data-roast={product.roast}>
            {product.roast}
          </span>
          <button
            type="button"
            className={`card__quick${added ? ' is-added' : ''}`}
            onClick={quickAdd}
            aria-label={`Add ${product.name} to cart`}
          >
            {added ? '✓ Added' : '+ Add'}
          </button>
        </div>
        <div className="card__body">
          <CoordTag lat={product.lat} lng={product.lng} className="card__coords" />
          <h3 className="card__name">{product.name}</h3>
          <p className="card__origin">{product.origin}</p>
          <p className="card__notes">{product.tastingNotes.join(' · ')}</p>
          <div className="card__foot">
            <span className="card__price">{formatCents(product.priceCents)}</span>
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
