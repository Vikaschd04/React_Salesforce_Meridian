/**
 * Session helpers — a signed JWT stored in an httpOnly cookie.
 *
 * The token carries only non-sensitive identity claims (contact id, email,
 * name) — never the password hash. httpOnly keeps it out of reach of client JS;
 * SameSite=Lax is fine since the app and BFF are same-origin (via the dev proxy
 * and a shared host in prod).
 */
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { ApiError } from './errors.js'

const { secret, cookieName, ttlDays, secure } = config.session
const MAX_AGE_MS = ttlDays * 24 * 60 * 60 * 1000

/** Issue the session cookie for a user profile. */
export function setSessionCookie(res, user) {
  const token = jwt.sign(
    { sub: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
    secret,
    { expiresIn: `${ttlDays}d` },
  )
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: MAX_AGE_MS,
    path: '/',
  })
}

/** Clear the session cookie. */
export function clearSessionCookie(res) {
  res.clearCookie(cookieName, { httpOnly: true, sameSite: 'lax', secure, path: '/' })
}

/** Decode the session from the request cookie, or null. */
export function readSession(req) {
  const token = req.cookies?.[cookieName]
  if (!token) return null
  try {
    const claims = jwt.verify(token, secret)
    return {
      id: claims.sub,
      email: claims.email,
      firstName: claims.firstName,
      lastName: claims.lastName,
    }
  } catch {
    return null
  }
}

/** Middleware: attach req.user (may be null). Never blocks. */
export function optionalAuth(req, res, next) {
  req.user = readSession(req)
  next()
}

/** Middleware: require a valid session or 401. */
export function requireAuth(req, res, next) {
  const user = readSession(req)
  if (!user) return next(new ApiError(401, 'unauthorized', 'Please log in to continue.'))
  req.user = user
  next()
}
