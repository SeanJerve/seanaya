/**
 * Kawaii Pastel Romantic Vector Illustrations & Scrapbook Primitives
 * Handcrafted SVG components for the Seanaya digital scrapbook aesthetic.
 */

import React from "react";

export function WashiTape({
  className = "",
  pattern = "gingham",
  color = "pink",
}: {
  className?: string;
  pattern?: "gingham" | "stripes" | "solid";
  color?: "pink" | "blue" | "lavender" | "yellow";
}) {
  const bgColors = {
    pink: "rgba(244, 114, 182, 0.65)",
    blue: "rgba(147, 197, 253, 0.65)",
    lavender: "rgba(196, 181, 253, 0.65)",
    yellow: "rgba(253, 230, 138, 0.75)",
  };

  return (
    <div
      className={`h-4 w-16 -top-2 left-1/2 -translate-x-1/2 absolute z-10 shadow-xs pointer-events-none rounded-[1px] transform -rotate-1 ${className}`}
      style={{
        backgroundColor: bgColors[color],
        backgroundImage:
          pattern === "gingham"
            ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.3) 0, rgba(255,255,255,0.3) 3px, transparent 0, transparent 6px)"
            : "none",
        clipPath: "polygon(4% 0%, 96% 0%, 100% 100%, 0% 100%)",
        backdropFilter: "blur(2px)",
      }}
    />
  );
}

export function LoopedHeartRibbon({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-1.5 w-full ${className}`}>
      <svg
        className="w-full max-w-[120px] sm:max-w-[160px] h-6 text-pink-300"
        viewBox="0 0 160 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 12 C30 12, 45 4, 60 12 C70 18, 75 8, 80 4 C85 8, 90 18, 100 12 C115 4, 130 12, 160 12"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray="3 3"
        />
        {/* Central Heart Loop */}
        <path
          d="M80 7 C76 2, 70 4, 70 9 C70 14, 77 17, 80 20 C83 17, 90 14, 90 9 C90 4, 84 2, 80 7 Z"
          fill="#fbcfe8"
          stroke="#f472b6"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

export function PeekingCat({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none select-none ${className}`}>
      <svg
        viewBox="0 0 100 65"
        className="w-16 h-11"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Cat Head */}
        <ellipse cx="50" cy="40" rx="30" ry="24" fill="#fafafa" stroke="#e2e8f0" strokeWidth="1.5" />
        {/* Left Ear */}
        <path
          d="M26 26 L20 6 C20 6, 36 12, 38 20 Z"
          fill="#fafafa"
          stroke="#e2e8f0"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M25 22 L22 10 L33 18 Z" fill="#fbcfe8" />
        {/* Right Ear */}
        <path
          d="M74 26 L80 6 C80 6, 64 12, 62 20 Z"
          fill="#fafafa"
          stroke="#e2e8f0"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M75 22 L78 10 L67 18 Z" fill="#fbcfe8" />

        {/* Brown ear patch */}
        <path d="M76 24 C72 16, 65 14, 62 20 C64 26, 73 28, 76 24 Z" fill="#cbd5e1" opacity="0.6" />

        {/* Eyes (happy curved sleeping/smiling eyes) */}
        <path
          d="M38 38 C40 42, 45 42, 47 38"
          stroke="#475569"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M53 38 C55 42, 60 42, 62 38"
          stroke="#475569"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        {/* Blush cheeks */}
        <circle cx="34" cy="43" r="4.5" fill="#fbcfe8" opacity="0.8" />
        <circle cx="66" cy="43" r="4.5" fill="#fbcfe8" opacity="0.8" />

        {/* Nose & Mouth */}
        <path d="M49 43 L51 43 L50 44.5 Z" fill="#f472b6" />
        <path
          d="M47 45.5 Q50 47.5 50 45.5 Q50 47.5 53 45.5"
          stroke="#475569"
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
        />

        {/* Whiskers */}
        <line x1="28" y1="41" x2="16" y2="40" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="28" y1="44" x2="17" y2="45" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="72" y1="41" x2="84" y2="40" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="72" y1="44" x2="83" y2="45" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" />

        {/* Paws resting on the bar */}
        <ellipse cx="32" cy="58" rx="8" ry="6" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.4" />
        <ellipse cx="68" cy="58" rx="8" ry="6" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.4" />
        {/* Toe divisions */}
        <line x1="30" y1="58" x2="30" y2="62" stroke="#e2e8f0" strokeWidth="1" />
        <line x1="34" y1="58" x2="34" y2="62" stroke="#e2e8f0" strokeWidth="1" />
        <line x1="66" y1="58" x2="66" y2="62" stroke="#e2e8f0" strokeWidth="1" />
        <line x1="70" y1="58" x2="70" y2="62" stroke="#e2e8f0" strokeWidth="1" />
      </svg>
    </div>
  );
}

