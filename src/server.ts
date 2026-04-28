import 'dotenv/config'
import { app } from './app.js'
import { prisma } from './lib/prisma.js'
import { redis } from './lib/redis.js'
import { startRemotiveScraper } from './jobs/remotive.job.js'

const PORT = process.env.PORT ?? 3000

async function startServer(): Promise<void> {
  await prisma.$connect()
  console.log('PostgreSQL connected')

  await redis.ping()
  console.log('Redis connected')

  startRemotiveScraper()

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
  process.exit(1)
})

process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  redis.disconnect()
  process.exit(0)
})

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
