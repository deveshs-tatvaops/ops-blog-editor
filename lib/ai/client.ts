import Anthropic from '@anthropic-ai/sdk';
import { WRITING_STANDARD } from './prompt';

let client: Anthropic | null = null;

export class MissingApiKeyError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY is not set — add it to .env.local to use the AI tools.');
    this.name = 'MissingApiKeyError';
  }
}

export function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new MissingApiKeyError();
  if (!client) client = new Anthropic();
  return client;
}

export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

/** Long-form generation. Streams so large max_tokens never trips an HTTP timeout. */
export async function generateProse(
  userPrompt: string,
  { maxTokens = 32000, effort = 'high' as const } = {}
): Promise<string> {
  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    system: WRITING_STANDARD,
    output_config: { effort },
    messages: [{ role: 'user', content: userPrompt }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') {
    throw new Error('The model declined this request. Try rephrasing the brief.');
  }
  return textOf(message.content);
}

/**
 * Structured generation. Uses output_config.format so the response is guaranteed
 * to satisfy the schema — no brittle JSON-from-prose parsing.
 */
export async function generateJson<T>(
  userPrompt: string,
  schema: Record<string, unknown>,
  { maxTokens = 8000, system = WRITING_STANDARD, effort = 'medium' as const } = {}
): Promise<T> {
  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    output_config: { effort, format: { type: 'json_schema', schema } as never },
    messages: [{ role: 'user', content: userPrompt }],
  });
  if (message.stop_reason === 'refusal') {
    throw new Error('The model declined this request.');
  }
  return JSON.parse(textOf(message.content)) as T;
}
