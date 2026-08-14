/**
 * TatvaOps mark: four-petal pinwheel in the amber→red brand gradient, with the
 * "tatva:Ops" wordmark running amber→red→magenta→violet→blue.
 */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="presentation" aria-hidden="true">
      <defs>
        <linearGradient id="tp-petal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDB913" />
          <stop offset="55%" stopColor="#F5761A" />
          <stop offset="100%" stopColor="#EE2B24" />
        </linearGradient>
      </defs>
      <g fill="url(#tp-petal)">
        <path d="M52 8c0-4.4-3.6-8-8-8H20C9 0 0 9 0 20v24c0 4.4 3.6 8 8 8h36c4.4 0 8-3.6 8-8V8Z" transform="translate(6 6)" />
        <path d="M8 0C3.6 0 0 3.6 0 8v36c0 4.4 3.6 8 8 8h24c11 0 20-9 20-20V20C52 9 43 0 32 0H8Z" transform="translate(62 6)" />
        <path d="M8 0C3.6 0 0 3.6 0 8v24c0 11 9 20 20 20h24c4.4 0 8-3.6 8-8V8c0-4.4-3.6-8-8-8H8Z" transform="translate(6 62)" />
        <path d="M44 0H8C3.6 0 0 3.6 0 8v36c0 4.4 3.6 8 8 8h24c11 0 20-9 20-20V8c0-4.4-3.6-8-8-8Z" transform="translate(62 62)" />
      </g>
    </svg>
  );
}

export function Wordmark({ className = 'text-2xl' }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-tight ${className}`}>
      <span className="bg-logo-gradient bg-clip-text text-transparent">tatva</span>
      <span className="mx-[.08em] inline-flex flex-col justify-center gap-[.12em] align-middle">
        <span className="block h-[.14em] w-[.14em] rounded-full bg-[#8B2BC4]" />
        <span className="block h-[.14em] w-[.14em] rounded-full bg-[#8B2BC4]" />
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
