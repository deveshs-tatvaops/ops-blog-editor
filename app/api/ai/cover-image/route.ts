import { NextResponse } from 'next/server';
import { generateJson } from '@/lib/ai/client';
import { aiError } from '@/lib/ai/errors';
import { contextBlock } from '@/lib/ai/prompt';
import { type CoverArtSpec, renderCoverImage } from '@/lib/media';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'Up to 6 words drawn from the post, set across the artwork' },
    motif: { type: 'string', enum: ['blueprint', 'arches', 'grid', 'roofline', 'panels'] },
    palette: {
      type: 'array',
      items: { type: 'string', description: 'Hex colour, e.g. #F26522' },
      description: 'Exactly two hex colours for the background gradient',
    },
    alt: { type: 'string', description: 'Alt text describing the artwork' },
    caption: { type: 'string', description: 'One-line caption for under the hero image' },
  },
  required: ['headline', 'motif', 'palette', 'alt', 'caption'],
  additionalProperties: false,
};

interface Spec extends CoverArtSpec {
  alt: string;
  caption: string;
}

export async function POST(req: Request) {
  try {
    const ctx = await req.json();
    const spec = await generateJson<Spec>(
      `Art-direct an abstract cover image for this post. It must be specific to this article — pick a motif and palette that suit its subject, not a generic default. Palette colours should sit in the TatvaOps range: warm oranges (#FF9A1F to #F2451E), deep indigo (#141345), or a considered pairing of the two.

${contextBlock(ctx)}`,
      SCHEMA,
      { maxTokens: 2000 }
    );

    const palette: [string, string] = [
      /^#[0-9a-f]{6}$/i.test(spec.palette?.[0] ?? '') ? spec.palette[0] : '#F2451E',
      /^#[0-9a-f]{6}$/i.test(spec.palette?.[1] ?? '') ? spec.palette[1] : '#141345',
    ];

    // Keying on title + excerpt guarantees a different file per post.
    const key = `${ctx.title ?? ''}|${ctx.excerpt ?? ''}|${ctx.focus_keyword ?? ''}`;
    const image = await renderCoverImage({ headline: spec.headline, motif: spec.motif, palette }, key);

    return NextResponse.json({ ...image, alt: spec.alt, caption: spec.caption });
  } catch (err) {
    return aiError(err);
  }
}
