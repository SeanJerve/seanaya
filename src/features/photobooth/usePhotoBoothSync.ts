import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FrameId, FilterId, PlacedSticker, PhotoCut } from "./types";

interface UsePhotoBoothSyncProps {
  relationshipId: string;
  userName: string;
  userSlot: "a" | "b";
  onTriggerShutter?: (cutIndex: number) => void;
}

export function usePhotoBoothSync({
  relationshipId,
  userName,
  userSlot,
  onTriggerShutter,
}: UsePhotoBoothSyncProps) {
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerName, setPartnerName] = useState<string>("Partner");
  const [selectedFrame, setSelectedFrame] = useState<FrameId>("lily-romance");
  const [selectedFilter, setSelectedFilter] = useState<FilterId>("pastel");
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [activeCutIndex, setActiveCutIndex] = useState<number>(0);
  const [cuts, setCuts] = useState<PhotoCut[]>([]);
  const [stickers, setStickers] = useState<PlacedSticker[]>([]);
  const [isShooting, setIsShooting] = useState(false);

  const channelRef = useRef<any>(null);
  const shutterCbRef = useRef(onTriggerShutter);
  shutterCbRef.current = onTriggerShutter;

  useEffect(() => {
    if (!relationshipId) return;

    const channelName = `photobooth-sync-${relationshipId}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: userSlot } },
    });
    channelRef.current = channel;

    // 1. Presence tracking
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const otherSlot = userSlot === "a" ? "b" : "a";
        const partnerPresence = state[otherSlot];
        if (partnerPresence && partnerPresence.length > 0) {
          setPartnerOnline(true);
          const p = partnerPresence[0] as any;
          if (p.name) setPartnerName(p.name);
        } else {
          setPartnerOnline(false);
        }
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        if (key !== userSlot) {
          setPartnerOnline(true);
          const p = newPresences[0] as any;
          if (p?.name) setPartnerName(p.name);
        }
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        if (key !== userSlot) {
          setPartnerOnline(false);
        }
      });

    // 2. Broadcast events
    channel
      .on("broadcast", { event: "frame_change" }, ({ payload }) => {
        setSelectedFrame(payload.frameId);
      })
      .on("broadcast", { event: "filter_change" }, ({ payload }) => {
        setSelectedFilter(payload.filterId);
      })
      .on("broadcast", { event: "start_countdown" }, ({ payload }) => {
        runSyncedCountdown(payload.cutIndex);
      })
      .on("broadcast", { event: "remote_cut_received" }, ({ payload }) => {
        setCuts((prev) => [...prev, payload.cut]);
      })
      .on("broadcast", { event: "stickers_update" }, ({ payload }) => {
        setStickers(payload.stickers);
      })
      .on("broadcast", { event: "reset_session" }, () => {
        setCuts([]);
        setStickers([]);
        setIsShooting(false);
        setCountdownValue(null);
      });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          name: userName,
          slot: userSlot,
          joinedAt: new Date().toISOString(),
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [relationshipId, userName, userSlot]);

  // Run synced countdown locally
  const runSyncedCountdown = (cutIdx: number) => {
    setIsShooting(true);
    setActiveCutIndex(cutIdx);
    setCountdownValue(3);

    const timer1 = setTimeout(() => setCountdownValue(2), 1000);
    const timer2 = setTimeout(() => setCountdownValue(1), 2000);
    const timer3 = setTimeout(() => {
      setCountdownValue(0); // 0 = Flash
      if (shutterCbRef.current) {
        shutterCbRef.current(cutIdx);
      }
      setTimeout(() => {
        setCountdownValue(null);
      }, 500);
    }, 3000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  };

  // Actions
  const broadcastFrame = (frameId: FrameId) => {
    setSelectedFrame(frameId);
    channelRef.current?.send({
      type: "broadcast",
      event: "frame_change",
      payload: { frameId },
    });
  };

  const broadcastFilter = (filterId: FilterId) => {
    setSelectedFilter(filterId);
    channelRef.current?.send({
      type: "broadcast",
      event: "filter_change",
      payload: { filterId },
    });
  };

  const startCountdown = (cutIndex: number = 0) => {
    runSyncedCountdown(cutIndex);
    channelRef.current?.send({
      type: "broadcast",
      event: "start_countdown",
      payload: { cutIndex },
    });
  };

  const broadcastCut = (cut: PhotoCut) => {
    setCuts((prev) => [...prev, cut]);
    channelRef.current?.send({
      type: "broadcast",
      event: "remote_cut_received",
      payload: { cut },
    });
  };

  const updateStickers = (updater: (prev: PlacedSticker[]) => PlacedSticker[]) => {
    setStickers((prev) => {
      const next = updater(prev);
      channelRef.current?.send({
        type: "broadcast",
        event: "stickers_update",
        payload: { stickers: next },
      });
      return next;
    });
  };

  const resetSession = () => {
    setCuts([]);
    setStickers([]);
    setIsShooting(false);
    setCountdownValue(null);
    channelRef.current?.send({
      type: "broadcast",
      event: "reset_session",
      payload: {},
    });
  };

  return {
    partnerOnline,
    partnerName,
    selectedFrame,
    selectedFilter,
    countdownValue,
    activeCutIndex,
    cuts,
    stickers,
    isShooting,
    broadcastFrame,
    broadcastFilter,
    startCountdown,
    broadcastCut,
    updateStickers,
    resetSession,
    setCuts,
  };
}
