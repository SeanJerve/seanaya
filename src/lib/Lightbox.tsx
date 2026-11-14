import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function Lightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  // onClose is often an inline arrow; keep the latest without re-running the effect
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const isOpen = !!src;

  // Escape closes. Capture on window so a sheet underneath doesn't also close.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      closeRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] rounded-full bg-white/20 p-2 text-white"
          >
            <X size={18} />
          </button>
          <motion.img
            key={src}
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            src={src}
            alt=""
            className="max-h-[85dvh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
