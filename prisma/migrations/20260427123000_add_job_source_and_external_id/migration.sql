ALTER TABLE "Job"
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'remotive',
ADD COLUMN "externalId" TEXT NOT NULL;

CREATE UNIQUE INDEX "Job_source_externalId_key" ON "Job"("source", "externalId");
