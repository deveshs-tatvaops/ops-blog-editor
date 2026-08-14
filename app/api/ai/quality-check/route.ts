import { NextResponse } from 'next/server';
import { generateJson } from '@/lib/ai/client';
import { aiError } from '@/lib/ai/errors';
import { WRITING_STANDARD } from '@/lib/ai/prompt';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          detail: { type: 'string' },
          suggestion: { type: 'string' },
        },
        required: ['type', 'severity', 'detail', 'suggestion'],
        additionalProperties: false,
      },
    },
    passiveVoice: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'issues', 'passiveVoice'],
  additionalProperties: false,
};

export async function POST(req: Request) {
  try {
    const { content_markdown } = await req.json();
    const report = await generateJson(
      `Review this draft against the house writing standard. Report concrete, fixable issues — reader value, structure, heading quality, keyword handling, anchor text, unsupported claims, filler. Quote the passive-voice sentences you find in passiveVoice; flag them, do not rewrite them.

--- DRAFT ---
${String(content_markdown ?? '').slice(0, 60000)}`,
      SCHEMA,
      { system: `${WRITING_STANDARD}\n\nYou are reviewing a draft, not writing one.` }
    );
    return NextResponse.json({ report });
  } catch (err) {
    return aiError(err);
  }
}
