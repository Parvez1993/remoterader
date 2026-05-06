import { Redis } from 'ioredis'
import { env } from '../config/env.js'

export const redis = new Redis(env.redisUrl)

redis.on('error', (error: Error) => console.error('Redis error:', error))

export function createBullRedisConnection(): Redis {
  return new Redis(env.redisUrl, {
    maxRetriesPerRequest: null,
  })
}
