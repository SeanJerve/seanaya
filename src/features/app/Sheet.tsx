import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useAppStore } from "./store";

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
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeSheet}
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
        >
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-3xl border border-white/40
              bg-white/70 backdrop-blur-2xl shadow-[0_-20px_60px_-20px_rgba(80,110,160,0.4)]
              max-h-[88vh] flex flex-col overflow-hidden"
          >
            {/* Header fixed at the top with solid backdrop shading */}
            <div className="flex items-center justify-between border-b border-white/30 bg-white/80 backdrop-blur-xl px-5 py-3.5 z-10 shrink-0">
              <h2 className="display text-lg">{title}</h2>
              <button
                onClick={closeSheet}
                className="p-1.5 rounded-full hover:bg-black/5 transition"
              >
                <X size={16} />
              </button>
            </div>
            {/* Scrollable contents separated to avoid z-index bleeding */}
            <div className="p-5 pb-8 overflow-y-auto grow">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
