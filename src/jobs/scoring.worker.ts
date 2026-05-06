import { Worker } from 'bullmq'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'
import { createBullRedisConnection } from '../lib/redis.js'
import { logger } from '../lib/logger.js'
import { createStructuredOutput } from '../lib/openai.js'

const SCORING_RESULT_TTL_SECONDS = 60 * 60 * 24 // 24 hours

const singleJobScoreJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    score: { type: 'number' },
    reason: { type: 'string' },
  },
  required: ['score', 'reason'],
} satisfies Record<string, unknown>

export function createScoringWorker(): Worker {
  const scoringWorker = new Worker(
    'job-scoring',
    async (job) => {
      const { jobId } = job.data as { jobId: string }

      logger.info({ jobId, bullJobId: job.id }, 'Processing scoring job')

      const dbJob = await prisma.job.findUnique({
        where: { id: jobId },
        select: { id: true, title: true, company: true, location: true, salary: true, description: true },
      })

      if (!dbJob) {
        throw new Error(`Job ${jobId} not found in database`)
      }

      const result = await createStructuredOutput<{ score: number; reason: string }>({
        schemaName: 'job_score',
        schema: singleJobScoreJsonSchema,
        systemPrompt: 'You are an expert recruiter. Score this remote job from 1 to 10 based on overall quality, clarity, and desirability. Keep the reason under 200 characters.',
        userPrompt: JSON.stringify({
          title: dbJob.title,
          company: dbJob.company,
          location: dbJob.location,
          salary: dbJob.salary,
          description: dbJob.description.slice(0, 1000),
        }),
      })

      const scoringResultKey = `scoring:result:${jobId}`
      await redis.set(
        scoringResultKey,
        JSON.stringify({ jobId, score: result.score, reason: result.reason }),
        'EX',
        SCORING_RESULT_TTL_SECONDS
      )

      logger.info({ jobId, bullJobId: job.id, score: result.score }, 'Scoring job completed')
    },
    {
      connection: createBullRedisConnection(),
      concurrency: 3,
    }
  )

  scoringWorker.on('failed', (job, error) => {
    logger.error({ bullJobId: job?.id, err: error }, 'Scoring job failed')
  })

  return scoringWorker
}
