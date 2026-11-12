import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseWebRTCOptions {
  relationshipId: string;
  userSlot: "a" | "b";
  enabled: boolean;
}

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

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
      if (pc.connectionState === "connected") setPeerConnected(true);
      // "disconnected" often recovers on its own; only drop the stream when it's really gone.
      if (pc.connectionState === "disconnected") setPeerConnected(false);
      if (pc.connectionState === "failed" || pc.connectionState === "closed") dropRemote();
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
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const scale = Math.min(1, 640 / Math.max(vw, vh));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    if (isMirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.78);
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
