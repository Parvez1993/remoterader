import { z } from 'zod'

export const filterJobsSchema = z.object({
  query: z.string().min(3).max(500),
  limit: z.number().int().min(1).max(25).default(10),
})

export type FilterJobsInput = z.infer<typeof filterJobsSchema>
