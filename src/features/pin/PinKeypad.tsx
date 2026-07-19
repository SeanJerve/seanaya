import { motion } from "framer-motion";
import { Delete } from "lucide-react";

interface Props {
  value: string;
  length?: number;
  onChange: (next: string) => void;
  onComplete?: (val: string) => void;
  bottomAction?: React.ReactNode;
}

/**
 * Apple-style PIN pad. Round liquid-glass keys, subtle press feedback.
 * Six dots indicating length.
 */
export function PinKeypad({ value, length = 4, onChange, onComplete, bottomAction }: Props) {
  const press = (d: string) => {
    if (value.length >= length) return;
    const next = value + d;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };
  const del = () => onChange(value.slice(0, -1));

  return (
    <div className="flex flex-col items-center gap-10 select-none">
      <div className="flex gap-4">
        {Array.from({ length }).map((_, i) => (
          <motion.span
            key={i}
            animate={{ scale: value.length > i ? 1.15 : 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className={`h-3.5 w-3.5 rounded-full border transition-colors ${
              value.length > i
                ? "bg-foreground border-foreground"
                : "border-foreground/30 bg-transparent"
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <KeyButton key={d} onClick={() => press(d)}>
            {d}
          </KeyButton>
        ))}
        <div>{bottomAction}</div>
        <KeyButton onClick={() => press("0")}>0</KeyButton>
        <button
          onClick={del}
          aria-label="Delete"
          className="h-[70px] w-[70px] rounded-full flex items-center justify-center text-foreground/60 hover:text-foreground transition"
        >
          <Delete size={22} />
        </button>
      </div>
    </div>
  );
}

function KeyButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className="relative h-[70px] w-[70px] rounded-full text-2xl font-light text-foreground/90
        border border-white/40
        bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.65),rgba(255,255,255,0.15)_60%,rgba(255,255,255,0.05))]
        shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_6px_20px_-8px_rgba(80,110,160,0.35)]
        backdrop-blur-xl transition
        active:shadow-[inset_0_2px_6px_rgba(80,110,160,0.25)]"
    >
      {children}
    </motion.button>
  );
}
