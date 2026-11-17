import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseWebRTCOptions {
  relationshipId: string;
  userSlot: "a" | "b";
  enabled: boolean;
}

/**
 * STUN finds a direct path between the phones. On mobile data that path is often
 * blocked, so a TURN relay is needed for live video: set VITE_TURN_URLS (comma
 * separated), VITE_TURN_USERNAME and VITE_TURN_CREDENTIAL in the hosting settings.
 */
const turnUrls = (import.meta.env.VITE_TURN_URLS as string | undefined)
  ?.split(",")
  .map((u) => u.trim())
  .filter(Boolean);
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: "stun:stun.cloudflare.com:3478" },
  ...(turnUrls?.length
    ? [
        {
          urls: turnUrls,
          username: import.meta.env.VITE_TURN_USERNAME as string,
          credential: import.meta.env.VITE_TURN_CREDENTIAL as string,
        },
      ]
    : []),
];
export const HAS_TURN = !!turnUrls?.length;

/**
 * Live two-way camera between the two booth pages.
 *
 * Handshake: each side says "hello" when it joins; slot A answers any hello with a
 * fresh offer, so it works whichever of you opens the booth first, and reconnects
 * when one of you leaves and comes back.
 */
export function useWebRTC({ relationshipId, userSlot, enabled }: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnected, setPeerConnected] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isMirror, setIsMirror] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const wantOffer = useRef(false);
  const partnerSeen = useRef(false);
  const camGen = useRef(0);
  const mounted = useRef(true);
  // Reconnect on its own when the call drops or never gets through.
  const retryRef = useRef<() => void>(() => {});
  const retries = useRef(0);
  const dropTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const send = (event: string, payload: Record<string, unknown>) =>
    channelRef.current?.send({
      type: "broadcast",
      event,
      payload: { ...payload, sender: userSlot },
    });

  const dropRemote = () => {
    setRemoteStream(null);
    setPeerConnected(false);
  };

  const makePc = useCallback(() => {
    pcRef.current?.close();
    pendingIce.current = [];
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) return;
      if (dropTimer.current) clearTimeout(dropTimer.current);
      if (pc.connectionState === "connected") {
        retries.current = 0;
        setPeerConnected(true);
      }
      // "disconnected" often recovers on its own; give it a few seconds, then redial.
      if (pc.connectionState === "disconnected") {
        setPeerConnected(false);
        dropTimer.current = setTimeout(() => retryRef.current(), 5000);
      }
      if (pc.connectionState === "failed") {
        dropRemote();
        retryRef.current();
      }
      if (pc.connectionState === "closed") dropRemote();
    };
    pc.ontrack = (e) => {
      if (e.streams?.[0]) setRemoteStream(e.streams[0]);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) send("ice-candidate", { candidate: e.candidate.toJSON() });
    };
    const stream = localStreamRef.current;
    stream?.getTracks().forEach((t) => pc.addTrack(t, stream));
    pcRef.current = pc;
    return pc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSlot]);

  const flushIce = async (pc: RTCPeerConnection) => {
    for (const c of pendingIce.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        /* stale candidate */
      }
    }
    pendingIce.current = [];
  };

  const sendOffer = useCallback(async () => {
    if (!localStreamRef.current) {
      wantOffer.current = true;
      return;
    }
    wantOffer.current = false;
    const pc = makePc();
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send("webrtc-offer", { offer });
    } catch (e) {
      console.error("[booth] offer failed", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [makePc]);

  // Redial with a short backoff: A makes a fresh offer, B asks A for one.
  retryRef.current = () => {
    if (!partnerSeen.current || retries.current >= 6) return;
    const n = ++retries.current;
    setTimeout(() => {
      if (!mounted.current || !partnerSeen.current) return;
      if (pcRef.current?.connectionState === "connected") return;
      if (userSlot === "a") sendOffer();
      else send("hello", { reply: false });
    }, 800 * n);
  };

  const startCamera = useCallback(async () => {
    const gen = ++camGen.current;
    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      // Left the booth (or flipped the camera again) while the permission prompt was up.
      if (gen !== camGen.current || !mounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCameraError(null);

      const pc = pcRef.current;
      const track = stream.getVideoTracks()[0];
      const sender = pc?.getSenders().find((s) => s.track?.kind === "video");
      if (sender && track) sender.replaceTrack(track);
      else if (userSlot === "a" && (wantOffer.current || partnerSeen.current)) sendOffer();
      // B can't offer; ask A to renegotiate now that there's a camera to send.
      else if (userSlot === "b" && partnerSeen.current) send("hello", { reply: true });
    } catch (err: any) {
      if (gen !== camGen.current || !mounted.current) return;
      setCameraError(err?.name === "NotAllowedError" ? "denied" : "unavailable");
    }
  }, [facingMode, userSlot, sendOffer]);

  useEffect(() => {
    if (!enabled) return;
    startCamera();
    return () => {
      camGen.current++;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, [enabled, startCamera]);

  useEffect(() => {
    if (!enabled || !relationshipId) return;
    const channel = supabase.channel(`photobooth-signaling-${relationshipId}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "hello" }, ({ payload }) => {
        if (payload.sender === userSlot) return;
        partnerSeen.current = true;
        if (userSlot === "a") sendOffer();
        else if (!payload.reply) send("hello", { reply: true });
      })
      .on("broadcast", { event: "bye" }, ({ payload }) => {
        if (payload.sender === userSlot) return;
        partnerSeen.current = false;
        pcRef.current?.close();
        pcRef.current = null;
        dropRemote();
      })
      .on("broadcast", { event: "webrtc-offer" }, async ({ payload }) => {
        if (payload.sender === userSlot) return;
        partnerSeen.current = true;
        const pc = makePc();
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          await flushIce(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          send("webrtc-answer", { answer });
        } catch (e) {
          console.error("[booth] answer failed", e);
        }
      })
      .on("broadcast", { event: "webrtc-answer" }, async ({ payload }) => {
        if (payload.sender === userSlot) return;
        const pc = pcRef.current;
        if (!pc || pc.signalingState !== "have-local-offer") return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
          await flushIce(pc);
        } catch (e) {
          console.error("[booth] set answer failed", e);
        }
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.sender === userSlot || !payload.candidate) return;
        const pc = pcRef.current;
        if (pc?.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch {
            /* ignore */
          }
        } else pendingIce.current.push(payload.candidate);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") send("hello", { reply: false });
      });

    const onLeave = () => send("bye", {});
    window.addEventListener("pagehide", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      send("bye", {});
      pcRef.current?.close();
      pcRef.current = null;
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, relationshipId, userSlot]);

  /** Grab the current frame, scaled down so it travels over realtime. */
  const captureLocalFrame = (videoEl: HTMLVideoElement): string => {
    // Not playing yet: a blank frame isn't a photo.
    if (!videoEl.videoWidth || videoEl.readyState < 2) return "";
    // Portrait 2:3, cut from the middle: exactly what the camera tile shows.
    return grabPortrait(videoEl, 600, isMirror, 0.8);
  };

  return {
    localStream,
    remoteStream,
    peerConnected,
    cameraError,
    facingMode,
    isMirror,
    toggleFacingMode: () => setFacingMode((p) => (p === "user" ? "environment" : "user")),
    toggleMirror: () => setIsMirror((p) => !p),
    captureLocalFrame,
    startCamera,
  };
}

/** A centred portrait (2:3) crop of the current video frame, as a JPEG data URL. */
export function grabPortrait(
  videoEl: HTMLVideoElement,
  outH: number,
  mirror: boolean,
  quality: number,
): string {
  if (!videoEl.videoWidth || videoEl.readyState < 2) return "";
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  const target = 2 / 3;
  let sw = vw;
  let sh = vh;
  if (vw / vh > target) sw = Math.round(vh * target);
  else sh = Math.round(vw / target);
  const sx = Math.round((vw - sw) / 2);
  const sy = Math.round((vh - sh) / 2);
  const h = Math.min(outH, sh);
  const w = Math.round(h * target);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}
