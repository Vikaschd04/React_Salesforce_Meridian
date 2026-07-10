import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useCart } from '../context/CartContext.jsx'
import MobileMenu from './MobileMenu.jsx'
import AccountMenu from './AccountMenu.jsx'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/shop', label: 'Shop' },
  { to: '/about', label: 'Our sourcing' },
]

export default function Navbar() {
  const { count } = useCart()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Close the mobile menu whenever the route changes.
  useEffect(() => setMenuOpen(false), [location.pathname])

  return (
    <header className="nav">
      <div className="container nav__inner">
        <button
          type="button"
          className="nav__burger"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>

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
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="nav__link">
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav__actions">
          <AccountMenu />
          <Link to="/cart" className="nav__cart" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>
            <svg className="nav__cart-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6h15l-1.5 9h-12L6 6Zm0 0-.7-3H2.5M9 20.5a1 1 0 1 0 0-.001M18 20.5a1 1 0 1 0 0-.001"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className={`nav__badge${count > 0 ? ' is-active' : ''}`}>{count}</span>
          </Link>
        </div>
      </div>

      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        links={LINKS}
        account={<AccountMenu variant="mobile" />}
      />
    </header>
  )
}
