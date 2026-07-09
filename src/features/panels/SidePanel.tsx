import { motion } from "framer-motion";
import { X } from "lucide-react";

export function SidePanel({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-0 bottom-0 w-[440px] max-w-full glass-panel rounded-l-3xl rounded-r-none overflow-auto"
    >
      <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-accent transition z-10">
        <X size={16} />
      </button>
      {children}
    </motion.div>
  );
}
