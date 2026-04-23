import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { signToken } from '../lib/jwt.js'
import { UnauthorizedError } from '../types/errors.js'
import { handlePrismaError } from '../lib/prismaErrors.js'
import type { RegisterInput, LoginInput } from '../validators/auth.validator.js'

export async function registerUser(input: RegisterInput): Promise<{ token: string }> {
  const passwordHash = await bcrypt.hash(input.password, 12)

  try {
    const user = await prisma.user.create({
      data: { email: input.email, passwordHash },
    })
    return { token: signToken(user.id) }
  } catch (error) {
    handlePrismaError(error)
  }
}

export async function loginUser(input: LoginInput): Promise<{ token: string }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user) throw new UnauthorizedError('Invalid credentials')

  const isValid = await bcrypt.compare(input.password, user.passwordHash)
  if (!isValid) throw new UnauthorizedError('Invalid credentials')

  return { token: signToken(user.id) }
}
