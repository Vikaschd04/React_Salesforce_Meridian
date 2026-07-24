import { useEffect, useRef, useState } from 'react'

/**
 * Subscribe to the live order-updates stream (Server-Sent Events) for the
 * logged-in shopper. Calls `onUpdate({ orderId, status })` whenever one of their
 * orders changes Status server-side — in salesforce mode that's driven by Order
 * Change Data Capture; in mock mode by the dev-trigger. Returns `{ connected }`
 * so the UI can show a "live" indicator.
 *
 * This is the one place the client opens an `EventSource` rather than going
 * through `src/api/store.js` — the store module is the single seam for `fetch`,
 * and SSE is a different, long-lived transport. EventSource reconnects on its
 * own, so there's no manual retry logic here.
 */
export default function useOrderStream(onUpdate) {
  const [connected, setConnected] = useState(false)
  // Keep the latest callback without re-opening the stream on every render.
  const cb = useRef(onUpdate)
  cb.current = onUpdate

  useEffect(() => {
    const es = new EventSource('/api/account/orders/stream', { withCredentials: true })
    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false) // browser will auto-reconnect
    es.addEventListener('order-update', (e) => {
      try {
        cb.current?.(JSON.parse(e.data))
      } catch {
        /* ignore malformed frames */
      }
    })
    return () => es.close()
  }, [])

  return { connected }
}
