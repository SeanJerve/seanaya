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
 * PIN pad. Round liquid-glass keys (the app-wide `sn-pill` key style),
 * navy numerals, filled dots for entered digits.
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
    <div className="flex select-none flex-col items-center gap-9">
      <div className="flex gap-4" aria-label={`${value.length} of ${length} digits entered`}>
        {Array.from({ length }).map((_, i) => (
          <motion.span
            key={i}
            animate={{ scale: value.length > i ? 1.15 : 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className={`h-3.5 w-3.5 rounded-full border-[1.5px] transition-colors ${
              value.length > i ? "border-sn-navy bg-sn-navy" : "border-sn-navy/35 bg-transparent"
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-x-5 gap-y-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <KeyButton key={d} onClick={() => press(d)}>
            {d}
          </KeyButton>
        ))}
        <div className="grid h-[72px] w-[72px] place-items-center">{bottomAction}</div>
        <KeyButton onClick={() => press("0")}>0</KeyButton>
        <button
          onClick={del}
          aria-label="Delete"
          className="grid h-[72px] w-[72px] place-items-center rounded-full text-sn-ink transition hover:text-sn-navy active:scale-95"
        >
          <Delete size={24} strokeWidth={1.7} />
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
      className="sn-pill sn-icon-btn h-[72px] w-[72px] text-[28px] tabular-nums text-sn-navy"
      style={{ fontWeight: 400 }}
    >
      {children}
    </motion.button>
  );
}
