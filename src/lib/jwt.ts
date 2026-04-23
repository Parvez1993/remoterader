import jwt from 'jsonwebtoken'

const accessSecret = process.env.JWT_ACCESS_SECRET as string
const refreshSecret = process.env.JWT_REFRESH_SECRET as string
const accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m'
const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d'

export function signAccessToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, accessSecret, { expiresIn: accessExpiresIn } as jwt.SignOptions)
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId }, refreshSecret, { expiresIn: refreshExpiresIn } as jwt.SignOptions)
}

export function verifyAccessToken(token: string): { userId: string; role: string } {
  return jwt.verify(token, accessSecret) as { userId: string; role: string }
}

export function verifyRefreshToken(token: string): { userId: string } {
  return jwt.verify(token, refreshSecret) as { userId: string }
}
