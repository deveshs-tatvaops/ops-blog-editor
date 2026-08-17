import crypto from 'node:crypto';
import sharp from 'sharp';
import { all, one, run } from './db';

/**
 * Images are stored in the database, not on disk. A serverless host gives every
 * function instance its own filesystem, so a file written while handling the
 * upload is invisible to the request that later renders the post. They are
 * served by the /uploads/[...file] route.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export class MediaError extends Error {}

/** 16:9 within a small tolerance, so a 1920x1081 export isn't rejected. */
export function isSixteenByNine(width: number, height: number): boolean {
  if (!width || !height) return false;
  return Math.abs(width / height - 16 / 9) <= 0.02;
}

export interface StoredImage {
  url: string;
  width: number;
  height: number;
  bytes: number;
}

export interface MediaRecord {
  name: string;
  mime: string;
  bytes: Uint8Array;
}

async function store(
  name: string,
  mime: string,
  data: Buffer,
  width: number,
  height: number
): Promise<StoredImage> {
  await run(
    `INSERT INTO media (name, mime, bytes, width, height) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET mime = excluded.mime, bytes = excluded.bytes,
       width = excluded.width, height = excluded.height`,
    [name, mime, new Uint8Array(data), width, height]
  );
  return { url: `/uploads/${name}`, width, height, bytes: data.length };
}

export async function getMedia(name: string): Promise<MediaRecord | null> {
  const row = await one('SELECT name, mime, bytes FROM media WHERE name = ?', [name]);
  if (!row) return null;
  const bytes = row.bytes as unknown;
  return {
    name: row.name as string,
    mime: row.mime as string,
    bytes: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBuffer),
  };
}

export async function listMedia(): Promise<{ name: string; mime: string }[]> {
  const rows = await all('SELECT name, mime FROM media ORDER BY created_at DESC');
  return rows.map((r) => ({ name: r.name as string, mime: r.mime as string }));
}

/**
 * Compresses to WebP on the way in. Animated GIFs are passed through untouched —
 * flattening them to a still frame would silently change the author's asset.
 */
export async function storeUpload(
  file: File,
  { enforceAspect = false }: { enforceAspect?: boolean } = {}
): Promise<StoredImage> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new MediaError(`Unsupported file type ${file.type || 'unknown'}. Use PNG, JPG, WebP or GIF.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new MediaError('That file is larger than 5MB.');
  }

  const input = Buffer.from(await file.arrayBuffer());
  const meta = await sharp(input).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (enforceAspect && !isSixteenByNine(width, height)) {
    throw new MediaError(`Cover images must be 16:9 — this one is ${width}×${height}.`);
  }

  const hash = crypto.createHash('sha1').update(input).digest('hex').slice(0, 16);

  if (meta.pages && meta.pages > 1) {
    return store(`${hash}.gif`, 'image/gif', input, width, height);
  }

  const output = await sharp(input)
    .resize({ width: Math.min(width || 1600, 1600), withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const outMeta = await sharp(output).metadata();
  return store(
    `${hash}.webp`,
    'image/webp',
    output,
    outMeta.width ?? width,
    outMeta.height ?? height
  );
}

export interface CoverArtSpec {
  headline: string;
  motif: 'blueprint' | 'arches' | 'grid' | 'roofline' | 'panels';
  palette: [string, string];
}

/** Deterministic per-post seed, so two posts never land on the same composition. */
function seedFrom(key: string): number {
  return parseInt(crypto.createHash('sha1').update(key).digest('hex').slice(0, 8), 16);
}

function motifPaths(motif: CoverArtSpec['motif'], seed: number): string {
  const jitter = (n: number) => ((seed >> n) % 7) * 12;
  switch (motif) {
    case 'arches':
      return [0, 1, 2, 3]
        .map(
          (i) =>
            `<path d="M${180 + i * 220 + jitter(i)} 620 v-150 a90 90 0 0 1 180 0 v150" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="10"/>`
        )
        .join('');
    case 'grid':
      return [0, 1, 2, 3, 4, 5]
        .map(
          (i) =>
            `<rect x="${140 + i * 170}" y="${260 + jitter(i)}" width="120" height="300" rx="14" fill="#fff" fill-opacity=".12"/>`
        )
        .join('');
    case 'roofline':
      return `<path d="M80 640 L360 ${380 + jitter(1)} L640 640 L920 ${400 + jitter(2)} L1200 640" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="12" stroke-linejoin="round"/>`;
    case 'panels':
      return [0, 1, 2]
        .map(
          (i) =>
            `<g transform="translate(${200 + i * 300} ${300 + jitter(i)}) skewY(-8)"><rect width="230" height="230" rx="18" fill="#fff" fill-opacity=".14"/><path d="M0 77 h230 M0 154 h230 M77 0 v230 M154 0 v230" stroke="#fff" stroke-opacity=".22" stroke-width="4"/></g>`
        )
        .join('');
    default:
      return (
        [0, 1, 2, 3, 4]
          .map(
            (i) =>
              `<rect x="${120 + i * 200}" y="${240 + jitter(i)}" width="150" height="${220 + jitter(i + 1)}" fill="none" stroke="#fff" stroke-opacity=".26" stroke-width="6"/>`
          )
          .join('') + '<path d="M0 700 H1280" stroke="#fff" stroke-opacity=".2" stroke-width="4"/>'
      );
  }
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!
  );
}

/** Renders a branded 16:9 cover as WebP. Unique per post by construction. */
export async function renderCoverImage(spec: CoverArtSpec, key: string): Promise<StoredImage> {
  const seed = seedFrom(key);
  const words = spec.headline.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > 24) {
      lines.push(current.trim());
      current = word;
    } else current += ` ${word}`;
    if (lines.length === 3) break;
  }
  if (current.trim() && lines.length < 3) lines.push(current.trim());

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${spec.palette[0]}"/>
      <stop offset="100%" stop-color="${spec.palette[1]}"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <g>${motifPaths(spec.motif, seed)}</g>
  <rect width="1280" height="720" fill="#141345" fill-opacity=".28"/>
  <g font-family="Poppins, Inter, Helvetica, Arial, sans-serif" fill="#ffffff">
    <text x="80" y="140" font-size="26" font-weight="600" letter-spacing="6" fill-opacity=".85">TATVAOPS</text>
    ${lines
      .map(
        (line, i) =>
          `<text x="80" y="${330 + i * 78}" font-size="64" font-weight="800">${escapeXml(line)}</text>`
      )
      .join('\n    ')}
  </g>
  <rect x="80" y="${330 + lines.length * 78 - 40}" width="140" height="10" rx="5" fill="#F26522"/>
</svg>`;

  const name = `cover-${crypto.createHash('sha1').update(key + svg).digest('hex').slice(0, 16)}.webp`;
  const output = await sharp(Buffer.from(svg)).webp({ quality: 88 }).toBuffer();
  return store(name, 'image/webp', output, 1280, 720);
}
