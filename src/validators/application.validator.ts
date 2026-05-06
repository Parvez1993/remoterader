import { z } from 'zod'

// jobId comes from req.params — cuid() values are always non-empty strings
export const applyToJobSchema = z.object({
  jobId: z.string().min(1),
})

export type ApplyToJobInput = z.infer<typeof applyToJobSchema>
