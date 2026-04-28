import type { NextFunction, Request, Response } from 'express'
import { filterJobsSchema } from '../validators/job.validator.js'
import { filterJobs } from '../services/job.service.js'

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
