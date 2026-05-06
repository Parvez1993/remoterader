
import { Queue } from 'bullmq'
import { createBullRedisConnection } from './redis.js'

export const scoringQueue = new Queue('job-scoring', {
  connection: createBullRedisConnection(),
})
