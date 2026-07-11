import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { config, assertProductionConfig } from './config.js'
import { errorHandler, notFoundHandler } from './lib/errors.js'
import healthRoutes from './routes/health.js'
import productRoutes from './routes/products.js'
import orderRoutes from './routes/orders.js'
import authRoutes from './routes/auth.js'
import accountRoutes from './routes/account.js'
import supportRoutes from './routes/support.js'
import promoRoutes from './routes/promo.js'
import paymentRoutes from './routes/payment.js'
import seoRoutes from './routes/seo.js'

assertProductionConfig()

const app = express()
const DIST_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist')

// Security + platform middleware. The CSP allows the bundled app + the pre-paint
// theme script (inline) and data: images; tighten with hashes/nonces later.
app.disable('x-powered-by')
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  }),
)
app.use(cors({ origin: config.appOrigin, credentials: true }))
app.use(express.json({ limit: '32kb' }))
app.use(cookieParser())
if (!config.isProd) app.use(morgan('dev'))

// Routes
app.use('/', healthRoutes)
app.use('/', seoRoutes) // /sitemap.xml
app.use('/api', authRoutes)
app.use('/api', accountRoutes)
app.use('/api', supportRoutes)
app.use('/api', promoRoutes)
app.use('/api', paymentRoutes)
app.use('/api', productRoutes)
app.use('/api', orderRoutes)

// In production the BFF also serves the built SPA (same origin as /api, so the
// session cookie just works). Dev is served by Vite instead.
if (config.isProd) {
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1h' }))
  // SPA fallback: any non-/api GET returns index.html so client routes resolve.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  })
}

// 404 + centralized error handling (must be last)
app.use(notFoundHandler)
app.use(errorHandler)

app.listen(config.port, () => {
  console.log(`Meridian BFF listening on http://localhost:${config.port}`)
  if (config.isProd) console.log(`Serving SPA from ${DIST_DIR}`)
})
