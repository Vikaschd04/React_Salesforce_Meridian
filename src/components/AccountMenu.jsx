import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

/**
 * Account entry point in the navbar.
 * - variant "desktop" (default): a button that opens a dropdown.
 * - variant "mobile": a flat list for the slide-in menu.
 * Reflects auth state: logged out → Log in / Sign up; logged in → Account /
 * Orders / Log out.
 */
export default function AccountMenu({ variant = 'desktop' }) {
  const { user, isAuthed, logout, loading } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function handleLogout() {
    setOpen(false)
    await logout()
    navigate('/')
  }

  if (variant === 'mobile') {
    return (
      <ul className="mobile-menu__sublist">
        {isAuthed ? (
          <>
            <li className="mobile-menu__hello">Hi, {user.firstName || 'shopper'}</li>
            <li>
              <Link to="/account" className="mobile-menu__link">
                Your account
              </Link>
            </li>
            <li>
              <button type="button" className="mobile-menu__link as-button" onClick={handleLogout}>
                Log out
              </button>
            </li>
          </>
        ) : (
          <>
            <li>
              <Link to="/login" className="mobile-menu__link">
                Log in
              </Link>
            </li>
            <li>
              <Link to="/signup" className="mobile-menu__link">
                Sign up
              </Link>
            </li>
          </>
        )}
      </ul>
    )
  }

  return (
    <div className="account" ref={ref}>
      <button
        type="button"
        className="account__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" className="account__icon" aria-hidden="true">
          <circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="account__label">
          {loading ? '' : isAuthed ? user.firstName || 'Account' : 'Account'}
        </span>
      </button>

      {open && (
        <div className="account__menu" role="menu">
          {isAuthed ? (
            <>
              <p className="account__greeting">Signed in as<br /><strong>{user.email}</strong></p>
              <Link to="/account" role="menuitem" className="account__item" onClick={() => setOpen(false)}>
                Your account
              </Link>
              <Link to="/account" role="menuitem" className="account__item" onClick={() => setOpen(false)}>
                Order history
              </Link>
              <button type="button" role="menuitem" className="account__item account__item--danger" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" role="menuitem" className="account__item" onClick={() => setOpen(false)}>
                Log in
              </Link>
              <Link to="/signup" role="menuitem" className="account__item" onClick={() => setOpen(false)}>
                Create an account
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
