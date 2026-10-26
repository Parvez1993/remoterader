import type { Request, Response, NextFunction } from 'express'
import type { RegisterInput, LoginInput } from '../validators/auth.validator.js'
import { registerUser, loginUser, refreshAccessToken, logoutUser } from '../services/auth.service.js'
import type { AuthenticatedRequest } from '../middleware/authenticate.js'
import { env } from '../config/env.js'
import { UnauthorizedError } from '../types/errors.js'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { accessToken } = await registerUser(req.body as RegisterInput)
    res.status(201).json({ success: true, accessToken })
  } catch (error) {
    next(error)
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { accessToken, refreshToken } = await loginUser(req.body as LoginInput)
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS)
    res.status(200).json({ success: true, accessToken })
  } catch (error) {
    next(error)
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = typeof req.cookies?.refreshToken === 'string' ? req.cookies.refreshToken : undefined
    if (!token) throw new UnauthorizedError('No refresh token')
    const { accessToken, refreshToken } = await refreshAccessToken(token)
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS)
    res.status(200).json({ success: true, accessToken })
  } catch (error) {
    next(error)
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AuthenticatedRequest).userId
    await logoutUser(userId)
    res.clearCookie('refreshToken')
    res.status(200).json({ success: true, message: 'Logged out' })
  } catch (error) {
    next(error)
  }
}
