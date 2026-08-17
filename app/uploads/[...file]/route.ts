import path from 'node:path';
import { getMedia } from '@/lib/media';

export const dynamic = 'force-dynamic';

const CONTENT_TYPES = new Set(['image/webp', 'image/png', 'image/jpeg', 'image/gif', 'image/avif']);

export async function GET(_req: Request, { params }: { params: Promise<{ file: string[] }> }) {
  const { file } = await params;

  // Names are content hashes we generated; anything with a path separator or
  // traversal segment is not ours to serve.
  const name = file.join('/');
  if (file.length !== 1 || name.includes('..') || name !== path.basename(name)) {
    return new Response('Not found', { status: 404 });
  }

  const media = await getMedia(name);
  if (!media || !CONTENT_TYPES.has(media.mime)) return new Response('Not found', { status: 404 });

  return new Response(media.bytes as unknown as BodyInit, {
    headers: {
      'content-type': media.mime,
      // Hashed names are immutable, so this can be cached hard.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
