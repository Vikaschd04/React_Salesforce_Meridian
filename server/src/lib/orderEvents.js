/**
 * In-process order-change event bus.
 *
 * The single seam between the *sources* of an order change and the SSE route
 * that pushes it to the browser. Two sources publish here:
 *   - sf/orderStream.js — real Salesforce Change Data Capture (salesforce mode)
 *   - routes/dev.js      — a mock dev-trigger (mock mode only)
 * and the SSE handler in routes/account.js consumes, filtering by contactId so
 * a shopper only ever receives their own orders' updates.
 *
 * Payload shape: { contactId, orderId, status }
 *   contactId — the Salesforce Contact Id that owns the order (routing key)
 *   orderId   — the human OrderNumber the UI shows (e.g. "MRD-…"/"00000780")
 *   status    — the raw Salesforce Status (the client re-fetches for the rest)
 */
import { EventEmitter } from 'node:events'

const emitter = new EventEmitter()
// Many browser tabs can be connected at once; lift the default 10-listener cap
// so a busy BFF doesn't log spurious "possible memory leak" warnings.
emitter.setMaxListeners(0)

const CHANNEL = 'order-change'

/** Publish an order change to every subscriber. */
export function emitOrderChange({ contactId, orderId, status }) {
  emitter.emit(CHANNEL, { contactId, orderId, status })
}

/** Subscribe to order changes; returns an unsubscribe function. */
export function onOrderChange(handler) {
  emitter.on(CHANNEL, handler)
  return () => emitter.off(CHANNEL, handler)
}
