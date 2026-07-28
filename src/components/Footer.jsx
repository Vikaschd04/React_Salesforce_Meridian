import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Placeholder social profiles for the demo brand. Meridian is a fictional
// storefront, so these point at the platforms' homepages — swap in real handles
// for a live store.
const SOCIALS = [
  {
    name: 'Instagram',
    href: 'https://instagram.com',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="3.8" />
        <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: 'X',
    href: 'https://x.com',
    icon: (
      <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
        <path d="M17.53 3H20.5l-6.51 7.44L21.75 21h-6.02l-4.71-6.16L5.6 21H2.63l6.96-7.96L2.25 3h6.17l4.26 5.63L17.53 3Zm-1.06 16.2h1.65L7.6 4.71H5.83l10.64 14.49Z" />
      </svg>
    ),
  },
  {
    name: 'TikTok',
    href: 'https://tiktok.com',
    icon: (
      <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
        <path d="M16.5 3c.33 2.2 1.62 3.7 3.7 3.9v2.53c-1.3.06-2.55-.34-3.7-1.04v5.6c0 3.12-2.3 5.56-5.35 5.56A5.3 5.3 0 0 1 5.9 14.05a5.3 5.3 0 0 1 6.1-5.2v2.72a2.7 2.7 0 0 0-1-.2 2.55 2.55 0 1 0 2.65 2.55V3h2.85Z" />
      </svg>
    ),
  },
  {
    name: 'YouTube',
    href: 'https://youtube.com',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" aria-hidden="true">
        <path d="M22 12s0-3.2-.4-4.72a2.5 2.5 0 0 0-1.76-1.76C18.32 5.12 12 5.12 12 5.12s-6.32 0-7.84.4A2.5 2.5 0 0 0 2.4 7.28C2 8.8 2 12 2 12s0 3.2.4 4.72a2.5 2.5 0 0 0 1.76 1.76c1.52.4 7.84.4 7.84.4s6.32 0 7.84-.4a2.5 2.5 0 0 0 1.76-1.76C22 15.2 22 12 22 12Zm-12 3.05v-6.1L15.2 12 10 15.05Z" />
      </svg>
    ),
  },
]

export default function Footer() {
  const year = new Date().getFullYear()
  const { user } = useAuth()
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <p className="footer__word">Meridian</p>
          <p className="footer__tag">
            Single-origin coffee, roasted to its coordinates and shipped within 48 hours.
          </p>
          <ul className="footer__social" aria-label="Follow Meridian">
            {SOCIALS.map((s) => (
              <li key={s.name}>
                <a
                  href={s.href}
                  className="footer__social-link"
                  aria-label={s.name}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {s.icon}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <nav className="footer__cols" aria-label="Footer">
          <div className="footer__col">
            <h3 className="footer__heading">Shop</h3>
            <ul>
              <li><Link to="/shop">All coffees</Link></li>
              <li><Link to="/shop?roast=Light">Light roasts</Link></li>
              <li><Link to="/shop?roast=Medium">Medium roasts</Link></li>
              <li><Link to="/shop?roast=Dark">Dark roasts</Link></li>
            </ul>
          </div>
          <div className="footer__col">
            <h3 className="footer__heading">Company</h3>
            <ul>
              <li><Link to="/about">Our sourcing</Link></li>
              {/* Guests track here; logged-in shoppers use their order history. */}
              {user ? (
                <li><Link to="/account/orders">Order history</Link></li>
              ) : (
                <li><Link to="/track">Track your order</Link></li>
              )}
              <li><Link to="/account">Your account</Link></li>
              <li><Link to="/contact">Help &amp; FAQ</Link></li>
            </ul>
          </div>
        </nav>

        <div className="footer__contact">
          <h3 className="footer__heading">Get in touch</h3>
          <address className="footer__address">
            The Roastery, Unit 7<br />
            Greenwich, London SE10
          </address>
          <a className="footer__contact-link" href="mailto:hello@meridian.coffee">
            hello@meridian.coffee
          </a>
          <a className="footer__contact-link" href="tel:+442080000000">+44 20 8000 0000</a>
          <Link to="/contact" className="btn btn--ghost footer__contact-btn">
            Contact us
          </Link>
        </div>
      </div>

      <div className="footer__base">
        <div className="container footer__base-inner">
          <p className="footer__fine">© {year} Meridian Coffee Co. · 51°28′N 0°00′W</p>
          <nav className="footer__legal" aria-label="Legal">
            {/* Placeholder legal pages for the demo. */}
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Shipping &amp; returns</a>
          </nav>
          <p className="footer__fine">Built as a Salesforce-backed storefront.</p>
        </div>
      </div>
    </footer>
  )
}
