import express from 'express'
import { errorHandler } from './middleware/errorHandler.js'

export const app = express()

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Server is running' })
})

app.use(errorHandler)
