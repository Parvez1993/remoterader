import type { Request, Response, NextFunction } from 'express'
import type { ZodType } from 'zod'

export function validate<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      next(result.error)
      return
    }
    req.body = result.data as Record<string, unknown>
    next()
  }
}
