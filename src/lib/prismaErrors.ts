import { ConflictError, NotFoundError, InternalServerError } from '../types/errors.js'

interface PrismaError {
  code: string
}

function isPrismaError(error: unknown): error is PrismaError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string'
  )
}

export function handlePrismaError(error: unknown): never {
  if (isPrismaError(error)) {
    if (error.code === 'P2002') throw new ConflictError('Resource already exists')
    if (error.code === 'P2025') throw new NotFoundError('Resource not found')
  }
  throw new InternalServerError()
}
