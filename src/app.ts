import express from 'express'
import cookieParser from 'cookie-parser'
import { errorHandler } from './middleware/errorHandler.js'
import { attachAuthContext } from './middleware/authenticate.js'
import { globalRateLimiter } from './middleware/rateLimit.js'
import authRouter from './routes/auth.route.js'
import jobRouter from './routes/job.route.js'

export const app = express()

app.use(express.json())
app.use(cookieParser())
app.use(attachAuthContext)
app.use(globalRateLimiter)

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Server is running' })
})

app.use('/auth', authRouter)
app.use('/jobs', jobRouter)

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

app.use(errorHandler)
