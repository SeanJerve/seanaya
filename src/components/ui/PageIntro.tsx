import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function PageIntro({
  pageKey,
  title,
  intro,
}: {
  pageKey: string;
  title: string;
  intro: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem(`seen_intro_${pageKey}`);
    if (!hasSeen) {
      setVisible(true);
    }
  }, [pageKey]);

  const handleDismiss = () => {
    localStorage.setItem(`seen_intro_${pageKey}`, "true");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="relative overflow-hidden rounded-3xl border border-pink-200/50 dark:border-pink-900/30 bg-gradient-to-br from-pink-50/80 to-white/60 dark:from-pink-950/10 dark:to-neutral-900/40 p-5 shadow-[0_10px_30px_-10px_rgba(244,143,177,0.3)] dark:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] backdrop-blur-xl mb-4"
        >
          {/* Decorative soft glowing spots */}
          <div className="absolute -top-12 -left-12 w-24 h-24 rounded-full bg-pink-300/20 dark:bg-pink-800/10 blur-xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-24 h-24 rounded-full bg-purple-300/20 dark:bg-purple-800/10 blur-xl pointer-events-none" />

          <div className="flex items-start justify-between gap-3 relative z-10">
            <div className="flex items-center gap-2 text-pink-500 dark:text-pink-400">
              <Sparkles size={16} className="animate-pulse" />
              <span className="font-semibold text-xs uppercase tracking-widest">{title}</span>
            </div>
            <button
              onClick={handleDismiss}
              className="rounded-full p-1 text-foreground/45 hover:text-foreground/75 hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
              aria-label="Dismiss introduction"
            >
              <X size={14} />
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-foreground/75 dark:text-foreground/90 font-medium font-[Nunito] relative z-10 select-none">
            {intro}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
