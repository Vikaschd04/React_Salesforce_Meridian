import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyOrders } from '../../api/store.js'
import Spinner from '../../components/Spinner.jsx'
import ErrorState from '../../components/ErrorState.jsx'
import OrderRow from '../../components/OrderRow.jsx'
import useRefreshOnFocus from '../../lib/useRefreshOnFocus.js'

export function formatOrderDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Order-history tab: compact list, each row linking to the order detail. */
export default function Orders() {
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setOrders(null)
      setError(null)
    }
    try {
      const data = await getMyOrders()
      setOrders(data)
      setError(null)
    } catch (err) {
      if (!silent) setError(err)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useRefreshOnFocus(useCallback(() => load({ silent: true }), [load]))

  if (error) {
    return <ErrorState message={error.message} onRetry={() => load()} />
  }
  if (!orders) return <Spinner label="Loading orders…" />

  if (orders.length === 0) {
    return (
      <div className="account-empty">
        <p>You haven’t placed any orders yet.</p>
        <Link to="/shop" className="btn">
          Start shopping
        </Link>
      </div>
    )
  }

  return (
    <ul className="order-list">
      {orders.map((order) => (
        <li key={order.orderId}>
          <OrderRow order={order} />
        </li>
      ))}
    </ul>
  )
}
