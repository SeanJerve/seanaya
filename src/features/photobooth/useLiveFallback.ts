import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { grabPortrait } from "./useWebRTC";

/**
 * Backup live view of each other.
 *
 * Direct phone-to-phone video (WebRTC) often can't connect on mobile data. When it
 * hasn't, each phone sends a small, frequently refreshed picture of its camera through
 * the app's realtime channel, so you still see each other moving while you pose.
 */
export function useLiveFallback({
  relationshipId,
  slot,
  send: shouldSend,
  videoRef,
  mirror,
}: {
  relationshipId: string;
  slot: "a" | "b";
  /** Send my camera (when the partner is here and direct video isn't connected). */
  send: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mirror: boolean;
}) {
  const [partnerFrame, setPartnerFrame] = useState<string | null>(null);
  const [lastAt, setLastAt] = useState(0);
  const channelRef = useRef<any>(null);
  const mirrorRef = useRef(mirror);
  mirrorRef.current = mirror;

  useEffect(() => {
    if (!relationshipId) return;
    const ch = supabase.channel(`photobooth-live-${relationshipId}`, {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "frame" }, ({ payload }) => {
      if (payload?.from === slot || typeof payload?.img !== "string") return;
      setPartnerFrame(payload.img);
      setLastAt(Date.now());
    }).subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [relationshipId, slot]);

  useEffect(() => {
    if (!shouldSend) return;
    const t = setInterval(() => {
      const v = videoRef.current;
      if (!v || document.visibilityState !== "visible") return;
      // Unmirrored, like real video: your partner sees you the right way round.
      const img = grabPortrait(v, 260, false, 0.55);
      if (img)
        channelRef.current?.send({
          type: "broadcast",
          event: "frame",
          payload: { from: slot, img },
        });
    }, 220);
    return () => clearInterval(t);
  }, [shouldSend, slot, videoRef]);

  // Stale after a couple of seconds without a new picture.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const fresh = !!partnerFrame && now - lastAt < 2500;

  return { partnerFrame: fresh ? partnerFrame : null };
}
