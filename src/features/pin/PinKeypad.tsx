import { useEffect, useRef } from "react";
import { motion, useIsPresent } from "framer-motion";
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

  // Physical keyboard: digits 0-9 and Backspace. Skipped while a text field has
  // focus, and while this keypad is animating out (AnimatePresence exit).
  const isPresent = useIsPresent();
  // Latest props, so fast typing never reads a stale value between renders
  const latest = useRef({ value, length, onChange, onComplete });
  latest.current = { value, length, onChange, onComplete };
  useEffect(() => {
    if (!isPresent) return;
    const onKey = (e: KeyboardEvent) => {
      const { value, length, onChange, onComplete } = latest.current;
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)
      ) {
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        if (value.length >= length) return;
        const next = value + e.key;
        latest.current = { ...latest.current, value: next };
        onChange(next);
        if (next.length === length) onComplete?.(next);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        if (value.length === 0) return;
        const next = value.slice(0, -1);
        latest.current = { ...latest.current, value: next };
        onChange(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPresent]);

  return (
    <div className="flex select-none flex-col items-center gap-9">
      <div role="status" aria-live="polite" className="flex gap-4">
        <span className="sr-only">{`${value.length} of ${length} digits`}</span>
        {Array.from({ length }).map((_, i) => (
          <motion.span
            key={i}
            aria-hidden="true"
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
