import { z } from 'zod'

function emptyStringToUndefined(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmedValue = value.trim()
  return trimmedValue === '' ? undefined : trimmedValue
}

export const filterJobsSchema = z.object({
  query: z.string().min(3).max(500),
  limit: z.number().int().min(1).max(25).default(10),
})

export const listJobsSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(25).default(10),
  company: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).max(100).optional()),
  location: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).max(100).optional()),
  sort: z.enum(['latest', 'oldest']).default('latest'),
})

export type FilterJobsInput = z.infer<typeof filterJobsSchema>
export type ListJobsInput = z.infer<typeof listJobsSchema>
