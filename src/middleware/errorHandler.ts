import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import jwt from 'jsonwebtoken'
import { AppError } from '../types/errors.js'

const { JsonWebTokenError, TokenExpiredError } = jwt

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ success: false, message: error.message })
    return
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    })
    return
  }

  if (error instanceof TokenExpiredError) {
    res.status(401).json({ success: false, message: 'Token expired' })
    return
  }

  if (error instanceof JsonWebTokenError) {
    res.status(401).json({ success: false, message: 'Invalid token' })
    return
  }

  console.error('Unexpected error:', error)
  res.status(500).json({ success: false, message: 'Internal server error' })
}
