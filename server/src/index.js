import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { config } from './config.js'
import { errorHandler, notFoundHandler } from './lib/errors.js'
import healthRoutes from './routes/health.js'
import productRoutes from './routes/products.js'
import orderRoutes from './routes/orders.js'
import authRoutes from './routes/auth.js'
import accountRoutes from './routes/account.js'
import supportRoutes from './routes/support.js'

const app = express()

// Security + platform middleware
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: config.appOrigin, credentials: true }))
app.use(express.json({ limit: '32kb' }))
app.use(cookieParser())
if (!config.isProd) app.use(morgan('dev'))

// Routes
app.use('/', healthRoutes)
app.use('/api', authRoutes)
app.use('/api', accountRoutes)
app.use('/api', supportRoutes)
app.use('/api', productRoutes)
app.use('/api', orderRoutes)

// 404 + centralized error handling (must be last)
app.use(notFoundHandler)
app.use(errorHandler)

app.listen(config.port, () => {
  console.log(`Meridian BFF listening on http://localhost:${config.port}`)
  console.log(`CORS allowed origin: ${config.appOrigin}`)
})
