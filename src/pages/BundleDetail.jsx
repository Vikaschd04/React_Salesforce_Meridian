import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getBundle } from '../api/store.js'
import { useCart } from '../context/CartContext.jsx'
import ProductImage from '../components/ProductImage.jsx'
import QtyStepper from '../components/QtyStepper.jsx'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import Spinner from '../components/Spinner.jsx'
import ErrorState from '../components/ErrorState.jsx'
import useSeo from '../lib/useSeo.js'
import { formatUsd } from '../lib/money.js'

export default function BundleDetail() {
  const { id } = useParams()
  const { addItem } = useCart()

  const [bundle, setBundle] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    let alive = true
    setBundle(null)
    setError(null)
    setQty(1)
    getBundle(id)
      .then((b) => alive && setBundle(b))
      .catch((e) => alive && setError(e))
    return () => {
      alive = false
    }
  }, [id, reloadKey])

  useSeo(
    bundle
      ? { title: bundle.name, description: bundle.description, image: bundle.image, type: 'product' }
      : { title: 'Bundle' },
  )

  function handleAdd() {
    addItem(bundle.id, qty)
    setAdded(true)
    window.clearTimeout(handleAdd._t)
    handleAdd._t = window.setTimeout(() => setAdded(false), 2200)
  }

  const crumbs = [
    { label: 'Home', to: '/' },
    { label: 'Bundles', to: '/bundles' },
    { label: bundle?.name || 'Bundle' },
  ]

  if (error) {
    return (
      <div className="container detail-wrap">
        <Breadcrumbs items={crumbs} />
        <ErrorState message={error.message} onRetry={() => setReloadKey((k) => k + 1)} />
      </div>
    )
  }
  if (!bundle) {
    return (
      <div className="container detail-wrap">
        <Breadcrumbs items={crumbs} />
        <Spinner label="Loading bundle…" />
      </div>
    )
  }

  const soldOut = bundle.stock <= 0

  return (
    <div className="container detail-wrap">
      <Breadcrumbs items={crumbs} />

      <div className="bundle-detail">
        <div className="bundle-detail__art">
          <div className="bundle-detail__thumbs" data-count={bundle.components.length}>
            {bundle.components.map((c) => (
              <Link key={c.id} to={`/product/${c.id}`} className="bundle-detail__thumb-link">
                <ProductImage product={c} className="bundle-detail__thumb" loading="eager" />
              </Link>
            ))}
          </div>
          {bundle.savings > 0 && (
            <span className="bundle-detail__save">
              Save {formatUsd(bundle.savings)} ({bundle.savingsPct}%)
            </span>
          )}
        </div>

        <div className="bundle-detail__info">
          <p className="hero__eyebrow">{bundle.components.length}-coffee bundle</p>
          <h1 className="bundle-detail__name">{bundle.name}</h1>
          <p className="bundle-detail__desc">{bundle.description}</p>

          <div className="bundle-detail__price">
            <span className="bundle-detail__now">{formatUsd(bundle.price)}</span>
            {bundle.savings > 0 && (
              <span className="bundle-detail__was">{formatUsd(bundle.componentTotal)}</span>
            )}
          </div>

          <div className="bundle-detail__contents">
            <h2 className="bundle-detail__contents-title">What’s inside</h2>
            <ul className="bundle-contents">
              {bundle.components.map((c) => (
                <li key={c.id} className="bundle-content">
                  <ProductImage product={c} className="bundle-content__img" />
                  <div className="bundle-content__meta">
                    <Link to={`/product/${c.id}`} className="bundle-content__name">
                      {c.name}
                      {c.qty > 1 ? ` ×${c.qty}` : ''}
                    </Link>
                    <span className="bundle-content__sub">
                      {[c.roast && `${c.roast} roast`, c.origin].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <span className="bundle-content__price">{formatUsd(c.price)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bundle-detail__buy">
            <QtyStepper value={qty} onChange={setQty} max={Math.max(1, bundle.stock)} idLabel="Quantity" />
            <button
              type="button"
              className="btn bundle-detail__add"
              onClick={handleAdd}
              disabled={soldOut}
            >
              {soldOut ? 'Sold out' : added ? 'Added to cart ✓' : 'Add bundle to cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
