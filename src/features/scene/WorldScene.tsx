import { motion } from "framer-motion";
import type { Daypart } from "@/hooks/useDaypart";
import { Lily } from "@/components/scene/Lily";

export function WorldScene({ daypart }: { daypart: Daypart; relationshipId: string }) {
  const isNight = daypart === "night";
  return (
    <div className="glass-panel relative h-full w-full overflow-hidden">
      {/* Sky through window */}
      <div className="absolute inset-0" style={{
        background: isNight
          ? "linear-gradient(180deg, oklch(0.28 0.06 265), oklch(0.22 0.05 275))"
          : daypart === "evening"
          ? "linear-gradient(180deg, oklch(0.88 0.06 40), oklch(0.7 0.08 285))"
          : "linear-gradient(180deg, oklch(0.96 0.04 235), oklch(0.9 0.05 240))",
      }} />

      {/* Stars at night */}
      {isNight && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white/80"
              style={{
                width: 2 + Math.random() * 2, height: 2 + Math.random() * 2,
                top: `${Math.random() * 45}%`, left: `${Math.random() * 100}%`,
                opacity: 0.4 + Math.random() * 0.6,
              }} />
          ))}
        </div>
      )}

      {/* Distant lily field outside window */}
      <div className="absolute inset-x-0 bottom-0 h-2/5" style={{
        background: "linear-gradient(180deg, transparent, oklch(0.88 0.04 155 / 0.5) 40%, oklch(0.75 0.06 155) 100%)",
      }} />
      <div className="absolute bottom-[20%] inset-x-0 flex justify-around opacity-70">
        {[36, 44, 40, 50, 38, 46].map((s, i) => (
          <motion.div key={i}
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }}>
            <Lily size={s} />
          </motion.div>
        ))}
      </div>

      {/* Cozy room frame — window */}
      <div className="absolute inset-6 rounded-[2rem] border-[10px] border-white/70 shadow-[inset_0_0_60px_oklch(0.9_0.03_240_/_0.4)] pointer-events-none" />
      <div className="absolute inset-x-6 top-1/2 h-[10px] bg-white/70" />
      <div className="absolute inset-y-6 left-1/2 w-[10px] bg-white/70" />

      {/* Desk / corkboard hint */}
      <div className="absolute left-10 bottom-10 w-40 h-20 rounded-xl bg-[oklch(0.86_0.04_75)] shadow-soft opacity-90" />
      <div className="absolute right-10 bottom-10 w-24 h-24 rounded-full bg-[oklch(0.92_0.03_240)] border-4 border-white/80 flex items-center justify-center text-2xl">🌐</div>

      {/* Cats — decorative */}
      <Cat variant="white" x="18%" y="72%" />
      <Cat variant="ginger" x="70%" y="76%" />
      <Cat variant="gray" x="45%" y="80%" />

      {/* Room caption */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center text-xs uppercase tracking-widest text-foreground/60">
        <span>Our Room</span>
        <span className="capitalize">{daypart}</span>
      </div>
    </div>
  );
}

function Cat({ variant, x, y }: { variant: "white" | "gray" | "ginger"; x: string; y: string }) {
  const color = { white: "oklch(0.97 0.005 240)", gray: "oklch(0.5 0.02 260)", ginger: "oklch(0.75 0.14 55)" }[variant];
  return (
    <motion.div
      className="absolute" style={{ left: x, top: y }}
      animate={{ y: [0, -2, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      <svg width="52" height="40" viewBox="0 0 52 40">
        <ellipse cx="26" cy="28" rx="18" ry="10" fill={color} />
        <circle cx="14" cy="18" r="9" fill={color} />
        <polygon points="8,10 12,18 16,14" fill={color} />
        <polygon points="20,10 16,18 12,14" fill={color} />
        <circle cx="12" cy="18" r="1" fill="#333" />
        <circle cx="17" cy="18" r="1" fill="#333" />
      </svg>
    </motion.div>
  );
}
