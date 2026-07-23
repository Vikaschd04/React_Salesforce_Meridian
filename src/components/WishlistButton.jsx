import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useWishlist } from '../context/WishlistContext.jsx'

/**
 * Heart toggle for saving a product to the wishlist. Filled (♥) when saved,
 * outline (♡) otherwise. A logged-out shopper is routed to /login (v1 requires
 * an account to save). `variant` picks the styling: 'icon' (bare heart, for the
 * product-card corner) or 'labeled' (heart + "Save"/"Saved", for detail pages).
 */
export default function WishlistButton({ productId, productName, variant = 'icon' }) {
  const { user } = useAuth()
  const { has, toggle } = useWishlist()
  const navigate = useNavigate()
  const saved = has(productId)

  function onClick(e) {
    // On a product card the heart sits over a link area — never navigate.
    e.preventDefault()
    e.stopPropagation()
    if (!user) {
      navigate('/login', { state: { from: '/shop' } })
      return
    }
    toggle(productId)
  }

  const label = saved ? `Remove ${productName || 'product'} from wishlist` : `Save ${productName || 'product'} to wishlist`

  if (variant === 'labeled') {
    return (
      <button
        type="button"
        className={`wishlist-btn wishlist-btn--labeled${saved ? ' is-saved' : ''}`}
        onClick={onClick}
        aria-pressed={saved}
        aria-label={label}
      >
        <span className="wishlist-btn__heart" aria-hidden="true">
          {saved ? '♥' : '♡'}
        </span>
        {saved ? 'Saved' : 'Save'}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`wishlist-btn wishlist-btn--icon${saved ? ' is-saved' : ''}`}
      onClick={onClick}
      aria-pressed={saved}
      aria-label={label}
      title={label}
    >
      <span className="wishlist-btn__heart" aria-hidden="true">
        {saved ? '♥' : '♡'}
      </span>
    </button>
  )
}
