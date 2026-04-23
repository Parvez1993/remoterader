import express from 'express'
import { errorHandler } from './middleware/errorHandler.js'
import authRouter from './routes/auth.route.js'

export const app = express()

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Server is running' })
})

app.use('/auth', authRouter)

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' })
})

app.use(errorHandler)
