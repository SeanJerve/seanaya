import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useAppStore } from "./store";

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
  const wide = typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches;

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
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={wide ? { opacity: 0, y: 16, scale: 0.98 } : { y: "100%" }}
            animate={wide ? { opacity: 1, y: 0, scale: 1 } : { y: 0 }}
            exit={wide ? { opacity: 0, y: 16, scale: 0.98 } : { y: "100%" }}
            transition={
              wide ? { duration: 0.22, ease: [0.2, 0, 0, 1] } : { type: "spring", stiffness: 340, damping: 34 }
            }
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] border border-white/90 [background:var(--paper-blush)] shadow-[0_-20px_60px_-24px_rgba(70,88,168,0.5)] backdrop-blur-2xl sm:rounded-[28px] sm:shadow-[var(--shadow-panel)]"
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
