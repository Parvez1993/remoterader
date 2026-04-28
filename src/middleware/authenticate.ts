import type { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from '../lib/jwt.js'
import { UnauthorizedError, ForbiddenError } from '../types/errors.js'
import type { Role } from '../types/roles.js'

export interface RequestWithAuthContext extends Request {
  userId?: string
  role?: Role
}

export interface AuthenticatedRequest extends Request {
  userId: string
  role: Role
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return null

  return authHeader.split(' ')[1] ?? null
}

function setAuthContext(req: RequestWithAuthContext, userId: string, role: string): void {
  req.userId = userId
  req.role = role as Role
}

export function attachAuthContext(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractBearerToken(req)
    if (!token) {
      next()
      return
    }

    const payload = verifyAccessToken(token)
    setAuthContext(req as RequestWithAuthContext, payload.userId, payload.role)
    next()
  } catch {
    next()
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractBearerToken(req)
    if (!token) throw new UnauthorizedError('No token provided')
    const payload = verifyAccessToken(token)

    setAuthContext(req as AuthenticatedRequest, payload.userId, payload.role)
    next()
  } catch (error) {
    next(error)
  }
}

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = (req as AuthenticatedRequest).role
    if (!roles.includes(role)) {
      next(new ForbiddenError('Insufficient permissions'))
      return
    }
    next()
  }
}
