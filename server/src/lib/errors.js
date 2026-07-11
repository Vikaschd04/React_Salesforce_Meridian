/**
 * Error helpers. Every error the API emits has the shape { error, message }
 * with a proper HTTP status, so the front end can show friendly messages and
 * branch on `error` (e.g. 'not_found').
 */

export class ApiError extends Error {
  constructor(status, error, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.error = error
  }
}

export const notFoundError = (message = 'Resource not found') =>
  new ApiError(404, 'not_found', message)

export const badRequest = (message = 'Invalid request', error = 'bad_request') =>
  new ApiError(400, error, message)

export const conflict = (message = 'Conflict', error = 'conflict') =>
  new ApiError(409, error, message)

/** Payment could not be taken (declined card, provider error). */
export const paymentError = (message = 'Payment failed', error = 'payment_failed') =>
  new ApiError(402, error, message)

/** Wrap async route handlers so thrown/rejected errors reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

/** 404 handler for unmatched routes. */
export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'not_found', message: `No route for ${req.method} ${req.path}` })
}

/** Central error middleware — must be registered last. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.error, message: err.message })
  }
  // Unexpected: log server-side, don't leak internals to the client.
  console.error('[unhandled]', err)
  return res.status(500).json({ error: 'server_error', message: 'Something went wrong.' })
}
