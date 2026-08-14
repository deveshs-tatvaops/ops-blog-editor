/**
 * TatvaOps mark: four petals in a pinwheel — each petal is a squircle whose
 * outer corner is fully rounded and whose inner corner is nearly square, with
 * one amber→red gradient running across the whole group.
 */
function petal(x: number, y: number, r: [number, number, number, number]): string {
  const s = 52;
  const [tl, tr, br, bl] = r;
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

export const LOGO_PETALS = [
  petal(6, 6, [24, 18, 6, 18]),
  petal(62, 6, [18, 24, 18, 6]),
  petal(6, 62, [18, 6, 18, 24]),
  petal(62, 62, [6, 18, 24, 18]),
];

export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="presentation" aria-hidden="true">
      <defs>
        <linearGradient id="tp-petal" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="120">
          <stop offset="0%" stopColor="#FDB913" />
          <stop offset="45%" stopColor="#F5761A" />
          <stop offset="100%" stopColor="#EE2B24" />
        </linearGradient>
      </defs>
      <g fill="url(#tp-petal)">
        {LOGO_PETALS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}

export function Wordmark({ className = 'text-2xl' }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-tight ${className}`}>
      <span className="bg-logo-gradient bg-clip-text text-transparent">tatva</span>
      <span className="mx-[.1em] inline-flex flex-col justify-center gap-[.1em] align-middle">
        <span className="block h-[.13em] w-[.13em] rounded-full bg-[#8B2BC4]" />
        <span className="block h-[.13em] w-[.13em] rounded-full bg-[#8B2BC4]" />
      </span>
      <span className="bg-[linear-gradient(90deg,#5B3BE0_0%,#2F6BFF_100%)] bg-clip-text text-transparent">
        Ops
      </span>
    </span>
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <Wordmark />
    </span>
  );
}
