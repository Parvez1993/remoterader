import { z } from 'zod'
import type { Prisma } from '../generated/prisma/index.js'
import { prisma } from '../lib/prisma.js'
import { createStructuredOutput } from '../lib/openai.js'
import { handlePrismaError } from '../lib/prismaErrors.js'
import { redis } from '../lib/redis.js'
import { scoringQueue } from '../lib/queue.js'
import { BadRequestError, InternalServerError, NotFoundError, TooManyRequestsError } from '../types/errors.js'
import type {
  JobsListCursor,
  ListedJobResult,
  PaginatedJobsResult,
  RankedJobResult,
  RankedJobScore,
  RemotiveJob,
  RemotiveJobsResponse,
} from '../types/jobs.js'
import type { FilterJobsInput, ListJobsInput, ScoreJobInput } from '../validators/job.validator.js'

const REMOTIVE_API_URL = process.env.REMOTIVE_API_URL ?? 'https://remotive.com/api/remote-jobs?limit=100'
const REMOTIVE_FETCH_TIMEOUT_MS = Number(process.env.REMOTIVE_FETCH_TIMEOUT_MS ?? 10000)
const JOBS_CACHE_TTL_SECONDS = Number(process.env.JOBS_CACHE_TTL_SECONDS ?? 300)
const JOBS_CACHE_VERSION_KEY = 'jobs:list:version'
const SCRAPER_SOURCE = 'remotive'

const rankedJobsResponseSchema = z.object({
  rankings: z.array(
    z.object({
      jobId: z.string(),
      score: z.number().min(1).max(10),
      reason: z.string().min(1).max(240),
    })
  ),
})

const rankedJobsJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rankings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          jobId: { type: 'string' },
          score: { type: 'number' },
          reason: { type: 'string' },
        },
        required: ['jobId', 'score', 'reason'],
      },
    },
  },
  required: ['rankings'],
} satisfies Record<string, unknown>

const jobsListCursorSchema = z.object({
  id: z.string().min(1),
  postedAt: z.string().datetime(),
})

const paginatedJobsCacheSchema = z.object({
  jobs: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      company: z.string(),
      location: z.string(),
      url: z.string(),
      salary: z.string().nullable(),
      postedAt: z.string().datetime(),
      applicationCount: z.number().int().min(0),
    })
  ),
  nextCursor: z.string().nullable(),
})

function normalizeDescription(description: string): string {
  return description.replace(/\s+/g, ' ').trim().slice(0, 1200)
}

function buildRankingPrompt(query: string, jobs: Array<{
  id: string
  title: string
  company: string
  location: string
  salary: string | null
  description: string
}>): string {
  return [
    `Candidate query: ${query}`,
    'Score every job from 1 to 10 based on fit for the candidate query.',
    'Return each job exactly once.',
    'Prefer strong title match, relevant experience match, location fit, and salary clarity.',
    'Keep each reason under 240 characters.',
    `Jobs: ${JSON.stringify(jobs)}`,
  ].join('\n')
}

function sortRankings(rankings: RankedJobResult[]): RankedJobResult[] {
  return [...rankings].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    return right.postedAt.getTime() - left.postedAt.getTime()
  })
}

function encodeJobsCursor(cursor: JobsListCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

function decodeJobsCursor(cursor: string): JobsListCursor {
  try {
    const decodedValue = Buffer.from(cursor, 'base64url').toString('utf8')
    return jobsListCursorSchema.parse(JSON.parse(decodedValue))
  } catch {
    throw new BadRequestError('Invalid cursor')
  }
}

function buildJobsOrderBy(sort: ListJobsInput['sort']): Prisma.JobOrderByWithRelationInput[] {
  const direction = sort === 'oldest' ? 'asc' : 'desc'

  return [
    { postedAt: direction },
    { id: direction },
  ]
}

function buildCursorWhereClause(
  cursor: JobsListCursor,
  sort: ListJobsInput['sort']
): Prisma.JobWhereInput {
  const cursorDate = new Date(cursor.postedAt)

  if (sort === 'oldest') {
    return {
      OR: [
        { postedAt: { gt: cursorDate } },
        {
          postedAt: { equals: cursorDate },
          id: { gt: cursor.id },
        },
      ],
    }
  }

  return {
    OR: [
      { postedAt: { lt: cursorDate } },
      {
        postedAt: { equals: cursorDate },
        id: { lt: cursor.id },
      },
    ],
  }
}

function buildJobsWhereInput(
  input: ListJobsInput,
  cursor: JobsListCursor | null
): Prisma.JobWhereInput | undefined {
  const conditions: Prisma.JobWhereInput[] = []

  if (input.company) {
    conditions.push({
      company: {
        contains: input.company,
        mode: 'insensitive',
      },
    })
  }

  if (input.location) {
    conditions.push({
      location: {
        contains: input.location,
        mode: 'insensitive',
      },
    })
  }

  if (cursor) {
    conditions.push(buildCursorWhereClause(cursor, input.sort))
  }

  if (conditions.length === 0) {
    return undefined
  }

  return { AND: conditions }
}

function mapListedJob(job: {
  id: string
  title: string
  company: string
  location: string
  url: string
  salary: string | null
  postedAt: Date
  applications: Array<{
    id: string
  }>
}): ListedJobResult {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    url: job.url,
    salary: job.salary,
    postedAt: job.postedAt.toISOString(),
    applicationCount: job.applications.length,
  }
}

