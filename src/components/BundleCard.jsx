import { Link } from 'react-router-dom'
import ProductImage from './ProductImage.jsx'
import { formatUsd } from '../lib/money.js'

/**
 * Catalog tile for a product bundle. Shows the coffees inside (thumbnails),
 * the saving vs buying separately, and the bundle price. Links to the bundle
 * detail page.
 */
export default function BundleCard({ bundle }) {
  const { id, name, price, componentTotal, savings, savingsPct, components } = bundle
  return (
    <article className="bundle-card">
      <Link to={`/bundles/${id}`} className="bundle-card__link" viewTransition>
        <div className="bundle-card__thumbs">
          {components.slice(0, 4).map((c) => (
            <ProductImage key={c.id} product={c} className="bundle-card__thumb" />
          ))}
          {savings > 0 && (
            <span className="bundle-card__save">
              Save {savingsPct}%
            </span>
          )}
        </div>
        <div className="bundle-card__body">
          <span className="bundle-card__count">{components.length}-coffee bundle</span>
          <h3 className="bundle-card__name">{name}</h3>
          <p className="bundle-card__contents">{components.map((c) => c.name).join(' · ')}</p>
          <div className="bundle-card__foot">
            <span className="bundle-card__price">
              <span className="bundle-card__now">{formatUsd(price)}</span>
              {savings > 0 && <span className="bundle-card__was">{formatUsd(componentTotal)}</span>}
            </span>
            <span className="bundle-card__cta" aria-hidden="true">
              View →
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}
