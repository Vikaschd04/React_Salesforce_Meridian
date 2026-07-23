import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getProduct } from '../api/store.js'
import { useCart } from '../context/CartContext.jsx'
import { formatCents } from '../lib/money.js'
import ProductImage from '../components/ProductImage.jsx'
import CoordTag from '../components/CoordTag.jsx'
import RelatedProducts from '../components/RelatedProducts.jsx'
import ProductReviews from '../components/ProductReviews.jsx'
import WishlistButton from '../components/WishlistButton.jsx'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import JsonLd from '../components/JsonLd.jsx'
import useSeo from '../lib/useSeo.js'
import useTilt from '../lib/useTilt.js'
import QtyStepper from '../components/QtyStepper.jsx'
import Spinner from '../components/Spinner.jsx'
import ErrorState from '../components/ErrorState.jsx'

export default function ProductDetail() {
  const { id } = useParams()
  const { addItem } = useCart()
  const tilt = useTilt(4)
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

  useSeo(
    product
      ? {
          title: product.name,
          description: `${product.tastingNotes.join(', ')} — single-origin ${product.roast.toLowerCase()} roast from ${product.origin}, roasted to order.`,
          image: product.image,
          type: 'product',
        }
      : { title: 'Coffee' },
  )

  function handleAdd() {
    addItem(product.id, qty)
    setAdded(true)
    window.clearTimeout(handleAdd._t)
    handleAdd._t = window.setTimeout(() => setAdded(false), 2200)
  }

  return (
    <div className="container detail-wrap">
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Shop', to: '/shop' },
          { label: product ? product.name : '…' },
        ]}
      />

      {error ? (
        <ErrorState
          message={error.status === 404 ? 'We couldn’t find that coffee.' : error.message}
          onRetry={error.status === 404 ? undefined : () => setReloadKey((k) => k + 1)}
        />
      ) : !product ? (
        <Spinner label="Loading coffee…" />
      ) : (
        <article className="detail">
          <JsonLd
            data={{
              '@context': 'https://schema.org',
              '@type': 'Product',
              name: product.name,
              image: `${window.location.origin}${product.image}`,
              description:
                product.description ||
                `${product.tastingNotes.join(', ')} — single-origin coffee from ${product.origin}.`,
              brand: { '@type': 'Brand', name: 'Meridian' },
              category: 'Coffee',
              offers: {
                '@type': 'Offer',
                price: (product.priceCents / 100).toFixed(2),
                priceCurrency: 'USD',
                availability:
                  product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                url: window.location.href.split('#')[0],
              },
            }}
          />
          <div
            className="detail__art"
            ref={tilt.ref}
            onPointerMove={tilt.onPointerMove}
            onPointerLeave={tilt.onPointerLeave}
          >
            <ProductImage
              product={product}
              className="detail__img"
              loading="eager"
              sizes="(max-width: 820px) 100vw, 560px"
              style={{ viewTransitionName: `product-${product.id}` }}
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
                <dd className={product.stock <= 5 ? 'specs__stock' : undefined}>
                  {product.stock > 0 ? `${product.stock} in stock` : 'Sold out'}
                </dd>
              </div>
            </dl>

            <div className="detail__buy">
              <span className="detail__price">{formatCents(product.priceCents)}</span>
              <QtyStepper
                value={qty}
                onChange={setQty}
                max={Math.max(1, product.stock)}
                idLabel="Quantity"
              />
              <button
                type="button"
                className="btn btn--block detail__add"
                onClick={handleAdd}
                disabled={product.stock <= 0}
              >
                {product.stock <= 0 ? 'Sold out' : added ? 'Added to cart ✓' : 'Add to cart'}
              </button>
              <WishlistButton productId={product.id} productName={product.name} variant="labeled" />
            </div>
            <p className="detail__ship" role={added ? 'status' : undefined}>
              {added ? 'In your cart — keep shopping or head to checkout.' : 'Free shipping over $45 · Roasted to order'}
            </p>
          </div>
        </article>
      )}

      {product && <ProductReviews productId={product.id} />}
      {product && <RelatedProducts product={product} />}
    </div>
  )
}
