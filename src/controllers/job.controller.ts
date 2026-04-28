import type { NextFunction, Request, Response } from 'express'
import { filterJobsSchema, listJobsSchema } from '../validators/job.validator.js'
import { filterJobs, listJobs } from '../services/job.service.js'

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
