import { Link } from 'react-router-dom'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <p className="footer__word">Meridian</p>
          <p className="footer__tag">Single-origin coffee, roasted to its coordinates.</p>
        </div>

        <nav className="footer__cols" aria-label="Footer">
          <div className="footer__col">
            <h3 className="footer__heading">Shop</h3>
            <ul>
              <li><Link to="/shop">All coffees</Link></li>
              <li><Link to="/shop">Light roasts</Link></li>
              <li><Link to="/shop">Medium roasts</Link></li>
              <li><Link to="/shop">Dark roasts</Link></li>
            </ul>
          </div>
          <div className="footer__col">
            <h3 className="footer__heading">Company</h3>
            <ul>
              <li><Link to="/about">Our sourcing</Link></li>
              <li><Link to="/contact">Contact</Link></li>
              <li><Link to="/account">Your account</Link></li>
              <li><Link to="/account/orders">Order history</Link></li>
            </ul>
          </div>
          <div className="footer__col">
            <h3 className="footer__heading">Brew with us</h3>
            <ul>
              <li>Free shipping over $45</li>
              <li>Roasted &amp; shipped in 48h</li>
              <li><Link to="/contact">hello@meridian.coffee</Link></li>
            </ul>
          </div>
        </nav>
      </div>

      <div className="footer__base">
        <div className="container footer__base-inner">
          <p className="footer__fine">© {year} Meridian Coffee Co. · 0°00′00″ N, 0°00′00″ E</p>
          <p className="footer__fine">Built as a Salesforce-backed storefront.</p>
        </div>
      </div>
    </footer>
  )
}
