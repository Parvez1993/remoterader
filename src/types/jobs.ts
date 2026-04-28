export interface RankedJobScore {
  jobId: string
  score: number
  reason: string
}

export interface RankedJobResult extends RankedJobScore {
  title: string
  company: string
  location: string
  url: string
  postedAt: Date
}

export interface JobsListCursor {
  id: string
  postedAt: string
}

export interface ListedJobResult {
  id: string
  title: string
  company: string
  location: string
  url: string
  salary: string | null
  postedAt: string
  applicationCount: number
}

export interface PaginatedJobsResult {
  jobs: ListedJobResult[]
  nextCursor: string | null
}

export interface RemotiveJob {
  id: number
  url: string
  title: string
  company_name: string
  candidate_required_location: string
  description: string
  salary: string
  publication_date: string
}

export interface RemotiveJobsResponse {
  jobs: RemotiveJob[]
}