async function getJobsCacheVersion(): Promise<number> {
  try {
    const version = await redis.get(JOBS_CACHE_VERSION_KEY)
    const parsedVersion = Number(version ?? '1')
    return Number.isNaN(parsedVersion) ? 1 : parsedVersion
  } catch (error) {
    console.error('Failed to read jobs cache version:', error)
    return 1
  }
}

async function buildJobsCacheKey(
  input: ListJobsInput,
  cursor: JobsListCursor | null
): Promise<string> {
  const version = await getJobsCacheVersion()
  const cachePayload = {
    limit: input.limit,
    company: input.company?.toLowerCase() ?? null,
    location: input.location?.toLowerCase() ?? null,
    sort: input.sort,
    cursor,
  }

  return `jobs:list:v${version}:${Buffer.from(JSON.stringify(cachePayload)).toString('base64url')}`
}

async function readJobsFromCache(cacheKey: string): Promise<PaginatedJobsResult | null> {
  try {
    const cachedValue = await redis.get(cacheKey)
    if (!cachedValue) return null

    return paginatedJobsCacheSchema.parse(JSON.parse(cachedValue))
  } catch (error) {
    console.error('Failed to read jobs list cache:', error)
    return null
  }
}

async function writeJobsToCache(cacheKey: string, result: PaginatedJobsResult): Promise<void> {
  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', JOBS_CACHE_TTL_SECONDS)
  } catch (error) {
    console.error('Failed to write jobs list cache:', error)
  }
}

export async function invalidateJobsListCache(): Promise<void> {
  try {
    await redis.incr(JOBS_CACHE_VERSION_KEY)
  } catch (error) {
    console.error('Failed to invalidate jobs list cache:', error)
  }
}

export async function fetchRemotiveJobs(): Promise<RemotiveJob[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REMOTIVE_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(REMOTIVE_API_URL, { signal: controller.signal })
    if (!response.ok) {
      throw new InternalServerError(`Remotive request failed with status ${response.status}`)
    }

    const payload = (await response.json()) as RemotiveJobsResponse
    return payload.jobs
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new InternalServerError('Remotive request timed out')
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function syncRemotiveJobs(): Promise<{
  fetched: number
  created: number
  updated: number
}> {
  const jobs = await fetchRemotiveJobs()
  const externalIds = jobs.map((job) => String(job.id))

  try {
    const existingJobs = await prisma.job.findMany({
      where: {
        source: SCRAPER_SOURCE,
        externalId: { in: externalIds },
      },
      select: { externalId: true },
    })

    const existingExternalIds = new Set(existingJobs.map((job) => job.externalId))
    const operations = jobs.map((job) =>
      prisma.job.upsert({
        where: {
          source_externalId: {
            source: SCRAPER_SOURCE,
            externalId: String(job.id),
          },
        },
        update: {
          title: job.title,
          company: job.company_name,
          location: job.candidate_required_location,
          description: job.description,
          url: job.url,
          salary: job.salary || null,
          postedAt: new Date(job.publication_date),
        },
        create: {
          source: SCRAPER_SOURCE,
          externalId: String(job.id),
          title: job.title,
          company: job.company_name,
          location: job.candidate_required_location,
          description: job.description,
          url: job.url,
          salary: job.salary || null,
          postedAt: new Date(job.publication_date),
        },
      })
    )

    await prisma.$transaction(operations)
    await invalidateJobsListCache()

    const updated = jobs.filter((job) => existingExternalIds.has(String(job.id))).length
    const created = jobs.length - updated

    return { fetched: jobs.length, created, updated }
  } catch (error) {
    handlePrismaError(error)
  }
}

export async function listJobs(input: ListJobsInput): Promise<PaginatedJobsResult> {
  const decodedCursor = input.cursor ? decodeJobsCursor(input.cursor) : null
  const cacheKey = await buildJobsCacheKey(input, decodedCursor)
  const cachedResult = await readJobsFromCache(cacheKey)

  if (cachedResult) {
    return cachedResult
  }

  try {
    const jobs = await prisma.job.findMany({
      relationLoadStrategy: 'join',
      where: buildJobsWhereInput(input, decodedCursor),
      orderBy: buildJobsOrderBy(input.sort),
      take: input.limit + 1,
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        url: true,
        salary: true,
        postedAt: true,
        applications: {
          select: {
            id: true,
          },
        },
      },
    })

    const hasNextPage = jobs.length > input.limit
    const pageJobs = hasNextPage ? jobs.slice(0, input.limit) : jobs
    const listedJobs = pageJobs.map(mapListedJob)
    const lastJob = pageJobs.at(-1)

    const result: PaginatedJobsResult = {
      jobs: listedJobs,
      nextCursor: hasNextPage && lastJob
        ? encodeJobsCursor({
            id: lastJob.id,
            postedAt: lastJob.postedAt.toISOString(),
          })
        : null,
    }

    await writeJobsToCache(cacheKey, result)

    return result
  } catch (error) {
    handlePrismaError(error)
  }
}

