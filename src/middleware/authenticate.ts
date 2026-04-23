import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/jwt.js'

export interface AuthenticatedRequest extends Request {
  userId: string
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Unauthorized' })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = verifyToken(token)
    ;(req as AuthenticatedRequest).userId = payload.userId
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' })
  }
}
