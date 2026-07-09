// White lily motif — pure SVG so it scales & tints via CSS.
export function Lily({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <radialGradient id="petal" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="oklch(1 0 0)" />
          <stop offset="70%" stopColor="oklch(0.97 0.015 240)" />
          <stop offset="100%" stopColor="oklch(0.88 0.03 240)" />
        </radialGradient>
      </defs>
      {/* stem */}
      <path d="M32 62 C 32 50, 32 40, 32 30" stroke="var(--color-lily-stem)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* petals */}
      <g transform="translate(32 28)">
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse key={deg} cx="0" cy="-12" rx="6" ry="14" fill="url(#petal)" stroke="oklch(0.85 0.03 240 / 0.6)" strokeWidth="0.5" transform={`rotate(${deg})`} />
        ))}
      </g>
      {/* center */}
      <circle cx="32" cy="28" r="3" fill="oklch(0.9 0.09 85)" />
    </svg>
  );
}
