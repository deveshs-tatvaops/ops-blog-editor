import { NextResponse } from 'next/server';
import { generateProse } from '@/lib/ai/client';
import { aiError } from '@/lib/ai/errors';
import { contextBlock } from '@/lib/ai/prompt';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const ctx = await req.json();
    const content_markdown = await generateProse(
      `Refine the draft below so it meets the house writing standard. Keep the author's facts, numbers, structure and voice — tighten the prose, fix passive constructions, sharpen headings, and make sure the focus keyword reads naturally in the opening and one H2. Do not invent new facts or figures. Return the full revised post as Markdown and nothing else.

${contextBlock(ctx)}

--- DRAFT ---
${ctx.content_markdown}`
    );
    return NextResponse.json({ content_markdown });
  } catch (err) {
    return aiError(err);
  }
}
