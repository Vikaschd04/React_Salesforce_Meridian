import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container cart-empty">
      <span className="meridian-rule">Error · off the map</span>
      <h1 className="cart-empty__title">Page not found</h1>
      <p className="cart-empty__text">
        These coordinates don’t point anywhere. Let’s get you back on course.
      </p>
      <Link to="/" className="btn">
        Back to the coffees
      </Link>
    </div>
  )
}
