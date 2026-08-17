/**
 * The TatvaOps logo, in one place.
 *
 * The mark is four petals in a pinwheel: each is a squircle whose three outer
 * corners are fully round and whose inner corner is nearly square, so the group
 * reads as a four-leaf clover with a cross of negative space at the centre. One
 * amber→red gradient runs diagonally across all four.
 *
 * Everything that draws the logo — the React components, the generated files in
 * public/, the favicon and the cover-image artwork — is built from the values
 * below, so none of them can drift apart.
 */

const PETAL_SIZE = 50;
const ROUND = 25; // fully round outer corners
const POINT = 5; // inner corner, aimed at the centre

/** Rounded rect with per-corner radii, clockwise from the top-left. */
function petal(x: number, y: number, [tl, tr, br, bl]: [number, number, number, number]): string {
  const s = PETAL_SIZE;
  return [
    `M${x + tl} ${y}`,
    `H${x + s - tr}`,
    `a${tr} ${tr} 0 0 1 ${tr} ${tr}`,
    `V${y + s - br}`,
    `a${br} ${br} 0 0 1 ${-br} ${br}`,
    `H${x + bl}`,
    `a${bl} ${bl} 0 0 1 ${-bl} ${-bl}`,
    `V${y + tl}`,
    `a${tl} ${tl} 0 0 1 ${tl} ${-tl}`,
    'Z',
  ].join(' ');
}

export const MARK_VIEWBOX = '0 0 120 120';

/** Each petal keeps its sharp corner facing the centre of the mark. */
export const MARK_PATHS = [
  petal(5, 5, [ROUND, ROUND, POINT, ROUND]),
  petal(65, 5, [ROUND, ROUND, ROUND, POINT]),
  petal(5, 65, [ROUND, POINT, ROUND, ROUND]),
  petal(65, 65, [POINT, ROUND, ROUND, ROUND]),
];

export const MARK_GRADIENT = [
  { offset: '0%', color: '#FDB813' },
  { offset: '38%', color: '#F58220' },
  { offset: '72%', color: '#F2601E' },
  { offset: '100%', color: '#EE2B24' },
] as const;

/** Crimson → magenta → violet → blue, running across the whole wordmark. */
export const WORDMARK_GRADIENT = [
  { offset: '0%', color: '#EE3046' },
  { offset: '30%', color: '#D02A72' },
  { offset: '58%', color: '#8B2BC4' },
  { offset: '78%', color: '#5B3BE0' },
  { offset: '100%', color: '#2F6BFF' },
] as const;

/** CSS gradient for the HTML wordmark, matching WORDMARK_GRADIENT. */
export const WORDMARK_CSS_GRADIENT = `linear-gradient(90deg, ${WORDMARK_GRADIENT.map(
  (s) => `${s.color} ${s.offset}`
).join(', ')})`;

export const BRAND_COLORS = {
  amber: '#FDB813',
  orange: '#F58220',
  red: '#EE2B24',
  crimson: '#EE3046',
  violet: '#8B2BC4',
  blue: '#2F6BFF',
  indigo: '#141345',
} as const;

function gradientStops(stops: readonly { offset: string; color: string }[]): string {
  return stops.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('');
}

/**
 * Standalone SVG of the mark. `idPrefix` keeps gradient ids unique when several
 * of these are inlined into one document.
 */
export function markSvg({ size = 120, idPrefix = 'tatva' } = {}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="${idPrefix}-mark" gradientUnits="userSpaceOnUse" x1="5" y1="5" x2="115" y2="115">
      ${gradientStops(MARK_GRADIENT)}
    </linearGradient>
  </defs>
  <g fill="url(#${idPrefix}-mark)">
${MARK_PATHS.map((d) => `    <path d="${d}"/>`).join('\n')}
  </g>
</svg>`;
}

/**
 * Full lockup: mark plus the "tatva:Ops" wordmark.
 *
 * The text carries `textLength`, so the file renders at the same width whether
 * or not the viewer has Poppins — a logo file that reflows with the available
 * font is a logo file that breaks on someone else's machine.
 */
export function lockupSvg({ idPrefix = 'tatva' } = {}): string {
  const font = "Poppins, Inter, 'Segoe UI', Helvetica, Arial, sans-serif";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 128" width="512" height="128">
  <defs>
    <linearGradient id="${idPrefix}-mark" gradientUnits="userSpaceOnUse" x1="4" y1="18" x2="102" y2="116">
      ${gradientStops(MARK_GRADIENT)}
    </linearGradient>
    <linearGradient id="${idPrefix}-word" gradientUnits="userSpaceOnUse" x1="130" y1="0" x2="500" y2="0">
      ${gradientStops(WORDMARK_GRADIENT)}
    </linearGradient>
  </defs>
  <g fill="url(#${idPrefix}-mark)" transform="translate(0 14) scale(0.82)">
${MARK_PATHS.map((d) => `    <path d="${d}"/>`).join('\n')}
  </g>
  <text x="130" y="94" font-family="${font}" font-size="76" font-weight="700"
        textLength="190" lengthAdjust="spacingAndGlyphs" fill="url(#${idPrefix}-word)">tatva</text>
  <g fill="url(#${idPrefix}-word)">
    <circle cx="334" cy="48" r="5.5"/>
    <circle cx="334" cy="69" r="5.5"/>
    <circle cx="334" cy="90" r="5.5"/>
  </g>
  <text x="352" y="94" font-family="${font}" font-size="76" font-weight="700"
        textLength="145" lengthAdjust="spacingAndGlyphs" fill="url(#${idPrefix}-word)">Ops</text>
</svg>`;
}
