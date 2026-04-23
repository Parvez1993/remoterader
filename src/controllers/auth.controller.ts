import type { Request, Response, NextFunction } from 'express'
import { registerSchema, loginSchema } from '../validators/auth.validator.js'
import { registerUser, loginUser, refreshAccessToken, logoutUser } from '../services/auth.service.js'
import type { AuthenticatedRequest } from '../middleware/authenticate.js'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = registerSchema.parse(req.body)
    const { accessToken } = await registerUser(input)
    res.status(201).json({ success: true, accessToken })
  } catch (error) {
    next(error)
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = loginSchema.parse(req.body)
    const { accessToken, refreshToken } = await loginUser(input)
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS)
    res.status(200).json({ success: true, accessToken })
  } catch (error) {
    next(error)
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.refreshToken as string | undefined
    if (!token) throw new Error('No refresh token')
    const { accessToken } = await refreshAccessToken(token)
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
