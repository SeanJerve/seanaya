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
            className="absolute inset-0 bg-[#1f2a5c]/20 backdrop-blur-[3px]"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
            className="sn-card relative z-10 w-full max-w-[340px] p-6 text-center"
          >
            {/* Title */}
            <h3 className="font-serif text-[22px] font-semibold leading-snug text-sn-navy">
              {confirmDialog.title}
            </h3>

            {/* Message body */}
            <p className="mt-2 text-[14.5px] leading-relaxed text-sn-ink">
              {confirmDialog.message}
            </p>

            {/* Control buttons */}
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                onClick={closeConfirm}
                className="sn-pill h-11 text-[14px] font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  closeConfirm();
                }}
                className="h-11 rounded-full bg-[#d24f7a] text-[14px] font-semibold text-white shadow-[0_10px_20px_-12px_rgba(201,69,122,0.9)] transition hover:bg-[#c2416c] active:scale-95"
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
