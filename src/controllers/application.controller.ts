import type { NextFunction, Request, Response } from 'express'
import { applyToJobSchema } from '../validators/application.validator.js'
import { applyToJob } from '../services/application.service.js'
import type { AuthenticatedRequest } from '../middleware/authenticate.js'

export async function applyToJobHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Cast here rather than in the function signature — Express's router types
    // expect the base Request type. The authenticate middleware guarantees
    // userId and role are set before this handler runs.
    const { userId } = req as AuthenticatedRequest

    // jobId lives in URL params — validate it with the same Zod schema
    // so we never pass raw req.params strings directly to the service
    const input = applyToJobSchema.parse({ jobId: req.params.id })

    const application = await applyToJob(input, userId)

    res.status(201).json({ success: true, application })
  } catch (error) {
    next(error)
  }
}
