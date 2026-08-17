import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { MissingApiKeyError, generateJson } from '@/lib/ai/client';
import { aiError } from '@/lib/ai/errors';
import { contextBlock, type PostContext } from '@/lib/ai/prompt';
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

const MOTIFS: CoverArtSpec['motif'][] = ['blueprint', 'arches', 'grid', 'roofline', 'panels'];
const PALETTES: [string, string][] = [
  ['#F2451E', '#141345'],
  ['#FF9A1F', '#B33F13'],
  ['#141345', '#5B3BE0'],
  ['#F26522', '#1D1C5C'],
];

function artDirect(ctx: PostContext): Promise<Spec> {
  return generateJson<Spec>(
    `Art-direct an abstract cover image for this post. It must be specific to this article — pick a motif and palette that suit its subject, not a generic default. Palette colours should sit in the TatvaOps range: warm oranges (#FF9A1F to #F2451E), deep indigo (#141345), or a considered pairing of the two.

${contextBlock(ctx)}`,
    SCHEMA,
    { maxTokens: 2000 }
  );
}

/**
 * Deterministic art direction for when no API key is configured. Still unique
 * per post — motif and palette are chosen by hashing the post's own text — so
 * the editor stays fully usable, including the cover-image publish requirement.
 */
function fallbackSpec(ctx: PostContext): Spec {
  const key = `${ctx.title ?? ''}|${ctx.focus_keyword ?? ''}`;
  const seed = parseInt(crypto.createHash('sha1').update(key).digest('hex').slice(0, 8), 16);
  const title = (ctx.title ?? 'TatvaOps').trim();
  return {
    headline: title,
    motif: MOTIFS[seed % MOTIFS.length],
    palette: PALETTES[(seed >> 8) % PALETTES.length],
    alt: `Abstract TatvaOps cover artwork for “${title}”`,
    caption: '',
  };
}

export async function POST(req: Request) {
  try {
    const ctx: PostContext = await req.json();

    let generatedBy: 'ai' | 'fallback' = 'ai';
    let spec: Spec;
    try {
      spec = await artDirect(ctx);
    } catch (err) {
      if (!(err instanceof MissingApiKeyError)) throw err;
      spec = fallbackSpec(ctx);
      generatedBy = 'fallback';
    }

    const palette: [string, string] = [
      /^#[0-9a-f]{6}$/i.test(spec.palette?.[0] ?? '') ? spec.palette[0] : '#F2451E',
      /^#[0-9a-f]{6}$/i.test(spec.palette?.[1] ?? '') ? spec.palette[1] : '#141345',
    ];

    // Keying on the post's own text guarantees a different image per post.
    const key = `${ctx.title ?? ''}|${ctx.excerpt ?? ''}|${ctx.focus_keyword ?? ''}`;
    const image = await renderCoverImage({ headline: spec.headline, motif: spec.motif, palette }, key);

    return NextResponse.json({ ...image, alt: spec.alt, caption: spec.caption, generatedBy });
  } catch (err) {
    return aiError(err);
  }
}
