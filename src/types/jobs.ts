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
