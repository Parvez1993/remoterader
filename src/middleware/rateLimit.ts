import { randomUUID } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { redis } from '../lib/redis.js'
import type { RequestWithAuthContext } from './authenticate.js'
import { TooManyRequestsError } from '../types/errors.js'

interface RateLimiterOptions {
  keyPrefix: string
  limit: number
  windowMs: number
}

function getRateLimitIdentity(req: Request): string {
  const authRequest = req as RequestWithAuthContext
  if (authRequest.userId) return `user:${authRequest.userId}`

  return `ip:${req.ip}`
}

async function consumeRateLimitSlot(
  options: RateLimiterOptions,
  identity: string
): Promise<{ count: number; resetAt: number }> {
  const now = Date.now()
  const windowStart = now - options.windowMs
  const resetAt = now + options.windowMs
  const redisKey = `${options.keyPrefix}:${identity}`
  const member = `${now}:${randomUUID()}`

  const results = await redis
    .multi()
    .zremrangebyscore(redisKey, 0, windowStart)
    .zadd(redisKey, now, member)
    .zcard(redisKey)
    .pexpire(redisKey, options.windowMs)
    .exec()

  const count = Number(results?.[2]?.[1] ?? 0)
  return { count, resetAt }
}

export function createRateLimiter(options: RateLimiterOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identity = getRateLimitIdentity(req)
      const { count, resetAt } = await consumeRateLimitSlot(options, identity)
      const remaining = Math.max(options.limit - count, 0)

      res.setHeader('X-RateLimit-Limit', String(options.limit))
      res.setHeader('X-RateLimit-Remaining', String(remaining))
      res.setHeader('X-RateLimit-Reset', String(resetAt))

      if (count >= options.limit) {
        throw new TooManyRequestsError('Rate limit exceeded')
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

export const globalRateLimiter = createRateLimiter({
  keyPrefix: 'rate-limit:global',
  limit: 100,
  windowMs: 15 * 60 * 1000,
})

export const aiRateLimiter = createRateLimiter({
  keyPrefix: 'rate-limit:ai',
  limit: 10,
  windowMs: 60 * 1000,
})
