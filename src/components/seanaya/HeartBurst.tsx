import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Little clay hearts that puff up from wherever you tapped.
 * Call `burstHearts(event)` (or with an element / x,y); <HeartBurstLayer/> draws them.
 */
type Heart = { id: number; x: number; y: number; dx: number; dy: number; size: number; rot: number; delay: number };

let nextId = 1;
const listeners = new Set<(h: Heart[]) => void>();

export function burstHearts(
  from: { clientX: number; clientY: number } | Element | { x: number; y: number },
  count = 7,
) {
  if (typeof window === "undefined") return;
  let x: number;
  let y: number;
  if (from instanceof Element) {
    const r = from.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  } else if ("clientX" in from) {
    x = from.clientX;
    y = from.clientY;
  } else {
    x = from.x;
    y = from.y;
  }
  // Keyboard "clicks" report 0,0; fall back to the focused element.
  if (x === 0 && y === 0 && document.activeElement && document.activeElement !== document.body) {
    const r = document.activeElement.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  }
  const hearts: Heart[] = Array.from({ length: count }, (_, i) => {
    const spread = (i / Math.max(1, count - 1) - 0.5) * 2; // -1..1, fanned out
    return {
      id: nextId++,
      x,
      y,
      dx: spread * (34 + Math.random() * 26) + (Math.random() - 0.5) * 14,
      dy: -(70 + Math.random() * 70),
      size: 15 + Math.random() * 13,
      rot: spread * 28 + (Math.random() - 0.5) * 20,
      delay: Math.random() * 0.12,
    };
  });
  listeners.forEach((fn) => fn(hearts));
}

export function HeartBurstLayer() {
  const [hearts, setHearts] = useState<Heart[]>([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    const add = (h: Heart[]) => {
      setHearts((prev) => [...prev, ...(reduce ? h.slice(0, 1) : h)].slice(-40));
      const ids = new Set(h.map((x) => x.id));
      setTimeout(() => setHearts((prev) => prev.filter((x) => !ids.has(x.id))), 1400);
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, [reduce]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      <AnimatePresence>
        {hearts.map((h) => (
          <motion.img
            key={h.id}
            src="/art/clay-heart-sm.webp"
            alt=""
            draggable={false}
            initial={{ x: h.x - h.size / 2, y: h.y - h.size / 2, scale: 0.3, opacity: 0, rotate: 0 }}
            animate={
              reduce
                ? { opacity: [0, 1, 0], scale: 1, y: h.y - h.size / 2 - 24 }
                : {
                    x: h.x - h.size / 2 + h.dx,
                    y: h.y - h.size / 2 + h.dy,
                    scale: [0.3, 1.15, 0.9],
                    opacity: [0, 1, 1, 0],
                    rotate: h.rot,
                  }
            }
            transition={{ duration: 1.15, delay: h.delay, ease: [0.16, 0.84, 0.3, 1] }}
            style={{ width: h.size, height: h.size, position: "absolute", left: 0, top: 0 }}
            className="drop-shadow-[0_4px_6px_rgba(236,122,164,0.35)]"
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
