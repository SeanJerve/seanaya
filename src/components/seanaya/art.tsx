/**
 * SEANAYA visual assets.
 *
 * Raster illustrations live in /public/art (characters, cats, photos, bouquet,
 * cloud band) and /public (white lilies). Only simple line graphics — washi
 * tape, the heart ribbon, sparkles, the bow and the logo mark — are SVG.
 */
import type { CSSProperties, ReactNode } from "react";

export const ART = {
  seanChibi: "/art/sean-chibi.webp",
  ayaChibi: "/art/aya-chibi.webp",
  catsCloud: "/art/cats-cloud.webp",
  catPeek: "/art/cat-peek.webp",
  polaroidSky: "/art/polaroid-sky-heart.webp",
  polaroidDusk: "/art/polaroid-dusk.webp",
  bouquet: "/art/lily-bouquet.webp",
  albumSky: "/art/album-sky.webp",
  clayHeart: "/art/clay-heart.png",
  cloudBand: "/art/cloud-band.webp",
  lilyOpen: "/lily2.webp",
  lilyWatercolor: "/lily1.webp",
  lilyStem: "/main-lily.webp",
} as const;

/** Which chibi portrait represents a given person. Aya gets hers; everyone else gets Sean's. */
export function chibiFor(name: string | null | undefined) {
  return (name ?? "").trim().toLowerCase() === "aya" ? ART.ayaChibi : ART.seanChibi;
}

/** Rounded portrait tile used in the synchronous-space postcard and header. */
export function ChibiTile({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[22px] border-[3px] border-white bg-[#fbf3f8] shadow-[0_10px_22px_-12px_rgba(86,104,176,0.55)] ${className}`}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="h-full w-full object-cover select-none"
      />
    </div>
  );
}

const TAPE = {
  pink: { base: "#f6b9cf", line: "rgba(255,255,255,0.55)" },
  blue: { base: "#a9c0f2", line: "rgba(255,255,255,0.6)" },
} as const;

/** Gingham washi tape strip. */
export function WashiTape({
  color = "pink",
  className = "",
  style,
}: {
  color?: keyof typeof TAPE;
  className?: string;
  style?: CSSProperties;
}) {
  const t = TAPE[color];
  const id = `gingham-${color}`;
  return (
    <svg
      viewBox="0 0 64 20"
      aria-hidden
      className={`pointer-events-none absolute ${className}`}
      style={style}
    >
      <defs>
        <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill={t.base} />
          <rect width="3" height="6" fill={t.line} />
          <rect width="6" height="3" fill={t.line} />
        </pattern>
      </defs>
      <path
        d="M2 1 L62 0 L63 4 L61 7 L63 10 L61 13 L63 16 L62 20 L1 19 L0 15 L2 12 L0 9 L2 6 L0 3 Z"
        fill={`url(#${id})`}
        opacity="0.88"
      />
    </svg>
  );
}

/**
 * Instant-photo frame with tape. `src` falls back to a placeholder photo.
 * The frame is real markup; only the photo inside is an image.
 */
export function Polaroid({
  src,
  alt = "",
  tape = "pink",
  tilt = -6,
  className = "",
  photoClassName = "aspect-square",
  children,
}: {
  src: string;
  alt?: string;
  tape?: keyof typeof TAPE;
  tilt?: number;
  className?: string;
  photoClassName?: string;
  children?: ReactNode;
}) {
  return (
    <figure
      className={`relative bg-white p-[9px] pb-[26px] shadow-[0_14px_26px_-14px_rgba(70,84,150,0.55),0_2px_4px_rgba(70,84,150,0.08)] ring-1 ring-[#e9ebf7] transition-transform duration-300 ${className}`}
      style={{ transform: `rotate(${tilt}deg)`, borderRadius: 4 }}
    >
      <WashiTape
        color={tape}
        className="left-1/2 -top-[9px] h-[20px] w-[64px] -translate-x-1/2"
        style={{ transform: `translateX(-50%) rotate(${-tilt - 4}deg)` }}
      />
      <div className={`overflow-hidden bg-[#dfe6fb] ${photoClassName}`}>
        <img src={src} alt={alt} draggable={false} className="h-full w-full object-cover" />
      </div>
      {children}
    </figure>
  );
}

const HEART =
  "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z";

/** Hand-drawn pink thread with three hearts that links the two of you. */
export function HeartRibbon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 46" fill="none" aria-hidden className={className}>
      <path
        d="M2 30 C 18 34, 28 33, 36 28 C 44 22, 34 12, 30 18 C 27 23, 38 27, 52 26 C 64 25, 72 24, 78 24 M 102 24 C 112 25, 122 30, 134 30 C 148 30, 156 20, 150 16 C 145 13, 141 22, 152 28 C 162 33, 172 33, 178 31"
        stroke="#ef9bbb"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <g transform="translate(78 6) scale(1)">
        <path d={HEART} fill="#fbd3e2" stroke="#ec7aa4" strokeWidth="1.3" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** Four-point sparkle. */
export function Sparkle({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`pointer-events-none ${className}`} style={style}>
      <path d="M12 0C12.9 7.6 16.4 11.1 24 12 16.4 12.9 12.9 16.4 12 24 11.1 16.4 7.6 12.9 0 12 7.6 11.1 11.1 7.6 12 0Z" fill="currentColor" />
    </svg>
  );
}

/** Line-art ribbon bow. */
export function Bow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 40" fill="none" aria-hidden className={`pointer-events-none ${className}`}>
      <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 15C17 5 5 5 6 14c1 7 11 6 18 1" />
        <path d="M24 15c7-10 19-10 18-1-1 7-11 6-18 1" />
        <path d="M22.5 17 15 34l4-1 1 4 5-19" />
        <path d="M25.5 17 33 34l-4-1-1 4-5-19" />
        <circle cx="24" cy="15.5" r="2.4" />
      </g>
    </svg>
  );
}

/** SEANAYA logo mark — an outlined heart with an orbiting thread. */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 44" fill="none" aria-hidden className={className}>
      <g transform="translate(17 6) scale(1.25)">
        <path d={HEART} stroke="#7d8dcc" strokeWidth="1.3" strokeLinejoin="round" />
      </g>
      <path
        d="M10 30c-6 4-3 9 8 7 10-2 24-10 33-18 6-6 7-11 2-11"
        stroke="#7d8dcc"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="56" cy="9" r="1.6" fill="#7d8dcc" />
    </svg>
  );
}

/** Today marker: a pastel clay heart. */
export function TodayHeart({ className = "" }: { className?: string }) {
  return (
    <img
      src={ART.clayHeart}
      alt=""
      aria-hidden
      draggable={false}
      className={`pointer-events-none select-none ${className}`}
    />
  );
}
