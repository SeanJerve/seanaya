import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Calendar, Image as ImageIcon, Pin, Star, Cat, Camera } from "lucide-react";
import { useAppStore, type TabKey } from "@/features/app/store";
import { useNotifications } from "@/hooks/useNotifications";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoamingPet } from "./pets/RoamingPet";

const ICON = { size: 23, strokeWidth: 1.55 } as const;
const TABS: { key: TabKey; label: string; icon: React.ReactNode; dotKinds?: string[] }[] = [
  { key: "home", label: "Home", icon: <Home {...ICON} /> },
  {
    key: "calendar",
    label: "Calendar",
    icon: <Calendar {...ICON} />,
    dotKinds: ["event", "memory"],
  },
  { key: "memories", label: "Album", icon: <ImageIcon {...ICON} />, dotKinds: ["album_item"] },
  { key: "photobooth", label: "Photo booth", icon: <Camera {...ICON} /> },
  { key: "wall", label: "Love wall", icon: <Pin {...ICON} />, dotKinds: ["note"] },
  { key: "stickers", label: "Stickers", icon: <Star {...ICON} />, dotKinds: ["sticker"] },
  { key: "pet", label: "Pet room", icon: <Cat {...ICON} />, dotKinds: ["pet"] },
];


export function BottomNav({ relationshipId }: { relationshipId?: string }) {
  const { tab, setTab, activeRoamingPetIds, isPetVisible } = useAppStore();
  const { list } = useNotifications(relationshipId);

  // Query details of all active roaming pets
  const { data: fetchedPets = [] } = useQuery({
    queryKey: ["roaming-pets", activeRoamingPetIds],
    queryFn: async () => {
      if (activeRoamingPetIds.length === 0) return [];
      const { data, error } = await supabase
        .from("pets")
        .select("id,name,photos,variant")
        .in("id", activeRoamingPetIds);
      if (error) throw error;
      return data || [];
    },
    enabled: activeRoamingPetIds.length > 0,
  });

  // Development-only preview of the cats: add ?demopets to the URL
  const demoPets =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("demopets")
      ? [
          { id: "demo-a", name: "Mingg", photos: [], variant: "cartoon:color:orange" },
          { id: "demo-b", name: "Daichi", photos: [], variant: "cartoon:color:black" },
          { id: "demo-c", name: "Mallows", photos: [], variant: "cartoon:color:white" },
        ]
      : null;
  const roamingPets = demoPets ?? fetchedPets;
  const showPets = !!demoPets || isPetVisible;

  const unreadByKind = list.reduce<Record<string, number>>((m, n) => {
    if (!n.read) m[n.kind] = (m[n.kind] ?? 0) + 1;
    return m;
  }, {});

  const petPositionsRef = useRef<Record<string, number>>({});

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none"
    >
      <div className="relative flex w-full max-w-[480px] flex-col pointer-events-auto">

        {/* ── Navbar Menu Capsule ── */}
        <div className="relative z-30 flex h-[64px] w-full items-center justify-between rounded-full border border-white/95 bg-[linear-gradient(180deg,rgba(244,245,254,0.92),rgba(236,239,252,0.9))] px-2.5 shadow-[inset_0_1px_0_#fff,0_20px_40px_-22px_rgba(70,88,168,0.55),0_2px_8px_rgba(120,138,204,0.12)] backdrop-blur-2xl sm:h-[70px] sm:px-4">
          {showPets &&
            roamingPets.map((p, idx) => (
              <RoamingPet
                key={p.id}
                pet={p}
                otherPets={roamingPets}
                index={idx}
                tab={tab}
                petPositionsRef={petPositionsRef}
              />
            ))}

          {TABS.map((t) => {
            const active = tab === t.key;
            const dot = t.dotKinds?.some((k) => (unreadByKind[k] ?? 0) > 0);
            return (
              <button
                key={t.key}
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.vibrate) {
                    navigator.vibrate(12);
                  }
                  setTab(t.key);
                }}
                className="relative grid h-11 w-11 place-items-center rounded-full active:scale-90 transition-transform touch-manipulation sm:h-12 sm:w-12"
                aria-label={t.label}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-full border border-white/80 bg-[radial-gradient(circle_at_35%_30%,#c9d8fd,#94b2f6_75%)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.7),0_8px_16px_-8px_rgba(70,100,200,0.65)]"
                  />
                )}
                <span
                  className={`relative z-10 transition-colors ${active ? "text-[#3150a8]" : "text-[#5c6aa3] hover:text-sn-navy"}`}
                >
                  {t.icon}
                  {dot && !active && (
                    <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[color:var(--hug)] shadow-[0_0_6px_var(--hug)]" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
