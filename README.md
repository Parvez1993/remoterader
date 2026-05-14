# RemoteRadar

RemoteRadar is a production-grade backend API that aggregates remote job listings, ranks them using AI, and lets users apply — all built with Node.js, PostgreSQL, Redis, and OpenAI.

It was built as a portfolio project to demonstrate real backend engineering: async job queues, JWT auth, Redis caching, database transactions, rate limiting, and a live deployment on Railway.

**Live API:** https://remoterader-production.up.railway.app
**Interactive docs:** https://remoterader-production.up.railway.app/docs

---

## What it does

- Scrapes remote jobs from the Remotive API every hour via a cron job
- Stores them in PostgreSQL and exposes a paginated, filterable API
- Lets users search jobs using natural language — powered by OpenAI
- Scores individual jobs in the background using a BullMQ queue, so the user never waits on an AI call
- Handles user registration, login, and secure JWT-based authentication
- Lets authenticated users apply to jobs, protected by a database transaction

---

## Architecture

```
                    +----------------------+
                    |      Remotive API    |
                    +----------+-----------+
                               |
                          every hour
                               |
                               v
                    +----------------------+
                    |    Cron Scraper      |
                    |    (node-cron)       |
                    +----------+-----------+
                               |
                               v
+------------+       +----------------------+       +----------------------+
|   Client   +-----> |     Express API      +-----> |     PostgreSQL       |
| Postman/UI |       |  auth, jobs, apply   |       | users, jobs, apps    |
+------+-----+       +----------+-----------+       +----------------------+
       |                        |
       |              +---------+---------+
       |              |                   |
       v              v                   v
  +----------+   +----------+    +----------------------+
  |  /docs   |   |  Redis   |    |     BullMQ Worker    |
  | Swagger  |   |  cache   |    |   AI scoring jobs    |
  +----------+   |  queue   |    +----------+-----------+
                 |  limits  |               |
                 +----------+               v
                                  +----------------------+
                                  |   OpenAI Responses   |
                                  +----------------------+
```

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22 |
| Framework | Express 5 |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL + Prisma ORM |
| Cache / Queue | Redis + BullMQ |
| Validation | Zod |
| Auth | JWT — access token + refresh token cookie |
| Logging | Pino (structured JSON logs) |
| Deployment | Docker (multi-stage) + Railway |

---

## API Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Liveness check |
| GET | `/ready` | — | Readiness check (DB + Redis) |
| POST | `/auth/register` | — | Create account |
| POST | `/auth/login` | — | Login, receive access + refresh tokens |
| POST | `/auth/refresh` | — | Exchange refresh cookie for new access token |
| POST | `/auth/logout` | ✓ | Invalidate refresh token |
| GET | `/jobs` | — | Paginated, filterable job list (Redis cached) |
| POST | `/jobs/filter` | — | AI-ranked jobs against a natural language query |
| POST | `/jobs/score` | ✓ | Queue async AI scoring for a single job |
| GET | `/jobs/scoring-status/:id` | ✓ | Poll background scoring result |
| POST | `/jobs/:id/apply` | ✓ | Apply to a job (database transaction) |
| GET | `/docs` | — | Interactive Swagger UI |

---

## Local Setup

### Prerequisites

- Node.js 22+
- pnpm
- PostgreSQL
- Redis

### Run it locally

```bash
git clone https://github.com/Parvez1993/remoterader.git
cd remoterader
pnpm install
cp .env.example .env   # fill in your values
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm dev
```

Then open:
- API: `http://localhost:5000`
- Swagger: `http://localhost:5000/docs`
- Health: `http://localhost:5000/health`

### Environment variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/remoterader
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
JWT_ACCESS_SECRET=your_secret
JWT_REFRESH_SECRET=your_other_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=5000
NODE_ENV=development
RUN_SCHEDULER=true
RUN_SCORING_WORKER=true
ALLOWED_ORIGINS=http://localhost:3000
JOB_SCRAPE_CRON=0 * * * *
JOBS_CACHE_TTL_SECONDS=300
```

---

## How the key flows work

### Job ingestion
A `node-cron` job runs on the `JOB_SCRAPE_CRON` schedule, fetches remote jobs from Remotive, and upserts them into PostgreSQL. After each sync, the Redis cache version is incremented to invalidate stale pages.

### Job browsing
`GET /jobs` uses cursor-based pagination with a compound `(postedAt, id)` index for stable, fast page navigation. Results are cached in Redis for 5 minutes. Filters for company and location are applied at the DB level.

### AI filtering
`POST /jobs/filter` sends recent jobs to OpenAI in one call and returns them ranked by relevance to the user's natural language query. Synchronous — the user waits for the result.

### Async AI scoring
`POST /jobs/score` drops a job into a BullMQ queue and returns `202 Accepted` immediately. A background worker picks it up, calls OpenAI, and stores the result in Redis for 24 hours. The user polls `GET /jobs/scoring-status/:id` until the score is ready. If OpenAI fails, BullMQ retries up to 5 times with exponential backoff.

### Applying to a job
`POST /jobs/:id/apply` runs inside a Prisma interactive transaction — the job existence check and the application write happen atomically. If anything fails mid-way, Postgres rolls everything back. A unique constraint on `(userId, jobId)` prevents duplicate applications and returns a clean 409.

---

## Design decisions

**JWT over sessions** — The API is stateless. Access tokens are short-lived (15 minutes). Refresh tokens are stored in an `httpOnly` cookie and invalidated in the database on logout, solving the JWT invalidation problem without sticky sessions.

**BullMQ over inline AI calls** — Calling OpenAI synchronously in a request handler ties up the connection for 3-10 seconds and fails silently on timeouts. The queue decouples accepting work from doing it, adds automatic retries, and lets the worker scale independently.

**Cursor pagination over offset** — Offset pagination on a live dataset causes rows to shift between pages as new jobs are inserted. Cursor pagination is stable and maps directly to the `(postedAt, id)` index — no large offset scans.

**Redis-backed rate limiting** — Rate limit counters live in Redis, not in process memory. This means limits are enforced correctly across multiple app instances without any coordination.

**Separate liveness and readiness** — `/health` tells Railway the process is alive. `/ready` verifies the app can actually serve traffic by pinging PostgreSQL and Redis. This prevents Railway from routing requests to a booted-but-broken container.

---

## Security

| Threat | Protection |
|---|---|
| SQL injection | Prisma parameterized queries |
| User enumeration | Same error message for wrong email and wrong password |
| Token theft | Short-lived access token + httpOnly refresh token cookie |
| Brute force | Redis sliding-window rate limiting on all routes |
| Mass assignment | Zod validates every request before it touches the DB |
| Insecure headers | Helmet |
| Cross-origin abuse | Explicit `ALLOWED_ORIGINS` allowlist |
| Privilege escalation | Route-level authentication + RBAC middleware |

---

## Docker

Multi-stage build — the `builder` stage compiles TypeScript and generates the Prisma client. The `production` stage copies only the compiled output and `node_modules`, runs as the non-root `node` user, and includes a Docker `HEALTHCHECK`.

```bash
docker build -t remoterader .
docker run --env-file .env -p 5000:5000 remoterader
```
