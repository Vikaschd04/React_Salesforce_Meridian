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
      // Never serve store data (orders, status, stock) from the HTTP cache —
      // an order's fulfillment status can change in Salesforce at any time.
      cache: 'no-store',
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

/**
 * List all active products (the whole catalog). Used where a caller genuinely
 * needs every product — pricing the cart, related products, wishlists, the
 * home page. The shop PLP uses getCatalogPage() instead so it only downloads
 * one page at a time.
 */
export async function getProducts() {
  return request('/products')
}

/**
 * One filtered/sorted page of the catalog for the shop PLP. The BFF filters,
 * sorts, and facets across the WHOLE catalog, then returns just this page:
 *   { items, page, pageSize, total, totalPages, facets:{origins,priceBuckets,roasts} }
 * `total` is the match count after filters (before paging).
 */
export async function getCatalogPage({
  page = 1,
  pageSize = 10,
  q = '',
  roasts = [],
  origin = '',
  price = '',
  sort = 'featured',
} = {}) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  if (q) params.set('q', q)
  if (roasts.length) params.set('roast', roasts.join(','))
  if (origin) params.set('origin', origin)
  if (price) params.set('price', price)
  if (sort && sort !== 'featured') params.set('sort', sort)
  return request(`/catalog?${params.toString()}`)
}

/** The guided-selling ("Find your coffee") quiz: an array of { id, label, help, options }. */
export async function getGuidedQuiz() {
  const data = await request('/guided/quiz')
  return data?.quiz || []
}

/**
 * Score the catalog against quiz answers. `answers` = { roast, flavor, body, brew }
 * (each an option value; omit or '' for no preference). Returns the top matches,
 * each with `matchPct` and `reasons`. If logged in, the BFF also saves the taste
 * profile onto the shopper's Salesforce Contact.
 */
export async function getGuidedRecommendations(answers) {
  const data = await request('/guided/recommend', {
    method: 'POST',
    body: JSON.stringify({ answers: answers || {} }),
  })
  return data?.recommendations || []
}

/** Typeahead suggestions for the shop search box (server-side, over all products). */
export async function getSearchSuggestions(q) {
  const term = String(q || '').trim()
  if (!term) return []
  const data = await request(`/catalog/suggest?q=${encodeURIComponent(term)}`)
  return data?.suggestions || []
}

/** Fetch a single product by id. Throws StoreError(404) if not found. */
export async function getProduct(id) {
  return request(`/products/${encodeURIComponent(id)}`)
}

/**
 * Reviews for a product: { reviews, average, count, myReview }. `myReview` is
 * the caller's own review if logged in and they've already reviewed it, else
 * null. Public — works logged out.
 */
export async function getProductReviews(id) {
  return request(`/products/${encodeURIComponent(id)}/reviews`)
}

/**
 * Submit a review for a product. Requires login. Throws StoreError('already_reviewed')
 * if the shopper has already reviewed this product.
 */
export async function submitProductReview(id, { rating, title, body }) {
  return request(`/products/${encodeURIComponent(id)}/reviews`, {
    method: 'POST',
    body: JSON.stringify({ rating, title, body }),
  })
}

/**
 * Place an order from cart items + shipping details.
 * `shipping` = { name, email, street, city, state, postalCode, country }.
 * The BFF recomputes the total from trusted prices and returns
 * { orderId, total, items, placedAt, status, shipping, email } (USD dollars).
 */
export async function placeOrder(items, shipping, promoCode = null, payment = null) {
  const payload = {
    items: (items || []).map(({ id, qty }) => ({
      id,
      qty: Math.max(1, Math.floor(Number(qty) || 0)),
    })),
    shipping,
    ...(promoCode ? { promoCode } : {}),
    ...(payment ? { payment } : {}),
  }
  return request('/orders', { method: 'POST', body: JSON.stringify(payload) })
}

/** Which payment UI to render: { provider, publishableKey }. */
export async function getPaymentConfig() {
  return request('/payment-config')
}

/**
 * Validate a promo code against a subtotal (USD dollars). Returns
 * { code, discount, freeShipping, label }. Throws StoreError with a
 * friendly message when the code is invalid or below its minimum.
 */
export async function applyPromo(code, subtotal) {
  return request('/promo/validate', {
    method: 'POST',
    body: JSON.stringify({ code, subtotal }),
  })
}

/** Fetch an order by id (order status / receipt). Throws StoreError(404) if missing. */
export async function getOrder(id) {
  return request(`/orders/${encodeURIComponent(id)}`)
}

// ---- Auth (shopper accounts) ----

/**
 * Create a shopper account and start a session. Returns the user profile.
 * Every shopper is an individual (B2C) — one login, one person.
 */
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

/** One of the shopper's own orders; 404 otherwise. */
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

// ---- Wishlist ----

/** The shopper's saved product ids (slugs). Requires login. */
export async function getWishlist() {
  return request('/account/wishlist')
}

/** Save a product; returns the updated id list. */
export async function addToWishlist(productId) {
  return request('/account/wishlist', {
    method: 'POST',
    body: JSON.stringify({ productId }),
  })
}

/** Unsave a product; returns the updated id list. */
export async function removeFromWishlist(productId) {
  return request(`/account/wishlist/${encodeURIComponent(productId)}`, { method: 'DELETE' })
}

// ---- Saved addresses ----

/** The shopper's saved addresses (default first). Requires login. */
export async function getAddresses() {
  return request('/account/addresses')
}

/** Save a new address; returns the updated list. */
export async function addAddress(address) {
  return request('/account/addresses', { method: 'POST', body: JSON.stringify(address) })
}

/** Edit an address or set it default (partial); returns the updated list. */
export async function updateAddress(id, patch) {
  return request(`/account/addresses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

/** Delete an address; returns the updated list. */
export async function deleteAddress(id) {
  return request(`/account/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** Send a support request; returns { caseNumber } (a Salesforce Case). */
export async function sendSupportRequest({ name, email, subject, message }) {
  return request('/support', {
    method: 'POST',
    body: JSON.stringify({ name, email, subject, message }),
  })
}

/** The shopper's support tickets (most recent first). Requires login. */
export async function getTickets() {
  return request('/account/tickets')
}

/** One ticket + its public update thread; 404 if not the shopper's. */
export async function getTicket(caseNumber) {
  return request(`/account/tickets/${encodeURIComponent(caseNumber)}`)
}

/**
 * Public guest order tracking by order number + email. Returns the order (same
 * shape as order history) or a generic not-found StoreError.
 */
export async function trackOrder({ orderId, email }) {
  return request('/orders/track', { method: 'POST', body: JSON.stringify({ orderId, email }) })
}
