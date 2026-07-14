import { useAppStore } from "./store";
import { motion, AnimatePresence } from "framer-motion";

export function ConfirmDialog() {
  const { confirmDialog, closeConfirm } = useAppStore();

  return (
    <AnimatePresence>
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5 select-none">
          {/* Blur Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeConfirm}
            className="absolute inset-0 bg-black/20 backdrop-blur-[3px]"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
            className="relative w-full max-w-[280px] rounded-3xl border border-white/50 bg-white/70 backdrop-blur-2xl p-5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.18)] z-10 text-center"
          >
            {/* Title */}
            <h3 className="display text-base font-semibold text-foreground leading-snug">
              {confirmDialog.title}
            </h3>

            {/* Message body */}
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {confirmDialog.message}
            </p>

            {/* Control buttons */}
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                onClick={closeConfirm}
                className="px-4 py-2.5 rounded-full border border-white/60 bg-white/40 hover:bg-white/60 text-xs font-semibold text-foreground/70 active:scale-95 transition-all shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  closeConfirm();
                }}
                className="px-4 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-xs font-semibold text-white active:scale-95 transition-all shadow-md shadow-red-500/15"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
