import jwt from 'jsonwebtoken'
import type { Role } from '../types/roles.js'
import { env } from '../config/env.js'

export function signAccessToken(userId: string, role: Role): string {
  return jwt.sign({ userId, role }, env.jwtAccessSecret, { expiresIn: env.jwtAccessExpiresIn } as jwt.SignOptions)
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId }, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshExpiresIn } as jwt.SignOptions)
}

export function verifyAccessToken(token: string): { userId: string; role: Role } {
  return jwt.verify(token, env.jwtAccessSecret) as { userId: string; role: Role }
}

export function verifyRefreshToken(token: string): { userId: string } {
  return jwt.verify(token, env.jwtRefreshSecret) as { userId: string }
}
