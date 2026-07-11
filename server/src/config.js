import 'dotenv/config'

/**
 * Typed config loaded from environment (.env in dev). Secrets live only here,
 * never in the front end.
 */
const dataSource = (process.env.DATA_SOURCE || 'mock').toLowerCase()
const paymentProvider = (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase()

export const config = {
  port: Number(process.env.PORT) || 8787,
  appOrigin: process.env.APP_ORIGIN || 'http://localhost:5173',
  // Public origin the site is served from (for absolute sitemap/canonical URLs).
  // In single-service prod this is the deployed host; falls back to appOrigin.
  publicUrl: process.env.PUBLIC_URL || process.env.APP_ORIGIN || '',
  cacheTtlMs: (Number(process.env.CACHE_TTL_SECONDS) || 60) * 1000,
  isProd: process.env.NODE_ENV === 'production',

  // 'mock' (default) reads the in-repo catalog; 'salesforce' reads a live org.
  dataSource,

  // Payments. 'mock' (default) simulates a card charge offline; 'stripe' uses
  // real Stripe test-mode PaymentIntents (requires STRIPE_* keys + `npm i stripe`).
  paymentProvider,
  payment: {
    provider: paymentProvider,
    currency: (process.env.PAYMENT_CURRENCY || 'usd').toLowerCase(),
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    // Safe to expose to the browser (used to mount Stripe Elements).
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  },

  // Shopper sessions (signed JWT in an httpOnly cookie).
  session: {
    secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me',
    cookieName: 'meridian_session',
    ttlDays: Number(process.env.SESSION_TTL_DAYS) || 30,
    // Set COOKIE_SECURE=true behind HTTPS in production.
    secure: String(process.env.COOKIE_SECURE || 'false') === 'true',
  },

  // Salesforce (used only when dataSource === 'salesforce'). Client Credentials flow.
  salesforce: {
    loginUrl: process.env.SF_LOGIN_URL || 'https://test.salesforce.com',
    clientId: process.env.SF_CLIENT_ID || '',
    clientSecret: process.env.SF_CLIENT_SECRET || '',
    apiVersion: process.env.SF_API_VERSION || '61.0',
    // Guest orders are attached to this Account; the standard pricebook is used.
    accountName: process.env.SF_ACCOUNT_NAME || 'Meridian Web Orders',
  },
}

/** Fail fast in production if the session secret is still the insecure default. */
export function assertProductionConfig() {
  if (!config.isProd) return
  if (!process.env.SESSION_SECRET || /change-me|dev-only/i.test(process.env.SESSION_SECRET)) {
    throw new Error(
      'Refusing to start in production without a real SESSION_SECRET (set a long random string in the environment).',
    )
  }
}

/** Throw early with a clear message if Salesforce mode is missing credentials. */
export function assertSalesforceConfig() {
  const { clientId, clientSecret, loginUrl } = config.salesforce
  const missing = []
  if (!loginUrl) missing.push('SF_LOGIN_URL')
  if (!clientId) missing.push('SF_CLIENT_ID')
  if (!clientSecret) missing.push('SF_CLIENT_SECRET')
  if (missing.length) {
    throw new Error(
      `DATA_SOURCE=salesforce but missing env: ${missing.join(', ')}. ` +
        `Set them in server/.env (see .env.example and docs/SALESFORCE_SETUP.md).`,
    )
  }
}
