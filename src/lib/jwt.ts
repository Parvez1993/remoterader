import jwt from 'jsonwebtoken'

const secret = process.env.JWT_SECRET as string
const expiresIn = process.env.JWT_EXPIRES_IN ?? '7d'

export function signToken(userId: string): string {
  return jwt.sign({ userId }, secret, { expiresIn } as jwt.SignOptions)
}

export function verifyToken(token: string): { userId: string } {
  return jwt.verify(token, secret) as { userId: string }
}
