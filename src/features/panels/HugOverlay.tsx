import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/useUser";
import { useCoupleNames } from "@/hooks/useCouple";
import { ChibiTile, chibiFor } from "@/components/seanaya/art";
import { burstHearts } from "@/components/seanaya/HeartBurst";

type Petal = { id: number; x: number; drift: number; delay: number; size: number; rot: number; src: string };

const PETALS = ["/art/petal-1.png", "/art/petal-2.png", "/art/petal-3.png"];

/** When your partner sends a hug: the two of you bump together and a heart pops out. */
export function HugOverlay({ relationshipId }: { relationshipId: string }) {
  const { user } = useUser();
  const { me, partner } = useCoupleNames();
  const reduce = useReducedMotion();
  const [hugId, setHugId] = useState<string | null>(null);
  const [petals, setPetals] = useState<Petal[]>([]);
  const userIdRef = useRef<string | undefined>(user?.id);
  userIdRef.current = user?.id;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const centerRef = useRef<HTMLDivElement | null>(null);

  const close = () => {
    if (timer.current) clearTimeout(timer.current);
    setHugId(null);
    setPetals([]);
  };

  const show = (id: string) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([40, 90, 40, 200, 50, 100, 50]);
    setPetals(
      Array.from({ length: 12 }, (_, i) => ({
        id: Date.now() + i,
        x: 4 + Math.random() * 92,
        drift: (Math.random() - 0.5) * 18,
        delay: Math.random() * 1.2,
        size: 14 + Math.random() * 14,
        rot: (Math.random() - 0.5) * 90,
        src: PETALS[i % PETALS.length],
      })),
    );
    setHugId(id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(close, 4200);
  };
  const showRef = useRef(show);
  showRef.current = show;

  // Local development only: lets the hug be previewed without a second phone.
  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    (window as any).__previewHug = () => showRef.current(`preview-${Date.now()}`);
  }, []);

  useEffect(() => {
    if (!relationshipId) return;
    const channel = supabase
      .channel(`hug-overlay-${relationshipId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "hugs", filter: `relationship_id=eq.${relationshipId}` },
        (payload) => {
          const row = payload.new as { id: string; sender_id?: string };
          // Your own hug already got its hearts on the button.
          if (row.sender_id && row.sender_id === userIdRef.current) return;
          showRef.current(row.id);
        },
      )
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [relationshipId]);

  return (
    <AnimatePresence>
      {hugId && (
        <motion.div
          key={hugId}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: "none" }}
          transition={{ duration: 0.45 }}
          onClick={close}
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_46%,rgba(255,221,234,0.75),rgba(214,224,250,0.45)_48%,rgba(205,217,248,0.2)_75%)] backdrop-blur-[3px]"
        >
          {!reduce &&
            petals.map((p) => (
              <motion.img
                key={p.id}
                src={p.src}
                alt=""
                aria-hidden
                initial={{ y: "-8vh", x: `${p.x}vw`, rotate: p.rot, opacity: 0 }}
                animate={{ y: "108vh", x: `${p.x + p.drift}vw`, rotate: p.rot + 220, opacity: [0, 1, 1, 0.8] }}
                transition={{ duration: 4.4, delay: p.delay, ease: "linear" }}
                style={{ width: p.size, height: p.size, position: "absolute", left: 0, top: 0 }}
              />
            ))}

          <div ref={centerRef} className="relative flex flex-col items-center">
            {/* The heart that pops out of the hug */}
            <motion.img
              src="/art/clay-heart.png"
              alt=""
              aria-hidden
              initial={{ scale: 0, y: 30, opacity: 0 }}
              animate={{ scale: [0, 1.25, 1], y: [30, -6, 0], opacity: 1 }}
              transition={{ delay: reduce ? 0 : 0.62, duration: 0.55, ease: "easeOut" }}
              onAnimationComplete={() => {
                if (!reduce && centerRef.current) {
                  const r = centerRef.current.getBoundingClientRect();
                  burstHearts({ x: r.left + r.width / 2, y: r.top + 40 }, 9);
                }
              }}
              className="relative z-10 mb-[-18px] h-[76px] w-[76px] drop-shadow-[0_10px_18px_rgba(236,122,164,0.45)]"
            />

            <div className="flex items-end">
              <motion.div
                initial={reduce ? { opacity: 0 } : { x: -110, rotate: -10, opacity: 0 }}
                animate={
                  reduce
                    ? { opacity: 1 }
                    : { x: [-110, 10, 2], rotate: [-10, 8, 5], opacity: 1, scaleX: [1, 0.94, 1] }
                }
                transition={{ duration: 0.75, times: [0, 0.75, 1], ease: "easeOut" }}
                className="relative z-[1]"
              >
                <ChibiTile src={chibiFor(partner)} alt={partner} className="h-[132px] w-[116px]" />
              </motion.div>
              <motion.div
                initial={reduce ? { opacity: 0 } : { x: 110, rotate: 10, opacity: 0 }}
                animate={
                  reduce
                    ? { opacity: 1 }
                    : { x: [110, -10, -2], rotate: [10, -8, -5], opacity: 1, scaleX: [1, 0.94, 1] }
                }
                transition={{ duration: 0.75, times: [0, 0.75, 1], ease: "easeOut" }}
              >
                <ChibiTile src={chibiFor(me)} alt={me} className="h-[132px] w-[116px]" />
              </motion.div>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0.1 : 0.9, duration: 0.4 }}
              className="sn-hand mt-5 text-[34px] leading-none text-sn-navy drop-shadow-[0_2px_8px_rgba(255,255,255,0.9)]"
            >
              a hug from {partner}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
