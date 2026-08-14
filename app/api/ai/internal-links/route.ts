import { NextResponse } from 'next/server';
import { generateJson } from '@/lib/ai/client';
import { aiError } from '@/lib/ai/errors';
import { extractLinks, toPlainText } from '@/lib/markdown';
import { listPostsForAdmin, listServices } from '@/lib/posts';
import { blogPath } from '@/lib/slug';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          anchor: {
            type: 'string',
            description: 'Text copied verbatim from the draft that should become the link',
          },
          url: { type: 'string', description: 'One of the supplied internal URLs' },
          reason: { type: 'string' },
        },
        required: ['anchor', 'url', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['suggestions'],
  additionalProperties: false,
};

interface Suggestion {
  anchor: string;
  url: string;
  reason: string;
}

export async function POST(req: Request) {
  try {
    const { content_markdown, id } = await req.json();
    const draft = String(content_markdown ?? '');

    const services = listServices();
    const posts = listPostsForAdmin({ status: 'published' }).filter((p) => p.id !== id && p.service_slug);

    const targets = [
      ...services.map((s) => ({ url: `/services/${s.slug}`, label: `${s.name} service page` })),
      ...posts.map((p) => ({ url: blogPath(p.service_slug!, p.slug), label: `Post: ${p.title}` })),
    ];

    const existing = new Set(extractLinks(draft).map((l) => l.href));

    const { suggestions } = await generateJson<{ suggestions: Suggestion[] }>(
      `Suggest contextual internal links for this draft. Only suggest a link where the surrounding sentence genuinely relates to the target. The anchor must be a phrase copied verbatim from the draft — descriptive, never "click here" — and must not already be inside a Markdown link. Suggest at most six.

--- AVAILABLE INTERNAL URLS ---
${targets.map((t) => `${t.url} — ${t.label}`).join('\n')}

--- DRAFT ---
${draft.slice(0, 40000)}`,
      SCHEMA
    );

    // Drop anything hallucinated: the anchor must exist in the draft and the URL
    // must be one we actually offered.
    const valid = new Set(targets.map((t) => t.url));
    const plain = toPlainText(draft);
    const filtered = suggestions.filter(
      (s) => valid.has(s.url) && !existing.has(s.url) && (draft.includes(s.anchor) || plain.includes(s.anchor))
    );

    return NextResponse.json({ suggestions: filtered });
  } catch (err) {
    return aiError(err);
  }
}
