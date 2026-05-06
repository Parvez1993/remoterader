import { PrismaClient } from '../../src/generated/prisma/index.js'
import { env } from '../config/env.js'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (!env.isProduction) globalForPrisma.prisma = prisma
