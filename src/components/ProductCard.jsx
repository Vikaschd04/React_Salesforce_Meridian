import { useState } from 'react'
import { Link } from 'react-router-dom'
import ProductImage from './ProductImage.jsx'
import CoordTag from './CoordTag.jsx'
import { formatCents } from '../lib/money.js'
import { useCart } from '../context/CartContext.jsx'
import WishlistButton from './WishlistButton.jsx'
import useTilt from '../lib/useTilt.js'

export default function ProductCard({ product }) {
  const { addItem } = useCart()
  const tilt = useTilt(6)
  const [added, setAdded] = useState(false)

  const soldOut = product.stock <= 0
  const lowStock = !soldOut && product.stock <= 5

  function quickAdd(e) {
    // The button sits inside the card link — don't navigate.
    e.preventDefault()
    e.stopPropagation()
    if (soldOut) return
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
      {/* Sibling of the card link (not nested inside it) — a button inside an
          <a> is invalid/inaccessible. Positioned over the card corner via CSS. */}
      <WishlistButton productId={product.id} productName={product.name} variant="icon" />
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
          {soldOut ? (
            <span className="card__stock card__stock--out">Sold out</span>
          ) : (
            lowStock && <span className="card__stock">Only {product.stock} left</span>
          )}
          <button
            type="button"
            className={`card__quick${added ? ' is-added' : ''}`}
            onClick={quickAdd}
            disabled={soldOut}
            aria-label={soldOut ? `${product.name} is sold out` : `Add ${product.name} to cart`}
          >
            {soldOut ? 'Sold out' : added ? '✓ Added' : '+ Add'}
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
