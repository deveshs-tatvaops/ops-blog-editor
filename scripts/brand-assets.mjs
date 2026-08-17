/**
 * Regenerates the static brand files in public/ from lib/brand.ts, so the files
 * and the React components can never drift apart.
 * Usage: npm run brand:assets
 */
import { register } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

register('../tests/ts-loader.mjs', import.meta.url);

const { markSvg, lockupSvg } = await import('../lib/brand.ts');
const sharp = (await import('sharp')).default;

const pub = path.join(process.cwd(), 'public');

writeFileSync(path.join(pub, 'logo.svg'), lockupSvg() + '\n');
writeFileSync(path.join(pub, 'logo-mark.svg'), markSvg() + '\n');

// PNG icons for surfaces that will not render SVG (some social cards, older
// Android home screens).
for (const size of [180, 512]) {
  const png = await sharp(Buffer.from(markSvg({ size }))).png().toBuffer();
  writeFileSync(path.join(pub, size === 180 ? 'apple-icon.png' : 'icon-512.png'), png);
}

console.log('Wrote public/logo.svg, public/logo-mark.svg, public/apple-icon.png, public/icon-512.png');
