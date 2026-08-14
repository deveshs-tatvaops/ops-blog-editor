import { NextResponse } from 'next/server';
import { generateJson } from '@/lib/ai/client';
import { aiError } from '@/lib/ai/errors';
import { contextBlock } from '@/lib/ai/prompt';
import { LIMITS } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const ALL = ['meta_title', 'meta_description', 'topic_label', 'tags'] as const;
type Field = (typeof ALL)[number];

const PROPERTIES: Record<Field, Record<string, unknown>> = {
  meta_title: { type: 'string', description: 'SEO title, 30-60 characters, contains the focus keyword' },
  meta_description: {
    type: 'string',
    description: 'A reason to click, 120-160 characters, contains the focus keyword exactly once',
  },
  topic_label: { type: 'string', description: 'Two or three word topic descriptor, e.g. "Construction Tech"' },
  tags: {
    type: 'array',
    items: { type: 'string' },
    description: 'Between 3 and 8 lowercase tags',
  },
};

export async function POST(req: Request) {
  try {
    const ctx = await req.json();
    const fields: Field[] = (ctx.fields?.length ? ctx.fields : ALL).filter((f: string) =>
      (ALL as readonly string[]).includes(f)
    );

    const schema = {
      type: 'object',
      properties: Object.fromEntries(fields.map((f) => [f, PROPERTIES[f]])),
      required: fields,
      additionalProperties: false,
    };

    const generated = await generateJson<Record<string, unknown>>(
      `Generate the requested metadata fields for this post.

${contextBlock(ctx)}

--- POST CONTENT ---
${String(ctx.content_markdown ?? '').slice(0, 20000)}`,
      schema
    );

    // Trim to the same limits the editor enforces so a long generation can't
    // silently produce a field that fails the publish gate.
    const out: Record<string, unknown> = { ...generated };
    if (typeof out.meta_title === 'string') out.meta_title = out.meta_title.slice(0, LIMITS.metaTitle);
    if (typeof out.meta_description === 'string')
      out.meta_description = out.meta_description.slice(0, LIMITS.metaDescription);
    if (Array.isArray(out.tags)) out.tags = out.tags.map(String).slice(0, LIMITS.tags);

    return NextResponse.json({ fields: out });
  } catch (err) {
    return aiError(err);
  }
}
