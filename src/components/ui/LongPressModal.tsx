import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export function LongPressModal({
  isOpen,
  onClose,
  title,
  description,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f2a5c]/20 p-4 backdrop-blur-[3px]">
          <div className="absolute inset-0" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lp-title"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="sn-card relative z-10 w-full max-w-[380px] px-7 pb-7 pt-6"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white bg-[#f7f7fe] text-sn-muted shadow-[var(--shadow-pill)] hover:text-sn-navy"
            >
              <X size={16} />
            </button>
            <h3 id="lp-title" className="pr-10 font-serif text-[23px] font-semibold leading-tight text-sn-navy">
              {title}
            </h3>
            <p className="mt-3 select-none whitespace-pre-line text-[15px] leading-[1.6] text-sn-ink">
              {description}
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
