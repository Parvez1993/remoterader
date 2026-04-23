import 'dotenv/config'
import { app } from './app.js'
import { prisma } from './lib/prisma.js'
import { redis } from './lib/redis.js'

const PORT = process.env.PORT ?? 3000

async function startServer(): Promise<void> {
  await prisma.$connect()
  console.log('PostgreSQL connected')

  await redis.ping()
  console.log('Redis connected')

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
