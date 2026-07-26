import { useEffect, useRef, useState } from 'react'

/**
 * Subscribe to a live order-updates stream (Server-Sent Events). Calls
 * `onUpdate({ orderId, status })` whenever an order changes Status server-side —
 * in salesforce mode driven by Order Change Data Capture, in mock mode by the
 * dev-trigger. Returns `{ connected }` so the UI can reflect the live state.
 *
 * `url` selects the stream:
 *   - default `/api/account/orders/stream` — the logged-in shopper's own orders
 *     (session cookie, filtered by contact).
 *   - a `/api/orders/track/stream?token=…` URL — the PUBLIC guest tracker,
 *     scoped to one order by a short-lived token.
 * Pass a falsy `url` to stay disconnected (e.g. a guest before they've looked up
 * an order).
 *
 * This is the one place the client opens an `EventSource` rather than going
 * through `src/api/store.js` — the store module is the single seam for `fetch`,
 * and SSE is a different, long-lived transport. EventSource reconnects on its
 * own, so there's no manual retry logic here.
 */
export default function useOrderStream(onUpdate, url = '/api/account/orders/stream') {
  const [connected, setConnected] = useState(false)
  // Keep the latest callback without re-opening the stream on every render.
  const cb = useRef(onUpdate)
  cb.current = onUpdate

  useEffect(() => {
    if (!url) {
      setConnected(false)
      return undefined
    }
    const es = new EventSource(url, { withCredentials: true })
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
  }, [url])

  return { connected }
}
