import { prisma } from '../lib/prisma.js'
import { handlePrismaError } from '../lib/prismaErrors.js'
import { ConflictError, NotFoundError } from '../types/errors.js'
import type { ApplyToJobInput } from '../validators/application.validator.js'

export interface ApplicationResult {
  id: string
  jobId: string
  userId: string
  status: string
  createdAt: Date
}

export async function applyToJob(
  input: ApplyToJobInput,
  userId: string
): Promise<ApplicationResult> {
  // Interactive transaction: we receive a `tx` client bound to a single
  // open DB connection with an open transaction. Every operation on `tx`
  // executes inside that transaction. If anything throws, Prisma rolls back
  // automatically — neither write lands in the DB.
  //
  // We use interactive (not batch) because we need the job lookup result
  // before we can decide to proceed with the application write.
  try {
    return await prisma.$transaction(async (tx) => {
      // Step 1: Verify job exists INSIDE the transaction.
      // This locks our view of this job row for the duration of the
      // transaction — if another process deletes the job between our
      // check and our write, the constraint on Application.jobId (FK)
      // would catch it anyway, but reading inside the transaction is
      // explicit and self-documenting about our intent.
      const job = await tx.job.findUnique({
        where: { id: input.jobId },
        select: { id: true },
      })

      if (!job) {
        // Throwing inside $transaction triggers an automatic rollback.
        // Nothing has been written yet, but if it had been — it would
        // all roll back here.
        throw new NotFoundError('Job not found')
      }

      // Step 2: Create the application.
      // The @@unique([userId, jobId]) constraint means if this user has
      // already applied, Postgres throws a P2002 unique violation, which
      // Prisma surfaces as a PrismaClientKnownRequestError. The transaction
      // rolls back. handlePrismaError() in the catch below maps it to a
      // 409 ConflictError.
      const application = await tx.application.create({
        data: {
          userId,
          jobId: input.jobId,
          // status defaults to 'applied' per schema — no need to set it
        },
        select: {
          id: true,
          jobId: true,
          userId: true,
          status: true,
          createdAt: true,
        },
      })

      return application
    })
  } catch (error) {
    // Re-throw our own AppErrors untouched — they're already the right shape.
    // Only pass Prisma errors through the mapper.
    if (error instanceof NotFoundError || error instanceof ConflictError) {
      throw error
    }

    handlePrismaError(error)
  }
}
