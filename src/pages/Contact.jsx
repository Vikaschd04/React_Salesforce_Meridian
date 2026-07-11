import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { sendSupportRequest } from '../api/store.js'
import Breadcrumbs from '../components/Breadcrumbs.jsx'

export default function Contact() {
  const { user } = useAuth()
  const [values, setValues] = useState({
    name: user ? `${user.firstName} ${user.lastName}`.trim() : '',
    email: user?.email || '',
    subject: '',
    message: '',
  })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [caseNumber, setCaseNumber] = useState(null)

  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }))

  async function onSubmit(e) {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      const res = await sendSupportRequest(values)
      setCaseNumber(res.caseNumber)
    } catch (err) {
      setError(err.message || 'Could not send your message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="container contact">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Contact' }]} />

      <header className="page-head">
        <p className="hero__eyebrow">Support · 24h response</p>
        <h1 className="page-head__title">Get in touch</h1>
        <p className="page-head__lede">
          Question about a coffee, an order, or where something’s from? Send us a note and
          we’ll get back to you. Every message opens a tracked support case.
        </p>
      </header>

      {caseNumber ? (
        <div className="contact-success" role="status">
          <div className="confirm__mark" aria-hidden="true">
            <svg viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="22" fill="none" stroke="var(--gold)" strokeWidth="1.5" />
              <path
                d="M15 24.5l6.2 6.2L34 18"
                fill="none"
                stroke="var(--pine-bright)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="contact-success__title">Message received</h2>
          <p className="contact-success__text">
            Thanks — we’ve logged your request. Reference your case number if you follow up.
          </p>
          <p className="contact-success__case">
            Case <strong>#{caseNumber}</strong>
          </p>
          <Link to="/shop" className="btn">
            Back to the coffees
          </Link>
        </div>
      ) : (
        <form className="auth-form contact-form" onSubmit={onSubmit}>
          {error && (
            <p className="auth-form__error" role="alert">
              {error}
            </p>
          )}
          <div className="auth-form__row">
            <label className="field">
              <span className="field__label">Name</span>
              <input type="text" required value={values.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label className="field">
              <span className="field__label">Email</span>
              <input
                type="email"
                required
                value={values.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </label>
          </div>
          <label className="field">
            <span className="field__label">Subject</span>
            <input
              type="text"
              required
              value={values.subject}
              onChange={(e) => set('subject', e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Message</span>
            <textarea
              rows={6}
              required
              value={values.message}
              onChange={(e) => set('message', e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn--block" disabled={sending}>
            {sending ? 'Sending…' : 'Send message'}
          </button>
        </form>
      )}
    </div>
  )
}
