import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useAppStore } from "./store";

const WIDE_QUERY = "(min-width: 640px)";

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute("inert") && el.getClientRects().length > 0,
  );
}

/** Tracks the 640px breakpoint, updating on resize and orientation change. */
function useIsWide() {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia(WIDE_QUERY).matches,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(WIDE_QUERY);
    const update = () => setWide(mql.matches);
    update();
    mql.addEventListener("change", update);
    window.addEventListener("orientationchange", update);
    return () => {
      mql.removeEventListener("change", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  return wide;
}

/**
 * Bottom sheet on phones, centred paper dialog from 640px up.
 */
export function Sheet({
  open,
  title,
  children,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
}) {
  const { closeSheet } = useAppStore();
  const wide = useIsWide();
  const panelRef = useRef<HTMLDivElement | null>(null);
  // Store actions are recreated each render; keep the latest without re-running effects
  const closeRef = useRef(closeSheet);
  closeRef.current = closeSheet;

  // While open: focus moves in (and back out on close), Tab is trapped,
  // Escape closes, and the page behind does not scroll.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus({ preventScroll: true });
    }

    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      const el = panelRef.current;
      if (!el) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const items = getFocusable(el);
      if (items.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!el.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === el)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.overflow = prevOverflow;
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeSheet}
          className="fixed inset-0 z-40 flex items-end justify-center bg-[#1f2a5c]/20 backdrop-blur-[3px] sm:items-center sm:p-6"
        >
          <motion.div
            key="sheet"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={wide ? { opacity: 0, y: 16, scale: 0.98 } : { y: "100%" }}
            animate={wide ? { opacity: 1, y: 0, scale: 1 } : { y: 0 }}
            exit={wide ? { opacity: 0, y: 16, scale: 0.98 } : { y: "100%" }}
            transition={
              wide ? { duration: 0.22, ease: [0.2, 0, 0, 1] } : { type: "spring", stiffness: 340, damping: 34 }
            }
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] border border-white/90 [background:var(--paper-blush)] shadow-[0_-20px_60px_-24px_rgba(70,88,168,0.5)] outline-none backdrop-blur-2xl sm:rounded-[28px] sm:shadow-[var(--shadow-panel)]"
          >
            <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-[#d9dcf0] sm:hidden" />
            <div className="flex shrink-0 items-center justify-between px-6 pb-3 pt-3 sm:pt-6">
              <h2 className="font-serif text-[24px] font-semibold capitalize leading-tight text-sn-navy">
                {title}
              </h2>
              <button
                onClick={closeSheet}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-full border border-white bg-[#f7f7fe] text-sn-muted shadow-[var(--shadow-pill)] hover:text-sn-navy"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grow overflow-y-auto px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-2">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
