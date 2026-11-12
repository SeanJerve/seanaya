import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

/**
 * The trail that links timeline bubbles: a rounded, dashed line of liquid glass
 * that slowly flows forward, with small sparkles twinkling along the way.
 * Nodes zig-zag across three columns; the trail passes through every centre.
 */
export const LEVEL_ROW = 185;
export const LEVEL_NODE_Y = 70; // bubble centre from the top of its row

export function levelColumn(i: number) {
  const r = i % 4;
  return r === 0 ? 0 : r === 2 ? 2 : 1;
}

const STAR = "M0 -1C.12 -.12 .12 -.12 1 0 .12 .12 .12 .12 0 1-.12 .12-.12 .12-1 0-.12-.12-.12-.12 0-1Z";

export function LevelPath({ count, rowHeight = LEVEL_ROW }: { count: number; rowHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const [w, setW] = useState(0);
  const [sparkles, setSparkles] = useState<{ x: number; y: number; s: number; d: number; c: string }[]>([]);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const d = useMemo(() => {
    if (!w || count < 2) return "";
    const pts = Array.from({ length: count }, (_, i) => ({
      x: (w * (levelColumn(i) * 2 + 1)) / 6,
      y: i * rowHeight + LEVEL_NODE_Y,
    }));
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      // Gentle easing: short vertical handles give soft, rounded bends instead of S-coils.
      const k = rowHeight * 0.38;
      path += ` C ${a.x} ${a.y + k}, ${b.x} ${b.y - k}, ${b.x} ${b.y}`;
    }
    return path;
  }, [w, count, rowHeight]);

  // Scatter sparkles beside the trail by sampling the real path.
  useLayoutEffect(() => {
    const p = pathRef.current;
    if (!p || !d) return setSparkles([]);
    const len = p.getTotalLength();
    const out: { x: number; y: number; s: number; d: number; c: string }[] = [];
    const colors = ["#ffffff", "#fde7f0", "#fff6d9", "#e6ecff"];
    for (let t = 60, i = 0; t < len - 40; t += 118, i++) {
      const pt = p.getPointAtLength(t);
      const ahead = p.getPointAtLength(Math.min(len, t + 1));
      const nx = -(ahead.y - pt.y);
      const ny = ahead.x - pt.x;
      const n = Math.hypot(nx, ny) || 1;
      const side = i % 2 ? 1 : -1;
      const off = 20 + ((i * 7) % 12);
      out.push({
        x: pt.x + (nx / n) * off * side,
        y: pt.y + (ny / n) * off * side,
        s: 5 + ((i * 5) % 6),
        d: (i * 0.37) % 2.4,
        c: colors[i % colors.length],
      });
    }
    setSparkles(out);
  }, [d]);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-0">
      {d && (
        <svg width={w} height={count * rowHeight} className="overflow-visible">
          <defs>
            <linearGradient id="trail-glass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.55" stopColor="#dfe7ff" stopOpacity="0.85" />
              <stop offset="1" stopColor="#c7d4fb" stopOpacity="0.8" />
            </linearGradient>
            <filter id="trail-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          {/* soft halo */}
          <path d={d} fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="20" strokeLinecap="round" filter="url(#trail-glow)" />
          {/* drop shadow under the glass dashes */}
          <path
            d={d}
            transform="translate(0 3)"
            fill="none"
            stroke="rgba(80,100,180,0.22)"
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray="16 18"
            className="sn-trail-flow"
          />
          {/* glass dashes */}
          <path
            ref={pathRef}
            d={d}
            fill="none"
            stroke="url(#trail-glass)"
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray="16 18"
            className="sn-trail-flow"
          />
          {/* specular highlight on each dash */}
          <path
            d={d}
            transform="translate(-1 -2)"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.95"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="8 26"
            strokeDashoffset="-3"
            className="sn-trail-flow"
          />
          {sparkles.map((s, i) => (
            <g key={i} transform={`translate(${s.x} ${s.y})`}>
              <path
                d={STAR}
                transform={`scale(${s.s})`}
                fill={s.c}
                className="sn-twinkle"
                style={{ animationDelay: `${s.d}s` }}
              />
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
