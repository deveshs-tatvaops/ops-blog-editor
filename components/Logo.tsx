import {
  MARK_GRADIENT,
  MARK_PATHS,
  MARK_VIEWBOX,
  WORDMARK_CSS_GRADIENT,
  WORDMARK_GRADIENT,
} from '@/lib/brand';

/** Four-petal pinwheel mark. Square, so it also works as an icon on its own. */
export function LogoMark({ className = 'h-9 w-9', id = 'logo' }: { className?: string; id?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={className} role="presentation" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-mark`} gradientUnits="userSpaceOnUse" x1="5" y1="5" x2="115" y2="115">
          {MARK_GRADIENT.map((s) => (
            <stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <g fill={`url(#${id}-mark)`}>
        {MARK_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}

/** "tatva:Ops" as live text, so it stays crisp and selectable at any size. */
export function Wordmark({ className = 'text-2xl' }: { className?: string }) {
  return (
    <span
      className={`font-display font-bold tracking-tight ${className}`}
      style={{
        backgroundImage: WORDMARK_CSS_GRADIENT,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      }}
    >
      tatva
      <span className="mx-[.09em] inline-flex flex-col justify-center gap-[.09em] align-middle">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block h-[.115em] w-[.115em] rounded-full"
            style={{ backgroundColor: WORDMARK_GRADIENT[2].color }}
          />
        ))}
      </span>
      Ops
    </span>
  );
}

export function Logo({ className = '', markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={markClassName ?? 'h-9 w-9 shrink-0'} />
      <Wordmark className="text-[1.6em] leading-none" />
    </span>
  );
}
