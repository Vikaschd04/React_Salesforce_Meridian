export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div>
          <p className="footer__word">Meridian</p>
          <p className="footer__tag">Single-origin coffee, roasted to its coordinates.</p>
        </div>
        <p className="footer__fine">
          © {year} Meridian Coffee Co. · Roasted in small batches, shipped within 48 hours.
        </p>
      </div>
    </footer>
  )
}
