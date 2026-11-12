import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LAYOUTS, type LayoutId, type Shot, type StyleId } from "./booth-templates";

type Slot = "a" | "b";

/**
 * Shared booth session over a realtime channel.
 *
 * Loop per shot: each of you taps Ready → when both are ready, A starts one shared
 * countdown → both devices capture at zero → each frame lands in the same shot →
 * Ready resets for the next one. Alone in the booth, your own Ready starts it.
 */
export function useBoothSession({
  relationshipId,
  slot,
  name,
  capture,
  onShotTaken,
}: {
  relationshipId: string;
  slot: Slot;
  name: string;
  capture: () => string | null;
  onShotTaken?: () => void;
}) {
  const other: Slot = slot === "a" ? "b" : "a";
  const [partnerHere, setPartnerHere] = useState(false);
  const [layout, setLayoutState] = useState<LayoutId>("strip");
  const [style, setStyleState] = useState<StyleId>("paper");
  const [filterId, setFilterState] = useState("soft");
  const [caption, setCaptionState] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const [shotIndex, setShotIndex] = useState(0);
  const [ready, setReadyState] = useState<Record<Slot, boolean>>({ a: false, b: false });
  const [countdown, setCountdown] = useState<number | null>(null);
  // Solo: shoot on your own, nothing is shared. Together: both must be here and ready.
  const [mode, setModeState] = useState<"solo" | "together">("together");
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // Whether this result has been kept in the album (shared so it isn't saved twice)
  const [kept, setKeptState] = useState(false);

  const channelRef = useRef<any>(null);
  const captureRef = useRef(capture);
  captureRef.current = capture;
  const takenRef = useRef(onShotTaken);
  takenRef.current = onShotTaken;
  const runningRef = useRef<number | null>(null);
  const stateRef = useRef({ shots, shotIndex, layout, style, filterId, caption });
  stateRef.current = { shots, shotIndex, layout, style, filterId, caption };

  // In solo mode only the mode itself is shared; everything else stays on this device.
  const send = (event: string, payload: Record<string, unknown> = {}) => {
    if (event !== "mode" && modeRef.current === "solo") return;
    channelRef.current?.send({ type: "broadcast", event, payload: { ...payload, from: slot } });
  };
  const ignoring = (payload: { from: Slot }) => payload.from === slot || modeRef.current === "solo";

  const putFrame = (index: number, who: Slot, dataUrl: string) =>
    setShots((prev) => {
      const next = [...prev];
      next[index] = { ...(next[index] ?? {}), [who]: dataUrl };
      return next;
    });

  // One countdown, started at the same moment on both screens.
  const runCountdown = useCallback((index: number, startAt: number) => {
    if (runningRef.current === index) return;
    runningRef.current = index;
    const at = (ms: number, fn: () => void) => setTimeout(fn, Math.max(0, startAt + ms - Date.now()));
    at(0, () => setCountdown(3));
    at(1000, () => setCountdown(2));
    at(2000, () => setCountdown(1));
    at(3000, () => {
      setCountdown(0);
      const frame = captureRef.current();
      if (frame) {
        putFrame(index, slot, frame);
        send("frame", { index, dataUrl: frame });
      }
      setReadyState({ a: false, b: false });
      setShotIndex(index + 1);
      takenRef.current?.();
      setTimeout(() => setCountdown(null), 450);
      runningRef.current = null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot]);

  useEffect(() => {
    if (!relationshipId) return;
    const ch = supabase.channel(`photobooth-session-${relationshipId}`, {
      config: { presence: { key: slot } },
    });
    channelRef.current = ch;

    const syncPresence = () => setPartnerHere((ch.presenceState()[other]?.length ?? 0) > 0);

    ch.on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, () => {
        syncPresence();
        setReadyState((r) => ({ ...r, [other]: false }));
      })
      .on("broadcast", { event: "ready" }, ({ payload }) => {
        if (ignoring(payload)) return;
        setReadyState((r) => ({ ...r, [payload.from]: payload.ready }));
      })
      .on("broadcast", { event: "countdown" }, ({ payload }) => {
        if (ignoring(payload)) return;
        runCountdown(payload.index, payload.startAt);
      })
      .on("broadcast", { event: "frame" }, ({ payload }) => {
        if (ignoring(payload)) return;
        putFrame(payload.index, payload.from, payload.dataUrl);
        // If we missed this countdown, catch up and clear stale ready flags.
        setShotIndex((i) => {
          if (payload.index + 1 > i) setReadyState({ a: false, b: false });
          return Math.max(i, payload.index + 1);
        });
      })
      .on("broadcast", { event: "settings" }, ({ payload }) => {
        if (ignoring(payload)) return;
        if (payload.layout) setLayoutState(payload.layout);
        if (payload.style) setStyleState(payload.style);
        if (payload.filterId) setFilterState(payload.filterId);
        if (typeof payload.caption === "string") setCaptionState(payload.caption);
      })
      .on("broadcast", { event: "kept" }, ({ payload }) => {
        if (ignoring(payload)) return;
        setKeptState(true);
      })
      .on("broadcast", { event: "mode" }, ({ payload }) => {
        if (payload.from === slot) return;
        setModeState(payload.mode);
        setShots([]);
        setShotIndex(0);
        setKeptState(false);
        setReadyState({ a: false, b: false });
      })
      .on("broadcast", { event: "reset" }, ({ payload }) => {
        if (ignoring(payload)) return;
        setKeptState(false);
        setShots([]);
        setShotIndex(0);
        setReadyState({ a: false, b: false });
      })
      // Someone (re)joined: share settings and the frames already taken.
      .on("broadcast", { event: "hello" }, ({ payload }) => {
        if (payload.from === slot) return;
        send("mode", { mode: modeRef.current });
        const s = stateRef.current;
        send("settings", { layout: s.layout, style: s.style, filterId: s.filterId, caption: s.caption });
        s.shots.forEach((shot, index) => {
          const mine = shot?.[slot];
          if (mine) send("frame", { index, dataUrl: mine });
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({ name, at: Date.now() });
          send("hello");
        }
      });

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationshipId, slot]);

  const total = LAYOUTS[layout].shots;
  const done = shotIndex >= total;

  // Start the countdown once everyone present is ready. A leads when both are here.
  useEffect(() => {
    if (done || countdown !== null || runningRef.current !== null) return;
    const together = mode === "together";
    const allReady = together ? partnerHere && ready.a && ready.b : ready[slot];
    const leader = together ? slot === "a" : true;
    if (allReady && leader) {
      const startAt = Date.now() + 350;
      send("countdown", { index: shotIndex, startAt });
      runCountdown(shotIndex, startAt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, partnerHere, done, countdown, shotIndex, mode]);

  // Broadcasts are best-effort: keep re-announcing Ready until the countdown starts.
  useEffect(() => {
    if (!ready[slot] || countdown !== null || done) return;
    const t = setInterval(() => send("ready", { ready: true }), 1500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready[slot], countdown, done]);

  const setReady = (v: boolean) => {
    setReadyState((r) => ({ ...r, [slot]: v }));
    send("ready", { ready: v });
  };

  const setLayout = (l: LayoutId) => {
    setLayoutState(l);
    send("settings", { layout: l });
  };
  const setStyle = (s: StyleId) => {
    setStyleState(s);
    send("settings", { style: s });
  };
  const setFilter = (f: string) => {
    setFilterState(f);
    send("settings", { filterId: f });
  };

  const setCaption = (c: string) => {
    setCaptionState(c);
    send("settings", { caption: c });
  };

  const setMode = (m: "solo" | "together") => {
    setModeState(m);
    modeRef.current = m;
    setShots([]);
    setShotIndex(0);
    setKeptState(false);
    setReadyState({ a: false, b: false });
    send("mode", { mode: m });
  };

  const markKept = () => {
    setKeptState(true);
    send("kept");
  };

  const reset = () => {
    setKeptState(false);
    setShots([]);
    setShotIndex(0);
    setReadyState({ a: false, b: false });
    send("reset");
  };

  return {
    partnerHere,
    mode,
    setMode,
    kept,
    markKept,
    layout,
    style,
    filterId,
    caption,
    setCaption,
    shots,
    shotIndex,
    total,
    done,
    ready,
    meReady: ready[slot],
    partnerReady: ready[other],
    countdown,
    setReady,
    setLayout,
    setStyle,
    setFilter,
    reset,
  };
}
