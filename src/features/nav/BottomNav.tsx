import { motion } from "framer-motion";
import { Home, Calendar, BookHeart, PinIcon, MoreHorizontal, Cat } from "lucide-react";
import { useAppStore, type TabKey } from "@/features/app/store";
import { useNotifications } from "@/hooks/useNotifications";

const TABS: { key: TabKey; icon: React.ReactNode; dotKinds?: string[] }[] = [
  { key: "home",     icon: <Home size={22} strokeWidth={1.6} /> },
  { key: "calendar", icon: <Calendar size={22} strokeWidth={1.6} />, dotKinds: ["event"] },
  { key: "memories", icon: <BookHeart size={22} strokeWidth={1.6} />, dotKinds: ["memory"] },
  { key: "wall",     icon: <PinIcon size={22} strokeWidth={1.6} />, dotKinds: ["note"] },
  { key: "stickers", icon: <Cat size={22} strokeWidth={1.6} />, dotKinds: ["sticker"] },
  { key: "more",     icon: <MoreHorizontal size={22} strokeWidth={1.6} />, dotKinds: ["trip","song"] },
];

export function BottomNav({ relationshipId }: { relationshipId?: string }) {
  const { tab, setTab } = useAppStore();
  const { list } = useNotifications(relationshipId);
  const unreadByKind = list.reduce<Record<string, number>>((m, n) => {
    if (!n.read) m[n.kind] = (m[n.kind] ?? 0) + 1;
    return m;
  }, {});

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="relative flex w-full max-w-md items-stretch justify-between rounded-full border border-white/40 bg-white/40 backdrop-blur-2xl px-2 py-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_18px_50px_-20px_rgba(80,110,160,0.45)]">
        {TABS.map((t) => {
          const active = tab === t.key;
          const dot = t.dotKinds?.some((k) => (unreadByKind[k] ?? 0) > 0);
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="relative flex flex-1 items-center justify-center rounded-full py-3"
              aria-label={t.key}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-full border border-white/60 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.75),rgba(255,255,255,0.25)_65%)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_6px_18px_-8px_rgba(80,110,160,0.35)]"
                />
              )}
              <span className={`relative z-10 transition-colors ${active ? "text-foreground" : "text-foreground/45"}`}>
                {t.icon}
                {dot && !active && (
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[color:var(--hug)] shadow-[0_0_6px_var(--hug)]" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
