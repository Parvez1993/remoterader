import type { NextFunction, Request, Response } from 'express'
import { filterJobsSchema, listJobsSchema, scoreJobSchema } from '../validators/job.validator.js'
import { filterJobs, listJobs, enqueueJobScoring, getScoringStatus } from '../services/job.service.js'

export async function getJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = listJobsSchema.parse({
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
      limit: typeof req.query.limit === 'string' ? req.query.limit : undefined,
      company: typeof req.query.company === 'string' ? req.query.company : undefined,
      location: typeof req.query.location === 'string' ? req.query.location : undefined,
      sort: typeof req.query.sort === 'string' ? req.query.sort : undefined,
    })

    const result = await listJobs(input)

    res.status(200).json({
      success: true,
      count: result.jobs.length,
      nextCursor: result.nextCursor,
      jobs: result.jobs,
    })
  } catch (error) {
    next(error)
  }
}

export async function filterJobsByAi(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = filterJobsSchema.parse(req.body)
    const jobs = await filterJobs(input)

    res.status(200).json({
      success: true,
      count: jobs.length,
      jobs,
    })
  } catch (error) {
    next(error)
  }
}

export async function scoreJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = scoreJobSchema.parse(req.body)
    const scoringJobId = await enqueueJobScoring(input)

    if (scoringJobId.startsWith('cached:')) {
      res.status(200).json({ success: true, scoringJobId, status: 'done' })
      return
    }

    res.status(202).json({ success: true, scoringJobId, status: 'pending' })
  } catch (error) {
    next(error)
  }
}

export async function getScoringJobStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const scoringJobId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0]
    const result = await getScoringStatus(scoringJobId)

    res.status(200).json({ success: true, ...result })
  } catch (error) {
    next(error)
  }
}
