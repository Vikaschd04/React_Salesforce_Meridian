import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getTicket } from '../../api/store.js'
import Spinner from '../../components/Spinner.jsx'
import ErrorState from '../../components/ErrorState.jsx'
import useRefreshOnFocus from '../../lib/useRefreshOnFocus.js'
import { formatOrderDate } from './Orders.jsx'
import { ticketStatusSlug } from './Tickets.jsx'

/** One support ticket: status, the original message, and the public reply thread. */
export default function TicketDetail() {
  const { caseNumber } = useParams()
  const [ticket, setTicket] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setTicket(null)
        setError(null)
      }
      try {
        setTicket(await getTicket(caseNumber))
        setError(null)
      } catch (err) {
        if (!silent) setError(err)
      }
    },
    [caseNumber],
  )

  useEffect(() => {
    load()
  }, [load])

  useRefreshOnFocus(useCallback(() => load({ silent: true }), [load]))

  if (error) {
    return (
      <ErrorState
        message={error.status === 404 ? 'We couldn’t find that ticket.' : error.message}
        onRetry={error.status === 404 ? undefined : () => load()}
      />
    )
  }
  if (!ticket) return <Spinner label="Loading ticket…" />

  return (
    <section className="ticket-detail" aria-labelledby="ticket-heading">
      <Link to="/account/tickets" className="order-detail__back">
        ← All tickets
      </Link>

      <div className="order-card">
        <div className="order-card__head">
          <div>
            <span className="order-card__label">Ticket</span>
            <h2 id="ticket-heading" className="order-card__id order-detail__id">
              #{ticket.caseNumber}
            </h2>
          </div>
          <div className="order-card__meta">
            <span className={`ticket-status ticket-status--${ticketStatusSlug(ticket.status)}`}>
              {ticket.status}
            </span>
            <span className="order-card__date">opened {formatOrderDate(ticket.createdAt)}</span>
          </div>
        </div>

        <h3 className="ticket-detail__subject">{ticket.subject}</h3>
        <p className="ticket-detail__message">{ticket.description}</p>

        <div className="ticket-thread">
          <h3 className="account-section-title">Updates</h3>
          {ticket.updates.length === 0 ? (
            <p className="field__hint">
              No updates yet — our team will reply here. We aim to respond within 24 hours.
            </p>
          ) : (
            <ul className="ticket-thread__list">
              {ticket.updates.map((u, i) => (
                <li key={i} className="ticket-reply">
                  <div className="ticket-reply__head">
                    <span className="ticket-reply__author">Meridian Support</span>
                    <span className="ticket-reply__date">{formatOrderDate(u.createdAt)}</span>
                  </div>
                  <p className="ticket-reply__body">{u.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {ticket.closed ? (
          <p className="field__hint ticket-detail__foot">
            This ticket is closed. Still need help? <Link to="/contact">Open a new one</Link>.
          </p>
        ) : (
          <p className="field__hint ticket-detail__foot">
            Need to add something? <Link to="/contact">Send another message</Link> and reference
            #{ticket.caseNumber}.
          </p>
        )}
      </div>
    </section>
  )
}
