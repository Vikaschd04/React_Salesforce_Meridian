import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import ThemeToggle from './ThemeToggle.jsx'

/**
 * Slide-in mobile navigation. Rendered only when open; traps nothing fancy but
 * closes on route change (parent controls `open`), Escape, and backdrop click.
 */
export default function MobileMenu({ open, onClose, links, account }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
      <button className="mobile-menu__backdrop" aria-label="Close menu" onClick={onClose} />
      <nav className="mobile-menu__panel" aria-label="Mobile">
        <ul className="mobile-menu__list">
          {links.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                end={l.end}
                className="mobile-menu__link"
                onClick={onClose}
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
        {account && <div className="mobile-menu__account">{account}</div>}
        <div className="mobile-menu__theme">
          <span className="mobile-menu__theme-label">Appearance</span>
          <ThemeToggle />
        </div>
      </nav>
    </div>
  )
}
