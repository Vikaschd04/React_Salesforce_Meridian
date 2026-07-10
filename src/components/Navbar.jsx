import { Link, NavLink } from 'react-router-dom'
import { useCart } from '../context/CartContext.jsx'

export default function Navbar() {
  const { count } = useCart()

  return (
    <header className="nav">
      <div className="container nav__inner">
        <Link to="/" className="nav__brand" aria-label="Meridian — home">
          <svg className="nav__mark" viewBox="0 0 32 32" aria-hidden="true">
            <line x1="16" y1="2" x2="16" y2="30" stroke="var(--gold)" strokeWidth="1" />
            <path
              d="M7 23V10l9 8 9-8v13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="nav__wordmark">Meridian</span>
        </Link>

        <nav className="nav__links" aria-label="Primary">
          <NavLink to="/" className="nav__link" end>
            Coffee
          </NavLink>
          <NavLink to="/cart" className="nav__link nav__cart">
            Cart
            <span
              className={`nav__badge${count > 0 ? ' is-active' : ''}`}
              aria-label={`${count} item${count === 1 ? '' : 's'} in cart`}
            >
              {count}
            </span>
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
