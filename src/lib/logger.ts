import pino from 'pino'
import { env } from '../config/env.js'

export const logger = pino({
  level: env.logLevel,
  transport:
    !env.isProduction
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
})
