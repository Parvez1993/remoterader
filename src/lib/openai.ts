import { InternalServerError } from '../types/errors.js'

const OPENAI_API_URL = 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

interface StructuredOutputOptions {
  schemaName: string
  schema: Record<string, unknown>
  systemPrompt: string
  userPrompt: string
}

interface OpenAIOutputTextItem {
  type: string
  text?: string
}

interface OpenAIOutputItem {
  content?: OpenAIOutputTextItem[]
}

interface OpenAIResponsePayload {
  output_text?: string
  output?: OpenAIOutputItem[]
}

function extractOutputText(payload: OpenAIResponsePayload): string {
  if (typeof payload.output_text === 'string' && payload.output_text.length > 0) {
    return payload.output_text
  }

  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
    .map((item) => item.text ?? '')
    .join('')

  if (!text) {
    throw new InternalServerError('OpenAI response did not contain text output')
  }

  return text
}

export async function createStructuredOutput<T>({
  schemaName,
  schema,
  systemPrompt,
  userPrompt,
}: StructuredOutputOptions): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new InternalServerError('OPENAI_API_KEY is not configured')
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new InternalServerError(`OpenAI request failed: ${errorBody}`)
  }

  const payload = (await response.json()) as OpenAIResponsePayload
  return JSON.parse(extractOutputText(payload)) as T
}
