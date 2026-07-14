import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Calendar, BookHeart, PinIcon, Settings, Cat } from "lucide-react";
import { useAppStore, type TabKey } from "@/features/app/store";
import { useNotifications } from "@/hooks/useNotifications";

const TOES: { key: TabKey; icon: React.ReactNode; label: string; x: number; y: number; dotKind?: string }[] = [
  { key: "home",     icon: <Home size={18} strokeWidth={1.8} />,     label: "Home",     x: -74, y: 15 },
  { key: "calendar", icon: <Calendar size={18} strokeWidth={1.8} />, label: "Calendar", x: -62, y: -36, dotKind: "event" },
  { key: "memories", icon: <BookHeart size={18} strokeWidth={1.8} />,label: "Memories", x: -22, y: -68, dotKind: "memory" },
  { key: "wall",     icon: <PinIcon size={18} strokeWidth={1.8} />,  label: "Wall",     x: 24,  y: -68, dotKind: "note" },
  { key: "stickers", icon: <Cat size={18} strokeWidth={1.8} />,      label: "Stickers", x: 64,  y: -36, dotKind: "sticker" },
];

export function BottomNav({ relationshipId }: { relationshipId?: string }) {
  const { tab, setTab } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const { list } = useNotifications(relationshipId);

  const unreadByKind = list.reduce<Record<string, number>>((m, n) => {
    if (!n.read) m[n.kind] = (m[n.kind] ?? 0) + 1;
    return m;
  }, {});

  const handleBaseClick = () => {
    setIsOpen(!isOpen);
    // Tapping the main center paw pad takes you to Settings/More view
    setTab("more");
  };

  const handleToeClick = (key: TabKey) => {
    setTab(key);
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 select-none touch-none">
      
      {/* ── Outer Toe Buttons (Pop out in a paw shape) ── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Click-away backdrop */}
            <div 
              className="fixed inset-0 z-10 pointer-events-auto" 
              onClick={() => setIsOpen(false)} 
            />

            {TOES.map((toe) => {
              const isActive = tab === toe.key;
              const hasDot = toe.dotKind ? (unreadByKind[toe.dotKind] ?? 0) > 0 : false;

              return (
                <motion.button
                  key={toe.key}
                  initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1, 
                    x: toe.x, 
                    y: toe.y 
                  }}
                  exit={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 380, 
                    damping: 24,
                    mass: 0.8
                  }}
                  onClick={() => handleToeClick(toe.key)}
                  className={`absolute z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/50 backdrop-blur-xl shadow-md transition-all active:scale-90
                    ${isActive 
                      ? "bg-white text-primary border-primary/40 shadow-primary/10" 
                      : "bg-white/70 text-foreground/70 hover:bg-white hover:text-foreground"
                    }`}
                  style={{
                    left: "8px", // Center coordinate offsets
                    top: "8px",
                  }}
                  title={toe.label}
                >
                  {toe.icon}
                  {hasDot && !isActive && (
                    <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[color:var(--hug)] shadow-[0_0_5px_var(--hug)]" />
                  )}
                </motion.button>
              );
            })}
          </>
        )}
      </AnimatePresence>

      {/* ── Main Base Toe Pad (Settings/More Tab) ── */}
      <motion.button
        onClick={handleBaseClick}
        whileHover={{ scale: 1.05 }}
        whileDrag={{ scale: 0.95 }}
        className={`relative z-30 flex h-14 w-14 items-center justify-center rounded-[45%_45%_38%_38%] border border-white/50 backdrop-blur-xl shadow-lg transition-all active:scale-95 cursor-pointer
          ${tab === "more"
            ? "bg-white text-primary border-primary/40"
            : "bg-white/70 text-foreground/75 hover:bg-white hover:text-foreground"
          }`}
      >
        <Settings size={22} className={isOpen ? "rotate-45 transition-transform duration-300" : "transition-transform duration-300"} />
        
        {/* Glow indicator if settings or more has updates */}
        {(unreadByKind["trip"] || unreadByKind["song"]) && tab !== "more" && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[color:var(--hug)] shadow-[0_0_6px_var(--hug)]" />
        )}
      </motion.button>
    </div>
  );
}
