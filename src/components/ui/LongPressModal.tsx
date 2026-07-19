import { motion, AnimatePresence } from "framer-motion";
import { X, HelpCircle } from "lucide-react";

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 dark:bg-black/45 backdrop-blur-[3px] animate-in fade-in duration-200">
          {/* Overlay backdrop */}
          <div className="absolute inset-0" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-sm rounded-3xl border border-white/50 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-2xl p-6 shadow-2xl space-y-4 z-10"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 rounded-full bg-white dark:bg-neutral-800 border border-white/50 dark:border-neutral-700 p-1 text-foreground/50 hover:text-foreground transition-all cursor-pointer"
            >
              <X size={14} />
            </button>

            <div className="flex items-center gap-2 text-primary dark:text-primary-foreground">
              <HelpCircle size={18} />
              <h3 className="display text-base font-semibold text-foreground/80 dark:text-foreground/90">
                About: {title}
              </h3>
            </div>

            <p className="text-xs leading-relaxed text-foreground/75 dark:text-foreground/80 font-medium font-[Nunito] whitespace-pre-line select-none">
              {description}
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
