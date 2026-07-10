/**
 * Salesforce connection via the OAuth 2.0 Client Credentials flow.
 *
 * We POST to the org's token endpoint with the Connected App's consumer
 * key/secret and get back an access token + instance URL, then hand those to a
 * jsforce Connection. The token is cached module-level; any call that fails with
 * an expired/invalid session triggers a single re-auth + retry (see withConn).
 *
 * No secrets ever leave the server — this module is the only place they're used.
 */
import jsforce from 'jsforce'
import { config, assertSalesforceConfig } from '../config.js'

let cached = null // { conn, fetchedAt }

async function authenticate() {
  assertSalesforceConfig()
  const { loginUrl, clientId, clientSecret, apiVersion } = config.salesforce

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    const detail = data.error_description || data.error || `HTTP ${res.status}`
    throw new Error(`Salesforce auth failed: ${detail}`)
  }

  const conn = new jsforce.Connection({
    instanceUrl: data.instance_url,
    accessToken: data.access_token,
    version: apiVersion,
  })
  cached = { conn, fetchedAt: Date.now() }
  return conn
}

/** Get a connection, authenticating (and caching) on first use. */
export async function getConnection() {
  if (cached?.conn) return cached.conn
  return authenticate()
}

/** Force a fresh token on next use (used after an invalid-session error). */
export function resetConnection() {
  cached = null
}

const SESSION_ERRORS = new Set(['INVALID_SESSION_ID', 'INVALID_AUTH_HEADER'])

function isSessionError(err) {
  return (
    SESSION_ERRORS.has(err?.errorCode) ||
    err?.name === 'INVALID_SESSION_ID' ||
    /INVALID_SESSION_ID|expired access\/refresh token/i.test(err?.message || '')
  )
}

/**
 * Run `fn(conn)`; if it fails because the session expired, re-authenticate once
 * and retry. This is what lets the app survive an expired access token.
 */
export async function withConn(fn) {
  const conn = await getConnection()
  try {
    return await fn(conn)
  } catch (err) {
    if (!isSessionError(err)) throw err
    resetConnection()
    const fresh = await authenticate()
    return fn(fresh)
  }
}
