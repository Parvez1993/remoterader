import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { pinoHttp } from 'pino-http'
import swaggerUi from 'swagger-ui-express'
import { logger } from './lib/logger.js'
import { prisma } from './lib/prisma.js'
import { redis } from './lib/redis.js'
import { errorHandler } from './middleware/errorHandler.js'
import { attachAuthContext } from './middleware/authenticate.js'
import { globalRateLimiter } from './middleware/rateLimit.js'
import { swaggerSpec } from './lib/swagger.js'
import { env } from './config/env.js'
import authRouter from './routes/auth.route.js'
import jobRouter from './routes/job.route.js'

export const app = express()

app.use(pinoHttp({ logger }))
app.use(helmet())
app.use(cors({ origin: env.allowedOrigins, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use(attachAuthContext)
app.use(globalRateLimiter)

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Server is alive' })
})

app.get('/ready', async (_req, res) => {
  const timeoutMs = env.healthcheckTimeoutMs
  const timeoutError = new Error('Readiness check timed out')

  try {
    await Promise.race([
      Promise.all([
        prisma.$queryRaw`SELECT 1`,
        redis.ping(),
      ]),
      new Promise((_, reject) => {
        setTimeout(() => reject(timeoutError), timeoutMs)
      }),
    ])

    res.json({
      success: true,
      message: 'Server is ready',
      dependencies: {
        database: 'up',
        redis: 'up',
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Readiness check failed')

    res.status(503).json({
      success: false,
      message: 'Server is not ready',
      dependencies: {
        database: 'down',
        redis: 'down',
      },
    })
  }
})

// Swagger UI — serves the interactive API docs at /docs
// swaggerUi.serve registers the static assets middleware
// swaggerUi.setup() generates the HTML page from our spec object
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

app.use('/auth', authRouter)
app.use('/jobs', jobRouter)

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

app.use(errorHandler)
