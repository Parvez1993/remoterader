import { Router } from 'express'
import { filterJobsByAi, getJobs } from '../controllers/job.controller.js'
import { aiRateLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.get('/', getJobs)
router.post('/filter', aiRateLimiter, filterJobsByAi)

export default router
