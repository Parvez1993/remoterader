import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { createStructuredOutput } from '../lib/openai.js'
import { handlePrismaError } from '../lib/prismaErrors.js'
import { InternalServerError } from '../types/errors.js'
import type { RankedJobResult, RankedJobScore, RemotiveJob, RemotiveJobsResponse } from '../types/jobs.js'
import type { FilterJobsInput } from '../validators/job.validator.js'

const REMOTIVE_API_URL = process.env.REMOTIVE_API_URL ?? 'https://remotive.com/api/remote-jobs?limit=100'
const REMOTIVE_FETCH_TIMEOUT_MS = Number(process.env.REMOTIVE_FETCH_TIMEOUT_MS ?? 10000)
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

    const updated = jobs.filter((job) => existingExternalIds.has(String(job.id))).length
    const created = jobs.length - updated

    return { fetched: jobs.length, created, updated }
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
