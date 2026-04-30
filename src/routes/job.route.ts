import { Router } from 'express'
import { filterJobsByAi, getJobs } from '../controllers/job.controller.js'
import { aiRateLimiter, jobsListRateLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.get('/', jobsListRateLimiter, getJobs)
router.post('/filter', aiRateLimiter, filterJobsByAi)

export default router
