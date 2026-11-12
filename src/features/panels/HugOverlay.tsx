import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { pinStorage } from "@/features/pin/pin-utils";

interface HugEvent {
  id: string;
  senderName: string;
  senderSlot: "a" | "b";
}

interface Petal {
  id: number;
  x: number;
  delay: number;
  size: number;
  rotation: number;
}

export function HugOverlay({ relationshipId }: { relationshipId: string }) {
  const [activeHug, setActiveHug] = useState<HugEvent | null>(null);
  const [petals, setPetals] = useState<Petal[]>([]);
  const currentSlot = pinStorage.getSlot();

  useEffect(() => {
    if (!relationshipId) return;

    const channelId = `hugs:${relationshipId}-${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "hugs",
          filter: `relationship_id=eq.${relationshipId}`,
        },
        async (payload) => {
          const hugId = (payload.new as { id: string; sender_id?: string }).id;

          // Fetch sender details
          const { data: rel } = await supabase
            .from("relationships")
            .select("name_a, name_b, user_a_id, user_b_id")
            .eq("id", relationshipId)
            .single();

          let senderName = "Your Love";
          let senderSlot: "a" | "b" = "a";

          if (rel) {
            const isUserA = (payload.new as any).sender_id === rel.user_a_id;
            senderSlot = isUserA ? "a" : "b";
            senderName = isUserA ? rel.name_a || "Sean" : rel.name_b || "Aya";
          }

          // Trigger Heartbeat Haptic Pattern on supported mobile devices
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            // Heartbeat rhythm: thump-thump ... thump-thump
            navigator.vibrate([40, 90, 40, 200, 50, 100, 50]);
          }

          // Generate 16 floating watercolor petals
          const newPetals: Petal[] = Array.from({ length: 16 }, (_, i) => ({
            id: Date.now() + i,
            x: 10 + Math.random() * 80,
            delay: Math.random() * 0.8,
            size: 16 + Math.random() * 20,
            rotation: (Math.random() - 0.5) * 60,
          }));
          setPetals(newPetals);

          setActiveHug({ id: hugId, senderName, senderSlot });

          setTimeout(() => {
            setActiveHug(null);
            setPetals([]);
          }, 4500);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [relationshipId]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      <AnimatePresence>
        {activeHug && (
          <>
            {/* Ambient Radial Warm Glow Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0 bg-radial from-rose-500/20 via-pink-400/10 to-transparent backdrop-blur-[2px]"
            />

            {/* Floating Watercolor Lily Petals */}
            {petals.map((p) => (
              <motion.div
                key={p.id}
                initial={{
                  opacity: 0,
                  y: 120,
                  x: `${p.x}vw`,
                  rotate: p.rotation,
                  scale: 0.6,
                }}
                animate={{
                  opacity: [0, 0.85, 0.85, 0],
                  y: -window.innerHeight * 0.7,
                  x: `${p.x + (Math.random() - 0.5) * 12}vw`,
                  rotate: p.rotation + 180,
                  scale: 1,
                }}
                transition={{
                  duration: 3.8,
                  delay: p.delay,
                  ease: [0.2, 0.8, 0.2, 1],
                }}
                className="absolute top-1/2"
              >
                <img
                  src="/main-lily.png"
                  alt="lily petal"
                  style={{ width: p.size, height: p.size }}
                  className="object-contain drop-shadow-[0_4px_12px_rgba(244,114,182,0.3)] opacity-90"
                />
              </motion.div>
            ))}

            {/* Central Heart with Kowalski Spring Physics */}
            <motion.div
              key={activeHug.id}
              initial={{ scale: 0.2, opacity: 0, y: 30 }}
              animate={{
                scale: [0.2, 1.25, 1.08, 1.35, 1.15, 1],
                opacity: [0, 1, 1, 1, 1, 0],
                y: [30, -10, -5, -15, -10, -50],
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                duration: 4.2,
                times: [0, 0.2, 0.35, 0.55, 0.75, 1],
                ease: "easeInOut",
              }}
              className="relative flex flex-col items-center justify-center"
            >
              <div className="relative">
                <Heart
                  size={100}
                  fill="oklch(0.78 0.13 15)"
                  className="text-hug drop-shadow-[0_0_35px_oklch(0.78_0.13_15/0.7)]"
                />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="absolute -top-2 -right-2 text-amber-300"
                >
                  <Sparkles size={24} />
                </motion.div>
              </div>

              {/* Sender Inscription Card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
                className="mt-4 px-5 py-2 rounded-full border border-white/60 bg-white/80 dark:bg-black/60 backdrop-blur-xl shadow-lg flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span className="font-serif text-sm font-semibold text-foreground tracking-tight">
                  A warm hug from {activeHug.senderName}
                </span>
                <span className="text-xs text-muted-foreground">❤️</span>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
