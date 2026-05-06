// OpenAPI 3.0 spec written as a plain TypeScript object.
// This is the contract between backend and any consumer (frontend, mobile, partners).
// Keeping it in code (not YAML) means it's type-checkable, diffable, and refactorable.

const bearerAuth = {
  BearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  },
} as const

// Reusable response shapes — defined once, referenced by $ref throughout
const sharedComponents = {
  schemas: {
    SuccessMessage: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string' },
      },
    },
    ErrorResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Something went wrong' },
      },
    },
    Job: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'clxyz123' },
        title: { type: 'string', example: 'Senior Backend Engineer' },
        company: { type: 'string', example: 'Acme Corp' },
        location: { type: 'string', example: 'Worldwide' },
        url: { type: 'string', example: 'https://remotive.com/job/123' },
        salary: { type: 'string', nullable: true, example: '$120k - $160k' },
        postedAt: { type: 'string', format: 'date-time' },
        applicationCount: { type: 'integer', example: 4 },
      },
    },
    RankedJob: {
      type: 'object',
      properties: {
        jobId: { type: 'string', example: 'clxyz123' },
        title: { type: 'string', example: 'Senior Backend Engineer' },
        company: { type: 'string', example: 'Acme Corp' },
        location: { type: 'string', example: 'Worldwide' },
        url: { type: 'string', example: 'https://remotive.com/job/123' },
        postedAt: { type: 'string', format: 'date-time' },
        score: { type: 'number', minimum: 1, maximum: 10, example: 8.5 },
        reason: { type: 'string', example: 'Strong title match, clear salary, fully remote' },
      },
    },
    Application: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'clappl123' },
        jobId: { type: 'string', example: 'clxyz123' },
        userId: { type: 'string', example: 'clusr456' },
        status: { type: 'string', example: 'applied' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  },
  securitySchemes: bearerAuth,
}

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'RemoteRadar API',
    version: '1.0.0',
    description: [
      'Remote job aggregator with AI-powered filtering and async job scoring.',
      '',
      '**Authentication:** Most endpoints require a Bearer JWT.',
      'Obtain a token via `POST /auth/login`.',
    ].join('\n'),
    contact: {
      name: 'RemoteRadar',
    },
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development' },
  ],
  components: sharedComponents,
  paths: {
    // ── Health ────────────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'Server is running',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessMessage' },
              },
            },
          },
        },
      },
    },

    // ── Auth ──────────────────────────────────────────────────────────────
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'dev@example.com' },
                  password: { type: 'string', minLength: 8, example: 'Str0ngPass!' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'User created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          409: { description: 'Email already in use', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and receive access + refresh tokens',
        description: 'The refresh token is set as an `httpOnly` cookie. The access token is returned in the response body.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    accessToken: { type: 'string' },
                  },
                },
              },
            },
          },
          401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Exchange refresh token for a new access token',
        description: 'Reads the refresh token from the `refreshToken` httpOnly cookie.',
        responses: {
          200: {
            description: 'New access token issued',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    accessToken: { type: 'string' },
                  },
                },
              },
            },
          },
          401: { description: 'Missing or invalid refresh token', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Invalidate the refresh token',
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Logged out', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessMessage' } } } },
          401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    // ── Jobs ──────────────────────────────────────────────────────────────
    '/jobs': {
      get: {
        tags: ['Jobs'],
        summary: 'List jobs (paginated, cursor-based)',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 25, default: 10 } },
          { name: 'cursor', in: 'query', description: 'Base64url-encoded cursor from previous response', schema: { type: 'string' } },
          { name: 'company', in: 'query', schema: { type: 'string', maxLength: 100 } },
          { name: 'location', in: 'query', schema: { type: 'string', maxLength: 100 } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['latest', 'oldest'], default: 'latest' } },
        ],
        responses: {
          200: {
            description: 'Paginated job list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 10 },
                    nextCursor: { type: 'string', nullable: true },
                    jobs: { type: 'array', items: { $ref: '#/components/schemas/Job' } },
                  },
                },
              },
            },
          },
          429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/jobs/filter': {
      post: {
        tags: ['Jobs'],
        summary: 'AI-powered job ranking against a candidate query',
        description: 'Sends recent jobs to OpenAI and returns them ranked by relevance to the query. Rate limited.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query'],
                properties: {
                  query: { type: 'string', minLength: 3, maxLength: 500, example: 'Senior Node.js engineer with Postgres, remote, US timezone' },
                  limit: { type: 'integer', minimum: 1, maximum: 25, default: 10 },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Ranked job list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer' },
                    jobs: { type: 'array', items: { $ref: '#/components/schemas/RankedJob' } },
                  },
                },
              },
            },
          },
          429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/jobs/score': {
      post: {
        tags: ['Jobs'],
        summary: 'Enqueue async AI scoring for a single job',
        description: [
          'Adds a scoring job to the BullMQ queue. Returns `202 Accepted` immediately.',
          'Poll `GET /jobs/scoring-status/:id` with the returned `scoringJobId`.',
          'If the job was already scored, returns `200` with `status: done` instantly.',
        ].join(' '),
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['jobId'],
                properties: {
                  jobId: { type: 'string', example: 'clxyz123' },
                },
              },
            },
          },
        },
        responses: {
          202: {
            description: 'Scoring job enqueued',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    scoringJobId: { type: 'string', example: '42' },
                    status: { type: 'string', enum: ['pending'], example: 'pending' },
                  },
                },
              },
            },
          },
          200: {
            description: 'Score already cached — returned immediately',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    scoringJobId: { type: 'string', example: 'cached:clxyz123' },
                    status: { type: 'string', enum: ['done'], example: 'done' },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { description: 'Job not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/jobs/scoring-status/{id}': {
      get: {
        tags: ['Jobs'],
        summary: 'Poll the status of an async scoring job',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, description: 'scoringJobId returned by POST /jobs/score', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Current scoring status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    status: { type: 'string', enum: ['pending', 'processing', 'done', 'failed'] },
                    score: { type: 'number', minimum: 1, maximum: 10, nullable: true },
                    reason: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { description: 'Scoring job not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },

    '/jobs/{id}/apply': {
      post: {
        tags: ['Jobs'],
        summary: 'Apply to a job',
        description: [
          'Creates an Application record in a Prisma interactive transaction.',
          'The unique constraint on `[userId, jobId]` prevents duplicate applications — returns 409 if already applied.',
        ].join(' '),
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, description: 'Job ID', schema: { type: 'string' } },
        ],
        responses: {
          201: {
            description: 'Application created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    application: { $ref: '#/components/schemas/Application' },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          404: { description: 'Job not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          409: { description: 'Already applied to this job', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
  },
}