export async function filterJobs(input: FilterJobsInput): Promise<RankedJobResult[]> {
  const jobs = await prisma.job.findMany({
    orderBy: { postedAt: 'desc' },
    take: input.limit,
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      url: true,
      salary: true,
      description: true,
      postedAt: true,
    },
  })

  if (jobs.length === 0) return []

  const promptJobs = jobs.map((job) => ({
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    salary: job.salary,
    description: normalizeDescription(job.description),
  }))

  const aiResponse = await createStructuredOutput<{ rankings: RankedJobScore[] }>({
    schemaName: 'job_rankings',
    schema: rankedJobsJsonSchema,
    systemPrompt: [
      'You are an expert recruiting assistant.',
      'Rank remote jobs against the candidate query.',
      'Always return valid JSON that matches the provided schema.',
    ].join(' '),
    userPrompt: buildRankingPrompt(input.query, promptJobs),
  })

  const parsed = rankedJobsResponseSchema.parse(aiResponse)
  const rankingMap = new Map(parsed.rankings.map((ranking) => [ranking.jobId, ranking]))

  const rankedJobs = jobs
    .map((job) => {
      const ranking = rankingMap.get(job.id)
      if (!ranking) return null

      return {
        jobId: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        postedAt: job.postedAt,
        score: ranking.score,
        reason: ranking.reason,
      } satisfies RankedJobResult
    })
    .filter((job): job is RankedJobResult => job !== null)

  return sortRankings(rankedJobs)
}

export async function getScoringStatus(
  scoringJobId: string
): Promise<{ status: 'pending' | 'processing' | 'done' | 'failed'; score?: number; reason?: string }> {
  // For cached results the scoringJobId is "cached:<dbJobId>" — extract the DB job ID directly.
  if (scoringJobId.startsWith('cached:')) {
    const dbJobId = scoringJobId.replace('cached:', '')
    const cached = await redis.get(`scoring:result:${dbJobId}`)
    if (cached) {
      const result = JSON.parse(cached) as { score: number; reason: string }
      return { status: 'done', score: result.score, reason: result.reason }
    }
    // Cache expired between enqueue and status check — treat as pending
    return { status: 'pending' }
  }

  // For a real BullMQ job ID, fetch the job first to get the DB job ID from job.data.
  // The worker writes the result under scoring:result:<dbJobId>, not scoring:result:<bullJobId>.
  // Without this lookup we'd be checking the wrong Redis key every time.
  const bullJob = await scoringQueue.getJob(scoringJobId)
  if (!bullJob) throw new NotFoundError('Scoring job not found')

  const dbJobId = (bullJob.data as { jobId: string }).jobId
  const cached = await redis.get(`scoring:result:${dbJobId}`)

  if (cached) {
    const result = JSON.parse(cached) as { score: number; reason: string }
    return { status: 'done', score: result.score, reason: result.reason }
  }

  const state = await bullJob.getState()

  if (state === 'failed') return { status: 'failed' }
  if (state === 'active') return { status: 'processing' }
  return { status: 'pending' }
}

export async function enqueueJobScoring(input: ScoreJobInput): Promise<string> {
  const job = await prisma.job.findUnique({
    where: { id: input.jobId },
    select: { id: true },
  })

  if (!job) throw new NotFoundError('Job not found')

  const existingScore = await redis.get(`scoring:result:${input.jobId}`)
  if (existingScore) return `cached:${input.jobId}`

  const bullJob = await scoringQueue.add(
    'score-job',
    { jobId: input.jobId },
    {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: false,
      removeOnFail: false,
    }
  )

  return bullJob.id!
}
