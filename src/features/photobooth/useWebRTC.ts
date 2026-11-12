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
  { urls: "stun:stun2.l.google.com:19302" },
];

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

  // 1. Initialize local camera
  const startCamera = useCallback(async () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false, // booth is visual camera
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCameraError(null);

      // If peer connection exists, update tracks
      if (pcRef.current) {
        const senders = pcRef.current.getSenders();
        const videoTrack = stream.getVideoTracks()[0];
        const videoSender = senders.find((s) => s.track?.kind === "video");
        if (videoSender && videoTrack) {
          videoSender.replaceTrack(videoTrack);
        } else if (videoTrack) {
          pcRef.current.addTrack(videoTrack, stream);
        }
      }
    } catch (err: any) {
      console.error("[WebRTC] Camera access failed:", err);
      setCameraError(
        err.name === "NotAllowedError" ? "Camera permission denied" : "Could not open camera",
      );
    }
  }, [facingMode]);

  useEffect(() => {
    if (!enabled) return;
    startCamera();
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [enabled, startCamera]);

  // 2. Setup WebRTC PeerConnection & Supabase Realtime Signaling
  useEffect(() => {
    if (!enabled || !relationshipId) return;

    const channelName = `photobooth-signaling-${relationshipId}`;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      setPeerConnected(pc.connectionState === "connected");
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channel.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: { candidate: event.candidate, sender: userSlot },
        });
      }
    };

    // Listen for signaling events
    channel
      .on("broadcast", { event: "webrtc-offer" }, async ({ payload }) => {
        if (payload.sender === userSlot) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: "broadcast",
            event: "webrtc-answer",
            payload: { answer, sender: userSlot },
          });
        } catch (e) {
          console.error("[WebRTC] Error handling offer:", e);
        }
      })
      .on("broadcast", { event: "webrtc-answer" }, async ({ payload }) => {
        if (payload.sender === userSlot) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        } catch (e) {
          console.error("[WebRTC] Error handling answer:", e);
        }
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.sender === userSlot) return;
        try {
          if (payload.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          }
        } catch (e) {
          console.error("[WebRTC] Error adding ICE candidate:", e);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && userSlot === "a") {
          // Slot 'a' initiates offer when camera is ready
          try {
            if (localStreamRef.current) {
              localStreamRef.current.getTracks().forEach((track) => {
                pc.addTrack(track, localStreamRef.current!);
              });
            }
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channel.send({
              type: "broadcast",
              event: "webrtc-offer",
              payload: { offer, sender: userSlot },
            });
          } catch (e) {
            console.error("[WebRTC] Failed to send offer:", e);
          }
        }
      });

    return () => {
      pc.close();
      supabase.removeChannel(channel);
    };
  }, [enabled, relationshipId, userSlot]);

  // Frame capture helper from local video element
  const captureLocalFrame = (videoEl: HTMLVideoElement): string => {
    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth || 640;
    canvas.height = videoEl.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    if (isMirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const toggleMirror = () => {
    setIsMirror((prev) => !prev);
  };

  return {
    localStream,
    remoteStream,
    peerConnected,
    cameraError,
    facingMode,
    isMirror,
    toggleFacingMode,
    toggleMirror,
    captureLocalFrame,
    startCamera,
  };
}
