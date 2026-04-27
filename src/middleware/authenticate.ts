import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../lib/jwt.js'
import { UnauthorizedError, ForbiddenError } from '../types/errors.js'
import type { Role } from '../types/roles.js'

export interface AuthenticatedRequest extends Request {
  userId: string
  role: Role
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError('No token provided')

    const token = authHeader.split(' ')[1]
    const payload = verifyAccessToken(token)

    ;(req as AuthenticatedRequest).userId = payload.userId
    ;(req as AuthenticatedRequest).role = payload.role
    next()
  } catch (error) {
    next(error)
  }
}

export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = (req as AuthenticatedRequest).role
    if (!roles.includes(role)) {
      next(new ForbiddenError('Insufficient permissions'))
      return
    }
    next()
  }
}
