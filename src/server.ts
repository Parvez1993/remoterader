import 'dotenv/config'
import { app } from './app.js'
import { env } from './config/env.js'
import { prisma } from './lib/prisma.js'
import { redis } from './lib/redis.js'
import { startRemotiveScraper } from './jobs/remotive.job.js'
import { createScoringWorker } from './jobs/scoring.worker.js'

let scoringWorker: ReturnType<typeof createScoringWorker> | null = null

async function startServer(): Promise<void> {
  await prisma.$connect()
  console.log('PostgreSQL connected')

  await redis.ping()
  console.log('Redis connected')

  if (env.runScheduler) {
    startRemotiveScraper()
    console.log('Remotive scraper scheduled')
  }

  if (env.runScoringWorker) {
    scoringWorker = createScoringWorker()
    console.log('Scoring worker started')
  }

  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`)
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
  if (scoringWorker) {
    await scoringWorker.close()
  }
  await prisma.$disconnect()
  redis.disconnect()
  process.exit(0)
})

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