export function CuddlingCatsCloud({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center p-3 select-none ${className}`}>
      <div className="relative">
        {/* Soft Puffy Cloud */}
        <svg
          viewBox="0 0 160 85"
          className="w-36 h-20 drop-shadow-[0_4px_12px_rgba(186,215,255,0.4)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Cloud Base */}
          <path
            d="M30 65 C18 65, 10 55, 12 42 C14 30, 26 25, 35 28 C40 16, 56 10, 72 15 C82 6, 102 7, 114 18 C126 15, 140 22, 144 35 C154 42, 152 58, 140 65 Z"
            fill="#ffffff"
            opacity="0.95"
          />
          {/* Cloud shading */}
          <path
            d="M25 60 C35 63, 60 64, 85 64 C110 64, 130 62, 140 58 C135 64, 125 65, 110 65 L40 65 C32 65, 27 63, 25 60 Z"
            fill="#e0f2fe"
            opacity="0.6"
          />
        </svg>

        {/* Two Cuddling Kittens resting on cloud */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-28 h-14 flex items-center justify-center">
          <svg viewBox="0 0 100 55" className="w-24 h-14" fill="none">
            {/* Ginger Cat Left */}
            <ellipse cx="36" cy="30" rx="18" ry="14" fill="#fed7aa" stroke="#fdba74" strokeWidth="1" />
            {/* Ginger Cat Head */}
            <circle cx="28" cy="22" r="11" fill="#fed7aa" stroke="#fdba74" strokeWidth="1" />
            <path d="M21 14 L20 7 L26 12 Z" fill="#fb923c" />
            <path d="M32 14 L36 8 L37 14 Z" fill="#fb923c" />
            {/* Sleeping face */}
            <path d="M24 22 Q27 24 30 22" stroke="#7c2d12" strokeWidth="1" strokeLinecap="round" />
            <circle cx="23" cy="24" r="2" fill="#fbcfe8" />

            {/* Calico/Gray-White Cat Right (cuddled against ginger) */}
            <ellipse cx="60" cy="28" rx="19" ry="15" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
            {/* Gray patch on back */}
            <path d="M56 16 C64 16, 72 20, 70 28 C64 26, 56 24, 56 16 Z" fill="#94a3b8" opacity="0.7" />
            {/* Head */}
            <circle cx="48" cy="23" r="11" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
            <path d="M43 14 L41 7 L48 12 Z" fill="#94a3b8" />
            <path d="M54 14 L59 8 L58 14 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.8" />
            {/* Sleeping face */}
            <path d="M46 23 Q49 25 52 23" stroke="#475569" strokeWidth="1" strokeLinecap="round" />
            <circle cx="53" cy="25" r="2" fill="#fbcfe8" />

            {/* Little pink floating heart above them */}
            <path
              d="M50 4 C48 1, 45 2, 45 5 C45 8, 49 10, 50 12 C51 10, 55 8, 55 5 C55 2, 52 1, 50 4 Z"
              fill="#f472b6"
            />
          </svg>
        </div>
      </div>

      <span className="font-serif italic text-xs text-sky-800/80 tracking-wide mt-0.5">
        you & me always ♡
      </span>
    </div>
  );
}

export function CuteBoyAvatar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-white bg-gradient-to-b from-sky-100 to-sky-200 shadow-[0_4px_14px_rgba(186,215,255,0.5)] shrink-0 flex items-center justify-center ${className}`}
    >
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none">
        {/* Background circle tint */}
        <circle cx="32" cy="32" r="30" fill="#e0f2fe" />

        {/* Neck & Shoulders (soft blue sweater) */}
        <path d="M18 58 C22 46, 42 46, 46 58 Z" fill="#93c5fd" />
        <path d="M26 48 Q32 52 38 48" stroke="#ffffff" strokeWidth="1.5" fill="none" />

        {/* Face */}
        <ellipse cx="32" cy="34" rx="14" ry="13" fill="#ffedd5" />

        {/* Cute blush cheeks */}
        <circle cx="23" cy="37" r="3" fill="#fca5a5" opacity="0.6" />
        <circle cx="41" cy="37" r="3" fill="#fca5a5" opacity="0.6" />

        {/* Anime Eyes */}
        <ellipse cx="27" cy="33" rx="2.5" ry="3.5" fill="#1e293b" />
        <circle cx="26" cy="32" r="1.2" fill="#ffffff" />
        <ellipse cx="37" cy="33" rx="2.5" ry="3.5" fill="#1e293b" />
        <circle cx="36" cy="32" r="1.2" fill="#ffffff" />

        {/* Gentle smiling mouth */}
        <path d="M30 40 Q32 42 34 40" stroke="#78350f" strokeWidth="1.2" strokeLinecap="round" />

        {/* Dark messy anime hair */}
        <path
          d="M18 30 C16 18, 26 12, 34 12 C44 12, 48 18, 46 30 C43 28, 41 24, 38 27 C34 22, 28 24, 25 28 C23 26, 20 28, 18 30 Z"
          fill="#1e293b"
        />
        {/* Hair bangs */}
        <path d="M22 24 L25 32 L28 25 L32 33 L35 25 L39 31 L42 25" fill="#1e293b" />

        {/* Resting hands / paws */}
        <ellipse cx="27" cy="50" rx="4" ry="3" fill="#ffedd5" stroke="#fcd34d" strokeWidth="0.5" />
        <ellipse cx="37" cy="50" rx="4" ry="3" fill="#ffedd5" stroke="#fcd34d" strokeWidth="0.5" />
      </svg>
    </div>
  );
}

