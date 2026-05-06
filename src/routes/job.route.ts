import { Router } from 'express'
import { filterJobsByAi, getJobs, scoreJob, getScoringJobStatus } from '../controllers/job.controller.js'
import { applyToJobHandler } from '../controllers/application.controller.js'
import { aiRateLimiter, jobsListRateLimiter } from '../middleware/rateLimit.js'
import { authenticate } from '../middleware/authenticate.js'

const router = Router()

router.get('/', jobsListRateLimiter, getJobs)
router.post('/filter', aiRateLimiter, filterJobsByAi)
router.post('/score', authenticate, aiRateLimiter, scoreJob)
router.get('/scoring-status/:id', authenticate, getScoringJobStatus)
router.post('/:id/apply', authenticate, applyToJobHandler)

export default router
