/**
 * Order progress: Paid → Shipped → Delivered, with the current stage lit and the
 * tracking number / shipped date surfaced once available. The merchant advances
 * an order by editing Fulfillment_Status__c / Tracking_Number__c in Salesforce;
 * this reads those fields back. Cancelled / refunded orders show a flag instead.
 */
const STAGES = [
  { key: 'paid', label: 'Paid' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
]
const STAGE_INDEX = { pending: -1, paid: 0, shipped: 1, delivered: 2 }

export default function OrderTimeline({ order }) {
  if (order.status === 'cancelled' || order.status === 'refunded') {
    const refunded = order.status === 'refunded'
    return (
      <div className={`order-flag order-flag--${order.status}`}>
        <span className="order-flag__label">{refunded ? 'Cancelled · refunded' : 'Cancelled'}</span>
        <p className="order-flag__note">
          {refunded
            ? 'This order was cancelled and the payment refunded.'
            : 'This order was cancelled.'}
        </p>
      </div>
    )
  }

  const current = STAGE_INDEX[order.status] ?? 0
  return (
    <ol className="order-timeline" aria-label="Order progress">
      {STAGES.map((stage, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo'
        const reached = state !== 'todo'
        return (
          <li key={stage.key} className={`order-stage is-${state}`}>
            <span className="order-stage__dot" aria-hidden="true" />
            <span className="order-stage__label">{stage.label}</span>
            {stage.key === 'shipped' && reached && order.trackingNumber && (
              <span className="order-stage__meta order-stage__meta--track">
                {order.trackingNumber}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
