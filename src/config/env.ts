function getString(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function getNumber(name: string, fallback: number): number {
  const rawValue = process.env[name]
  if (!rawValue) return fallback

  const parsedValue = Number(rawValue)
  if (Number.isNaN(parsedValue)) {
    throw new Error(`Environment variable ${name} must be a valid number`)
  }

  return parsedValue
}

function getBoolean(name: string, fallback: boolean): boolean {
  const rawValue = process.env[name]
  if (!rawValue) return fallback

  return rawValue.toLowerCase() === 'true'
}

function getAllowedOrigins(): string[] {
  const rawValue = process.env.ALLOWED_ORIGINS

  if (!rawValue) {
    return ['http://localhost:3000']
  }

  return rawValue
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

const nodeEnv = process.env.NODE_ENV ?? 'development'

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: getNumber('PORT', 5000),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  redisUrl: getString('REDIS_URL', 'redis://localhost:6379'),
  allowedOrigins: getAllowedOrigins(),
  healthcheckTimeoutMs: getNumber('HEALTHCHECK_TIMEOUT_MS', 3000),
  runScheduler: getBoolean('RUN_SCHEDULER', true),
  runScoringWorker: getBoolean('RUN_SCORING_WORKER', true),
  jwtAccessSecret: getString('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: getString('JWT_REFRESH_SECRET'),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
}
