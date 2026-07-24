/**
 * Salesforce → app real-time bridge (salesforce mode only).
 *
 * Subscribes to the Order Change Data Capture channel (/data/OrderChangeEvent)
 * and republishes each change onto the in-process order-events bus, which the
 * SSE route fans out to connected browsers. This is what makes a merchant-side
 * status change (e.g. marking an order Shipped in Salesforce) appear live in
 * the shopper's order timeline without a reload.
 *
 * A CDC event carries only the *changed* fields + a header of record ids — it
 * does NOT include Shopper__c (the owner) unless that changed. So we resolve
 * owner + human OrderNumber with one SOQL lookup per event before emitting.
 *
 * Reliability: the CometD connection is authenticated with the cached
 * client-credentials access token; when that token expires the transport drops.
 * We listen for transport failures and re-subscribe with a fresh connection
 * (capped exponential backoff), so the stream self-heals. Every failure path is
 * non-fatal — if streaming is unavailable the app still works via the order
 * page's focus-refresh + manual Refresh button.
 */
import { getConnection, resetConnection } from './client.js'
import { emitOrderChange } from '../lib/orderEvents.js'

const CDC_CHANNEL = '/data/OrderChangeEvent'
const MIN_BACKOFF_MS = 2000
const MAX_BACKOFF_MS = 60000

let started = false
let client = null
let backoff = MIN_BACKOFF_MS
let reconnectTimer = null

/** Begin (or resume) the CDC subscription. Idempotent. */
export function start() {
  if (started) return
  started = true
  connect()
}

async function connect() {
  clearTimeout(reconnectTimer)
  reconnectTimer = null
  try {
    const conn = await getConnection()
    client = conn.streaming.createClient()
    // Transport dropping (often an expired token) → tear down and reconnect.
    if (typeof client.on === 'function') {
      client.on('transport:down', () => scheduleReconnect('transport down'))
    }
    await client.subscribe(CDC_CHANNEL, handleEvent)
    backoff = MIN_BACKOFF_MS // healthy connection resets the backoff
    console.log('[orderStream] subscribed to Order CDC — live updates on')
  } catch (err) {
    console.warn(`[orderStream] subscribe failed: ${err?.message || err}`)
    scheduleReconnect('subscribe error')
  }
}

function scheduleReconnect(reason) {
  if (reconnectTimer) return // already scheduled
  try {
    client?.disconnect?.()
  } catch {
    /* ignore */
  }
  client = null
  resetConnection() // force a fresh token on the next getConnection()
  const wait = backoff
  backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
  console.warn(`[orderStream] reconnecting in ${wait}ms (${reason})`)
  reconnectTimer = setTimeout(connect, wait)
}

async function handleEvent(message) {
  try {
    const payload = message?.payload || {}
    const header = payload.ChangeEventHeader || {}
    if (header.entityName !== 'Order') return
    const ids = (header.recordIds || []).filter(Boolean)
    if (ids.length === 0) return

    // Resolve owner + human order number (not carried in the CDC payload).
    const conn = await getConnection()
    const idList = ids.map((id) => `'${id.replace(/'/g, "\\'")}'`).join(', ')
    const res = await conn.query(
      `SELECT Id, OrderNumber, Shopper__c, Status FROM Order WHERE Id IN (${idList})`,
    )
    for (const row of res.records) {
      if (!row.Shopper__c) continue // guest/company orders with no shopper — skip
      emitOrderChange({ contactId: row.Shopper__c, orderId: row.OrderNumber, status: row.Status })
    }
  } catch (err) {
    console.warn(`[orderStream] event handling failed: ${err?.message || err}`)
  }
}
