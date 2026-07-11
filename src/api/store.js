/**
 * store.js — the ONE data-access module for the whole app.
 *
 * The UI (pages, components, context) imports from here and nowhere else. This
 * is the single swap point from docs/ARCHITECTURE.md:
 *
 *   Phase 1  → returned mock data from src/data/products.js
 *   Phase 2  → calls the BFF via fetch('/api/...')   ← we are here
 *   Phase 3  → the BFF calls Salesforce (no change to this file)
 *
 * Only the transport lives here; return shapes are unchanged from Phase 1, so
 * no page or component had to change when we swapped mock → BFF.
 */

// Requests go to same-origin `/api` — Vite proxies to the BFF in dev
// (see vite.config.js), and in prod the app and BFF share a host.
const API_BASE = '/api'

/**
 * A typed error the UI can show as a friendly message. Mirrors the BFF's
 * { error, message } payload plus the HTTP status.
 */
export class StoreError extends Error {
  constructor(message, { code = 'store_error', status = 500 } = {}) {
    super(message)
    this.name = 'StoreError'
    this.code = code
    this.status = status
  }
}

/** Fetch JSON from the BFF, turning any failure into a StoreError. */
async function request(path, options) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      // Send the session cookie so the BFF can identify a logged-in shopper.
      credentials: 'include',
      headers: { Accept: 'application/json', ...(options?.body ? { 'Content-Type': 'application/json' } : {}) },
      ...options,
    })
  } catch {
    // Network / server-down: give a friendly, retryable message.
    throw new StoreError('Couldn’t reach the store. Check your connection and try again.', {
      code: 'network_error',
      status: 0,
    })
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    throw new StoreError(data?.message || 'Request failed.', {
      code: data?.error || 'store_error',
      status: res.status,
    })
  }
  return data
}

/** List all active products. */
export async function getProducts() {
  return request('/products')
}

/** Fetch a single product by id. Throws StoreError(404) if not found. */
export async function getProduct(id) {
  return request(`/products/${encodeURIComponent(id)}`)
}

/**
 * Place an order from cart items + shipping details.
 * `shipping` = { name, email, street, city, state, postalCode, country }.
 * The BFF recomputes the total from trusted prices and returns
 * { orderId, totalCents, items, placedAt, status, shipping, email }.
 */
export async function placeOrder(items, shipping) {
  const payload = {
    items: (items || []).map(({ id, qty }) => ({
      id,
      qty: Math.max(1, Math.floor(Number(qty) || 0)),
    })),
    shipping,
  }
  return request('/orders', { method: 'POST', body: JSON.stringify(payload) })
}

/** Fetch an order by id (order status / receipt). Throws StoreError(404) if missing. */
export async function getOrder(id) {
  return request(`/orders/${encodeURIComponent(id)}`)
}

// ---- Auth (shopper accounts) ----

/** Create a shopper account and start a session. Returns the user profile. */
export async function signup({ firstName, lastName, email, password }) {
  return request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ firstName, lastName, email, password }),
  })
}

/** Log in; returns the user profile and sets the session cookie. */
export async function login({ email, password }) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

/** End the session. */
export async function logout() {
  return request('/auth/logout', { method: 'POST' })
}

/**
 * Return the current shopper's profile, or null if not logged in.
 * A 401 is the normal "logged out" case — not an error to surface.
 */
export async function getMe() {
  try {
    return await request('/auth/me')
  } catch (err) {
    if (err instanceof StoreError && (err.status === 401 || err.status === 0)) return null
    throw err
  }
}

/** List the logged-in shopper's orders (most recent first). */
export async function getMyOrders() {
  return request('/account/orders')
}

/** One of the shopper's own orders (404 if it isn't theirs). */
export async function getMyOrder(id) {
  return request(`/account/orders/${encodeURIComponent(id)}`)
}

/** Cancel the shopper's own draft order; returns the updated order. */
export async function cancelOrder(id) {
  return request(`/account/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' })
}

/** Update the shopper's name. Returns the fresh profile. */
export async function updateProfile({ firstName, lastName }) {
  return request('/account/profile', {
    method: 'PATCH',
    body: JSON.stringify({ firstName, lastName }),
  })
}

/** Send a support request; returns { caseNumber } (a Salesforce Case). */
export async function sendSupportRequest({ name, email, subject, message }) {
  return request('/support', {
    method: 'POST',
    body: JSON.stringify({ name, email, subject, message }),
  })
}
