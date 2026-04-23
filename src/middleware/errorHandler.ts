import type { Request, Response, NextFunction } from 'express'

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(error.stack)
  res.status(500).json({ success: false, message: error.message })
}
