import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTickets } from '../../api/store.js'
import Spinner from '../../components/Spinner.jsx'
import ErrorState from '../../components/ErrorState.jsx'
import useRefreshOnFocus from '../../lib/useRefreshOnFocus.js'
import { formatOrderDate } from './Orders.jsx'

/** A Case Status → badge modifier class ('new' | 'on-hold' | 'escalated' | 'closed'). */
export function ticketStatusSlug(status) {
  return String(status || 'new').toLowerCase().replace(/\s+/g, '-')
}

/** Support tab: the shopper's tickets, each linking to its detail + update thread. */
export default function Tickets() {
  const [tickets, setTickets] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setTickets(null)
      setError(null)
    }
    try {
      setTickets(await getTickets())
      setError(null)
    } catch (err) {
      if (!silent) setError(err)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // A merchant can reply/close a ticket in Salesforce any time — refresh on focus.
  useRefreshOnFocus(useCallback(() => load({ silent: true }), [load]))

  if (error) return <ErrorState message={error.message} onRetry={() => load()} />
  if (!tickets) return <Spinner label="Loading your tickets…" />

  if (tickets.length === 0) {
    return (
      <div className="account-empty">
        <p>You haven’t opened any support tickets yet.</p>
        <Link to="/contact" className="btn">
          Contact support
        </Link>
      </div>
    )
  }

  return (
    <ul className="ticket-list">
      {tickets.map((t) => (
        <li key={t.caseNumber}>
          <Link to={`/account/tickets/${t.caseNumber}`} className="ticket-row">
            <div className="ticket-row__main">
              <span className="ticket-row__subject">{t.subject}</span>
              <span className="ticket-row__meta">
                #{t.caseNumber} · opened {formatOrderDate(t.createdAt)}
              </span>
            </div>
            <span className={`ticket-status ticket-status--${ticketStatusSlug(t.status)}`}>{t.status}</span>
            <span className="order-row__chev" aria-hidden="true">
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
