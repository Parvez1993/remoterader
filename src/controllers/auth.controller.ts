import type { Request, Response, NextFunction } from 'express'
import { registerSchema, loginSchema } from '../validators/auth.validator.js'
import { registerUser, loginUser } from '../services/auth.service.js'

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = registerSchema.parse(req.body)
    const result = await registerUser(input)
    res.status(201).json({ success: true, ...result })
  } catch (error) {
    next(error)
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = loginSchema.parse(req.body)
    const result = await loginUser(input)
    res.status(200).json({ success: true, ...result })
  } catch (error) {
    next(error)
  }
}
