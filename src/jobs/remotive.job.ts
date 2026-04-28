import cron from 'node-cron'
import { syncRemotiveJobs } from '../services/job.service.js'

const JOB_SCRAPE_CRON = process.env.JOB_SCRAPE_CRON ?? '0 * * * *'

let isScrapeRunning = false

async function runRemotiveSync(): Promise<void> {
  if (isScrapeRunning) {
    console.warn('Remotive sync skipped because the previous run is still active')
    return
  }

  isScrapeRunning = true

  try {
    const result = await syncRemotiveJobs()
    console.log(
      `Remotive sync completed: fetched=${result.fetched} created=${result.created} updated=${result.updated}`
    )
  } catch (error) {
    console.error('Remotive sync failed:', error)
  } finally {
    isScrapeRunning = false
  }
}

export function startRemotiveScraper(): void {
  if (!cron.validate(JOB_SCRAPE_CRON)) {
    throw new Error(`Invalid JOB_SCRAPE_CRON value: ${JOB_SCRAPE_CRON}`)
  }

  cron.schedule(JOB_SCRAPE_CRON, () => {
    void runRemotiveSync()
  })

  console.log(`Remotive scraper scheduled with cron: ${JOB_SCRAPE_CRON}`)
}
