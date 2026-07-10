import 'dotenv/config'

/**
 * Typed config loaded from environment (.env in dev). Secrets live only here,
 * never in the front end. Salesforce keys arrive in Phase 3.
 */
export const config = {
  port: Number(process.env.PORT) || 8787,
  appOrigin: process.env.APP_ORIGIN || 'http://localhost:5173',
  cacheTtlMs: (Number(process.env.CACHE_TTL_SECONDS) || 60) * 1000,
  isProd: process.env.NODE_ENV === 'production',
}
