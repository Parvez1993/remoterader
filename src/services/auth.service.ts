import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js'
import { UnauthorizedError } from '../types/errors.js'
import { handlePrismaError } from '../lib/prismaErrors.js'
import type { RegisterInput, LoginInput } from '../validators/auth.validator.js'

export async function registerUser(input: RegisterInput): Promise<{ accessToken: string }> {
  const passwordHash = await bcrypt.hash(input.password, 12)

  try {
    const user = await prisma.user.create({
      data: { email: input.email, passwordHash },
    })
    const accessToken = signAccessToken(user.id, user.role)
    return { accessToken }
  } catch (error) {
    handlePrismaError(error)
  }
}

export async function loginUser(input: LoginInput): Promise<{ accessToken: string; refreshToken: string }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user) throw new UnauthorizedError('Invalid credentials')

  const isValid = await bcrypt.compare(input.password, user.passwordHash)
  if (!isValid) throw new UnauthorizedError('Invalid credentials')

  const accessToken = signAccessToken(user.id, user.role)
  const refreshToken = signRefreshToken(user.id)

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  })

  return { accessToken, refreshToken }
}

export async function refreshAccessToken(token: string): Promise<{ accessToken: string }> {
  const payload = verifyRefreshToken(token)

  const user = await prisma.user.findUnique({ where: { id: payload.userId } })
  if (!user || user.refreshToken !== token) throw new UnauthorizedError('Invalid refresh token')

  const accessToken = signAccessToken(user.id, user.role)
  return { accessToken }
}

export async function logoutUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  })
}
