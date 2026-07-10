import { Link } from 'react-router-dom'
import BagArt from './BagArt.jsx'
import CoordTag from './CoordTag.jsx'
import { formatCents } from '../lib/money.js'

export default function ProductCard({ product }) {
  return (
    <article className="card">
      <Link to={`/product/${product.id}`} className="card__link">
        <div className="card__art">
          <BagArt product={product} className="card__svg" />
          <span className="chip card__roast" data-roast={product.roast}>
            {product.roast}
          </span>
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
      </Link>
    </article>
  )
}
