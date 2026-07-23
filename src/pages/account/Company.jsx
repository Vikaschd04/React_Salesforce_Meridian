import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { getCompanyOrders, getCompanyInsights } from '../../api/store.js'
import Spinner from '../../components/Spinner.jsx'
import ErrorState from '../../components/ErrorState.jsx'
import OrderRow from '../../components/OrderRow.jsx'
import useRefreshOnFocus from '../../lib/useRefreshOnFocus.js'

// Map an Einstein reorder-likelihood score (0–100) to a band: label + color.
function likelihoodBand(score) {
  if (score >= 70) return { level: 'high', label: 'Likely to reorder soon' }
  if (score >= 40) return { level: 'medium', label: 'May reorder soon' }
  return { level: 'low', label: 'Recently stocked up' }
}

/**
 * Einstein reorder-likelihood badge. Rendered only when a Prediction Builder
 * model has scored the company (score non-null) — absent otherwise, never a
 * placeholder.
 */
function ReorderInsight({ score }) {
  const { level, label } = likelihoodBand(score)
  return (
    <div className={`company-insight company-insight--${level}`}>
      <span className="company-insight__score">{score}%</span>
      <span className="company-insight__body">
        <span className="company-insight__label">{label}</span>
        <span className="company-insight__by">Einstein prediction</span>
      </span>
    </div>
  )
}

/**
 * Company tab: the shared order history for the shopper's team — any teammate's
 * order under the same Salesforce Account, most recent first. Only rendered
 * (see AccountLayout) when the shopper belongs to a company.
 */
export default function Company() {
  const { user } = useAuth()
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState(null)
  const [likelihood, setLikelihood] = useState(null)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setOrders(null)
      setError(null)
    }
    try {
      const data = await getCompanyOrders()
      setOrders(data)
      setError(null)
    } catch (err) {
      if (!silent) setError(err)
    }
    // Insights are supplementary — a failure (or a null score pre-training)
    // just means no badge, never a broken order list.
    try {
      const insights = await getCompanyInsights()
      setLikelihood(insights.reorderLikelihood)
    } catch {
      setLikelihood(null)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useRefreshOnFocus(useCallback(() => load({ silent: true }), [load]))

  return (
    <div className="company-tab">
      <div className="company-tab__head">
        <h2 className="account-section-title">{user.company.name}</h2>
        <p className="field__hint">
          Every order placed by a teammate on this company account shows up here.
        </p>
      </div>

      {likelihood != null && <ReorderInsight score={likelihood} />}

      {error ? (
        <ErrorState message={error.message} onRetry={() => load()} />
      ) : !orders ? (
        <Spinner label="Loading company orders…" />
      ) : orders.length === 0 ? (
        <div className="account-empty">
          <p>No orders on this company account yet.</p>
          <Link to="/shop" className="btn">
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="order-list">
          {orders.map((order) => (
            <li key={order.orderId}>
              <OrderRow order={order} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
