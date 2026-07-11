import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function HugOverlay({ relationshipId }: { relationshipId: string }) {
  const [hearts, setHearts] = useState<{ id: string }[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel(`hugs:${relationshipId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "hugs", filter: `relationship_id=eq.${relationshipId}` },
        (payload) => {
          const id = (payload.new as { id: string }).id;
          setHearts((h) => [...h, { id }]);
          setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 3500);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [relationshipId]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <AnimatePresence>
        {hearts.map((h) => (
          <motion.div
            key={h.id}
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 0], y: [-20, -140] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3, ease: "easeOut" }}
            className="absolute"
          >
            <Heart size={72} fill="oklch(0.78 0.13 15)" className="text-hug drop-shadow-[0_0_18px_oklch(0.78_0.13_15/0.45)]" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
