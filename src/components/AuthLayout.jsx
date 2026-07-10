/**
 * Two-panel layout shared by Login and Signup: a branded aside (hidden on small
 * screens) and the form card. Keeps the auth pages visually balanced and
 * consistent.
 */
export default function AuthLayout({ eyebrow, title, subtitle, benefits = [], children, footer }) {
  return (
    <div className="auth-split">
      <aside className="auth-aside" aria-hidden="true">
        <div className="auth-aside__inner">
          <p className="auth-aside__brand">
            <svg viewBox="0 0 32 32" className="auth-aside__mark">
              <line x1="16" y1="2" x2="16" y2="30" stroke="var(--gold)" strokeWidth="1" />
              <path d="M7 23V10l9 8 9-8v13" fill="none" stroke="var(--paper)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Meridian
          </p>
          <p className="auth-aside__headline">
            Coffee with a fixed address — and an account to match.
          </p>
          <ul className="auth-aside__benefits">
            {benefits.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="auth-aside__coord">00°00′00″ N · 00°00′00″ E</p>
        </div>
      </aside>

      <div className="auth-main">
        <div className="auth-card">
          <span className="meridian-rule">{eyebrow}</span>
          <h1 className="auth-card__title">{title}</h1>
          <p className="auth-card__sub">{subtitle}</p>
          {children}
          {footer}
        </div>
      </div>
    </div>
  )
}
