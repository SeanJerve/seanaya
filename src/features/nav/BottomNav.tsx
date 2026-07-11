import { motion } from "framer-motion";
import { Home, Calendar, BookHeart, PinIcon, MoreHorizontal } from "lucide-react";
import { useAppStore, type TabKey } from "@/features/app/store";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "home",     label: "Home",     icon: <Home size={20} strokeWidth={1.6} /> },
  { key: "calendar", label: "Calendar", icon: <Calendar size={20} strokeWidth={1.6} /> },
  { key: "memories", label: "Memories", icon: <BookHeart size={20} strokeWidth={1.6} /> },
  { key: "wall",     label: "Wall",     icon: <PinIcon size={20} strokeWidth={1.6} /> },
  { key: "more",     label: "More",     icon: <MoreHorizontal size={20} strokeWidth={1.6} /> },
];

export function BottomNav() {
  const { tab, setTab } = useAppStore();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
    >
      <div
        className="relative flex w-full max-w-md items-stretch justify-between rounded-full border border-white/40 bg-white/40 backdrop-blur-2xl px-2 py-1.5
          shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_18px_50px_-20px_rgba(80,110,160,0.45)]"
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="relative flex flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-2 text-[10px] uppercase tracking-wider"
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-full border border-white/60
                    bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.75),rgba(255,255,255,0.25)_65%)]
                    shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_6px_18px_-8px_rgba(80,110,160,0.35)]"
                />
              )}
              <span className={`relative z-10 transition-colors ${active ? "text-foreground" : "text-foreground/50"}`}>
                {t.icon}
              </span>
              <span className={`relative z-10 transition-colors ${active ? "text-foreground" : "text-foreground/50"}`}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
