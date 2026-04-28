import { Router } from 'express'
import { filterJobsByAi } from '../controllers/job.controller.js'
import { aiRateLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.post('/filter', aiRateLimiter, filterJobsByAi)

export default router