export function CuteGirlAvatar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-white bg-gradient-to-b from-pink-100 to-rose-200 shadow-[0_4px_14px_rgba(251,207,232,0.6)] shrink-0 flex items-center justify-center ${className}`}
    >
      <svg viewBox="0 0 64 64" className="w-full h-full" fill="none">
        {/* Background circle tint */}
        <circle cx="32" cy="32" r="30" fill="#fce7f3" />

        {/* Soft pink sweater */}
        <path d="M18 58 C22 46, 42 46, 46 58 Z" fill="#f472b6" />
        <path d="M26 48 Q32 52 38 48" stroke="#ffffff" strokeWidth="1.5" fill="none" />

        {/* Face */}
        <ellipse cx="32" cy="34" rx="14" ry="13" fill="#ffedd5" />

        {/* Cute blush cheeks */}
        <circle cx="23" cy="37" r="3.5" fill="#f43f5e" opacity="0.5" />
        <circle cx="41" cy="37" r="3.5" fill="#f43f5e" opacity="0.5" />

        {/* Anime Eyes with cute sparkle */}
        <ellipse cx="27" cy="33" rx="2.8" ry="3.8" fill="#334155" />
        <circle cx="26" cy="32" r="1.3" fill="#ffffff" />
        <circle cx="28" cy="34" r="0.6" fill="#ffffff" />

        <ellipse cx="37" cy="33" rx="2.8" ry="3.8" fill="#334155" />
        <circle cx="36" cy="32" r="1.3" fill="#ffffff" />
        <circle cx="38" cy="34" r="0.6" fill="#ffffff" />

        {/* Cute smiling mouth */}
        <path d="M30 40 Q32 43 34 40" stroke="#881337" strokeWidth="1.2" strokeLinecap="round" />

        {/* Warm brown hair with side strands */}
        <path
          d="M17 38 C15 22, 22 12, 32 12 C42 12, 49 22, 47 38 C49 44, 46 52, 45 56 C44 48, 43 40, 42 34 C39 27, 34 26, 32 29 C30 26, 25 27, 22 34 C21 40, 20 48, 19 56 C18 52, 15 44, 17 38 Z"
          fill="#451a03"
        />
        {/* Soft front bangs */}
        <path d="M22 25 Q32 28 42 25 Q32 23 22 25 Z" fill="#451a03" />

        {/* Cute white lily flower in hair */}
        <circle cx="43" cy="20" r="3.5" fill="#ffffff" stroke="#fbcfe8" strokeWidth="0.8" />
        <circle cx="43" cy="20" r="1" fill="#fde047" />

        {/* Resting hands */}
        <ellipse cx="27" cy="50" rx="4" ry="3" fill="#ffedd5" stroke="#fcd34d" strokeWidth="0.5" />
        <ellipse cx="37" cy="50" rx="4" ry="3" fill="#ffedd5" stroke="#fcd34d" strokeWidth="0.5" />
      </svg>
    </div>
  );
}

export function LilyBouquetAccent({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none select-none ${className}`}>
      <img
        src="/main-lily.png"
        alt="White lily accent"
        className="w-24 h-24 object-contain opacity-75 drop-shadow-[0_4px_10px_rgba(255,255,255,0.8)]"
        onError={(e) => {
          // If image fails, hide gracefully
          (e.target as HTMLElement).style.display = "none";
        }}
      />
    </div>
  );
}
