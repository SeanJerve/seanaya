import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LAYOUTS, type LayoutId, type Shot, type StyleId } from "./booth-templates";

type Slot = "a" | "b";
type Mode = "solo" | "together";

/**
 * Shared booth session over a realtime channel.
 *
 * Loop per shot: each of you taps Ready → when both are ready, A starts one shared
 * countdown → both devices capture at zero → each frame lands in the same shot →
 * Ready resets for the next one. In Solo, your own Ready starts it and nothing is shared.
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
  const [mode, setModeState] = useState<Mode>("together");
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // Whether this result has been kept in the album (shared so it isn't saved twice)
  const [kept, setKeptState] = useState(false);
  const [partnerKeeping, setPartnerKeeping] = useState(false);
  const keptRef = useRef(kept);
  keptRef.current = kept;
  // Bumped whenever the shoot starts over, so late async work can tell it's stale.
  const genRef = useRef(0);
  const claimRef = useRef<{ gen: number; lost: boolean } | null>(null);

  const channelRef = useRef<any>(null);
  const captureRef = useRef(capture);
  captureRef.current = capture;
  const takenRef = useRef(onShotTaken);
  takenRef.current = onShotTaken;
  const runningRef = useRef<number | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
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

  const cancelCountdown = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    runningRef.current = null;
    setCountdown(null);
  };

  const startOver = () => {
    genRef.current += 1;
    claimRef.current = null;
    cancelCountdown();
    setKeptState(false);
    setPartnerKeeping(false);
    setShots([]);
    setShotIndex(0);
    setReadyState({ a: false, b: false });
  };

  // One countdown. Each device times it from when it hears about it (no clock comparison
  // between phones), so both capture within a network hop of each other.
  const runCountdown = useCallback(
    (index: number, delayMs: number) => {
      if (runningRef.current === index) return;
      runningRef.current = index;
      const gen = genRef.current;
      const at = (ms: number, fn: () => void) => {
        timersRef.current.push(
          setTimeout(
            () => {
              if (gen === genRef.current) fn();
            },
            Math.max(0, delayMs + ms),
          ),
        );
      };
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
        setShotIndex((i) => Math.max(i, index + 1));
        takenRef.current?.();
        runningRef.current = null;
      });
      at(3450, () => {
        setCountdown(null);
        timersRef.current = [];
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [slot],
  );

  useEffect(() => {
    if (!relationshipId) return;
    const ch = supabase.channel(`photobooth-session-${relationshipId}`, {
      config: { presence: { key: slot } },
    });
    channelRef.current = ch;

    const syncPresence = () => setPartnerHere((ch.presenceState()[other]?.length ?? 0) > 0);
    const replayTimers: ReturnType<typeof setTimeout>[] = [];

    ch.on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, () => {
        syncPresence();
        setReadyState((r) => ({ ...r, [other]: false }));
        setPartnerKeeping(false);
      })
      .on("broadcast", { event: "ready" }, ({ payload }) => {
        if (ignoring(payload)) return;
        // A Ready meant for an earlier shot must not start the next one.
        if (typeof payload.index === "number" && payload.index !== stateRef.current.shotIndex)
          return;
        setReadyState((r) => ({ ...r, [payload.from]: payload.ready }));
      })
      .on("broadcast", { event: "countdown" }, ({ payload }) => {
        if (ignoring(payload)) return;
        if (payload.index < stateRef.current.shotIndex) return;
        runCountdown(payload.index, typeof payload.delayMs === "number" ? payload.delayMs : 0);
      })
      .on("broadcast", { event: "frame" }, ({ payload }) => {
        if (ignoring(payload)) return;
        if (payload.index >= LAYOUTS[stateRef.current.layout].shots) return;
        putFrame(payload.index, payload.from, payload.dataUrl);
        // If we missed this countdown, catch up and clear stale ready flags.
        setShotIndex((i) => {
          if (payload.index + 1 > i) setReadyState({ a: false, b: false });
          return Math.max(i, payload.index + 1);
        });
      })
      .on("broadcast", { event: "settings" }, ({ payload }) => {
        if (ignoring(payload)) return;
        if (payload.layout && payload.layout !== stateRef.current.layout) {
          setLayoutState(payload.layout);
          setKeptState(false);
        }
        if (payload.style) setStyleState(payload.style);
        if (payload.filterId) setFilterState(payload.filterId);
        if (typeof payload.caption === "string") setCaptionState(payload.caption);
      })
      .on("broadcast", { event: "keeping" }, ({ payload }) => {
        if (ignoring(payload)) return;
        setPartnerKeeping(true);
        // Both tapped Keep at once: A's save wins.
        if (claimRef.current && slot === "b") claimRef.current.lost = true;
      })
      .on("broadcast", { event: "keep-failed" }, ({ payload }) => {
        if (ignoring(payload)) return;
        setPartnerKeeping(false);
      })
      .on("broadcast", { event: "kept" }, ({ payload }) => {
        if (ignoring(payload)) return;
        setPartnerKeeping(false);
        setKeptState(true);
      })
      .on("broadcast", { event: "mode" }, ({ payload }) => {
        if (payload.from === slot || payload.mode === modeRef.current) return;
        // Never wipe a shoot that's under way because the other phone changed modes.
        if (stateRef.current.shotIndex > 0 || runningRef.current !== null) return;
        modeRef.current = payload.mode;
        setModeState(payload.mode);
        startOver();
        if (payload.mode === "together" && slot === "a") {
          const s = stateRef.current;
          send("settings", {
            layout: s.layout,
            style: s.style,
            filterId: s.filterId,
            caption: s.caption,
          });
        }
      })
      .on("broadcast", { event: "reset" }, ({ payload }) => {
        if (ignoring(payload)) return;
        startOver();
      })
      // Someone (re)joined: share settings and the frames already taken.
      .on("broadcast", { event: "hello" }, ({ payload }) => {
        if (payload.from === slot) return;
        send("mode", { mode: modeRef.current });
        if (modeRef.current === "solo") return;
        const s = stateRef.current;
        if (slot === "a" || s.shotIndex > 0) {
          send("settings", {
            layout: s.layout,
            style: s.style,
            filterId: s.filterId,
            caption: s.caption,
          });
        }
        // Space the frames out so a rejoin doesn't flood the channel.
        s.shots.forEach((shot, index) => {
          const mine = shot?.[slot];
          if (mine)
            replayTimers.push(
              setTimeout(() => send("frame", { index, dataUrl: mine }), 250 * (index + 1)),
            );
        });
        if (keptRef.current) send("kept");
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({ name, at: Date.now() });
          send("hello");
        }
      });

    return () => {
      replayTimers.forEach(clearTimeout);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      runningRef.current = null;
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
      send("countdown", { index: shotIndex, delayMs: 250 });
      runCountdown(shotIndex, 350);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, partnerHere, done, countdown, shotIndex, mode]);

  // Broadcasts are best-effort: keep re-announcing Ready until the countdown starts.
  useEffect(() => {
    if (!ready[slot] || countdown !== null || done) return;
    const t = setInterval(() => send("ready", { ready: true, index: shotIndex }), 1500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready[slot], countdown, done, shotIndex]);

  const setReady = (v: boolean) => {
    setReadyState((r) => ({ ...r, [slot]: v }));
    send("ready", { ready: v, index: shotIndex });
  };

  const setLayout = (l: LayoutId) => {
    if (l === layout) return;
    setLayoutState(l);
    setKeptState(false);
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

  // Typing a caption shouldn't fire a broadcast per keystroke.
  const captionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setCaption = (c: string) => {
    setCaptionState(c);
    if (captionTimer.current) clearTimeout(captionTimer.current);
    captionTimer.current = setTimeout(() => send("settings", { caption: c }), 300);
  };
  useEffect(
    () => () => {
      if (captionTimer.current) clearTimeout(captionTimer.current);
    },
    [],
  );

  const setMode = (m: Mode) => {
    if (m === modeRef.current) return;
    modeRef.current = m;
    setModeState(m);
    startOver();
    send("mode", { mode: m });
    if (m === "together" && slot === "a") {
      const s = stateRef.current;
      send("settings", {
        layout: s.layout,
        style: s.style,
        filterId: s.filterId,
        caption: s.caption,
      });
    }
  };

  /**
   * Claim the save before uploading so the two of you can't both keep the same shoot.
   * Resolves with a token for markKept, or null if your partner is already keeping it.
   */
  const claimKeep = async (): Promise<number | null> => {
    if (keptRef.current || partnerKeeping) return null;
    const gen = genRef.current;
    claimRef.current = { gen, lost: false };
    if (modeRef.current === "together" && partnerHere) {
      send("keeping");
      await new Promise((r) => setTimeout(r, 450));
    }
    const claim = claimRef.current;
    if (!claim || claim.gen !== genRef.current || claim.lost) return null;
    return gen;
  };
  const markKept = (gen: number) => {
    claimRef.current = null;
    if (gen !== genRef.current) return;
    setKeptState(true);
    send("kept");
  };
  const keepFailed = () => {
    claimRef.current = null;
    send("keep-failed");
  };

  const reset = () => {
    startOver();
    send("reset");
  };

  return {
    partnerHere,
    mode,
    setMode,
    kept,
    partnerKeeping,
    claimKeep,
    markKept,
    keepFailed,
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
