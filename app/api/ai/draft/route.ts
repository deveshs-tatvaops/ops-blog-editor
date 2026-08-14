import { NextResponse } from 'next/server';
import { generateProse } from '@/lib/ai/client';
import { aiError } from '@/lib/ai/errors';
import { contextBlock } from '@/lib/ai/prompt';
import { listServices } from '@/lib/posts';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const ctx = await req.json();
    const services = listServices()
      .map((s) => `- ${s.name}: /services/${s.slug}`)
      .join('\n');

    const content_markdown = await generateProse(
      `Write a complete blog post.

${contextBlock(ctx)}

TatvaOps service pages available for internal linking (use at least one, with descriptive anchor text):
${services}

Include at least one link to a credible external source, and finish with an "## FAQ" section of three "### Question?" headings and short answers.`
    );

    return NextResponse.json({ content_markdown });
  } catch (err) {
    return aiError(err);
  }
}
