import { useEffect, useMemo, useRef, useState } from "react";

/**
 * A winding road that runs through every timeline bubble, like a level map.
 * Nodes zig-zag across three columns (left, centre, right, centre, …); the road
 * passes exactly through each node centre.
 */
export const LEVEL_ROW = 185;
export const LEVEL_NODE_Y = 70; // bubble centre from the top of its row

export function levelColumn(i: number) {
  const r = i % 4;
  return r === 0 ? 0 : r === 2 ? 2 : 1;
}

export function LevelPath({ count, rowHeight = LEVEL_ROW }: { count: number; rowHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);

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
      const k = rowHeight * 0.58;
      path += ` C ${a.x} ${a.y + k}, ${b.x} ${b.y - k}, ${b.x} ${b.y}`;
    }
    return path;
  }, [w, count, rowHeight]);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-0">
      {d && (
        <svg width={w} height={count * rowHeight} className="overflow-visible">
          <defs>
            <filter id="road-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          <path d={d} transform="translate(0 5)" fill="none" stroke="rgba(80,100,170,0.22)" strokeWidth="30" strokeLinecap="round" filter="url(#road-shadow)" />
          <path d={d} fill="none" stroke="#ffffff" strokeWidth="26" strokeLinecap="round" />
          <path d={d} fill="none" stroke="#e4eafd" strokeWidth="15" strokeLinecap="round" />
          <path d={d} fill="none" stroke="#a9bdf2" strokeWidth="4.5" strokeLinecap="round" strokeDasharray="0.1 15" />
        </svg>
      )}
    </div>
  );
}
