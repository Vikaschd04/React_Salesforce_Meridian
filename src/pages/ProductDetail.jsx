import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProduct } from '../api/store.js'
import { useCart } from '../context/CartContext.jsx'
import { formatCents } from '../lib/money.js'
import ProductImage from '../components/ProductImage.jsx'
import CoordTag from '../components/CoordTag.jsx'
import QtyStepper from '../components/QtyStepper.jsx'
import Spinner from '../components/Spinner.jsx'
import ErrorState from '../components/ErrorState.jsx'

export default function ProductDetail() {
  const { id } = useParams()
  const { addItem } = useCart()
  const [product, setProduct] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    let alive = true
    setProduct(null)
    setError(null)
    setQty(1)
    setAdded(false)
    getProduct(id)
      .then((data) => alive && setProduct(data))
      .catch((err) => alive && setError(err))
    return () => {
      alive = false
    }
  }, [id, reloadKey])

  function handleAdd() {
    addItem(product.id, qty)
    setAdded(true)
    window.clearTimeout(handleAdd._t)
    handleAdd._t = window.setTimeout(() => setAdded(false), 2200)
  }

  return (
    <div className="container detail-wrap">
      <p className="crumb">
        <Link to="/" className="crumb__link">
          Coffee
        </Link>
        <span aria-hidden="true"> / </span>
        <span>{product ? product.name : '…'}</span>
      </p>

      {error ? (
        <ErrorState
          message={error.status === 404 ? 'We couldn’t find that coffee.' : error.message}
          onRetry={error.status === 404 ? undefined : () => setReloadKey((k) => k + 1)}
        />
      ) : !product ? (
        <Spinner label="Loading coffee…" />
      ) : (
        <article className="detail">
          <div className="detail__art">
            <ProductImage
              product={product}
              className="detail__img"
              loading="eager"
              sizes="(max-width: 820px) 100vw, 560px"
            />
            <span className="chip detail__roast" data-roast={product.roast}>
              {product.roast} roast
            </span>
          </div>

          <div className="detail__info">
            <CoordTag lat={product.lat} lng={product.lng} />
            <h1 className="detail__name">{product.name}</h1>
            <p className="detail__origin">{product.origin}</p>

            <p className="detail__notes">{product.tastingNotes.join(' · ')}</p>
            <p className="detail__desc">{product.description}</p>

            <dl className="specs">
              <div className="specs__row">
                <dt>Process</dt>
                <dd>{product.process}</dd>
              </div>
              <div className="specs__row">
                <dt>Altitude</dt>
                <dd>{product.altitudeMeters.toLocaleString()} masl</dd>
              </div>
              <div className="specs__row">
                <dt>Bag</dt>
                <dd>{product.weightGrams} g whole bean</dd>
              </div>
              <div className="specs__row">
                <dt>Availability</dt>
                <dd>{product.stock > 0 ? `${product.stock} in stock` : 'Sold out'}</dd>
              </div>
            </dl>

            <div className="detail__buy">
              <span className="detail__price">{formatCents(product.priceCents)}</span>
              <QtyStepper value={qty} onChange={setQty} idLabel="Quantity" />
              <button
                type="button"
                className="btn btn--block detail__add"
                onClick={handleAdd}
                disabled={product.stock <= 0}
              >
                {added ? 'Added to cart ✓' : 'Add to cart'}
              </button>
            </div>
            <p className="detail__ship" role={added ? 'status' : undefined}>
              {added ? 'In your cart — keep shopping or head to checkout.' : 'Free shipping over $45 · Roasted to order'}
            </p>
          </div>
        </article>
      )}
    </div>
  )
}
